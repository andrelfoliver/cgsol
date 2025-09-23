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
let currentPDTI = []; // sempre aponta para o dataset em uso (filtrado ou completo)

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
function updatePDTIKPIs(data = cachePDTI) {
    const total = data.length;
    const concluidas = data.filter(a => a.situacao === 'Concluída').length;
    const andamento = data.filter(a => a.situacao === 'Em andamento').length;
    const naoIniciadas = data.filter(a => a.situacao === 'Não iniciada').length;

    document.getElementById('totalAcoes').textContent = total;
    document.getElementById('acoesConcluidas').textContent = concluidas;
    document.getElementById('acoesAndamento').textContent = andamento;
    document.getElementById('acoesNaoIniciadas').textContent = naoIniciadas;

    const concluidasPercent = total ? Math.round((concluidas / total) * 100) : 0;
    const andamentoPercent = total ? Math.round((andamento / total) * 100) : 0;
    const naoIniciadasPercent = total ? Math.round((naoIniciadas / total) * 100) : 0;

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

    const progressBar = document.getElementById('pdtiProgressBar');
    if (progressBar) {
        progressBar.style.width = `${concluidasPercent}%`;
        progressBar.textContent = `${concluidasPercent}% Concluído`;
    }

    if (document.getElementById('boxConcluidas'))
        document.getElementById('boxConcluidas').textContent = concluidas;
    if (document.getElementById('boxAndamento'))
        document.getElementById('boxAndamento').textContent = andamento;
    if (document.getElementById('boxNaoIniciadas'))
        document.getElementById('boxNaoIniciadas').textContent = naoIniciadas;
}

function updatePDTIProgress(data = cachePDTI) {
    const total = data.length || 0;
    const concluidas = data.filter(a => a.situacao === 'Concluída').length;
    const pct = total ? Math.round((concluidas / total) * 100) : 0;
    const bar = document.getElementById('pdtiProgressBar');
    if (bar) {
        bar.style.width = pct + '%';
        bar.textContent = `${pct}% Concluído`;
    }
}


// 👉 expõe pro showPage (e mantém nomes que ele chama)
window.updatePDTIProgress = updatePDTIProgress;
window.drawPDTICharts = function () { renderPDTICharts(); }; // alias

// ---- helpers timeline (contagem mensal contínua) ----
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function parseISOorYMD(s) {
    if (!s) return null;
    const t = String(s).trim();
    // aceita 'YYYY-MM-DD' (ou com horário)
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(t);
    return isNaN(d) ? null : d;
}
function buildMonthlySeries(items, dateProp) {
    const dates = items
        .map(x => parseISOorYMD(x[dateProp]))
        .filter(d => d instanceof Date && !isNaN(d));
    if (!dates.length) return [];

    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    // normaliza p/ início do mês
    min.setDate(1); min.setHours(0, 0, 0, 0);
    max.setDate(1); max.setHours(0, 0, 0, 0);

    // contagem bruta por mês
    const counts = {};
    dates.forEach(d => {
        const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
        counts[k] = (counts[k] || 0) + 1;
    });

    // preenche meses faltantes com 0
    const out = [];
    const cur = new Date(min);
    while (cur <= max) {
        const k = monthKey(cur);
        out.push({ x: new Date(cur), y: counts[k] || 0 });
        cur.setMonth(cur.getMonth() + 1);
    }
    return out;
}

let pdtiTipoChart, pdtiTimelineChart;
// tenta pegar a data de conclusão em vários nomes de campo
function getConclusaoDateField(a) {
    return (
        a.data_conclusao ??
        a.dataConclusao ??
        a.dt_conclusao ??
        a.dtConclusao ??
        a.conclusao ??
        a.dataFim ??
        a.data_fim ??
        null
    );
}


