// assets/js/sustentacao.js
(function () {
    'use strict';

    const API_ROOT = 'http://localhost:5001/api';

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
        const projetoId =
            r.projeto_id ?? r.id_projeto ?? r.projetoId ?? r.idProjeto ??
            (Number.isInteger(r.projeto) ? r.projeto : null);

        const projetoNome =
            r.projeto ?? r.projeto_nome ?? r.nome_projeto ??
            (projetoId != null ? projetosById[String(projetoId)] : null);

        return {
            id: r.id ?? r.chamado_id ?? r.ticket_id ?? null,
            numero: r.numero ?? r.numero_chamado ?? r.ticket ?? r.chamado ?? r.id ?? null,
            projeto: projetoNome ?? '—',
            desenvolvedor: r.desenvolvedor ?? r.dev ?? r.responsavel ?? '—',
            data_abertura: (
                r.data_chamado ??
                r.data_abertura ?? r.dt_registro ?? r.data_registro ?? r.dt_abertura ??
                r.data ?? r.created_at ?? r.abertura ?? r.registro ??
                r['DT REGISTRO'] ?? r['DT_REGISTRO'] ?? r['DT ABERTURA'] ?? r['DT_ABERTURA'] ??
                r['DT REGISTRO '] ?? r['DATA REGISTRO'] ?? r['DATA ABERTURA'] ?? r['ABERTURA'] ??
                pickAny(r, [/^dt.?reg/i, /^dt.?abert/i, /abertura/i, /registro/i]) ?? null
            ),
            data_fechamento: (
                r.data_fechamento ?? r.dt_fechado ?? r.data_fechado ?? r.dt_fechamento ??
                r.fechado ?? r.fechamento ??
                r['DT FECHADO'] ?? r['DT_FECHADO'] ?? r['DT FECHAMENTO'] ?? r['DT_FECHAMENTO'] ??
                pickAny(r, [/^dt.?fech/i, /fechamento/i, /fechado/i]) ?? null
            ),
            solicitante: r.solicitante ?? r.aberto_por ?? r.solicitante_nome ?? '—',
            status: r.status ?? r.situacao ?? r.state ?? '—',
            observacao: r.observacao ?? r.observacoes ?? r.obs ?? ''
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

        sustCache = Array.isArray(list) ? list : [];
        tbody.innerHTML = '';

        if (!sustCache.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum chamado encontrado.</td></tr>`;
            return;
        }

        sustCache.forEach(ch => {


            tbody.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm font-medium text-gray-900">${esc(ch.projeto)}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.numero)}</td>

                  <td class="px-6 py-4 text-sm">
                     <span class="badge"
                          style="background:${colorForStatus(ch.status)};color:#fff;border-radius:6px;">
                         ${esc(ch.status)}  
                     </span>
                 </td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.desenvolvedor)}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.solicitante)}</td>
                  <td class="px-6 py-4 text-sm font-medium">
  <div class="flex items-center gap-3">
    <a href="#" onclick="verChamadoByNumero('${esc(ch.numero)}')" class="btn-ico bg-[#1555D6] text-white shadow-sm" aria-label="Ver">
      <!-- olho -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </a>

    <a href="#" onclick="editarChamado('${esc(ch.numero)}')" class="btn-ico bg-white text-[#1555D6] ring-2 ring-[#1555D6]" aria-label="Editar">
      <!-- lápis -->
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5 20.5 7.5 7 21H3v-4L16.5 3.5z"/>
      </svg>
    </a>

    <a href="#"
   onclick="concluirChamado('${esc(ch.numero)}')"
   class="btn-ico bg-[#16a34a] text-white shadow-sm"
   aria-label="Concluir" title="Concluir">
  <!-- check -->
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
</a>

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
            const proj = norm(ch.projeto);
            const dev = norm(ch.desenvolvedor);
            const solic = norm(ch.solicitante);

            // cada campo filtra sua coluna; vazio = ignora
            const okProj = !pN || proj.includes(pN);
            const okDev = !dN || dev.includes(dN);
            const okSolic = !sN || solic.includes(sN);

            return okProj && okDev && okSolic;
        });

        // atualiza cache atual e re-renderiza
        sustCache = filtered;
        renderTable(filtered);
        // opcional: atualizar contagem do card da tela de Sustentação
        const countEl = document.getElementById('sustChamadosCount');
        if (countEl) countEl.textContent = String(filtered.length);
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
    };

    // mapeia status -> classes do "pill"

    function statusPillStyle(status) {
        return `background:${colorForStatus(status)};color:#fff;`;
    }


    async function doConcluirChamado() {
        const numero = window.__viewNumero;
        const closeEl = document.getElementById('verFechamento');
        if (!numero || !closeEl) return;

        const dt = closeEl.value; // formato do input datetime-local
        try {
            const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'Concluído',
                    data_fechamento: dt ? new Date(dt).toISOString() : new Date().toISOString()
                })
            });
            if (!resp.ok) throw new Error(await resp.text());
            hideModal && hideModal('verChamadoModal');
            await loadSustentacao();
        } catch (e) {
            console.error(e);
            alert('Não foi possível concluir o chamado.');
        }
    }

    // ligar o botão do modal (uma vez)
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btnConcluirChamado');
        if (btn && !btn.__bound) { btn.__bound = true; btn.addEventListener('click', doConcluirChamado); }
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
        'em testes': css.getPropertyValue('--st-em-testes').trim()
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

        const counts = {};
        list.forEach(ch => {
            const key = String(ch.status || '—').trim();
            counts[key] = (counts[key] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = labels.map(l => counts[l]);

        const colors = labels.map(l => {
            const k = l.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
            return statusColors[k] || '#6b7280';
        });

        if (chartSustStatus) chartSustStatus.destroy();

        chartSustStatus = new Chart(el.getContext('2d'), {
            type: 'bar',                 // 👈 de rosca para colunas
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
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 },
                        grid: { drawBorder: false }
                    },
                    x: {
                        ticks: { maxRotation: 0, minRotation: 0 },
                        grid: { display: false }
                    }
                }
            }
        });

        // mantém a legenda customizada do card
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
            const countEl = document.getElementById('sustChamadosCount');
            if (countEl) countEl.textContent = String(list.length);
            if (typeof window.applySustCard === 'function') window.applySustCard(list.length);

            // guarda a lista crua e aplica filtros
            sustRaw = list;
            applySustFilters();     // renderiza com os filtros atuais (ou todos, se vazios)

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


    window.loadSustentacao = loadSustentacao;
})();
