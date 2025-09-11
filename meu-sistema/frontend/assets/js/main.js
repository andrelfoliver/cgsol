/**
 * SigSOL main.js — compatível com o backend atual
 * Backend aceita APENAS estes campos:
 *  - id, nome, tipo, coordenacao, status, descricao, inicio, fim
 * Campos extras (prioridade, progresso, etc.) ficam no LocalStorage por ID/NOME.
 */
(function () {
  const API = 'http://localhost:5000/api/projetos';

  // Campos suportados pelo backend
  const SUPPORTED_FIELDS = ['nome', 'tipo', 'coordenacao', 'status', 'descricao', 'inicio', 'fim'];

  // Campos extras apenas no front
  const EXTRA_FIELDS = [
    'prioridade', 'progresso', 'totalSprints', 'sprintsConcluidas',
    'responsavel', 'orcamento', 'equipe', 'rag', 'riscos'
  ];

  let cacheProjetos = [];
  let chartCoordenacao = null;
  let chartStatus = null;

  // Para POST que não retorna id
  let pendingExtras = null;
  let pendingKeyName = null;

  // ========= Boot =========
  onReady(async () => {
    ensureCardIndexing();

    const form = byId('projectForm');
    if (form) {
      relaxOptionalFields();
      const coordSel = byId('projectCoord');
      if (coordSel) {
        coordSel.addEventListener('change', () => toggleFormByCoord(coordSel.value));
        toggleFormByCoord(coordSel.value);
      }
      form.addEventListener('submit', handleCreateOrUpdate);
    }

    // torna globais helpers de modal de notificação
    window.showNotify = showNotify;
    window.hideNotify = hideNotify;

    // carrega dados
    await loadProjetos();

    // expõe funções para HTML
    window.filterProjects = filterProjects;
    window.showProjectDetail = showProjectDetail;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.openNewProject = openNewProject;
  });

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else fn();
  }

  // ========= Helpers DOM/UTIL =========
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { const el = byId(id); if (el) el.textContent = (v ?? '—'); }
  function setValue(id, v) { const el = byId(id); if (el != null) el.value = (v ?? ''); }
  function getValue(id) { const el = byId(id); return el ? el.value : ''; }
  function numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function js(v) { return JSON.stringify(v); }
  function escapeHtml(s) { if (s == null) return s; return String(s).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function capitalize(s) { return String(s || '').replace(/^\w/, c => c.toUpperCase()); }
  async function safeJsonOrNull(res) { try { return await res.json(); } catch { return null; } }

  // ========= Modal de notificação =========
  let notifyTimer = null;
  function showNotify(title, message, type = 'info') {
    const wrap = byId('notifyModal'); if (!wrap) return alert(message);
    const bar = byId('notifyBar');
    const icon = byId('notifyIcon');
    const t = byId('notifyTitle');
    const m = byId('notifyMessage');

    const THEME = {
      info: { bar: 'bg-blue-600', icon: 'ℹ️', title: title || 'Informação' },
      success: { bar: 'bg-green-600', icon: '✅', title: title || 'Sucesso' },
      warn: { bar: 'bg-yellow-500', icon: '⚠️', title: title || 'Atenção' },
      error: { bar: 'bg-red-600', icon: '⛔', title: title || 'Erro' },
    }[type] || { bar: 'bg-blue-600', icon: 'ℹ️', title: title || 'Aviso' };

    // barra
    bar.className = 'h-1 ' + THEME.bar;
    // ícone
    icon.textContent = THEME.icon;
    // textos
    t.textContent = THEME.title;
    m.textContent = message || '';

    wrap.classList.remove('hidden');

    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => hideNotify(), 3500);
  }
  function hideNotify() {
    const wrap = byId('notifyModal'); if (!wrap) return;
    wrap.classList.add('hidden');
  }

  // ========= Formulário =========
  function relaxOptionalFields() {
    EXTRA_FIELDS.forEach(idSuffix => {
      const el = byId('project' + capitalize(idSuffix));
      if (el) el.removeAttribute('required');
    });
  }
  function toggleFormByCoord(coord) {
    // Sprints apenas para CODES
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

  // ========= LocalStorage (extras por ID/NOME) =========
  const lsKeyById = id => `sigsol:extras:${id}`;
  const lsKeyByName = name => `sigsol:extrasByName:${(name || '').trim()}`;

  function saveExtrasById(id, extras) { if (id == null) return; try { localStorage.setItem(lsKeyById(id), JSON.stringify(extras)); } catch { } }
  function saveExtrasByName(name, extras) { if (!name) return; try { localStorage.setItem(lsKeyByName(name), JSON.stringify(extras)); } catch { } }

  function saveExtrasForProject(project, extras) {
    if (!project) return;
    if (project.id != null) saveExtrasById(project.id, extras);
    if (project.nome) saveExtrasByName(project.nome, extras); // mantém cópia por nome (fallback)
  }

  function loadExtrasForProject(project) {
    if (!project) return null;
    const byIdRaw = project.id != null ? localStorage.getItem(lsKeyById(project.id)) : null;
    const byNameRaw = project.nome ? localStorage.getItem(lsKeyByName(project.nome)) : null;

    const exId = byIdRaw ? safeParse(byIdRaw) : null;
    const exName = byNameRaw ? safeParse(byNameRaw) : null;

    // se achou por nome e temos id, migra para id
    if (!exId && exName && project.id != null) {
      saveExtrasById(project.id, exName);
      // opcional: pode limpar por nome para evitar duplicidade
      try { localStorage.removeItem(lsKeyByName(project.nome)); } catch { }
      return exName;
    }
    // se achou pelos dois, prioriza o ID
    return exId || exName || null;
  }
  function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

  // ========= Cards: indexa data-card =========
  function ensureCardIndexing() {
    document.querySelectorAll('[onclick^="filterProjects("]').forEach(el => {
      const raw = el.getAttribute('onclick') || '';
      const m = raw.match(/filterProjects\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/i);
      if (m) {
        const coord = String(m[1] || '').toLowerCase();
        const cat = String(m[2] || '').toLowerCase();
        el.setAttribute('data-card', `${coord}:${cat}`);
      }
    });
  }

  // ========= Carregamento =========
  async function loadProjetos() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`Falha ao carregar projetos (${res.status})`);
      const projetos = await res.json();
      cacheProjetos = Array.isArray(projetos) ? projetos : [];

      // aplica extras pendentes (POST sem id)
      if (pendingExtras && pendingKeyName) {
        const p = cacheProjetos.find(px => (px && px.nome) === pendingKeyName);
        if (p) saveExtrasForProject(p, pendingExtras);
        pendingExtras = null;
        pendingKeyName = null;
      }

      renderRecentTable(cacheProjetos);
      renderAllCoordTables(cacheProjetos);
      updateKPIs(cacheProjetos);
      drawCharts(cacheProjetos);
      updateLastUpdateTime();
    } catch (err) {
      console.error(err);
      showNotify('Erro', 'Erro ao carregar projetos: ' + err.message, 'error');
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
      const extras = loadExtrasForProject(p) || {};
      const idArg = js(p.id ?? p.nome);
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div></td>
          <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">${escapeHtml(p.coordenacao) || '-'}</div></td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(extras.rag)}">${escapeHtml(extras.rag) || '—'}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(extras.responsavel) || '—'}</td>
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

    const rows = list.filter(p => (p.coordenacao || '').toUpperCase() === coord);
    const emptyMsg = `<tr><td colspan="${tbodyId === 'codesTableBody' ? 7 : 6}" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto encontrado.</td></tr>`;
    if (!rows.length) { tbody.innerHTML = emptyMsg; return; }

    rows.forEach(p => {
      const extras = loadExtrasForProject(p) || {};
      const progresso = (extras.progresso != null) ? Number(extras.progresso) : null;
      const sprints = (extras.sprints != null) ? String(extras.sprints)
        : (extras.sprintsConcluidas != null && extras.totalSprints != null ? `${extras.sprintsConcluidas} de ${extras.totalSprints}` : '—');
      const idArg = js(p.id ?? p.nome);

      if (tbodyId === 'codesTableBody') {
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div></td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(extras.rag)}">${escapeHtml(extras.rag) || '—'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div class="h-2 rounded-full bg-blue-600" style="width:${progresso != null ? progresso : 0}%"></div>
                </div>
                <span class="text-sm text-gray-900">${progresso != null ? progresso + '%' : '—'}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${sprints}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(extras.responsavel) || '—'}</td>
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
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(extras.rag)}">${escapeHtml(extras.rag) || '—'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div class="h-2 rounded-full bg-blue-600" style="width:${progresso != null ? progresso : 0}%"></div>
                </div>
                <span class="text-sm text-gray-900">${progresso != null ? progresso + '%' : '—'}</span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(extras.responsavel) || '—'}</td>
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
    const U = s => String(s || '').toUpperCase();
    const is = (a, b) => U(a) === U(b);
    const count = fn => list.filter(fn).length;

    // Totais (Home)
    setText('totalProjetos', list.length);
    setText('projetosCodes', count(p => is(p.coordenacao, 'CODES')));
    setText('projetosCoset', count(p => is(p.coordenacao, 'COSET')));
    setText('projetosCgod', count(p => is(p.coordenacao, 'CGOD')));

    // Home – Detalhamento
    setCardCount('codes', 'desenvolvimento', count(p => is(p.coordenacao, 'CODES') && is(p.status, 'EM ANDAMENTO')));
    setCardCount('codes', 'sustentacao', count(p => is(p.coordenacao, 'CODES') && is(p.status, 'SUSTENTAÇÃO')));

    setCardCount('coset', 'infraestrutura', count(p => is(p.coordenacao, 'COSET') && is(p.tipo, 'INFRAESTRUTURA')));
    setCardCount('coset', 'integracao', count(p => is(p.coordenacao, 'COSET') && (is(p.tipo, 'SISTEMA INTEGRADO') || is(p.tipo, 'INTEGRAÇÃO'))));

    setCardCount('cgod', 'analytics', count(p => is(p.coordenacao, 'CGOD') && (is(p.tipo, 'BI DASHBOARD') || is(p.tipo, 'DASHBOARD'))));
    setCardCount('cgod', 'datalake', count(p => is(p.coordenacao, 'CGOD') && is(p.tipo, 'SISTEMA DE DADOS')));

    // Páginas
    setCardCount('codes', 'ativos', count(p => is(p.coordenacao, 'CODES') && (is(p.status, 'EM ANDAMENTO') || is(p.status, 'SUSTENTAÇÃO'))));
    setCardCount('codes', 'fora-prazo', count(p => is(p.coordenacao, 'CODES') && (is((loadExtrasForProject(p) || {}).rag, 'VERMELHO') || is(p.status, 'EM RISCO'))));

    setCardCount('coset', 'sistemas-integrados', count(p => is(p.coordenacao, 'COSET') && is(p.tipo, 'SISTEMA INTEGRADO')));
    setCardCount('coset', 'modernizacao', count(p => is(p.coordenacao, 'COSET') && is(p.tipo, 'MODERNIZAÇÃO')));
    setCardCount('coset', 'compliance', count(p => is(p.coordenacao, 'COSET') && is(p.tipo, 'COMPLIANCE')));

    setCardCount('cgod', 'catalogos', count(p => is(p.coordenacao, 'CGOD') && (is(p.tipo, 'SISTEMA DE DADOS') || /CAT[AÁ]LOGO/.test(U(p.nome)))));
    setCardCount('cgod', 'qualidade', count(p => is(p.coordenacao, 'CGOD') && is(p.tipo, 'QUALIDADE DE DADOS')));
    setCardCount('cgod', 'governanca', count(p => is(p.coordenacao, 'CGOD') && is(p.tipo, 'GOVERNANÇA')));
  }

  function setCardCount(coordKey, cat, value) {
    let container = document.querySelector(`[data-card="${coordKey}:${cat}"]`);
    if (!container) {
      const selectors = [
        `[onclick*="filterProjects('${coordKey}', '${cat}')"]`,
        `[onclick*="filterProjects('${coordKey}','${cat}')"]`
      ];
      for (const sel of selectors) {
        container = document.querySelector(sel);
        if (container) break;
      }
      if (!container) {
        const candidates = Array.from(document.querySelectorAll('[onclick^="filterProjects("]'));
        container = candidates.find(el => (el.getAttribute('onclick') || '').replace(/\s+/g, '').includes(`filterProjects('${coordKey}','${cat}')`));
      }
    }
    if (!container) return;
    const countEl = container.querySelector('.font-bold, .count');
    if (countEl) countEl.textContent = value;
  }

  // ========= Gráficos =========
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

    if (chartCoordenacao) { chartCoordenacao.destroy(); chartCoordenacao = null; }
    if (chartStatus) { chartStatus.destroy(); chartStatus = null; }

    const coordCanvas = byId('coordenacaoChart');
    if (coordCanvas && window.Chart) {
      chartCoordenacao = new Chart(coordCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['CODES', 'COSET', 'CGOD'],
          datasets: [{ data: [codes, coset, cgod], backgroundColor: ['#3b82f6', '#8b5cf6', '#f97316'], borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
      });
    }

    const statusCanvas = byId('statusChart');
    if (statusCanvas && window.Chart) {
      chartStatus = new Chart(statusCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Planejado', 'Em Andamento', 'Em Risco', 'Concluído', 'Sustentação'],
          datasets: [{
            label: 'Quantidade',
            data: [statusData['Planejado'], statusData['Em Andamento'], statusData['Em Risco'], statusData['Concluído'], statusData['Sustentação']],
            backgroundColor: ['#6b7280', '#16a34a', '#dc2626', '#2563eb', '#f59e0b'],
            borderRadius: 4, borderSkipped: false
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
  }

  // ========= Filtros (cards) =========
  function filterProjects(coordenacao, categoria) {
    const navBtnGetter = window.getNavButtonFor;
    const showPageFn = window.showPage;
    const pageKey = (coordenacao || '').toLowerCase();
    if (typeof navBtnGetter === 'function') {
      const btn = navBtnGetter(pageKey);
      if (btn) btn.click();
    } else if (typeof showPageFn === 'function') {
      showPageFn(pageKey);
    }

    const coord = (coordenacao || '').toUpperCase();
    const cat = (categoria || '').toLowerCase();

    let filtered = cacheProjetos.filter(p => (p.coordenacao || '').toUpperCase() === coord);

    if (coord === 'CODES') {
      if (cat === 'ativos') filtered = filtered.filter(p => ['Em Andamento', 'Sustentação'].includes(p.status));
      if (cat === 'desenvolvimento') filtered = filtered.filter(p => p.status === 'Em Andamento');
      if (cat === 'sustentacao') filtered = filtered.filter(p => p.status === 'Sustentação');
      if (cat === 'fora-prazo') filtered = filtered.filter(p => (loadExtrasForProject(p) || {}).rag === 'Vermelho' || p.status === 'Em Risco');
    }
    if (coord === 'COSET') {
      if (cat === 'infraestrutura') filtered = filtered.filter(p => p.tipo === 'Infraestrutura');
      if (cat === 'integracao') filtered = filtered.filter(p => p.tipo === 'Sistema Integrado' || p.tipo === 'Integração');
      if (cat === 'modernizacao') filtered = filtered;
      if (cat === 'sistemas-integrados') filtered = filtered.filter(p => p.tipo === 'Sistema Integrado');
    }
    if (coord === 'CGOD') {
      if (cat === 'analytics') filtered = filtered.filter(p => p.tipo === 'BI Dashboard' || p.tipo === 'Dashboard');
      if (cat === 'catalogos') filtered = filtered.filter(p => p.tipo === 'Sistema de Dados' || /cat[aá]logo/i.test(p.nome || ''));
      if (cat === 'datalake') filtered = filtered.filter(p => p.tipo === 'Sistema de Dados');
    }

    const map = { CODES: 'codesTableBody', COSET: 'cosetTableBody', CGOD: 'cgodTableBody' };
    renderCoordTable(coord, map[coord], filtered);
  }

  // ========= Detalhe =========
  function showProjectDetail(idOrName) {
    const p = findProjeto(idOrName);
    if (!p) return showNotify('Não encontrado', 'Projeto não encontrado', 'warn');

    const extras = loadExtrasForProject(p) || {};

    setText('detailProjectName', p.nome || '—');
    setText('detailProjectType', `${p.tipo || '—'} • ${p.coordenacao || '—'}`);

    const ragEl = byId('detailRagStatus');
    if (ragEl) {
      ragEl.textContent = extras.rag || '—';
      ragEl.className = `w-full h-8 rounded flex items-center justify-center text-white font-medium ${ragClass(extras.rag)}`;
    }
    setText('detailPrioridade', extras.prioridade || '—');

    const prog = (extras.progresso != null) ? Number(extras.progresso) : null;
    const progBar = byId('detailProgress');
    const progTxt = byId('detailProgressText');
    if (progBar) progBar.style.width = (prog != null ? prog : 0) + '%';
    if (progTxt) progTxt.textContent = (prog != null ? prog + '%' : '—');

    setText('detailSprints', (extras.sprintsConcluidas != null && extras.totalSprints != null) ? `${extras.sprintsConcluidas} de ${extras.totalSprints}` : '—');
    setText('detailCoordenacao', p.coordenacao || '—');
    setText('detailResponsavel', extras.responsavel || '—');
    setText('detailStatus', p.status || '—');
    setText('detailInicio', formatDate(p.inicio));
    setText('detailFim', formatDate(p.fim));
    setText('detailDescricao', p.descricao || '—');
    setText('detailOrcamento', formatCurrency(extras.orcamento));
    setText('detailRiscos', extras.riscos || '—');

    const equipeEl = byId('detailEquipe');
    if (equipeEl) {
      equipeEl.innerHTML = '';
      if (extras.equipe) {
        extras.equipe.split(',').map(s => s.trim()).forEach(m => {
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
    if (!p) return showNotify('Não encontrado', 'Projeto não encontrado', 'warn');

    const extras = loadExtrasForProject(p) || {};
    const form = byId('projectForm');
    if (!form) return;

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
    setValue('projectPrioridade', extras.prioridade);
    setValue('projectProgresso', extras.progresso);
    const slider = byId('projectProgressoSlider'); if (slider) slider.value = extras.progresso || 0;
    if (typeof updateProgressDisplay === 'function') updateProgressDisplay();
    const disp = byId('progressDisplay'); if (disp) disp.textContent = (extras.progresso || 0) + '%';
    const bar = byId('progressBar'); if (bar) bar.style.width = (extras.progresso || 0) + '%';

    setValue('projectTotalSprints', extras.totalSprints);
    setValue('projectSprintsConcluidas', extras.sprintsConcluidas);
    setValue('projectResponsavel', extras.responsavel);
    setValue('projectOrcamento', extras.orcamento);
    setValue('projectEquipe', extras.equipe);
    setValue('projectRag', extras.rag);
    setValue('projectRisco', extras.riscos);

    toggleFormByCoord(p.coordenacao);

    const h = document.querySelector('#projectModal h3'); if (h) h.textContent = 'Editar Projeto';
    const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Atualizar Projeto';
    const modal = byId('projectModal'); if (modal) modal.classList.remove('hidden');
  }

  // ========= Novo Projeto por coordenação =========
  function openNewProject(coord) {
    const form = byId('projectForm');
    if (!form) return;
    form.reset();

    const slider = byId('projectProgressoSlider'); if (slider) slider.value = 0;
    const inputP = byId('projectProgresso'); if (inputP) inputP.value = 0;
    if (typeof updateProgressDisplay === 'function') updateProgressDisplay();

    delete form.dataset.id;

    setValue('projectCoord', coord || '');
    toggleFormByCoord(coord || '');

    const h = document.querySelector('#projectModal h3'); if (h) h.textContent = `Novo Projeto${coord ? ' • ' + coord : ''}`;
    const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Salvar Projeto';
    window.showModal && window.showModal('projectModal');
  }

  // ========= Create / Update =========
  function getFormData() {
    return {
      nome: getValue('projectName'),
      tipo: getValue('projectTipo'),
      coordenacao: getValue('projectCoord'),
      status: getValue('projectStatus'),
      descricao: getValue('projectDescricao'),
      inicio: getValue('projectInicio'),
      fim: getValue('projectFim'),

      // extras (não vão para o backend):
      prioridade: getValue('projectPrioridade'),
      progresso: numOrNull(getValue('projectProgresso')),
      totalSprints: numOrNull(getValue('projectTotalSprints')),
      sprintsConcluidas: numOrNull(getValue('projectSprintsConcluidas')),
      responsavel: getValue('projectResponsavel'),
      orcamento: numOrNull(getValue('projectOrcamento')),
      equipe: getValue('projectEquipe'),
      rag: getValue('projectRag'),
      riscos: getValue('projectRisco')
    };
  }
  function sanitizeForBackend(all) {
    const payload = {};
    SUPPORTED_FIELDS.forEach(k => payload[k] = all[k] ?? null);
    return payload;
  }

  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target;
    const id = form.dataset.id; // se existe → edição (PUT)

    const all = getFormData();
    const dados = sanitizeForBackend(all);

    // Validação mínima
    if (!dados.nome || !dados.tipo || !dados.coordenacao || !dados.status || !dados.inicio || !dados.fim) {
      return showNotify('Campos obrigatórios', 'Preencha nome, tipo, coordenação, status, início e fim.', 'warn');
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
        throw new Error((erro && erro.erro) || `Erro ao ${isEdit ? 'atualizar' : 'salvar'} (${res.status})`);
      }

      const saved = await safeJsonOrNull(res); // pode ser null em 204

      // Extras — sempre salvamos por ID (se houver) e por NOME (fallback)
      const extras = {};
      EXTRA_FIELDS.forEach(k => extras[k] = all[k] ?? null);

      if (isEdit) {
        saveExtrasById(id, extras);
        saveExtrasByName(all.nome, extras);
      } else if (saved && saved.id != null) {
        saveExtrasById(saved.id, extras);
        saveExtrasByName(all.nome, extras);
      } else {
        pendingExtras = extras;
        pendingKeyName = all.nome;
      }

      // UI
      delete form.dataset.id;
      const h = document.querySelector('#projectModal h3'); if (h) h.textContent = 'Novo Projeto';
      const btn = byId('submitProjectBtn'); if (btn) btn.textContent = 'Salvar Projeto';
      form.reset();
      const modal = byId('projectModal'); if (modal) modal.classList.add('hidden');

      await loadProjetos();

      // Mensagem: força “Atualizado” quando for PUT (independe do JSON retornado)
      showNotify('Sucesso', isEdit ? 'Projeto atualizado com sucesso!' : 'Projeto cadastrado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showNotify('Erro', err.message, 'error');
    }
  }

  // ========= Excluir =========
  async function deleteProject(idOrName) {
    const p = findProjeto(idOrName);
    if (!p || !p.id) return showNotify('Ação inválida', 'Não foi possível identificar o ID do projeto.', 'warn');

    const ok = confirm(`Excluir o projeto "${p.nome}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    try {
      const res = await fetch(`${API}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const erro = await safeJsonOrNull(res);
        throw new Error((erro && erro.erro) || `Erro ao excluir (${res.status})`);
      }
      try { localStorage.removeItem(lsKeyById(p.id)); } catch { }
      try { if (p.nome) localStorage.removeItem(lsKeyByName(p.nome)); } catch { }

      showNotify('Sucesso', 'Projeto excluído com sucesso!', 'success');
      await loadProjetos();
    } catch (err) {
      console.error(err);
      showNotify('Erro', err.message, 'error');
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
      default: return 'rag-verde';
    }
  }
  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
  }
  function formatCurrency(v) {
    if (v == null) return '—';
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
    catch { return String(v); }
  }
  function updateLastUpdateTime() {
    const now = new Date();
    document.querySelectorAll('#lastUpdate').forEach(el => {
      el.textContent = `Hoje, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    });
    const yEl = byId('footerYear'); if (yEl) yEl.textContent = String(now.getFullYear());
  }

})();