function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function buildMonthlySeriesFlexible(items, getDateFn) {
    const dates = items
        .map(x => parseDateFlexible(getDateFn(x)))
        .filter(d => d instanceof Date && !isNaN(d));

    if (!dates.length) return [];

    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    min.setDate(1); min.setHours(0, 0, 0, 0);
    max.setDate(1); max.setHours(0, 0, 0, 0);

    const counts = {};
    dates.forEach(d => {
        const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
        counts[k] = (counts[k] || 0) + 1;
    });

    // série contínua mês a mês
    const serie = [];
    const cur = new Date(min);
    while (cur <= max) {
        const k = monthKey(cur);
        serie.push({ x: new Date(cur), y: counts[k] || 0 });
        cur.setMonth(cur.getMonth() + 1);
    }
    return serie;
}
// tenta achar a data de conclusão em vários nomes de campo
function getConclusaoDateValue(a) {
    // campos explícitos de conclusão
    const cands = [
        a.data_conclusao, a.dataConclusao, a.dt_conclusao, a.dtConclusao,
        a.conclusao, a.mes_conclusao, a.mesConclusao,
        a.dataFim, a.data_fim, a.fim,
        a.termino, a.termino_real, a.data_conclusao_real,
    ];
    for (const v of cands) if (v) return v;

    // se não houver, tente campos “audit” que às vezes vêm da API
    const audit = [
        a.updated_at, a.updatedAt, a.last_update, a.lastUpdate,
        a.created_at, a.createdAt, a.inserted_at, a.insertedAt,
        a.endDate, a.end_date
    ];
    for (const v of audit) if (v) return v;

    // varredura por nome aproximado
    for (const k of Object.keys(a)) {
        if (/(conclu|fim|final|end|termin|mes.*conclu|mes.*fim|updated|created|last.*updat)/i.test(k) && a[k]) {
            return a[k];
        }
    }
    return null;
}

// === PARSER ROBUSTO DE MÊS/ANO ===
// === parser robusto de mês/ano (aceita PT/EN, ano 2 ou 4 dígitos) ===
function parseMonthAny(raw) {
    if (raw == null) return null;
    if (raw instanceof Date && !isNaN(raw)) {
        return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));
    }
    const t0 = String(raw).trim();

    // normaliza nomes PT/EN para 3 letras
    const mesesPT = { janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11, jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
    const mesesEN = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11, jan: 0, feb: 1, mar: 2, apr: 3, may2: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const lower = t0.toLowerCase();

    const toDateUTC = (y, m) => new Date(Date.UTC(Number(y), Number(m), 1));
    const fixYY = (yy) => (yy < 50 ? 2000 + yy : yy < 100 ? 1900 + yy : yy);

    // 1) YYYY-MM(-DD) ou YYYY/MM(/DD)
    let m = lower.match(/^(\d{4})[\/.-](\d{1,2})(?:[\/.-](\d{1,2}))?$/);
    if (m) { const y = +m[1], mo = +m[2] - 1; if (mo >= 0 && mo < 12) return toDateUTC(y, mo); }

    // 2) DD/MM/YYYY ou DD-MM-YYYY
    m = lower.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (m) { const y = fixYY(+m[3]), mo = +m[2] - 1; if (mo >= 0 && mo < 12) return toDateUTC(y, mo); }

    // 3) MM/YYYY ou M/YY
    m = lower.match(/^(\d{1,2})[\/.-](\d{2,4})$/);
    if (m) { const mo = +m[1] - 1, y = fixYY(+m[2]); if (mo >= 0 && mo < 12) return toDateUTC(y, mo); }

    // 4) YYYYMM
    m = lower.match(/^(\d{4})(\d{2})$/);
    if (m) { const y = +m[1], mo = +m[2] - 1; if (mo >= 0 && mo < 12) return toDateUTC(y, mo); }

    // 5) "set/2025", "set 25", "setembro 2025", "oct 2025", etc.
    m = lower.match(/^([a-zç]+)[ ./-]+(\d{2,4})$/);
    if (m) {
        const key = m[1].normalize('NFD').replace(/[^\w]/g, ''); // tira acento
        const mo = (mesesPT[key] ?? mesesEN[key] ?? null);
        if (mo != null) { const y = fixYY(+m[2]); return toDateUTC(y, mo); }
    }

    // 6) fallback: deixa o motor do JS tentar e normaliza p/ mês
    const tryJs = new Date(t0);
    if (!isNaN(tryJs)) return toDateUTC(tryJs.getUTCFullYear(), tryJs.getUTCMonth());

    return null;
}

