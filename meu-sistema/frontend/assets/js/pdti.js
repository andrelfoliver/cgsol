// ======================
// API PDTI
// ======================
const API_PDTI = 'http://localhost:5001/api/pdti';
let cachePDTI = [];
// normaliza strings (remove acentos e baixa)
function norm(s) {
    return String(s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().trim();
}
// trata situacao: "-" conta como "Não iniciada"
function normSituacao(s) {
    if (!s || s === "-") return "nao iniciada";
    const n = norm(s);
    if (n === "nao iniciadaa") return "nao iniciada"; // só por segurança
    return n;
}

// ======================
// Carregar tabela PDTI
// ======================
function sortPdtiBySituacao(list) {
    const order = { 'Em andamento': 1, 'Não iniciada': 2, 'Concluída': 3 };
    return [...list].sort((a, b) => {
        const sa = order[a.situacao] || 99;
        const sb = order[b.situacao] || 99;
        return sa - sb;
    });
}

async function loadPDTITable() {
    try {
        const res = await fetch(API_PDTI);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        cachePDTI = await res.json();

        filterPDTI();       // aplica ordenação + filtros atuais (se houver)
        updatePDTIKPIs();

    } catch (err) {
        console.error('Erro ao carregar PDTI:', err);
    }
}
function showNotify(titulo, mensagem, tipo = "info") {
    const modal = document.getElementById("notifyModal");
    const bar = document.getElementById("notifyBar");
    const icon = document.getElementById("notifyIcon");
    const titleEl = document.getElementById("notifyTitle");
    const msgEl = document.getElementById("notifyMessage");

    // Define cores e ícones
    let cor = "bg-blue-600";
    let icone = "ℹ️";
    if (tipo === "success") { cor = "bg-green-600"; icone = "✅"; }
    if (tipo === "error") { cor = "bg-red-600"; icone = "❌"; }
    if (tipo === "warn") { cor = "bg-yellow-500"; icone = "⚠️"; }

    bar.className = `h-1 ${cor}`;
    icon.textContent = icone;
    titleEl.textContent = titulo;
    msgEl.textContent = mensagem;

    modal.classList.remove("hidden");

    // Auto-close em 3s
    setTimeout(() => { modal.classList.add("hidden"); }, 3000);
}

// ======================
// Renderizar tabela
// ======================
function renderPDTITable(list) {
    const tableBody = document.getElementById('pdtiTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    sortPdtiBySituacao(list).forEach(action => {
        // Classes de status
        let statusClass = '';
        switch (action.situacao) {
            case 'Concluída': statusClass = 'bg-green-100 text-green-800'; break;
            case 'Em andamento': statusClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'Não iniciada': statusClass = 'bg-red-100 text-red-800'; break;
            default: statusClass = 'bg-gray-100 text-gray-800';
        }

        // Classes de tipo
        let tipoClass = '';
        let tipoText = '';
        switch (action.tipo) {
            case 'SDF': tipoClass = 'bg-blue-100 text-blue-800'; tipoText = 'Soluções Digitais'; break;
            case 'SDD': tipoClass = 'bg-purple-100 text-purple-800'; tipoText = 'Soluções de Dados'; break;
            case 'SDS': tipoClass = 'bg-green-100 text-green-800'; tipoText = 'Soluções de Sistemas'; break;
            default: tipoClass = 'bg-gray-100 text-gray-800'; tipoText = action.tipo || '—';
        }

        // Linha da tabela
        tableBody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${action.id}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${action.descricao}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
              ${action.situacao}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tipoClass}">
              ${tipoText}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
            <button 
  onclick="showPDTIModal('${encodeURIComponent(JSON.stringify(action))}')"
  class="text-blue-600 hover:text-blue-900">✏️ Editar
</button>

            <button onclick="confirmDeletePDTI('${action.id}')"
              class="text-red-600 hover:text-red-900">🗑️ Excluir</button>
          </td>
        </tr>
      `);
    });
}

function filterPDTI() {
    if (!Array.isArray(cachePDTI)) return;

    const stSel = document.getElementById("pdtiStatusFilter");
    const tpSel = document.getElementById("pdtiTipoFilter");
    const qEl = document.getElementById("pdtiSearchFilter");

    const statusRaw = stSel ? stSel.value : "";
    const tipoRaw = tpSel ? tpSel.value : "";
    const qRaw = qEl ? qEl.value : "";

    // "-" no select significa "Não iniciada"
    const statusNorm = norm(statusRaw === "-" ? "Não iniciada" : statusRaw);
    const q = norm(qRaw);

    let list = cachePDTI.filter(a => {
        const sOk = !statusNorm || normSituacao(a.situacao) === statusNorm;
        const tOk = !tipoRaw || (a.tipo || "") === tipoRaw;
        const bOk = !q || norm(a.descricao).includes(q) || norm(a.id).includes(q);
        return sOk && tOk && bOk;
    });

    // ordenação pedida: Em andamento (1), Não iniciada (2), Concluída (3)
    const order = { "em andamento": 1, "nao iniciada": 2, "concluida": 3 };
    list.sort((a, b) => {
        const sa = order[normSituacao(a.situacao)] || 99;
        const sb = order[normSituacao(b.situacao)] || 99;
        if (sa !== sb) return sa - sb;
        return String(a.id).localeCompare(String(b.id)); // desempate estável
    });

    renderPDTITable(list);
}

// resetar filtros
function clearPDTIFilters() {
    const st = document.getElementById("pdtiStatusFilter");
    const tp = document.getElementById("pdtiTipoFilter");
    const q = document.getElementById("pdtiSearchFilter");
    if (st) st.value = "";
    if (tp) tp.value = "";
    if (q) q.value = "";
    filterPDTI();
}

// garante que os handlers inline do HTML funcionem
window.filterPDTI = filterPDTI;
window.clearPDTIFilters = clearPDTIFilters;

function filterPDTIByStatus(status) {
    const stSel = document.getElementById("pdtiStatusFilter");
    if (stSel) stSel.value = status;   // seta o select invisível, se existir
    filterPDTI();                      // reaplica filtro + render
}
window.filterPDTIByStatus = filterPDTIByStatus;


// ======================
// Atualizar KPIs
// ======================
function updatePDTIKPIs() {
    const total = cachePDTI.length;
    const concluidas = cachePDTI.filter(a => a.situacao === 'Concluída').length;
    const andamento = cachePDTI.filter(a => a.situacao === 'Em andamento').length;
    const naoIniciadas = cachePDTI.filter(a => a.situacao === 'Não iniciada').length;

    // Totais principais
    document.getElementById('totalAcoes').textContent = total;
    document.getElementById('acoesConcluidas').textContent = concluidas;
    document.getElementById('acoesAndamento').textContent = andamento;
    document.getElementById('acoesNaoIniciadas').textContent = naoIniciadas;

    // Percentuais
    const concluidasPercent = total ? Math.round((concluidas / total) * 100) : 0;
    const andamentoPercent = total ? Math.round((andamento / total) * 100) : 0;
    const naoIniciadasPercent = total ? Math.round((naoIniciadas / total) * 100) : 0;

    // Atualiza % nos cards
    const cards = [
        { id: 'acoesConcluidas', pct: concluidasPercent },
        { id: 'acoesAndamento', pct: andamentoPercent },
        { id: 'acoesNaoIniciadas', pct: naoIniciadasPercent }
    ];
    cards.forEach(({ id, pct }) => {
        const card = document.getElementById(id)?.parentElement;
        if (card) {
            const pctEl = card.querySelector('p.text-xs');
            if (pctEl) pctEl.textContent = `${pct}%`;
        }
    });

    // Barra de progresso geral
    const progressBar = document.getElementById('pdtiProgressBar');
    if (progressBar) {
        progressBar.style.width = `${concluidasPercent}%`;
        progressBar.textContent = `${concluidasPercent}% Concluído`;
    }

    // Boxes embaixo da barra
    if (document.getElementById('boxConcluidas'))
        document.getElementById('boxConcluidas').textContent = concluidas;
    if (document.getElementById('boxAndamento'))
        document.getElementById('boxAndamento').textContent = andamento;
    if (document.getElementById('boxNaoIniciadas'))
        document.getElementById('boxNaoIniciadas').textContent = naoIniciadas;
}

let pdtiTipoChart, pdtiTimelineChart;

function renderPDTICharts() {
    // ==== Donut por Tipo ====
    const tipos = ['SDF', 'SDD', 'SDS'];
    const counts = tipos.map(t => cachePDTI.filter(a => a.tipo === t).length);

    if (pdtiTipoChart) pdtiTipoChart.destroy();
    pdtiTipoChart = new Chart(document.getElementById('pdtiTipoChart'), {
        type: 'doughnut',
        data: {
            labels: ['Soluções Digitais (SDF)', 'Soluções de Dados (SDD)', 'Soluções de Sistemas (SDS)'],
            datasets: [{
                data: counts,
                backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,   // ✅ força ocupar o container
            cutout: '65%',                // ✅ reduz o furo para caber mais
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 12,   // ✅ controla tamanho do marcador
                        font: { size: 12 } // ✅ fonte menor pra não cortar
                    }
                }
            }
        }
    });



    // ==== Linha do Tempo (Concluídas por mês) ====
    const concluidas = cachePDTI.filter(a => a.situacao === 'Concluída');
    const countsByMonth = {};

    concluidas.forEach(a => {
        // 👉 aqui você pode usar data real; como mock, usamos "2025-01"
        const mes = a.data_conclusao ? a.data_conclusao.slice(0, 7) : "2025-01";
        countsByMonth[mes] = (countsByMonth[mes] || 0) + 1;
    });

    const labels = Object.keys(countsByMonth).sort();
    const values = labels.map(m => countsByMonth[m]);

    if (pdtiTimelineChart) pdtiTimelineChart.destroy();
    pdtiTimelineChart = new Chart(document.getElementById('pdtiTimelineChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Concluídas',
                data: values,
                fill: false,
                borderColor: '#16a34a',
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

// Chamar sempre que carregar/atualizar
async function loadPDTITable() {
    try {
        const res = await fetch(API_PDTI);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
        cachePDTI = await res.json();

        filterPDTI();
        updatePDTIKPIs();
        renderPDTICharts();   // <<< aqui!
    } catch (err) {
        console.error('Erro ao carregar PDTI:', err);
    }
}

// ======================
// CRUD
// ======================
async function addPDTIAction(dados) {
    const res = await fetch(API_PDTI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
    });
    if (res.ok) loadPDTITable();
}

async function editPDTIAction(id) {
    const acao = cachePDTI.find(a => a.id === id);
    if (!acao) return;
    // 👉 aqui você pode abrir modal pré-preenchido
    console.log("Editar ação:", acao);
}

async function deletePDTIAction(id) {
    if (!confirm("Excluir ação do PDTI?")) return;
    await fetch(`${API_PDTI}/${id}`, { method: "DELETE" });
    loadPDTITable();
}
// ======================
// Modal de Adicionar/Editar PDTI
// ======================
// Abre modal de edição com dados preenchidos
function showPDTIModal(acaoJSON = null) {
    const acao = acaoJSON ? JSON.parse(decodeURIComponent(acaoJSON)) : null;
    const modal = document.getElementById('pdtiModal');
    const form = document.getElementById('pdtiForm');
    const btn = document.getElementById('submitPDTIBtn');

    if (acao) {
        form.dataset.id = acao.id;
        document.getElementById('pdtiId').value = acao.id;
        document.getElementById('pdtiId').disabled = true;
        document.getElementById('pdtiDescricao').value = acao.descricao;
        document.getElementById('pdtiSituacao').value = acao.situacao;
        document.getElementById('pdtiTipo').value = acao.tipo;
        btn.textContent = "Atualizar Ação";
    } else {
        delete form.dataset.id;
        form.reset();
        document.getElementById('pdtiId').disabled = false;
        btn.textContent = "Salvar Ação";
    }

    modal.classList.remove('hidden');
}

function hidePDTIModal() {
    document.getElementById('pdtiModal').classList.add('hidden');
}

// Confirmação antes de excluir
function confirmDeletePDTI(id) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = "Confirmar exclusão";
    document.getElementById('confirmMessage').textContent = `Tem certeza que deseja excluir a ação ${id}?`;

    modal.classList.remove('hidden');

    window.confirmDelete = async () => {
        try {
            await fetch(`${API_PDTI}/${id}`, { method: "DELETE" });
            showNotify("Ação Excluída", `A ação ${id} foi removida.`, "success");
            modal.classList.add('hidden');
            loadPDTITable();
        } catch (err) {
            console.error("Erro ao excluir ação:", err);
            showNotify("Erro", "❌ Não foi possível excluir a ação.", "error");
        }
    };


    window.cancelDelete = () => {
        modal.classList.add('hidden');
    };
}


// ======================
// Submit do Formulário PDTI (criar/editar)
// ======================
document.getElementById('pdtiForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const dados = {
        id: document.getElementById('pdtiId').value.trim(),
        descricao: document.getElementById('pdtiDescricao').value.trim(),
        situacao: document.getElementById('pdtiSituacao').value,
        tipo: document.getElementById('pdtiTipo').value
    };

    try {
        if (form.dataset.id) {
            // Atualizar existente
            await fetch(`${API_PDTI}/${form.dataset.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
            showNotify("Ação Atualizada", `A ação ${dados.id} foi atualizada com sucesso.`, "success");
        } else {
            // Criar novo
            await fetch(API_PDTI, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
            showNotify("Ação Criada", `A ação ${dados.id} foi criada com sucesso.`, "success");
        }

        hidePDTIModal();
        loadPDTITable();

    } catch (err) {
        console.error("Erro ao salvar ação PDTI:", err);
        showNotify("Erro", "❌ Ocorreu um erro ao salvar a ação. Verifique o console.", "error");
    }

});


// ======================
// Inicialização
// ======================
document.addEventListener('DOMContentLoaded', () => {
    loadPDTITable();
});
