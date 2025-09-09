/**
 * SigSOL main.js — versão limpa (sem localStorage)
 * Todos os dados persistem no backend (Postgres).
 */

(function () {
  'use strict';

  const API = 'http://localhost:5001/api/projetos';

  // Cache em memória
  let cacheProjetos = [];
  let chartCoordenacao = null;
  let chartStatus = null;
  let chartCodes = null;
  let chartCoset = null;
  let chartCgod = null;

  // ========= boot =========
  onReady(async () => {
    const form = byId('projectForm');
    if (form) {
      const coordSel = byId('projectCoord');
      if (coordSel) {
        coordSel.addEventListener('change', () => toggleFormByCoord(coordSel.value));
        toggleFormByCoord(coordSel.value);
      }

      form.addEventListener('submit', handleCreateOrUpdate);
    }

    // Expor funções no escopo global (usadas no HTML)
    window.filterProjects = filterProjects;
    window.showProjectDetail = showProjectDetail;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.openNewProject = openNewProject;

    await loadProjetos();
    updateLastUpdateTime();
  });

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else fn();
  }

  // ========= helpers DOM =========
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { const el = byId(id); if (el) el.textContent = (v ?? '—'); }
  function setValue(id, v) { const el = byId(id); if (el != null) el.value = (v ?? ''); }
  function getValue(id) { const el = byId(id); return el ? el.value : ''; }
  function js(v) { return JSON.stringify(v); }
  async function safeJsonOrNull(res) { try { return await res.json(); } catch { return null; } }
  function escapeHtml(s) {
    if (s == null) return s;
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  // ========= carregar projetos =========
  async function loadProjetos() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const projetos = await res.json();
      cacheProjetos = Array.isArray(projetos) ? projetos : [];

      renderRecentTable(cacheProjetos);
      renderAllCoordTables(cacheProjetos);
      updateKPIs(cacheProjetos);
      drawCharts(cacheProjetos);
      drawCodesSprintsChart(cacheProjetos);
      drawCosetTiposChart(cacheProjetos);

      updateLastUpdateTime();
    } catch (err) {
      console.error(err);
      toast('Erro', 'Erro ao carregar projetos: ' + err.message, 'error');
    }
  }


  // ========= Tabelas =========
  function renderRecentTable(list) {
    const tbody = byId('projectsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto cadastrado.</td></tr>`;
      return;
    }
    list.forEach(p => {
      const idArg = js(p.id);
      tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">${escapeHtml(p.coordenacao) || '-'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">
                ${escapeHtml(p.status) || '-'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">${escapeHtml(p.rag) || '—'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(p.responsavel) || '—'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button class="text-blue-600 hover:text-blue-900 mr-3" onclick="showProjectDetail(${idArg})">👁️ Ver</button>
              <button class="text-green-600 hover:text-green-900 mr-3" onclick="editProject(${idArg})">✏️ Editar</button>
              <button class="text-red-600 hover:text-red-900" onclick="deleteProject(${idArg})">🗑️ Excluir</button>
            </td>
          </tr>
        `);
    });
  }

  function renderAllCoordTables(list) {
    renderCoordTable('CODES', 'codesTableBody', list);
    renderCoordTable('COSET', 'cosetTableBody', list);
    renderCoordTable('CGOD', 'cgodTableBody', list);
  }

  function renderCoordTable(coord, tbodyId, list) {
    const tbody = byId(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    const rows = list.filter(p => (p.coordenacao || '') === coord);
    const colCount = (tbodyId === 'codesTableBody') ? 7 : 6;
    const emptyMsg = `<tr><td colspan="${colCount}" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto encontrado.</td></tr>`;
    if (!rows.length) { tbody.innerHTML = emptyMsg; return; }

    rows.forEach(p => {
      const idArg = js(p.id);
      const progresso = (p.progresso != null) ? Number(p.progresso) : null;
      const sprints = (p.sprintsConcluidas != null && p.totalSprints != null)
        ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—';

      if (tbodyId === 'codesTableBody') {
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div></td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span></td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">${escapeHtml(p.rag) || '—'}</span></td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="h-2 rounded-full bg-blue-600" style="width:${progresso != null ? progresso : 0}%"></div>
                  </div>
                  <span class="text-sm text-gray-900">${progresso != null ? progresso + '%' : '—'}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${sprints}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(p.responsavel) || '—'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="showProjectDetail(${idArg})" class="text-blue-600 hover:text-blue-900 mr-3">👁️ Ver</button>
                <button onclick="editProject(${idArg})" class="text-green-600 hover:text-green-900 mr-3">✏️ Editar</button>
                <button onclick="deleteProject(${idArg})" class="text-red-600 hover:text-red-900">🗑️ Excluir</button>
              </td>
            </tr>
          `);
      } else {
        // COSET / CGOD
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div></td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span></td>
              <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">${escapeHtml(p.rag) || '—'}</span></td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div class="h-2 rounded-full bg-blue-600" style="width:${progresso != null ? progresso : 0}%"></div>
                  </div>
                  <span class="text-sm text-gray-900">${progresso != null ? progresso + '%' : '—'}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(p.responsavel) || '—'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="showProjectDetail(${idArg})" class="text-blue-600 hover:text-blue-900 mr-3">👁️ Ver</button>
                <button onclick="editProject(${idArg})" class="text-green-600 hover:text-green-900 mr-3">✏️ Editar</button>
                <button onclick="deleteProject(${idArg})" class="text-red-600 hover:text-red-900">🗑️ Excluir</button>
              </td>
            </tr>
          `);
      }
    });
  }

  // ========= KPIs =========
  function updateKPIs(list) {
    const norm = str => String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const codes = list.filter(p => norm(p.coordenacao) === 'codes');
    const coset = list.filter(p => norm(p.coordenacao) === 'coset');
    const cgod = list.filter(p => norm(p.coordenacao) === 'cgod');

    // Concluídos no mês
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    const concluidosMes = list.filter(p => {
      if (p.status !== 'Concluído' || !p.fim) return false;
      const d = new Date(p.fim);
      return !isNaN(d) && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    }).length;
    setText('kpiConcluidosMes', concluidosMes);

    // Fora do prazo
    const foraPrazo = list.filter(p => {
      if (!p.fim || p.status === 'Concluído') return false;
      const d = new Date(p.fim);
      return !isNaN(d) && d < now;
    }).length;
    setText('kpiForaPrazo', foraPrazo);

    // Progresso médio
    const progressoVals = list.map(p => p.progresso).filter(v => v != null);
    const progressoMedio = progressoVals.length
      ? Math.round(progressoVals.reduce((a, b) => a + b, 0) / progressoVals.length)
      : 0;
    setText('kpiProgressoMedio', progressoMedio + '%');

    // Projetos ativos
    const ativos = list.filter(p =>
      p.status === 'Em Andamento' || p.status === 'Sustentação'
    ).length;
    setText('kpiProjetosAtivos', ativos);

    // Totais Home
    setText('totalProjetos', list.length);
    setText('projetosCodes', codes.length);
    setText('projetosCoset', coset.length);
    setText('projetosCgod', cgod.length);

    // Home – Detalhamento CODES
    setCardCount('codes', 'desenvolvimento', codes.filter(p => norm(p.status) === 'em andamento').length);
    setCardCount('codes', 'sustentacao', codes.filter(p => norm(p.status) === 'sustentacao').length);

    // Home – Detalhamento COSET
    setCardCount('coset', 'infraestrutura', coset.filter(p => norm(p.tipo).includes('infraestrutura')).length);
    setCardCount('coset', 'integracao', coset.filter(p => norm(p.tipo).includes('integracao')).length);

    // Home – Detalhamento CGOD
    setCardCount('cgod', 'analytics', cgod.filter(p => /dashboard|bi/.test(norm(p.tipo))).length);
    setCardCount('cgod', 'datalake', cgod.filter(p => norm(p.tipo).includes('dados')).length);

    // CODES page
    setCardCount('codes', 'ativos', codes.filter(p => ['em andamento', 'sustentacao'].includes(norm(p.status))).length);
    setCardCount('codes', 'fora-prazo', codes.filter(p => p.status === 'Em Risco' || (p.rag || '').toLowerCase() === 'vermelho').length);

    // COSET page
    setCardCount('coset', 'sistemas-integrados', coset.filter(p => norm(p.tipo).includes('sistema integrado')).length);
    setCardCount('coset', 'modernizacao', coset.filter(p => norm(p.tipo).includes('modernizacao')).length);
    setCardCount('coset', 'compliance', coset.filter(p => norm(p.tipo).includes('compliance')).length);

    // CGOD page
    setCardCount('cgod', 'catalogos', cgod.filter(p => /catalogo/.test(norm(p.nome)) || norm(p.tipo).includes('dados')).length);
    setCardCount('cgod', 'qualidade', cgod.filter(p => norm(p.tipo).includes('qualidade')).length);
    setCardCount('cgod', 'governanca', cgod.filter(p => norm(p.tipo).includes('governanca')).length);
  }

  function setCardCount(coordKey, cat, value) {
    const sel = `[data-card="${coordKey}:${cat}"]`;
    const containers = document.querySelectorAll(sel);

    if (!containers.length) {
      console.warn(`setCardCount: nenhum container para ${coordKey}:${cat}`);
      return;
    }

    containers.forEach(container => {
      let countEl =
        container.querySelector('p.text-2xl.font-bold') ||
        container.querySelector('p.text-2xl') ||
        container.querySelector('span.text-lg.font-bold') ||
        container.querySelector('span.text-lg') ||
        container.querySelector('.count');

      if (!countEl) {
        const cands = Array.from(container.querySelectorAll('span, p')).reverse();
        countEl = cands.find(n => /\d+/.test(n.textContent || ''));
      }
      if (countEl) countEl.textContent = value;
    });
  }


  // ========= GRÁFICOS (Home) =========
  // ========= Gráficos Home =========
  function drawCharts(list) {
    const codes = list.filter(p => p.coordenacao === 'CODES').length;
    const coset = list.filter(p => p.coordenacao === 'COSET').length;
    const cgod = list.filter(p => p.coordenacao === 'CGOD').length;

    const st = s => list.filter(p => p.status === s).length;
    const statusData = {
      'Planejado': st('Planejado'),
      'Em Andamento': st('Em Andamento'),
      'Em Risco': st('Em Risco'),
      'Concluído': st('Concluído'),
      'Sustentação': st('Sustentação')
    };

    if (chartCoordenacao) chartCoordenacao.destroy();
    if (chartStatus) chartStatus.destroy();

    // Projetos por Coordenação
    const coordCanvas = byId('coordenacaoChart');
    if (coordCanvas && window.Chart) {
      chartCoordenacao = new Chart(coordCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['CODES', 'COSET', 'CGOD'],
          datasets: [{
            data: [codes, coset, cgod],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#f97316']
          }]
        }
      });
    }

    // Distribuição por Status
    const distribCanvas = byId('statusDistribChart');
    if (distribCanvas && window.Chart) {
      new Chart(distribCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusData),
          datasets: [{
            data: Object.values(statusData),
            backgroundColor: ['#6b7280', '#16a34a', '#dc2626', '#2563eb', '#f59e0b'],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '55%' }
      });
    }

    // Consolidação RAG
    const ragCounts = { Verde: 0, Amarelo: 0, Vermelho: 0 };
    list.forEach(p => {
      if (p.rag && ragCounts[p.rag] != null) ragCounts[p.rag]++;
    });
    const ragCanvas = byId('ragChart');
    if (ragCanvas && window.Chart) {
      new Chart(ragCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(ragCounts),
          datasets: [{
            label: 'Projetos',
            data: Object.values(ragCounts),
            backgroundColor: ['#16a34a', '#f59e0b', '#dc2626'],
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // Evolução Temporal
    const monthlyData = {};
    list.forEach(p => {
      if (p.inicio) {
        const d = new Date(p.inicio);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[key] = (monthlyData[key] || 0) + 1;
        }
      }
    });
    const sortedKeys = Object.keys(monthlyData).sort();
    const timelineCanvas = byId('timelineChart');
    if (timelineCanvas && window.Chart) {
      new Chart(timelineCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: sortedKeys,
          datasets: [{
            label: 'Projetos Iniciados',
            data: sortedKeys.map(k => monthlyData[k]),
            fill: true,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.2)',
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#2563eb'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // Status (barras)
    const statusCanvas = byId('statusChart');
    if (statusCanvas && window.Chart) {
      chartStatus = new Chart(statusCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(statusData),
          datasets: [{ data: Object.values(statusData), backgroundColor: ['#6b7280', '#16a34a', '#dc2626', '#2563eb', '#f59e0b'] }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }
  }

  // ========= Gráficos por aba =========
  function drawCodesSprintsChart(projects) {
    const ctx = byId('codesSprintsChart');
    if (!ctx) return;
    const codes = projects.filter(p => p.coordenacao === 'CODES');
    const labels = codes.map(p => p.nome);
    const data = codes.map(p => p.sprintsConcluidas || 0);

    if (chartCodes) chartCodes.destroy();
    chartCodes = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Sprints Concluídas', data, backgroundColor: '#3b82f6' }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  function drawCosetTiposChart(projects) {
    const ctx = byId('cosetTiposChart');
    if (!ctx) return;

    // Mapeia tipo normalizado -> {labelOriginal, count}
    const acc = {};
    projects.forEach(p => {
      const original = (p.tipo || '').trim();
      if (!original) return;
      const norm = original
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sem acentos
        .toLowerCase();
      if (!acc[norm]) acc[norm] = { label: original, count: 0 };
      acc[norm].count++;
    });

    const labels = Object.values(acc).map(x => x.label);
    const counts = Object.values(acc).map(x => x.count);

    if (chartCoset) chartCoset.destroy();
    chartCoset = new Chart(ctx, {
      type: 'pie',
      data: { labels, datasets: [{ data: counts, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ef4444'] }] },
      options: { responsive: true }
    });
  }



  // ========= FILTROS =========
  function filterProjects(coordenacao, categoria) {
    // Navega para a página correta (usa showPage do HTML)
    const go = () => {
      const map = { CODES: 'codes', COSET: 'coset', CGOD: 'cgod' };
      const key = map[(coordenacao || '').toUpperCase()];
      if (key && typeof window.showPage === 'function') {
        const getter = window.getNavButtonFor;
        let btn = null;
        if (typeof getter === 'function') btn = getter(key);
        window.showPage(key, btn);
      }
    };
    go();

    const coord = (coordenacao || '').toUpperCase();
    const cat = (categoria || '').toLowerCase();

    let filtered = cacheProjetos.filter(p => (p.coordenacao || '').toUpperCase() === coord);
    if (coord === 'CODES') {
      if (cat === 'ativos') filtered = filtered.filter(p => p.status === 'Em Andamento' || p.status === 'Sustentação');
      if (cat === 'desenvolvimento') filtered = filtered.filter(p => p.status === 'Em Andamento');
      if (cat === 'sustentacao') filtered = filtered.filter(p => (p.status || '').toLowerCase().includes('susten'));
      if (cat === 'fora-prazo') filtered = filtered.filter(p => (p.rag === 'Vermelho') || p.status === 'Em Risco');
    }
    if (coord === 'COSET') {
      if (cat === 'infraestrutura') filtered = filtered.filter(p => p.tipo === 'Infraestrutura');
      if (cat === 'integracao') filtered = filtered.filter(p => p.tipo === 'Sistema Integrado' || p.tipo === 'Integração');
      if (cat === 'modernizacao') filtered = filtered.filter(p => p.tipo === 'Modernização');
      if (cat === 'sistemas-integrados') filtered = filtered.filter(p => p.tipo === 'Sistema Integrado');
    }
    if (coord === 'CGOD') {
      if (cat === 'analytics') filtered = filtered.filter(p => p.tipo === 'BI Dashboard' || p.tipo === 'Dashboard');
      if (cat === 'catalogos') filtered = filtered.filter(p => p.tipo === 'Sistema de Dados' || /cat[áa]logo/i.test(p.nome || ''));
      if (cat === 'datalake') filtered = filtered.filter(p => p.tipo === 'Sistema de Dados');
      if (cat === 'qualidade') filtered = filtered.filter(p => p.tipo === 'Qualidade de Dados');
      if (cat === 'governanca') filtered = filtered.filter(p => p.tipo === 'Governança');
    }

    const mapTbody = { CODES: 'codesTableBody', COSET: 'cosetTableBody', CGOD: 'cgodTableBody' };
    renderCoordTable(coord, mapTbody[coord], filtered);
  }

  // ========= DETALHE =========
  // ========= Detalhe =========
  function showProjectDetail(idOrName) {
    const p = findProjeto(idOrName);
    if (!p) return toast('Não encontrado', 'Projeto não encontrado', 'warn');

    setText('detailProjectName', p.nome || '—');
    setText('detailProjectType', `${p.tipo || '—'} • ${p.coordenacao || '—'}`);

    const ragEl = byId('detailRagStatus');
    if (ragEl) {
      ragEl.textContent = p.rag || '—';
      ragEl.className = `w-full h-8 rounded flex items-center justify-center text-white font-medium ${ragClass(p.rag)}`;
    }

    setText('detailPrioridade', p.prioridade || '—');
    setText('detailSprints', (p.sprintsConcluidas != null && p.totalSprints != null) ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—');
    setText('detailCoordenacao', p.coordenacao || '—');
    setText('detailResponsavel', p.responsavel || '—');
    setText('detailStatus', p.status || '—');
    setText('detailInicio', formatDate(p.inicio));
    setText('detailFim', formatDate(p.fim));
    setText('detailDescricao', p.descricao || '—');
    setText('detailOrcamento', formatCurrency(p.orcamento));
    setText('detailRiscos', p.riscos || '—');

    const prog = (p.progresso != null) ? Number(p.progresso) : null;
    const progBar = byId('detailProgress');
    const progTxt = byId('detailProgressText');
    if (progBar) progBar.style.width = (prog != null ? prog : 0) + '%';
    if (progTxt) progTxt.textContent = (prog != null ? prog + '%' : '—');

    const equipeEl = byId('detailEquipe');
    if (equipeEl) {
      equipeEl.innerHTML = '';
      if (p.equipe) {
        p.equipe.split(',').map(s => s.trim()).forEach(m => {
          const div = document.createElement('div');
          div.className = 'flex items-center';
          div.innerHTML = `<span class="w-2 h-2 rounded-full mr-2"></span><span>${escapeHtml(m)}</span>`;
          equipeEl.appendChild(div);
        });
      }
    }

    window.showModal && window.showModal('projectDetailModal');
  }

  function editProject(idOrName) {
    const p = findProjeto(idOrName);
    if (!p) return toast('Não encontrado', 'Projeto não encontrado', 'warn');

    const form = byId('projectForm'); if (!form) return;
    form.dataset.id = p.id; // marca edição

    // Backend
    setValue('projectName', p.nome);
    setValue('projectTipo', p.tipo);
    setValue('projectCoord', p.coordenacao);
    setValue('projectStatus', p.status);
    setValue('projectInicio', p.inicio);
    setValue('projectFim', p.fim);
    setValue('projectDescricao', p.descricao);

    // Extras
    setValue('projectPrioridade', p.prioridade);
    setValue('projectProgresso', p.progresso);
    const slider = byId('projectProgressoSlider'); if (slider) slider.value = p.progresso || 0;
    if (typeof window.updateProgressDisplay === 'function') window.updateProgressDisplay();

    setValue('projectTotalSprints', p.totalSprints);
    setValue('projectSprintsConcluidas', p.sprintsConcluidas);
    setValue('projectResponsavel', p.responsavel);
    setValue('projectOrcamento', p.orcamento);
    setValue('projectEquipe', p.equipe);
    setValue('projectRag', p.rag);
    setValue('projectRisco', p.riscos);
    setValue('projectQualidade', p.qualidade);

    toggleFormByCoord(p.coordenacao);

    const h = document.querySelector('#projectModal h3'); if (h) h.textContent = 'Editar Projeto';
    const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Atualizar Projeto';
    const modal = byId('projectModal'); if (modal) modal.classList.remove('hidden');
  }

  function openNewProject(coord) {
    const form = byId('projectForm');
    if (!form) return;
    form.reset();
    delete form.dataset.id;

    const slider = byId('projectProgressoSlider'); if (slider) slider.value = 0;
    const inputP = byId('projectProgresso'); if (inputP) inputP.value = 0;
    if (typeof window.updateProgressDisplay === 'function') window.updateProgressDisplay();

    setValue('projectCoord', coord || '');
    toggleFormByCoord(coord || '');

    const h = document.querySelector('#projectModal h3'); if (h) h.textContent = `Novo Projeto${coord ? ' • ' + coord : ''}`;
    const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Salvar Projeto';
    window.showModal && window.showModal('projectModal');
  }

  function toggleFormByCoord(coord) {
    const showForCodes = coord === 'CODES';
    toggleDiv('projectTotalSprints', showForCodes);
    toggleDiv('projectSprintsConcluidas', showForCodes);
  }

  function toggleDiv(inputId, show) {
    const el = byId(inputId);
    if (!el) return;
    const wrapper = el.closest('div');
    if (wrapper) wrapper.style.display = show ? '' : 'none';
  }

  // ========= Criar / Atualizar =========
  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target;
    const id = form.dataset.id;

    const dados = {
      nome: getValue('projectName'),
      tipo: getValue('projectTipo'),
      coordenacao: getValue('projectCoord'),
      status: getValue('projectStatus'),
      descricao: getValue('projectDescricao'),
      inicio: getValue('projectInicio'),
      fim: getValue('projectFim'),
      prioridade: getValue('projectPrioridade'),
      progresso: numOrNull(getValue('projectProgresso')),
      totalSprints: numOrNull(getValue('projectTotalSprints')),
      sprintsConcluidas: numOrNull(getValue('projectSprintsConcluidas')),
      responsavel: getValue('projectResponsavel'),
      orcamento: numOrNull(getValue('projectOrcamento')),
      equipe: getValue('projectEquipe'),
      rag: getValue('projectRag'),
      riscos: getValue('projectRisco'),
      qualidade: numOrNull(getValue('projectQualidade'))
    };

    // Validação mínima
    if (!dados.nome || !dados.tipo || !dados.coordenacao || !dados.status || !dados.inicio || !dados.fim) {
      return toast('Campos obrigatórios', 'Preencha nome, tipo, coordenação, status, início e fim.', 'warn');
    }

    const isEdit = Boolean(id);
    try {
      const url = isEdit ? `${API}/${id}` : API;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (!res.ok) {
        const erro = await safeJsonOrNull(res);
        throw new Error((erro && (erro.erro || erro.message)) || `Erro ao ${isEdit ? 'atualizar' : 'salvar'} (${res.status})`);
      }
      await safeJsonOrNull(res);

      // UI
      delete form.dataset.id;
      const h = document.querySelector('#projectModal h3'); if (h) h.textContent = 'Novo Projeto';
      const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Salvar Projeto';
      form.reset();
      const modal = byId('projectModal'); if (modal) modal.classList.add('hidden');

      await loadProjetos();
      toast('Sucesso', isEdit ? 'Projeto atualizado com sucesso!' : 'Projeto cadastrado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro', err.message, 'error');
    }
  }


  // ========= DELETE =========
  // ========= Deletar =========
  async function deleteProject(idOrName) {
    const p = findProjeto(idOrName);
    if (!p || !p.id) return toast('Ação inválida', 'Não foi possível identificar o ID do projeto.', 'warn');

    const ok = confirm(`Excluir o projeto "${p.nome}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    try {
      const res = await fetch(`${API}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const erro = await safeJsonOrNull(res);
        throw new Error((erro && erro.erro) || `Erro ao excluir (${res.status})`);
      }

      toast('Sucesso', 'Projeto excluído com sucesso!', 'success');
      await loadProjetos();
    } catch (err) {
      console.error(err);
      toast('Erro', err.message, 'error');
    }
  }

  // ========= Utils =========
  function findProjeto(idOrName) {
    return cacheProjetos.find(p => String(p.id) === String(idOrName)) ||
      cacheProjetos.find(p => (p.nome || '') === idOrName);
  }

  function statusBadgeClass(status) {
    switch (status) {
      case 'Em Andamento': return 'bg-green-100 text-green-800';
      case 'Em Risco': return 'bg-red-100 text-red-800';
      case 'Concluído': return 'bg-blue-100 text-blue-800';
      case 'Sustentação': return 'bg-yellow-100 text-yellow-800';
      case 'Planejado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function ragClass(rag) {
    switch (rag) {
      case 'Verde': return 'rag-verde';
      case 'Amarelo': return 'rag-amarelo';
      case 'Vermelho': return 'rag-vermelho';
      default: return 'bg-gray-300';
    }
  }

  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  }

  function formatCurrency(v) {
    if (v == null) return '—';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    } catch { return String(v); }
  }

  function numOrNull(v) {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  function updateLastUpdateTime() {
    const now = new Date();
    document.querySelectorAll('#lastUpdate').forEach(el => {
      el.textContent = `Hoje, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    });
    const yEl = byId('footerYear'); if (yEl) yEl.textContent = String(now.getFullYear());
  }

  // ========= Notificação simples =========
  function toast(title, message, type) {
    const wrap = byId('notifyModal');
    if (!wrap) { alert(message); return; }
    const bar = byId('notifyBar');
    const icon = byId('notifyIcon');
    const t = byId('notifyTitle');
    const m = byId('notifyMessage');

    const THEME = {
      info: { bar: 'bg-blue-600', icon: 'ℹ️', title: title || 'Informação' },
      success: { bar: 'bg-green-600', icon: '✅', title: title || 'Sucesso' },
      warn: { bar: 'bg-yellow-500', icon: '⚠️', title: title || 'Atenção' },
      error: { bar: 'bg-red-600', icon: '⛔', title: title || 'Erro' }
    }[type || 'info'];

    bar.className = 'h-1 ' + THEME.bar;
    icon.textContent = THEME.icon;
    t.textContent = THEME.title;
    m.textContent = message || '';

    wrap.classList.remove('hidden');
    setTimeout(() => { wrap.classList.add('hidden'); }, 3500);
  }

})(); // 🔚 fim do IIFE
