// assets/js/sustentacao.js
(function () {
    'use strict';

    const API_ROOT = 'http://localhost:5001/api';
    let chartSustentacao = null;
    // Cache local dos chamados para abrir o modal só com o número
    let sustCache = [];

    // escape básico p/ evitar injeção em células
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));

    // -------- utils --------
    const safe = v => (v === undefined || v === null || v === '' ? '—' : String(v));

    function formatToBrasilia(raw) {
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d)) return '—';
        d.setHours(d.getHours() - 3); // UTC -> Brasília
        return d.toLocaleString('pt-BR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }

    function normalizeChamado(r, projetosById) {
        // tenta deduzir projeto pelo id se vier numérico
        const projetoId =
            r.projeto_id ?? r.id_projeto ?? r.projetoId ?? r.idProjeto ??
            (Number.isInteger(r.projeto) ? r.projeto : null);

        const projetoNome =
            r.projeto ?? r.projeto_nome ?? r.nome_projeto ??
            (projetoId != null ? projetosById[String(projetoId)] : null);

        return {
            id: r.id ?? r.chamado_id ?? r.ticket_id ?? null,
            numero: r.numero ?? r.numero_chamado ?? r.ticket ?? r.chamado ?? r.id ?? null,
            projeto: projetoNome ?? null,
            desenvolvedor: r.desenvolvedor ?? r.dev ?? r.responsavel ?? null,
            data: r.data ?? r.data_abertura ?? r.created_at ?? r.abertura ?? null,
            solicitante: r.solicitante ?? r.aberto_por ?? r.solicitante_nome ?? null,
            status: r.status ?? r.situacao ?? r.state ?? null,
            observacao: r.observacao ?? r.observacoes ?? r.obs ?? null
        };
    }

    async function fetchProjetosById() {
        try {
            const resp = await fetch(`${API_ROOT}/projetos`);
            if (!resp.ok) return {};
            const arr = await resp.json();
            const map = {};
            (arr || []).forEach(p => { if (p?.id != null) map[String(p.id)] = p.nome || `Projeto ${p.id}`; });
            return map;
        } catch {
            return {};
        }
    }

    // -------- tabela --------
    function renderTable(list) {
        const tbody = document.getElementById('sustentacaoTableBody');
        if (!tbody) return;

        sustCache = Array.isArray(list) ? list : [];
        tbody.innerHTML = '';

        if (!sustCache.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum chamado encontrado.</td></tr>`;
            return;
        }

        sustCache.forEach(ch => {
            // badge de status
            let badgeClass = 'badge-gray';
            if (/andamento/i.test(ch.status)) badgeClass = 'badge-green';
            else if (/risco|erro/i.test(ch.status)) badgeClass = 'badge-red';
            else if (/susten|pendente/i.test(ch.status)) badgeClass = 'badge-yellow';

            tbody.insertAdjacentHTML('beforeend', `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 text-sm font-medium text-gray-900">${esc(ch.projeto)}</td>
          <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.numero)}</td>
          <td class="px-6 py-4 text-sm"><span class="badge ${badgeClass}">${esc(ch.status)}</span></td>
          <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.desenvolvedor)}</td>
          <td class="px-6 py-4 text-sm text-gray-700">${esc(ch.solicitante)}</td>
          <td class="px-6 py-4 text-sm font-medium">
            <a href="#" onclick="verChamadoByNumero('${esc(ch.numero)}')" class="action-btn action-view">👁️ Ver</a>
            <a href="#" onclick="editarChamado('${esc(ch.numero)}')" class="action-btn action-edit">✏️ Editar</a>
            <a href="#" onclick="excluirChamado('${esc(ch.numero)}')" class="action-btn action-del">🗑️ Excluir</a>
          </td>
        </tr>
      `);
        });
    }


    window.verChamado = function (numero, projeto, status, dev, solicitante, obs) {
        document.getElementById('verProjeto').textContent = projeto || '—';
        document.getElementById('verNumero').textContent = numero || '—';
        document.getElementById('verStatus').textContent = status || '—';
        document.getElementById('verDev').textContent = dev || '—';
        document.getElementById('verSolicitante').textContent = solicitante || '—';
        document.getElementById('verObs').textContent = obs || '—';
        window.showModal && window.showModal('verChamadoModal');
    };


    // -------- gráfico --------
    function colorFor(status) {
        const map = {
            'A desenvolver': '#6b7280',
            'Em desenvolvimento': '#3b82f6',
            'Em homologação': '#8b5cf6',
            'Pendente': '#f59e0b',
            'Suspenso': '#9ca3af',
            'Em testes': '#10b981',
            'Aberto': '#16a34a',
            'Fechado': '#dc2626'
        };
        return map[status] || '#2563eb';
    }

    function drawChart(list) {
        const canvas = document.getElementById('codesSustentacaoChart');
        if (!canvas || !window.Chart) return;

        // conta por status
        const counts = {};
        list.forEach(ch => {
            const s = (ch.status || '—').trim();
            counts[s] = (counts[s] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = labels.map(l => counts[l]);

        if (chartSustentacao) chartSustentacao.destroy();

        chartSustentacao = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Chamados',
                    data,
                    backgroundColor: labels.map(colorFor),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y', // 👈 faz as barras ficarem horizontais
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Distribuição de Chamados por Status' }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1 } },
                    y: { ticks: { font: { size: 12 } } }
                }
            }
        });
    }



    // -------- carga principal --------
    async function loadSustentacao() {
        try {
            // pega projetos (para resolver nome quando vier só id)
            const projetosById = await fetchProjetosById();

            // endpoint dos chamados (ajuste se o seu for diferente)
            const resp = await fetch(`${API_ROOT}/sustentacao`);
            if (!resp.ok) throw new Error(`Erro ao buscar sustentação (${resp.status})`);
            const payload = await resp.json();

            const list = Array.isArray(payload) ? payload.map(r => normalizeChamado(r, projetosById)) : [];

            // atualiza card "Em Sustentação"
            const countEl = document.getElementById('sustentacaoCount');
            if (countEl) countEl.textContent = String(list.length);

            renderTable(list);
            drawChart(list);
        } catch (err) {
            console.error(err);
            const tbody = document.getElementById('sustentacaoTableBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-6 text-center text-sm text-red-600">Falha ao carregar: ${err.message}</td></tr>`;
            }
        }
    }

    // expõe para o index usar
    window.loadSustentacao = loadSustentacao;
})();