// === tenta por nome conhecido e depois "arranca" datas de QUALQUER campo/substring ===
function getConclusaoSmartDate(a) {
    // a) campos “clássicos”
    const preferida = getConclusaoDateValue(a);
    const d1 = parseMonthAny(preferida);
    if (d1) return d1;

    // b) varredura por todas as props (inclui trechos de textos longos)
    const grabbers = [
        // YYYY-MM(-DD) / YYYY/MM(/DD)
        /(\d{4})[\/.-](\d{1,2})(?:[\/.-](\d{1,2}))?/g,
        // DD/MM/YYYY
        /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/g,
        // MM/YYYY ou M/YY
        /(\d{1,2})[\/.-](\d{2,4})/g,
        // YYYYMM
        /(\d{4})(\d{2})/g,
        // NomeMes/ano (PT/EN, abreviado ou completo)
        /\b([a-zç]{3,9})[ ./-]+(\d{2,4})\b/gi
    ];

    for (const [, v] of Object.entries(a)) {
        if (v == null) continue;
        const text = String(v);
        for (const rg of grabbers) {
            rg.lastIndex = 0;
            let m;
            while ((m = rg.exec(text))) {
                const found = m[0];
                const d = parseMonthAny(found);
                if (d) return d;
            }
        }
    }
    return null;
}




// utilitários p/ timeline contínua
function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function buildMonthlySeriesFlexible(items, getDateFn) {
    const dates = items
        .map(x => parseDateFlexible(getDateFn(x)))
        .filter(d => d instanceof Date && !isNaN(d));

    if (!dates.length) return [];

    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    min.setDate(1); min.setHours(0, 0, 0, 0);
    max.setDate(1); max.setHours(0, 0, 0, 0);

    const counts = {};
    dates.forEach(d => {
        const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
        counts[k] = (counts[k] || 0) + 1;
    });

    const serie = [];
    const cur = new Date(min);
    while (cur <= max) {
        const k = monthKey(cur);
        serie.push({ x: new Date(cur), y: counts[k] || 0 });
        cur.setMonth(cur.getMonth() + 1);
    }
    return serie;
}
function parseYMDUTC(ymd) {
    if (!ymd) return null;
    const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1;
    return new Date(Date.UTC(y, mo, 1)); // normaliza pro 1º dia do mês (UTC)
}

