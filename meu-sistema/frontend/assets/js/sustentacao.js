// assets/js/sustentacao.js
(function () {
    'use strict';

    // --- SHIMS p/ main.js esperar sem quebrar ---
    window.ensureDynamicStatusCards = window.ensureDynamicStatusCards || function () { /* no-op */ };

    // Mapa de rótulos -> chave (usado por main.js em alguns cenários)
    window.SUST_LABEL_TO_KEY = window.SUST_LABEL_TO_KEY || {
        'A desenvolver': 'a_desenvolver',
        'Em desenvolvimento': 'em_desenvolvimento',
        'Em homologação': 'em_homologacao',
        'Em testes': 'em_testes',
        'Pendente': 'pendente',
        'Suspenso': 'suspenso',
        'Concluídos': 'fechados',
        'Total': 'total'
    };


    // --- API base e shim de fetch (main.js)
    (function () {
        if (!window.API_ROOT) window.API_ROOT = 'http://localhost:5001/api';
        console.log('[MAIN] API_ROOT =', window.API_ROOT);

        const _fetch = window.fetch;
        window.fetch = function (input, init) {
            if (typeof input === 'string' && input.startsWith('/api/')) {
                // troca /api/... por http://localhost:5001/api/...
                input = window.API_ROOT + input.replace(/^\/api/, '');
            }
            return _fetch(input, init);
        };
    })();


    // gráficos
    let chartSustStatus = null;
    let chartSustProjetos = null;

    // cache de chamados (para abrir modal pelo número)
    let sustCache = [];
    // mantemos a lista "crua" e a filtrada
    let sustRaw = []; // dados originais carregados
    const norm = s => String(s ?? '')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().trim();

    // ===== EDICAO =====
    window.editarChamado = function (numero) {
        const ch = sustCache.find(c => String(c.numero) === String(numero));
        if (!ch) return;

        // preenche o form
        document.getElementById('editHiddenNumero').value = ch.numero ?? '';
        document.getElementById('editProjeto').value = ch.projeto ?? '';
        document.getElementById('editNumero').value = ch.numero ?? '';
        document.getElementById('editStatus').value = ch.status ?? 'Pendente';
        document.getElementById('editDev').value = ch.desenvolvedor ?? '';
        document.getElementById('editSolic').value = ch.solicitante ?? '';
        document.getElementById('editObs').value = ch.observacao ?? '';

        window.showModal && window.showModal('editChamadoModal');
    };

    // garante que o submit será ligado quando o form existir
    function attachEditHandler() {
        const form = document.getElementById('editChamadoForm');
        if (!form) return; // ainda não está no DOM

        // evita listeners duplicados
        if (form.__bound) return;
        form.__bound = true;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const numero = document.getElementById('editHiddenNumero').value.trim();

            const payload = {
                projeto: document.getElementById('editProjeto').value.trim(),
                status: document.getElementById('editStatus').value.trim(),
                desenvolvedor: document.getElementById('editDev').value.trim(),
                solicitante: document.getElementById('editSolic').value.trim(),
                observacao: document.getElementById('editObs').value.trim(),
                // se tiver campos extras:
                // descricao: document.getElementById('editDesc').value.trim(),
                // data_chamado: '2025-09-23T14:30'
            };
            // prepara confirmação
            window.__pendingEdit = { numero, payload };

            const msg = document.getElementById('confirmEditMessage');
            if (msg) msg.textContent = `Deseja salvar as alterações do chamado ${numero}?`;

            window.showModal && window.showModal('confirmEditModal');

            try {
                const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload) // <- usa o payload!
                });

                if (!resp.ok) {
                    const err = await resp.text();
                    throw new Error(`HTTP ${resp.status} - ${err}`);
                }

                hideModal('editChamadoModal');
                await loadSustentacao();
            } catch (err) {
                console.error('Falha ao salvar edição:', err);
                alert('Não foi possível salvar o chamado.');
            }
        });
    }
    window.cancelEdit = function () {
        window.__pendingEdit = null;
        hideModal && hideModal('confirmEditModal');
    };

    window.confirmEdit = async function () {
        const pen = window.__pendingEdit;
        if (!pen) {
            hideModal && hideModal('confirmEditModal');
            return;
        }

        try {
            const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(pen.numero)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pen.payload)
            });

            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(`HTTP ${resp.status} - ${err}`);
            }

            hideModal && hideModal('confirmEditModal');
            hideModal && hideModal('editChamadoModal');
            await loadSustentacao(); // recarrega tabela e gráficos
        } catch (err) {
            console.error('Falha ao salvar edição:', err);
            alert('Não foi possível salvar o chamado.');
        } finally {
            window.__pendingEdit = null;
        }
    };

    // liga quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', attachEditHandler);

    // e tente de novo caso este arquivo carregue antes do modal ser renderizado
    setTimeout(attachEditHandler, 0);
    setTimeout(attachEditHandler, 300);

    document.addEventListener('DOMContentLoaded', () => {
        const proj = document.getElementById('fProjeto');
        const dev = document.getElementById('fDev');
        const solic = document.getElementById('fSolic');
        const clear = document.getElementById('fClear');

        const bind = el => el && el.addEventListener('input', applySustFilters);
        bind(proj); bind(dev); bind(solic);

        if (clear) clear.addEventListener('click', () => {
            if (proj) proj.value = '';
            if (dev) dev.value = '';
            if (solic) solic.value = '';
            applySustFilters();
        });
    });

    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
    function pickAny(obj, patterns) {
        for (const k in obj) {
            if (patterns.some(rx => rx.test(k))) return obj[k];
        }
        return null;
    }

    function normalizeChamado(r, projetosById) {
        projetosById = projetosById || {};

        // helper seguro de id
        function makeId() {
            try {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID();
                }
            } catch (_) { }
            return String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
        }

        // ---- Projeto (id/nome) ---------------------------------------------------
        var projetoId =
            (r.projeto_id != null ? r.projeto_id : null) ||
            (r.id_projeto != null ? r.id_projeto : null) ||
            (r.projetoId != null ? r.projetoId : null) ||
            (r.idProjeto != null ? r.idProjeto : null) ||
            (Number.isInteger(r.projeto) ? r.projeto : null);

        var projetoNome =
            (r.projeto != null ? r.projeto : null) ||
            (r.projeto_nome != null ? r.projeto_nome : null) ||
            (r.nome_projeto != null ? r.nome_projeto : null) ||
            (projetoId != null ? projetosById[String(projetoId)] : null);

        // ---- Identificadores ------------------------------------------------------
        var id =
            (r.id != null ? r.id : null) ||
            (r.chamado_id != null ? r.chamado_id : null) ||
            (r.ticket_id != null ? r.ticket_id : null) ||
            (r.id_chamado != null ? r.id_chamado : null) ||
            (r.idTicket != null ? r.idTicket : null);

        var numero =
            (r.numero != null ? r.numero : null) ||
            (r.numero_chamado != null ? r.numero_chamado : null) ||
            (r.ticket != null ? r.ticket : null) ||
            (r.chamado != null ? r.chamado : null) ||
            (r.id != null ? r.id : null);

        // ---- Datas ----------------------------------------------------------------
        function pickAny(obj, patterns) {
            for (var k in obj) {
                for (var i = 0; i < patterns.length; i++) {
                    if (patterns[i].test(k)) return obj[k];
                }
            }
            return null;
        }

        var dataAbertura =
            (r.data_chamado != null ? r.data_chamado : null) ||
            (r.data_abertura != null ? r.data_abertura : null) ||
            (r.dt_registro != null ? r.dt_registro : null) ||
            (r.data_registro != null ? r.data_registro : null) ||
            (r.dt_abertura != null ? r.dt_abertura : null) ||
            (r.data != null ? r.data : null) ||
            (r.created_at != null ? r.created_at : null) ||
            (r.abertura != null ? r.abertura : null) ||
            (r.registro != null ? r.registro : null) ||
            (r['DT REGISTRO'] != null ? r['DT REGISTRO'] : null) ||
            (r['DT_REGISTRO'] != null ? r['DT_REGISTRO'] : null) ||
            (r['DT ABERTURA'] != null ? r['DT ABERTURA'] : null) ||
            (r['DT_ABERTURA'] != null ? r['DT_ABERTURA'] : null) ||
            (r['DT REGISTRO '] != null ? r['DT REGISTRO '] : null) ||
            (r['DATA REGISTRO'] != null ? r['DATA REGISTRO'] : null) ||
            (r['DATA ABERTURA'] != null ? r['DATA ABERTURA'] : null) ||
            (r['ABERTURA'] != null ? r['ABERTURA'] : null) ||
            pickAny(r, [/^dt.?reg/i, /^dt.?abert/i, /abertura/i, /registro/i]);

        var dataFechamento =
            (r.data_fechamento != null ? r.data_fechamento : null) ||
            (r.dt_fechado != null ? r.dt_fechado : null) ||
            (r.data_fechado != null ? r.data_fechado : null) ||
            (r.dt_fechamento != null ? r.dt_fechamento : null) ||
            (r.fechado != null ? r.fechado : null) ||
            (r.fechamento != null ? r.fechamento : null) ||
            (r['DT FECHADO'] != null ? r['DT FECHADO'] : null) ||
            (r['DT_FECHADO'] != null ? r['DT_FECHADO'] : null) ||
            (r['DT FECHAMENTO'] != null ? r['DT FECHAMENTO'] : null) ||
            (r['DT_FECHAMENTO'] != null ? r['DT_FECHAMENTO'] : null) ||
            pickAny(r, [/^dt.?fech/i, /fechamento/i, /fechado/i]);

        // ---- Pessoas / Status -----------------------------------------------------
        var desenvolvedor =
            (r.desenvolvedor != null ? r.desenvolvedor : null) ||
            (r.dev != null ? r.dev : null) ||
            (r.responsavel != null ? r.responsavel : '—');

        var solicitante =
            (r.solicitante != null ? r.solicitante : null) ||
            (r.aberto_por != null ? r.aberto_por : null) ||
            (r.solicitante_nome != null ? r.solicitante_nome : '—');

        var status =
            (r.status != null ? r.status : null) ||
            (r.situacao != null ? r.situacao : null) ||
            (r.state != null ? r.state : '—');

        // ---- Observação “solta” (compat) -----------------------------------------
        var obsSolta =
            (r.observacao != null ? r.observacao : null) ||
            (r.observacoes != null ? r.observacoes : null) ||
            (r.obs != null ? r.obs : '');

        // ---- Histórico ------------------------------------------------------------
        var historico = r.historico || r.andamentos || r.logs || [];
        if (!Array.isArray(historico)) historico = [];

        function normItem(it) {
            if (!it || typeof it !== 'object') {
                return {
                    id: makeId(),
                    dataHora: new Date().toISOString(),
                    autor: desenvolvedor || '—',
                    texto: String(it != null ? it : '').trim()
                };
            }
            var itId =
                (it.id != null ? it.id : null) ||
                (it.item_id != null ? it.item_id : null) ||
                (it.log_id != null ? it.log_id : null) ||
                (it.codigo != null ? it.codigo : null) ||
                makeId();

            var itData =
                (it.dataHora != null ? it.dataHora : null) ||
                (it.data_hora != null ? it.data_hora : null) ||
                (it.data != null ? it.data : null) ||
                (it.dt != null ? it.dt : null) ||
                (it.when != null ? it.when : null) ||
                (it.timestamp != null ? it.timestamp : null) ||
                pickAny(it, [/^data/i, /^dt/i, /hora/i, /time/i]) ||
                new Date().toISOString();

            var itAutor =
                (it.autor != null ? it.autor : null) ||
                (it.user != null ? it.user : null) ||
                (it.usuario != null ? it.usuario : null) ||
                (it.quem != null ? it.quem : null) ||
                (it.responsavel != null ? it.responsavel : null) ||
                desenvolvedor || '—';

            var itTexto =
                (it.texto != null ? it.texto : null) ||
                (it.mensagem != null ? it.mensagem : null) ||
                (it.msg != null ? it.msg : null) ||
                (it.descricao != null ? it.descricao : null) ||
                (it.obs != null ? it.obs : null) ||
                (it.observacao != null ? it.observacao : '');

            return {
                id: String(itId),
                dataHora: itData,
                autor: String(itAutor || '—'),
                texto: String(itTexto || '')
            };
        }

        historico = historico.map(normItem).filter(function (x) {
            return x && x.texto !== undefined;
        });

        // se não houver histórico mas há observação solta, cria um item
        if (!historico.length && obsSolta) {
            var when = dataFechamento || dataAbertura || new Date().toISOString();
            historico = [{
                id: makeId(),
                dataHora: when,
                autor: desenvolvedor || '—',
                texto: String(obsSolta)
            }];
        }

        // ---- Retorno final --------------------------------------------------------
        return {
            id: id != null ? id : null,
            numero: numero != null ? numero : null,
            projeto: projetoNome != null ? projetoNome : '—',
            desenvolvedor: desenvolvedor,
            data_abertura: dataAbertura != null ? dataAbertura : null,
            data_fechamento: dataFechamento != null ? dataFechamento : null,
            solicitante: solicitante,
            status: status,
            // mantemos observacao por compat, mas a tela usa 'historico'
            observacao: '',
            historico: historico
        };
    }




    function renderBulletsLegend(containerId, labels, colors) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = labels.map((lbl, i) =>
            `<span class="inline-flex items-center">
             <span class="legend-dot" style="background:${colors[i]};"></span>
             <span>${esc(lbl)}</span>
           </span>`
        ).join('');
    }

    async function fetchProjetosById() {
        try {
            const resp = await fetch(`${API_ROOT}/projetos`);
            if (!resp.ok) return {};
            const arr = await resp.json();
            const map = {};
            (arr || []).forEach(p => { if (p?.id != null) map[String(p.id)] = p.nome || `Projeto ${p.id}`; });
            return map;
        } catch { return {}; }
    }
    // === cores por status (badge da TABELA) ===
    function badgeClassFor(statusRaw) {
        const s = String(statusRaw || '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '') // remove acentos
            .toLowerCase().trim();

        if (s.includes('pendente')) return 'badge-yellow'; // Pendente
        if (s === 'a desenvolver' || s.startsWith('a desenvolv'))
            return 'badge-blue';   // A desenvolver
        if (s.includes('em desenvolvimento')) return 'badge-green';  // Em desenvolvimento
        if (s.includes('em homologacao')) return 'badge-purple'; // Em homologação
        if (s.includes('em testes')) return 'badge-teal';   // Em testes
        if (s.includes('suspens')) return 'badge-red';    // Suspenso

        return 'badge-gray'; // fallback
    }

    // ---------- TABELA ----------
    function renderTable(list) {
        const tbody = document.getElementById('sustentacaoTableBody');
        if (!tbody) return;

        // Mostrar concluídos apenas quando o filtro ativo pedir
        const active = String(window.__sustActiveFilter || '').toLowerCase();
        const showConcluidos = /conclu/.test(active);
        const showProducao = /produc/.test(active);

        // Aplica corte final na lista para a tabela (visual; gráficos usam outra base)
        const visible = (Array.isArray(list) ? list : []).filter(ch => {
            const st = String(ch.status || '')
                .normalize('NFD').replace(/\p{Diacritic}/gu, '')
                .toLowerCase();
            const isConcluido = /conclu/.test(st);
            const isProducao = /produc/.test(st);

            // regra: na visão geral NÃO aparecem Concluídos nem Em Produção,
            // a menos que o card/filtro específico esteja ativo.
            if (isConcluido && !showConcluidos) return false;
            if (isProducao && !showProducao) return false;
            return true;
        });

        sustCache = visible;
        tbody.innerHTML = '';

        if (!visible.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum chamado encontrado.</td></tr>`;
            return;
        }

        visible.forEach(ch => {
            const stRaw = String(ch.status || '');
            const stKey = stRaw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
            const isConcluido = /conclu/.test(stKey);
            const isProducao = /produc/.test(stKey);

            // Botões de ação:
            // - Em Produção: 🚀 desabilitado (não faz sentido concluir / reenviar)
            // - Concluído:   🚀 Enviar p/ produção (ativo)
            // - Outros:      ✅ Concluir (ativo)
            const actions = isProducao
                ? `
              <span class="btn-ico bg-gray-300 text-white opacity-60 cursor-not-allowed"
                    aria-disabled="true" title="Já em produção">
                <!-- foguete (desabilitado) -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14 3l7 7-4 1-4 4-1 4-7-7 1-4 4-4 4-1z"/>
                  <path d="M5 15l-2 6 6-2"/>
                </svg>
              </span>`
                : (isConcluido
                    ? `
              <button title="Enviar para Produção"
                      class="btn-ico bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      onclick="window.enviarParaProducao('${esc(ch.numero)}')">
                <!-- foguete -->
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14 3l7 7-4 1-4 4-1 4-7-7 1-4 4-4 4-1z"/>
                  <path d="M5 15l-2 6 6-2"/>
                </svg>
              </button>`
                    : `
              <a href="#"
                 onclick="concluirChamado('${esc(ch.numero)}')"
                 class="btn-ico bg-[#16a34a] hover:bg-[#15803d] text-white shadow-sm"
                 aria-label="Concluir" title="Concluir">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </a>`);

            tbody.insertAdjacentHTML('beforeend', `
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 text-sm font-medium text-gray-900">${esc(ch.projeto)}</td>
              <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.numero)}</td>
              <td class="px-6 py-4 text-sm">
                <span class="badge" style="background:${colorForStatus(stRaw)};color:#fff;border-radius:6px;">
                  ${esc(stRaw)}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.desenvolvedor)}</td>
              <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.solicitante)}</td>
              <td class="px-6 py-4 text-sm font-medium">
                <div class="flex items-center gap-3">
                  <a href="#" onclick="verChamadoByNumero('${esc(ch.numero)}')"
                     class="btn-ico bg-[#1555D6] hover:bg-[#0f42a8] text-white shadow-sm" aria-label="Ver" title="Ver">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </a>
                  <a href="#" onclick="editarChamado('${esc(ch.numero)}')"
                     class="btn-ico bg-white text-[#1555D6] ring-2 ring-[#1555D6]" aria-label="Editar" title="Editar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5 20.5 7.5 7 21H3v-4L16.5 3.5z"/>
                    </svg>
                  </a>
                  ${actions}
                </div>
              </td>
            </tr>
          `);
        });
    }



    // Concluir direto com confirmação (sem abrir o modal Ver)
    window.concluirChamado = function (numero) {
        const ch = sustCache.find(c => String(c.numero) === String(numero));
        if (!ch) return;

        const ask = `Concluir o chamado ${numero}?`;
        const doFinish = async () => {
            try {
                const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'Concluído',
                        data_fechamento: new Date().toISOString()
                    })
                });
                if (!resp.ok) throw new Error(await resp.text());

                // recarrega lista/gráficos e dá feedback
                await loadSustentacao();
                (typeof toast === 'function') && toast('Sucesso', `Chamado ${numero} concluído.`, 'success');
            } catch (e) {
                console.error(e);
                (typeof toast === 'function') && toast('Erro', 'Não foi possível concluir o chamado.', 'error');
            }
        };

        // usa o confirm modal global do main.js
        if (typeof window.showConfirm === 'function') {
            window.showConfirm(
                `Concluir o chamado ${numero}?`,
                doFinish,           // sua função que faz o PUT e recarrega
                () => { },
                {
                    title: 'Concluir chamado',
                    icon: '✅',
                    confirmText: 'Concluir',
                    confirmClass: 'bg-emerald-600 hover:bg-emerald-700',
                    barClass: 'bg-emerald-600',   // fica verdinho no topo
                    cancelText: 'Cancelar'
                }
            );

        } else {
            // fallback nativo
            if (confirm(ask)) doFinish();
        }
    };

    function applySustFilters() {
        const p = document.getElementById('fProjeto')?.value || '';
        const d = document.getElementById('fDev')?.value || '';
        const s = document.getElementById('fSolic')?.value || '';

        const pN = norm(p), dN = norm(d), sN = norm(s);

        const filtered = (sustRaw || []).filter(ch => {
            const st = String(ch.status || '')
                .normalize('NFD').replace(/\p{Diacritic}/gu, '')
                .toLowerCase();

            // Na visão geral, não mostrar Concluídos nem Em Produção
            if (/conclu/.test(st)) return false;
            if (/produc/.test(st)) return false;

            const proj = norm(ch.projeto);
            const dev = norm(ch.desenvolvedor);
            const solic = norm(ch.solicitante);

            const okProj = !pN || proj.includes(pN);
            const okDev = !dN || dev.includes(dN);
            const okSolic = !sN || solic.includes(sN);

            return okProj && okDev && okSolic;
        });

        sustCache = filtered;
        renderTable(filtered);
    }


    // abrir modal por número usando o cache
    window.verChamadoByNumero = function (numero) {
        const ch = sustCache.find(c => String(c.numero) === String(numero));
        if (!ch) return;
        window.verChamado(ch.numero, ch.projeto, ch.status, ch.desenvolvedor, ch.solicitante, ch.observacao, ch.data_abertura, ch.data_fechamento);
    };
    function toDate(x) { try { return x ? new Date(x) : null; } catch { return null; } }
    function pad(n) { return String(n).padStart(2, '0'); }
    function toLocalInputValue(d) {
        if (!d) return '';
        const y = d.getFullYear(), m = pad(d.getMonth() + 1), da = pad(d.getDate());
        const h = pad(d.getHours()), mi = pad(d.getMinutes());
        return `${y}-${m}-${da}T${h}:${mi}`;
    }

    window.verChamado = function (
        numero, projeto, status, dev, solicitante, obs,
        dtAbertura, dtFechamento, focoFechamento = false
    ) {
        // guardar para "Concluir"
        window.__viewNumero = numero || null;
        window.currentChamadoNumero = numero;

        // textos
        document.getElementById('verProjeto')?.replaceChildren(document.createTextNode(projeto || '—'));
        document.getElementById('verNumero')?.replaceChildren(document.createTextNode(numero || '—'));
        document.getElementById('verDev')?.replaceChildren(document.createTextNode(dev || '—'));
        document.getElementById('verSolicitante')?.replaceChildren(document.createTextNode(solicitante || '—'));
        document.getElementById('verObs')?.replaceChildren(document.createTextNode(obs || '—'));

        // status (mesmas cores do gráfico)
        const st = document.getElementById('verStatus');
        if (st) {
            st.textContent = status || '—';
            st.className = 'badge mt-2';
            st.setAttribute('style', `${statusPillStyle(status)}border-radius:6px;`);
        }

        // datas
        const openEl = document.getElementById('verAbertura');    // <div> texto
        const closeEl = document.getElementById('verFechamento');  // <input datetime-local>

        const dOpen = parseDateSmart(dtAbertura);
        const dClose = parseDateSmart(dtFechamento);
        // Dias em aberto: (fechamento - abertura) ou (agora - abertura) se ainda aberto
        const daysEl = document.getElementById('verDiasAberto');
        if (daysEl) {
            let dias = '—';
            if (dOpen instanceof Date && !isNaN(dOpen)) {
                const end = (dClose instanceof Date && !isNaN(dClose)) ? dClose : new Date();
                const ms = end - dOpen;
                const oneDay = 24 * 60 * 60 * 1000;
                // arredonda pra cima para contar dia corrente
                dias = Math.max(0, Math.ceil(ms / oneDay));
            }
            daysEl.textContent = String(dias);
        }

        if (openEl) {
            const raw = dtAbertura ?? '';
            openEl.textContent = dOpen
                ? dOpen.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : (String(raw).trim() || '—');
        }
        if (closeEl) {
            closeEl.value = toLocalInputValue(dClose);
            if (focoFechamento) closeEl.focus();
        }

        window.showModal && window.showModal('verChamadoModal');
        loadSustObs(numero); // carrega do backend e preenche #sustHistoricoList

    };

    // mapeia status -> classes do "pill"

    function statusPillStyle(status) {
        return `background:${colorForStatus(status)};color:#fff;`;
    }


    async function doConcluirChamado() {
        const numero = window.__viewNumero;
        const closeEl = document.getElementById('verFechamento');
        const btn = document.getElementById('btnConcluirChamado');
        if (!numero || !closeEl) return;

        const dt = closeEl.value;
        const oldHTML = btn?.innerHTML;
        try {
            if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Concluindo...'; }

            const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Concluído',
                    data_fechamento: dt ? new Date(dt).toISOString() : new Date().toISOString()
                })
            });
            if (!resp.ok) throw new Error(await resp.text());

            // (opção 2) toast de sucesso
            if (typeof toast === 'function') toast('Sucesso', `Chamado ${numero} concluído.`, 'success');

            hideModal && hideModal('verChamadoModal');

            // (opção 4) atualização “ao vivo” (sem recarregar)
            const i = sustCache.findIndex(c => String(c.numero) === String(numero));
            if (i >= 0) {
                sustCache[i].status = 'Concluído';
                sustCache[i].data_fechamento = dt ? new Date(dt).toISOString() : new Date().toISOString();
            }
            renderTable(sustCache);
            ensureCharts(sustCache);
        } catch (e) {
            console.error(e);
            // (opção 2) toast de erro
            if (typeof toast === 'function') toast('Erro', 'Não foi possível concluir o chamado.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = oldHTML; }
        }
    }

    // Enviar chamado concluído para Produção
    window.enviarParaProducao = function (numero) {
        const ch = (sustCache || []).find(c => String(c.numero) === String(numero));
        if (!ch) return;

        const doSend = async () => {
            try {
                const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'Em Produção',
                        data_envio_producao: new Date().toISOString()
                    })
                });
                if (!resp.ok) throw new Error(await resp.text());

                // recarrega lista / gráficos / cards
                await loadSustentacao();
                (typeof toast === 'function') && toast('Sucesso', `Chamado ${numero} enviado para produção.`, 'success');
            } catch (e) {
                console.error(e);
                (typeof toast === 'function') && toast('Erro', 'Não foi possível enviar para produção.', 'error');
            }
        };

        // Usa modal global se existir; senão, confirm nativo
        if (typeof window.showConfirm === 'function') {
            window.showConfirm(
                `Enviar o chamado ${numero} para Produção?`,
                doSend,
                () => { },
                {
                    title: 'Enviar para Produção',
                    icon: '🚀',
                    confirmText: 'Enviar',
                    confirmClass: 'bg-amber-600 hover:bg-amber-700',
                    barClass: 'bg-amber-600',
                    cancelText: 'Cancelar'
                }
            );
        } else {
            if (confirm(`Enviar o chamado ${numero} para Produção?`)) doSend();
        }
    };

    // ligar o botão do modal (uma vez)
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btnConcluirChamado');
        if (btn && !btn.__bound) { btn.__bound = true; btn.addEventListener('click', doConcluirChamado); }
    });
    // Delegação: funciona mesmo se o botão aparecer depois no DOM
    document.addEventListener('click', (e) => {
        const el = e.target.closest('#btnAddSustObs, [data-add-sust-obs]');
        if (!el) return;

        e.preventDefault();

        // se quiser, pode passar o número no data-attribute do botão
        const numeroAttr = el.getAttribute('data-numero');
        const numero = numeroAttr || window.currentChamadoNumero || window.__viewNumero;

        console.log('[SUST] addSustObs: click detectado. numero=', numero);

        // sempre prioriza a implementação interna “boa”
        const fn = window.__addSustObsImpl || window.addSustObs;
        if (typeof fn === 'function') fn(numero);
        else console.error('[SUST] addSustObs não disponível.');
    });



    // UX: fecha ao clicar fora / ESC
    (function enhanceViewModalUX() {
        const modal = document.getElementById('verChamadoModal');
        if (!modal) return;

        // clique fora
        modal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.getAttribute('data-modal-close') === 'verChamadoModal') {
                hideModal('verChamadoModal');
            }
        });

        // tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                hideModal('verChamadoModal');
            }
        });
    })();

    // ---------- GRÁFICOS ----------
    const css = getComputedStyle(document.documentElement);

    const statusColors = {
        'a desenvolver': css.getPropertyValue('--st-a-desenvolver').trim(),
        'em desenvolvimento': css.getPropertyValue('--st-em-desenvolvimento').trim(),
        'em homologação': css.getPropertyValue('--st-em-homologacao').trim(),
        'em homologacao': css.getPropertyValue('--st-em-homologacao').trim(),
        'pendente': css.getPropertyValue('--st-pendente').trim(),
        'suspenso': css.getPropertyValue('--st-suspenso').trim(),
        'em testes': css.getPropertyValue('--st-em-testes').trim(),
        // 👇 ADICIONAR
        'em produção': css.getPropertyValue('--st-em-producao').trim(),
        'em producao': css.getPropertyValue('--st-em-producao').trim()
    };

    function normStatusKey(s) {
        return String(s || '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase().trim();
    }
    function colorForStatus(status) {
        return statusColors[normStatusKey(status)] || '#6b7280'; // fallback cinza
    }

    function drawStatusChart(list) {
        const el = document.getElementById('sustStatusChart');
        if (!el || !window.Chart) return;

        // Agrupa usando o rótulo canônico
        const counts = {};
        (list || []).forEach(ch => {
            const label = canonicalStatusLabel(ch.status);
            counts[label] = (counts[label] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = labels.map(l => counts[l]);

        // Cores: usa sua tabela statusColors (chave sem acento) via normalização
        const colors = labels.map(l => {
            const k = l.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
            return statusColors[k] || '#6b7280';
        });

        if (chartSustStatus) chartSustStatus.destroy();

        chartSustStatus = new Chart(el.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Chamados',
                    data,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    borderSkipped: false,
                    borderRadius: 6,
                    maxBarThickness: 36
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { drawBorder: false } },
                    x: { ticks: { maxRotation: 0, minRotation: 0 }, display: false, grid: { display: false } }
                }
            }
        });

        // legenda customizada com os rótulos canônicos
        renderBulletsLegend('sustStatusLegend', labels, colors);
    }


    function drawProjetosChart(list) {
        const el = document.getElementById('sustProjetosChart');
        if (!el || !window.Chart) return;

        const byProj = {};
        list.forEach(ch => {
            const k = ch.projeto || '—';
            byProj[k] = (byProj[k] || 0) + 1;
        });

        // top 12 projetos por volume (ajuste se quiser mais)
        const entries = Object.entries(byProj).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const labels = entries.map(([k]) => k);
        const data = entries.map(([, v]) => v);

        if (chartSustProjetos) chartSustProjetos.destroy();
        chartSustProjetos = new Chart(el.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Chamados', data, borderRadius: 6, backgroundColor: '#3b82f6' }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    // ---------- CARGA ----------
    async function loadSustentacao() {
        try {
            const projetosById = await fetchProjetosById();
            const resp = await fetch(`${API_ROOT}/sustentacao`);
            if (!resp.ok) throw new Error(`Erro ao buscar sustentação (${resp.status})`);

            const raw = await resp.json();
            console.log('SUST row 0 =>', raw[0]);
            console.log('CHAVES DISPONÍVEIS =>', Object.keys(raw[0]));
            console.log('CAMPO DE REGISTRO =>', ['data_chamado', 'data_abertura', 'dt_registro', 'data_registro', 'created_at', 'abertura', 'registro']
                .find(k => raw[0]?.[k] != null));

            if (Array.isArray(raw) && raw.length) {
                console.log('Sust RAW primeira linha:', raw[0]);
                console.log('Keys:', Object.keys(raw[0]));
            }

            const list = Array.isArray(raw) ? raw.map(r => normalizeChamado(r, projetosById)) : [];
            console.table(list.slice(0, 5), ['numero', 'projeto', 'status', 'data_abertura', 'data_fechamento']);

            // ✅ atualiza somente coisas de sustentação
            const tot = String(list.length);
            const elTopo = document.getElementById('sustentacaoCount');
            if (elTopo) elTopo.textContent = tot;


            // guarda a lista crua e aplica filtros
            sustRaw = list;
            applySustFilters();     // renderiza com os filtros atuais (ou todos, se vazios)
            updateSustCards(sustRaw);
            // gráficos continuam usando a base completa
            ensureCharts(sustRaw);


        } catch (e) {
            console.error(e);
            const tbody = document.getElementById('sustentacaoTableBody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-red-600">Falha ao carregar: ${e.message}</td></tr>`;
            try { chartSustStatus?.destroy(); chartSustStatus = null; } catch { }
            try { chartSustProjetos?.destroy(); chartSustProjetos = null; } catch { }
        }
    }
    // Converte qualquer variação para um rótulo canônico de exibição
    function canonicalStatusLabel(statusRaw) {
        const s = String(statusRaw || '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase().trim();

        if (s.includes('produc')) return 'Em Produção';
        if (s.includes('conclu')) return 'Concluído';
        if (s.startsWith('a desenvol')) return 'A desenvolver';
        if (s.includes('em desenvolvimento')) return 'Em desenvolvimento';
        if (s.includes('homolog')) return 'Em homologação';
        if (s.includes('testes')) return 'Em testes';
        if (s.includes('suspens')) return 'Suspenso';
        if (s.includes('pendente')) return 'Pendente';
        return statusRaw || '—';
    }
    // --- CSS de fallback + helpers VISUAIS (hover-glow e ativo) ---
    (function ensureGlowCSS() {
        if (document.getElementById('sust-glow-style')) return;
        const css = `
    /* ---- GLOW APENAS NO HOVER ---- */
    [data-card][data-glow="hover"]:hover .kpi-number,
    [data-card][data-glow="hover"]:hover .count,
    [data-card][data-glow="hover"]:hover .value,
    [data-card][data-glow="hover"]:hover .metric-value {
      text-shadow: 0 0 10px var(--kpi-accent, rgba(251,191,36,.85));
      filter: drop-shadow(0 0 4px var(--kpi-accent, rgba(251,191,36,.65)));
      transition: text-shadow .2s ease, filter .2s ease;
    }
    [data-card][data-glow="hover"]:hover {
      --glow-color: var(--kpi-accent, rgba(251,191,36,.35));
      box-shadow: 0 0 0 1px rgba(0,0,0,.03), 0 0 16px var(--glow-color);
    }
  
    /* ---- (compat) brilho forçado, caso algum card use "on" em outra parte do sistema ---- */
    [data-card][data-glow="on"] .kpi-number,
    [data-card][data-glow="on"] .count,
    [data-card][data-glow="on"] .value,
    [data-card][data-glow="on"] .metric-value { 
      text-shadow: 0 0 10px var(--kpi-accent, rgba(251,191,36,.85));
      filter: drop-shadow(0 0 4px var(--kpi-accent, rgba(251,191,36,.65)));
    }
    [data-card][data-glow="on"] {
      --glow-color: var(--kpi-accent, rgba(251,191,36,.35));
      box-shadow: 0 0 0 1px rgba(0,0,0,.03), 0 0 16px var(--glow-color);
    }
  
    /* ---- DESTAQUE ATIVO (barra lateral quando clica) ---- */
    [data-card][data-active="on"] { position: relative; }
    [data-card][data-active="on"]::before{
      content:"";
      position:absolute;
      left:0; top:10%;
      width:6px; height:80%;
      border-radius:6px;
      background: var(--kpi-accent, #f59e0b);
      box-shadow: 0 0 8px var(--kpi-accent, rgba(245,158,11,.7));
    }
    `;
        const tag = document.createElement('style');
        tag.id = 'sust-glow-style';
        tag.textContent = css;
        document.head.appendChild(tag);
    })();

    /**
     * Define o modo de glow de um conjunto de cards.
     * mode: 'hover' (padrão), 'on' (sempre) ou 'off'
     */
    function setCardGlow(cardKeys = [], mode = 'hover', accentColor = '') {
        (cardKeys || []).forEach(key => {
            document.querySelectorAll(`[data-card="${key}"]`).forEach(el => {
                if (accentColor) {
                    el.style.setProperty('--kpi-accent', accentColor);
                    el.style.setProperty('--accent', accentColor); // compat
                }
                if (mode === 'off') {
                    el.removeAttribute('data-glow');
                    el.classList.remove('kpi-hot');
                } else {
                    el.setAttribute('data-glow', mode);           // 'hover' ou 'on'
                    if (mode === 'on') el.classList.add('kpi-hot');
                    else el.classList.remove('kpi-hot');
                }
            });
        });
    }

    /** Liga/desliga o estado ATIVO (barra lateral) de um conjunto de cards */
    function setCardActive(cardKeys = [], on = true, accentColor = '') {
        (cardKeys || []).forEach(key => {
            document.querySelectorAll(`[data-card="${key}"]`).forEach(el => {
                if (accentColor) el.style.setProperty('--kpi-accent', accentColor);
                if (on) el.setAttribute('data-active', 'on');
                else el.removeAttribute('data-active');
            });
        });
    }


    // helper: tenta desenhar assim que o Chart estiver disponível
    function ensureCharts(list) {
        const draw = () => { drawStatusChart(list); drawProjetosChart(list); };
        if (window.Chart) { draw(); return; }

        // aguarda o Chart.js (até ~3s)
        let tries = 0;
        const iv = setInterval(() => {
            if (window.Chart || tries++ > 20) {
                clearInterval(iv);
                if (window.Chart) draw();
            }
        }, 150);
    }
    function pad(n) { return String(n).padStart(2, '0'); }
    function toLocalInputValue(d) {
        if (!d) return '';
        const y = d.getFullYear(), m = pad(d.getMonth() + 1), da = pad(d.getDate());
        const h = pad(d.getHours()), mi = pad(d.getMinutes());
        return `${y}-${m}-${da}T${h}:${mi}`;
    }
    function parseDateSmart(v) {
        if (!v) return null;
        if (v instanceof Date) return v;
        if (typeof v === 'number') return new Date(v);
        const s = String(v).trim();

        // ISO
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s);

        // aceita "dd/mm/aa(aa)[, ]hh:mm[:ss]"
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})[, ]\s*(\d{2}):(\d{2})(?::(\d{2}))?$/)
            || s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (m) {
            let [, d, mo, y, h = '00', mi = '00', se = '00'] = m;
            y = y.length === 2 ? (Number(y) >= 70 ? '19' + y : '20' + y) : y;
            return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
        }

        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    // ---------- EXPORTS E UTILITÁRIOS PARA main.js ----------
    // expõe render da tabela e dos charts
    window.renderSustentacaoTable = renderTable;
    window.renderSustCharts = (items) => { drawStatusChart(items); drawProjetosChart(items); };

    // filtra sustentacao por status (usa normalização interna)
    window.filterSustByStatus = function (statusLike) {
        const norm = v => String(v || '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase().trim();

        const wanted = norm(statusLike);

        // Toggle: clicar no mesmo card limpa o filtro
        if (window.__sustActiveFilter === wanted) {
            window.__sustActiveFilter = '';
            sustCache = Array.from(sustRaw);
            renderTable(sustCache);
            ensureCharts(sustCache);
            clearPickedVisuals();                    // 👈 limpa barra lateral/seleção
            return;
        }

        window.__sustActiveFilter = wanted;

        const filtered = wanted
            ? (sustRaw || []).filter(ch => {
                const st = norm(ch.status);
                if (wanted.includes('producao')) return st.includes('producao');
                return st.includes(wanted);
            })
            : Array.from(sustRaw);

        sustCache = filtered;
        renderTable(filtered);
        ensureCharts(filtered);

        // Marca visualmente o card selecionado (inclui o TOP “Em Produção”)
        markPickedCard(wanted);
    };




    // calcula e atualiza os 8 cards (IDs esperados — ajuste se seu HTML usar outros IDs)
    function updateSustCards(list = sustRaw) {
        const counters = {
            aDesenvolver: 0,
            emDesenvolvimento: 0,
            emHomologacao: 0,
            emTestes: 0,
            pendente: 0,
            suspenso: 0,
            concluido: 0,
            emProducao: 0
        };

        (list || []).forEach(ch => {
            const s = normStatusKey(ch.status || '');
            if (s.includes('a desenvolver') || s.startsWith('a desenvolv')) counters.aDesenvolver++;
            else if (s.includes('em desenvolvimento') || s.includes('desenvolvimento')) counters.emDesenvolvimento++;
            else if (s.includes('em homolog') || s.includes('homolog')) counters.emHomologacao++;
            else if (s.includes('em testes') || s.includes('testes')) counters.emTestes++;
            else if (s.includes('suspens')) counters.suspenso++;
            else if (s.includes('produc')) counters.emProducao++;
            else if (s.includes('conclu')) counters.concluido++;
            else if (s.includes('pendente')) counters.pendente++;
            else counters.pendente++;
        });

        // IDs da grade (Sustentação)
        const idMap = {
            aDesenvolver: 'sustADevs',
            emDesenvolvimento: 'sustEmDev',
            emHomologacao: 'sustHomolog',
            emTestes: 'sustTestes',
            pendente: 'sustPendente',
            suspenso: 'sustSuspenso',
            concluido: 'sustFechados',
            emProducao: 'sustProducao'
        };

        // data-card (Home/Visão geral/CODES)
        const cardKeys = {
            aDesenvolver: ['codes:sustentação:a_desenvolver', 'codes:sust:a_desenvolver', 'codes:sust:adesenvolver'],
            emDesenvolvimento: ['codes:sustentação:em_desenvolvimento', 'codes:sust:em_desenvolvimento', 'codes:sust:emdesenv'],
            emHomologacao: ['codes:sustentação:em_homologacao', 'codes:sust:em_homologacao', 'codes:sust:homolog'],
            emTestes: ['codes:sustentação:em_testes', 'codes:sust:em_testes', 'codes:sust:testes'],
            pendente: ['codes:sustentação:pendente', 'codes:sust:pendente'],
            suspenso: ['codes:sustentação:suspenso', 'codes:sust:suspenso'],
            concluido: ['codes:sustentação:fechados', 'codes:sust:fechados'],
            emProducao: ['codes:sustentação:em_producao', 'codes:sust:em_producao', 'codes:producao-top', 'codes:sust:em_producao']
        };

        function writeCardCount(cardKey, value) {
            const sel = `[data-card="${cardKey}"]`;
            const nodes = document.querySelectorAll(
                `${sel} [data-count], ${sel} .count, ${sel} .value, ${sel} .metric-value, ${sel} .card-number, ${sel} .kpi-number`
            );
            nodes.forEach(el => el.textContent = String(value));
        }

        // Atualiza IDs legados (grade)
        for (const k in idMap) {
            const el = document.getElementById(idMap[k]);
            if (el) el.textContent = String(counters[k] || 0);
        }

        // Atualiza data-card (Home/Visão geral)
        for (const k of Object.keys(counters)) {
            const val = counters[k] || 0;
            (cardKeys[k] || []).forEach(key => writeCardCount(key, val));
        }

        // Totais
        const total = String((list || []).length);
        document.getElementById('sustTotal')?.replaceChildren(document.createTextNode(total));
        document.getElementById('sustentacaoCount')?.replaceChildren(document.createTextNode(total));
        (['codes:sustentação', 'codes:sust:total', 'codes:sustentacao', 'codes:sust']).forEach(key => writeCardCount(key, total));

        // ⚠️ Importante: nada de brilho permanente aqui.
        // Se quiser brilho no hover, deixe o CSS cuidar com :hover.
        // Também não mexemos no “picked” aqui — isso fica a cargo do filtro/cli­que.

        return counters;
    }



    /* ============ HISTÓRICO DE ANDAMENTO (Sustentação) ============ */
    // >>> usa as rotas reais do backend:
    // GET/POST  /api/sustentacao/:numero/observacoes
    // PUT/DELETE /api/sustentacao/observacoes/:id

    function _escHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

    async function loadSustObsImpl(numero) {
        window.currentChamadoNumero = numero;
        const box = document.getElementById('sustHistoricoList');
        if (!box) return;
        box.innerHTML = '<div class="text-sm text-gray-500">Carregando…</div>';
        try {
            const url = `${API_ROOT}/sustentacao/${encodeURIComponent(numero)}/observacoes?t=${Date.now()}`;
            const r = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            if (!r.ok) throw new Error(await r.text());

            let itens = await r.json();
            if (!Array.isArray(itens) || !itens.length) {
                box.innerHTML = '<p class="text-sm text-gray-500">Nenhum andamento registrado.</p>';
                return;
            }
            itens = itens.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
            box.innerHTML = itens.map(it => `
            <div class="flex items-start gap-2 mb-2">
              <div class="flex-1 px-3 py-2 rounded border bg-gray-50 text-sm text-gray-700">
                <div class="text-xs text-gray-500">${new Date(it.created_at).toLocaleString('pt-BR')}</div>
                <div class="mt-1 whitespace-pre-wrap">${esc(it.texto)}</div>
              </div>
              <div class="shrink-0 flex gap-2">
                <button type="button" class="px-2 py-1 text-sm rounded bg-yellow-400 text-white hover:bg-yellow-500"
                        onclick="editSustObs(${it.id}, '${numero}')">Editar</button>
                <button type="button" class="px-2 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600"
                        onclick="deleteSustObs(${it.id}, '${numero}')">Excluir</button>
              </div>
            </div>`).join('');
        } catch (e) {
            console.error(e);
            box.innerHTML = '<p class="text-sm text-red-600">Falha ao carregar observações.</p>';
        }
    }

    async function addSustObsImpl(numero) {
        numero = numero || window.currentChamadoNumero || window.__viewNumero || document.getElementById('verNumero')?.textContent?.trim();
        const input = document.getElementById('sustNovoAndamento') || document.getElementById('novaObs');
        const texto = (input?.value || '').trim();

        console.log('[SUST] addSustObs:start', { numero, textoLen: texto.length, preview: texto.slice(0, 80) });
        if (!numero) { alert('Sem número do chamado.'); return; }
        if (!input) { alert('Campo #sustNovoAndamento não encontrado.'); return; }
        if (!texto) { alert('Digite o andamento antes de adicionar.'); return; }

        const btn = document.getElementById('btnAddSustObs');
        const oldHTML = btn?.innerHTML;

        try {
            if (btn) { btn.disabled = true; btn.innerHTML = 'Enviando…'; }

            const r = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}/observacoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto })
            });
            if (!r.ok) throw new Error(`HTTP ${r.status} - ${await r.text()}`);

            const created = await r.json();

            // render otimista
            try {
                const box = document.getElementById('sustHistoricoList');
                if (box) {
                    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
                    box.insertAdjacentHTML('afterbegin', `
                <div class="flex items-start gap-2 mb-2" data-optimistic="1">
                  <div class="flex-1 px-3 py-2 rounded border bg-gray-50 text-sm text-gray-700">
                    <div class="text-xs text-gray-500">${new Date(created.created_at || Date.now()).toLocaleString('pt-BR')}</div>
                    <div class="mt-1 whitespace-pre-wrap">${esc(created.texto || texto)}</div>
                  </div>
                </div>`);
                }
            } catch { }

            input.value = '';
            await loadSustObs(numero);   // reconcilia com GET sem cache
            return created;              // <- *** importante ***
        } catch (e) {
            console.error('[SUST] falhou:', e);
            window.toast ? toast('Erro', 'Falha ao salvar andamento.', 'error') : alert('Falha ao salvar andamento.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = oldHTML || '+'; }
        }
    }
    window.loadSustObs = loadSustObsImpl;
    window.addSustObs = addSustObsImpl;

    window.__addSustObsImpl = addSustObsImpl;
    window.__loadSustObsImpl = loadSustObsImpl;


    // (opcional, mas útil): se alguém tentar setar algo que não é função, ignora
    (function hardenExports() {
        let addRef = addSustObsImpl;
        let loadRef = loadSustObsImpl;

        Object.defineProperty(window, 'addSustObs', {
            configurable: true,
            get() { return addRef; },
            set(v) { if (typeof v === 'function') addRef = v; else console.warn('[SUST] addSustObs ignorado (não-função)'); }
        });
        Object.defineProperty(window, 'loadSustObs', {
            configurable: true,
            get() { return loadRef; },
            set(v) { if (typeof v === 'function') loadRef = v; else console.warn('[SUST] loadSustObs ignorado (não-função)'); }
        });

    })();

    window.editSustObs = async function (obsId, numero) {
        numero = numero || window.currentChamadoNumero || window.__viewNumero;
        const novo = prompt('Editar andamento:');
        if (novo == null) return;
        try {
            const r = await fetch(`${API_ROOT}/sustentacao/observacoes/${encodeURIComponent(obsId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: String(novo).trim() })
            });
            if (!r.ok) throw new Error(await r.text());
            await loadSustObs(numero); // ✅ recarrega usando o número certo
            (typeof toast === 'function') && toast('Sucesso', 'Andamento atualizado.', 'success');
        } catch (e) {
            console.error(e);
            (typeof toast === 'function') && toast('Erro', 'Falha ao atualizar.', 'error');
        }
    };

    window.deleteSustObs = async function (obsId, numero) {
        numero = numero || window.currentChamadoNumero || window.__viewNumero;
        if (!confirm('Excluir este andamento?')) return;
        try {
            const r = await fetch(`${API_ROOT}/sustentacao/observacoes/${encodeURIComponent(obsId)}`, { method: 'DELETE' });
            if (!r.ok) throw new Error(await r.text());  // 204 é ok e passa aqui
            await loadSustObs(numero); // ✅ recarrega usando o número certo
            (typeof toast === 'function') && toast('Sucesso', 'Andamento excluído.', 'success');
        } catch (e) {
            console.error(e);
            (typeof toast === 'function') && toast('Erro', 'Falha ao excluir.', 'error');
        }
    };



    // expõe para que main.js possa chamar quando abrir a tela de sustentação
    window.updateSustCards = updateSustCards;

    // tenta ligar os handlers de clique dos sub-cards (se existirem no DOM)
    function bindSustCardClicks() {
        const map = {
            'sustADevs': 'a desenvolver',
            'sustEmDev': 'em desenvolvimento',
            'sustHomolog': 'em homologacao',
            'sustTestes': 'em testes',
            'sustPendente': 'pendente',
            'sustSuspenso': 'suspenso',
            'sustFechados': 'concluido',
            'sustProducao': 'em producao' // se um dia existir subcard
        };

        // Subcards (grid #codesKpisSustExtra)
        for (const id in map) {
            const numEl = document.getElementById(id);
            if (!numEl) continue;

            const card = numEl.closest('[data-card^="codes:sust:"]') || numEl.parentElement;
            if (!card || card.__bound) continue;
            card.__bound = true;

            card.style.cursor = 'pointer';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            const run = (e) => {
                e.preventDefault();
                window.filterSustByStatus(map[id]);
            };

            card.addEventListener('click', run);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(e); }
            });
        }

        // TOP “Em Produção”
        const prodTop = document.querySelector('#codesPage [data-card="codes:sust:em_producao"]');
        if (prodTop && !prodTop.__bound) {
            prodTop.__bound = true;
            prodTop.style.cursor = 'pointer';
            prodTop.setAttribute('role', 'button');
            prodTop.setAttribute('tabindex', '0');

            const runTop = (e) => {
                e.preventDefault();
                window.filterSustByStatus('em producao'); // filtra e marca visual
                // rola até a grade/tabela de Sustentação (opcional)
                document.getElementById('codesSustentacaoWrapper')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };

            prodTop.addEventListener('click', runTop);
            prodTop.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runTop(e); }
            });
        }
    }



    // tenta bind após o DOM estar pronto (e de novo em 300ms caso o HTML seja injetado dinamicamente)
    document.addEventListener('DOMContentLoaded', bindSustCardClicks);
    setTimeout(bindSustCardClicks, 300);
    setTimeout(bindSustCardClicks, 800);

    // quando os dados mudarem (após loadSustentacao), atualiza os cards automaticamente
    const origEnsureCharts = ensureCharts;
    ensureCharts = function (list) {
        // atualiza cards mesmo se charts ainda não puderem ser desenhados
        try { updateSustCards(sustRaw); } catch (e) { console.warn(e); }
        origEnsureCharts(list);
    };
    // === COLAR (são novas) ===
    function clearPickedVisuals() {
        const scope = document.getElementById('codesPage') || document;
        scope.querySelectorAll('.card-picked, .card-picked--amber').forEach(el => {
            el.classList.remove('card-picked', 'card-picked--amber');
        });
    }

    function markPickedCard(wantedKey) {
        clearPickedVisuals();

        const selMap = {
            'a desenvolver': '#codesKpisSustExtra [data-card="codes:sust:adesenvolver"]',
            'em desenvolvimento': '#codesKpisSustExtra [data-card="codes:sust:emdesenv"]',
            'em homologacao': '#codesKpisSustExtra [data-card="codes:sust:homolog"]',
            'em testes': '#codesKpisSustExtra [data-card="codes:sust:testes"]',
            'pendente': '#codesKpisSustExtra [data-card="codes:sust:pendente"]',
            'suspenso': '#codesKpisSustExtra [data-card="codes:sust:suspenso"]',
            'concluido': '#codesKpisSustExtra [data-card="codes:sust:fechados"]',
            'em producao': '#codesPage [data-card="codes:sust:em_producao"]'
        };

        const sel = selMap[wantedKey];
        if (!sel) return;

        const el = document.querySelector(sel);
        if (!el) return;

        // Seleção com barra lateral (tema âmbar para Sustentação)
        el.classList.add('card-picked', 'card-picked--amber');
    }

    // helper simples para main.js: mostra todos os chamados (sem filtro)
    window.showAllSust = function () { window.filterSustByStatus(''); };

    window.loadSustentacao = loadSustentacao;
    document.addEventListener('DOMContentLoaded', () => {
        // se estamos no dashboard/visão geral e ainda não carregamos sustentação,
        // dispara o load para preencher os cards.
        const hasSustCards =
            document.querySelector('[data-card^="codes:sustentação"]') ||
            document.querySelector('[data-card^="codes:sust"]') ||
            document.getElementById('sustentacaoCount');

        if (hasSustCards && (!Array.isArray(sustRaw) || sustRaw.length === 0)) {
            try { loadSustentacao(); } catch { }
        }
    });

})();
