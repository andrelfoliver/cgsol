// assets/js/sustentacao.js
(function () {
    'use strict';

    const API_ROOT = 'http://localhost:5001/api';

    // gráficos
    let chartSustStatus = null;
    let chartSustProjetos = null;

    // cache de chamados (para abrir modal pelo número)
    let sustCache = [];

    // ===== EDICAO =====
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

    // liga quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', attachEditHandler);

    // e tente de novo caso este arquivo carregue antes do modal ser renderizado
    setTimeout(attachEditHandler, 0);
    setTimeout(attachEditHandler, 300);

    // submit do formulário
    (function attachEditHandler() {
        const form = document.getElementById('editChamadoForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const numero = document.getElementById('editHiddenNumero').value.trim();

            const payload = {
                projeto: document.getElementById('editProjeto').value.trim(),
                // numero NÃO vai no payload: ele é a chave da URL
                status: document.getElementById('editStatus').value.trim(),
                desenvolvedor: document.getElementById('editDev').value.trim(),
                solicitante: document.getElementById('editSolic').value.trim(),
                observacao: document.getElementById('editObs').value.trim()
                // se quiser enviar descricao/data_chamado, inclua aqui
                // descricao:  ...,
                // data_chamado: '2025-09-23'
            };


            try {
                const resp = await fetch(`${API_ROOT}/sustentacao/${encodeURIComponent(numero)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projeto, status, desenvolvedor, solicitante, observacao,
                        // se tiver campo de data no modal:
                        // data_chamado: '2025-09-23T14:30'
                    })
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                hideModal('editChamadoModal');
                await loadSustentacao(); // recarrega tabela e gráficos
            } catch (err) {
                console.error('Falha ao salvar edição:', err);
                alert('Não foi possível salvar o chamado.');
            }
        });
    })();
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));

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
            data: r.data ?? r.data_abertura ?? r.created_at ?? r.abertura ?? null,
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
            let badgeClass = 'badge-gray';
            if (/desenvolv/i.test(ch.status)) badgeClass = 'badge-green';
            else if (/homolog/i.test(ch.status)) badgeClass = 'badge-purple';
            else if (/pendente/i.test(ch.status)) badgeClass = 'badge-yellow';
            else if (/suspens|erro|incid/i.test(ch.status)) badgeClass = 'badge-red';

            tbody.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm font-medium text-gray-900">${esc(ch.projeto)}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.numero)}</td>
                  <td class="px-6 py-4 text-sm"><span class="badge ${badgeClass}">${esc(ch.status)}</span></td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.desenvolvedor)}</td>
                  <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.solicitante)}</td>
                  <td class="px-6 py-4 text-sm font-medium">
                    <div class="action-group">
                      <a href="#" onclick="verChamadoByNumero('${esc(ch.numero)}')" class="action-btn text-blue-600 hover:text-blue-800">
                        <span class="action-ico">👁️</span><span>Ver</span>
                      </a>
                      <a href="#" onclick="editarChamado('${esc(ch.numero)}')" class="action-btn text-green-600 hover:text-green-800">
                        <span class="action-ico">✏️</span><span>Editar</span>
                      </a>
                      <a href="#" onclick="excluirChamado('${esc(ch.numero)}')" class="action-btn text-red-600 hover:text-red-800">
                        <span class="action-ico">🗑️</span><span>Excluir</span>
                      </a>
                    </div>
                  </td>
                </tr>
              `);

        });
    }

    // abrir modal por número usando o cache
    window.verChamadoByNumero = function (numero) {
        const ch = sustCache.find(c => String(c.numero) === String(numero));
        if (!ch) return;
        window.verChamado(ch.numero, ch.projeto, ch.status, ch.desenvolvedor, ch.solicitante, ch.observacao);
    };

    window.verChamado = function (numero, projeto, status, dev, solicitante, obs) {
        document.getElementById('verProjeto')?.replaceChildren(document.createTextNode(projeto || '—'));
        document.getElementById('verNumero')?.replaceChildren(document.createTextNode(numero || '—'));
        document.getElementById('verStatus')?.replaceChildren(document.createTextNode(status || '—'));
        document.getElementById('verDev')?.replaceChildren(document.createTextNode(dev || '—'));
        document.getElementById('verSolicitante')?.replaceChildren(document.createTextNode(solicitante || '—'));
        document.getElementById('verObs')?.replaceChildren(document.createTextNode(obs || '—'));
        window.showModal && window.showModal('verChamadoModal');
    };

    // ---------- GRÁFICOS ----------
    const statusColors = {
        'a desenvolver': '#16a34a',
        'em desenvolvimento': '#3b82f6',
        'em homologação': '#ef4444',
        'em homologacao': '#ef4444',
        'pendente': '#f59e0b',
        'suspenso': '#8b5cf6',
        'em testes': '#10b981',
        'aberto': '#2563eb',
        'fechado': '#9ca3af'
    };

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
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: { legend: { display: false } } // 👈 escondemos a legenda padrão
            }
        });

        // 👇 legenda custom com bolinhas
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
            const list = Array.isArray(raw) ? raw.map(r => normalizeChamado(r, projetosById)) : [];

            // card (se existir)
            const countEl = document.getElementById('sustChamadosCount');
            if (countEl) countEl.textContent = String(list.length);

            renderTable(list);
            //drawStatusChart(list);
            //drawProjetosChart(list);
            ensureCharts(list);  // <- use isso no lugar

        } catch (e) {
            console.error(e);
            const tbody = document.getElementById('sustentacaoTableBody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-red-600">Falha ao carregar: ${e.message}</td></tr>`;
            // limpa gráficos se der erro
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

    window.loadSustentacao = loadSustentacao;
})();