function renderPDTICharts(data = cachePDTI) {
    // ===== DONUT =====
    const TIPOS = ['SDF', 'SDD', 'SDS'];
    const COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];
    const labelsLongas = ['Soluções Digitais (SDF)', 'Soluções de Dados (SDD)', 'Soluções de Sistemas (SDS)'];

    if (pdtiTipoChart) pdtiTipoChart.destroy?.();
    const tipoCtx = document.getElementById('pdtiTipoChart');
    if (tipoCtx) {
        const countsTipos = TIPOS.map(t => data.filter(a => a.tipo === t).length);
        pdtiTipoChart = new Chart(tipoCtx, {
            type: 'doughnut',
            data: { labels: labelsLongas, datasets: [{ data: countsTipos, backgroundColor: COLORS, borderColor: '#fff', borderWidth: 2 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 12, font: { size: 12 } } } }
            }
        });
    }

    // ===== TIMELINE por mês (NÃO acumulada, área preenchida) =====
    const concluidas = data.filter(a => a.situacao === 'Concluída');

    const byMonth = {};
    concluidas.forEach(a => {
        const k = String(a.data_conclusao || '').slice(0, 7); // "YYYY-MM"
        if (k) byMonth[k] = (byMonth[k] || 0) + 1;
    });

    const keys = Object.keys(byMonth).sort();
    let labelsISO = [], countsPerMonth = [];
    if (keys.length) {
        const [y0, m0] = keys[0].split('-').map(Number);
        const [y1, m1] = keys[keys.length - 1].split('-').map(Number);
        const cur = new Date(Date.UTC(y0, m0 - 1, 1));
        const end = new Date(Date.UTC(y1, m1 - 1, 1));
        while (cur <= end) {
            const ym = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
            labelsISO.push(ym);
            countsPerMonth.push(byMonth[ym] || 0);
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    } else {
        const now = new Date();
        const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        labelsISO = [ym];
        countsPerMonth = [0];
    }

    const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const labelsMonth = labelsISO.map(ym => {
        const [yy, mm] = ym.split('-').map(Number);
        return `${MESES_PT[mm - 1]}/${String(yy).slice(-2)}`;
    });

    if (pdtiTimelineChart) pdtiTimelineChart.destroy?.();
    const tlCtx = document.getElementById('pdtiTimelineChart');
    if (tlCtx) {
        pdtiTimelineChart = new Chart(tlCtx, {
            type: 'line',
            data: {
                labels: labelsMonth,
                datasets: [{
                    label: 'Concluídas no mês',
                    data: countsPerMonth,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22,163,74,0.20)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 3,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { autoSkip: true, maxRotation: 0 } },
                    y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Quantidade' } }
                }
            }
        });
    }
}




// Chamar sempre que carregar/atualizar
async function loadPDTITable() {
    try {
        const res = await fetch(API_PDTI);
        if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

        cachePDTI = await res.json();

        // 🔄 mantém o showPage em sintonia com os mesmos dados
        window.pdtiData = cachePDTI;

        // 🔁 render / KPIs / progresso / charts
        filterPDTI();
        updatePDTIKPIs();
        updatePDTIProgress();  // garante barra correta
        renderPDTICharts();    // mantém a legenda com tooltip

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

    // monta payload básico
    const dados = {
        id: document.getElementById('pdtiId').value.trim(),
        descricao: document.getElementById('pdtiDescricao').value.trim(),
        situacao: document.getElementById('pdtiSituacao').value,
        tipo: document.getElementById('pdtiTipo').value
    };

    // ---- NOVO: carimbar data_conclusao quando vira Concluída ----
    // pega registro atual (se já existir)
    const atual = cachePDTI.find(a => a.id === dados.id);

    const virouConcluida =
        dados.situacao === 'Concluída' &&
        (!atual || (atual.situacao !== 'Concluída'));

    const jaTemDataConclusao =
        getConclusaoDateValue(atual || {}) != null ||
        'data_conclusao' in (atual || {}) ||
        'dataConclusao' in (atual || {});

    if (virouConcluida && !jaTemDataConclusao) {
        // use formato YYYY-MM (mês de referência) ou YYYY-MM-DD, como preferir
        const hoje = new Date();
        const y = hoje.getFullYear();
        const m = String(hoje.getMonth() + 1).padStart(2, '0');
        dados.data_conclusao = `${y}-${m}-01`; // grava primeiro dia do mês
    }
    // ---- FIM do carimbo automático ----

    try {
        if (form.dataset.id) {
            await fetch(`${API_PDTI}/${form.dataset.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });
            showNotify("Ação Atualizada", `A ação ${dados.id} foi atualizada com sucesso.`, "success");
        } else {
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
function normSituacao(s) {
    if (!s || s === "-") return "nao iniciada";
    const n = norm(s); // sem acento, minúsculo
    // normalizações explícitas
    if (n === "nao iniciadaa") return "nao iniciada";
    if (n === "concluido") return "concluida";
    if (n === "concluida") return "concluida";
    if (n.replace(/\s+/g, "_") === "em_andamento") return "em andamento";
    return n;
}
