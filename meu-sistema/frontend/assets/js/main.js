/**
 * main.js — versão conectada ao backend (sem mocks)
 * - Lista projetos na Home e nas páginas CODES/COSET/CGOD
 * - KPIs/Gráficos dinâmicos
 * - Filtros dos cards funcionando (CODES/COSET/CGOD)
 * - Criação/Edição via POST/PUT no backend (apenas campos suportados)
 * - Exclusão via DELETE (botão 🗑️)
 * - Atualiza TODOS os cards (Home + abas) após criar/editar/excluir
 */
(function () {
  const API = 'http://localhost:5000/api/projetos';

  // Campos que o backend aceita (evita erros tipo "'prioridade' is an invalid keyword argument")
  const BACKEND_FIELDS = ['nome', 'tipo', 'coordenacao', 'status', 'descricao', 'inicio', 'fim', 'responsavel'];

  let cacheProjetos = [];
  let chartCoordenacao = null;
  let chartStatus = null;
  let kpiPatchedOnce = false;

  // ========= Boot =========
  onReady(async () => {
    const form = document.getElementById('projectForm');
    if (form) form.addEventListener('submit', handleCreateOrUpdate);

    await loadProjetos();

    // expõe funções para os onclick do HTML
    window.filterProjects = filterProjects;
    window.showProjectDetail = showProjectDetail;
    window.editProject = editProject;
    window.handleCreateOrUpdate = handleCreateOrUpdate;
    window.deleteProject = deleteProject;
  });

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // ========= Carregamento =========
  async function loadProjetos() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`Falha ao carregar projetos (${res.status})`);
      const projetos = await res.json();
      cacheProjetos = Array.isArray(projetos) ? projetos : [];

      // garante que os cards possam ser encontrados (por onclick OU por rótulo)
      patchKpiDataAttributes();

      renderRecentTable(cacheProjetos);
      renderAllCoordTables(cacheProjetos);
      updateKPIs(cacheProjetos);
      drawCharts(cacheProjetos);
      updateLastUpdateTime();
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar projetos: ' + err.message);
    }
  }

  // ========= Tabela Recentes (Home) =========
  function renderRecentTable(list) {
    const tbody = byId('projectsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto cadastrado.</td></tr>`;
      return;
    }

    list.forEach(p => {
      const idArg = js(p.id ?? p.nome); // seguro para onclick
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
            <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">
              ${escapeHtml(p.rag) || '—'}
            </span>
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

  // ========= Tabelas por coordenação =========
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
      const progresso = (p.progresso != null) ? Number(p.progresso) : null;
      const sprints = (p.sprints != null) ? String(p.sprints)
        : (p.sprintsConcluidas != null && p.totalSprints != null ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—');

      const idArg = js(p.id ?? p.nome); // seguro para onclick

      if (tbodyId === 'codesTableBody') {
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div></td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">${escapeHtml(p.rag) || '—'}</span>
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
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">${escapeHtml(p.status) || '-'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">${escapeHtml(p.rag) || '—'}</span>
            </td>
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

  // ========= KPIs / Contadores =========
  function unaccent(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().trim();
  }
  function isEq(a, b) { return unaccent(a) === unaccent(b); }

  function computeKpiMap(list) {
    const c = (fn) => list.filter(fn).length;
    const m = {};

    // ---------- CODES ----------
    m['codes:ativos'] = c(p => isEq(p.coordenacao, 'CODES') && (isEq(p.status, 'EM ANDAMENTO') || isEq(p.status, 'SUSTENTACAO')));
    m['codes:desenvolvimento'] = c(p => isEq(p.coordenacao, 'CODES') && isEq(p.status, 'EM ANDAMENTO'));
    m['codes:sustentacao'] = c(p => isEq(p.coordenacao, 'CODES') && isEq(p.status, 'SUSTENTACAO'));
    // Se não houver RAG no backend, usamos só "Em Risco"
    m['codes:fora-prazo'] = c(p => isEq(p.coordenacao, 'CODES') && (isEq(p.status, 'EM RISCO') || isEq(p.rag, 'VERMELHO')));

    // ---------- COSET ----------
    m['coset:infraestrutura'] = c(p => isEq(p.coordenacao, 'COSET') && isEq(p.tipo, 'INFRAESTRUTURA'));
    m['coset:integracao'] = c(p => isEq(p.coordenacao, 'COSET') && (isEq(p.tipo, 'SISTEMA INTEGRADO') || isEq(p.tipo, 'INTEGRACAO')));
    m['coset:modernizacao'] = c(p => isEq(p.coordenacao, 'COSET') && isEq(p.tipo, 'MODERNIZACAO'));
    m['coset:sistemas-integrados'] = c(p => isEq(p.coordenacao, 'COSET') && isEq(p.tipo, 'SISTEMA INTEGRADO'));
    m['coset:compliance'] = c(p => isEq(p.coordenacao, 'COSET') && isEq(p.tipo, 'COMPLIANCE'));

    // ---------- CGOD ----------
    m['cgod:analytics'] = c(p => isEq(p.coordenacao, 'CGOD') && (isEq(p.tipo, 'BI DASHBOARD') || isEq(p.tipo, 'DASHBOARD')));
    m['cgod:datalake'] = c(p => isEq(p.coordenacao, 'CGOD') && isEq(p.tipo, 'SISTEMA DE DADOS'));
    m['cgod:catalogos'] = c(p => isEq(p.coordenacao, 'CGOD') && (isEq(p.tipo, 'SISTEMA DE DADOS') || /CATALOGO/.test(unaccent(p.nome))));
    m['cgod:qualidade'] = c(p => isEq(p.coordenacao, 'CGOD') && isEq(p.tipo, 'QUALIDADE DE DADOS'));
    m['cgod:governanca'] = c(p => isEq(p.coordenacao, 'CGOD') && isEq(p.tipo, 'GOVERNANCA'));

    return m;
  }

  function paintKpisFromMap(map) {
    // Atualiza qualquer card que tenha data-kpi="coord:categoria"
    document.querySelectorAll('[data-kpi]').forEach(card => {
      const key = card.getAttribute('data-kpi');
      if (!(key in map)) return;
      const valueEl = card.querySelector('[data-kpi-value]') ||
        card.querySelector('.font-bold, .count, .text-2xl');
      if (valueEl) valueEl.textContent = map[key];
    });
  }

  function updateKPIs(list) {
    // Totais gerais (Home)
    const byCoord = (coord) => list.filter(p => isEq(p.coordenacao, coord)).length;
    setText('totalProjetos', list.length);
    setText('projetosCodes', byCoord('CODES'));
    setText('projetosCoset', byCoord('COSET'));
    setText('projetosCgod', byCoord('CGOD'));

    // Pinta todos os cards (Home + abas)
    const kpis = computeKpiMap(list);
    paintKpisFromMap(kpis);

    // Compat: ainda atualiza cards legados via setCardCount (caso não tenham data-kpi)
    Object.entries(kpis).forEach(([key, val]) => {
      const [coord, cat] = key.split(':');
      setCardCount(coord, cat, val);
    });
  }

  // ========= Gráficos =========
  function drawCharts(list) {
    const codes = list.filter(p => p.coordenacao === 'CODES').length;
    const coset = list.filter(p => p.coordenacao === 'COSET').length;
    const cgod = list.filter(p => p.coordenacao === 'CGOD').length;

    const st = (s) => list.filter(p => p.status === s).length;
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
            borderRadius: 4,
            borderSkipped: false
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
      if (cat === 'fora-prazo') filtered = filtered.filter(p => p.rag === 'Vermelho' || p.status === 'Em Risco');
    }
    if (coord === 'COSET') {
      if (cat === 'infraestrutura') filtered = filtered.filter(p => p.tipo === 'Infraestrutura');
      if (cat === 'integracao') filtered = filtered.filter(p => p.tipo === 'Sistema Integrado' || p.tipo === 'Integração');
      if (cat === 'modernizacao') filtered = filtered; // ajuste conforme backend
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

  // ========= Detalhe / Edição =========
  function showProjectDetail(idOrName) {
    const p = findProjeto(idOrName);
    if (!p) return toast('Projeto não encontrado');

    setText('detailProjectName', p.nome || '—');
    setText('detailProjectType', `${p.tipo || '—'} • ${p.coordenacao || '—'}`);

    const ragEl = byId('detailRagStatus');
    if (ragEl) {
      ragEl.textContent = p.rag || '—';
      ragEl.className = `w-full h-8 rounded flex items-center justify-center text-white font-medium ${ragClass(p.rag)}`;
    }
    setText('detailPrioridade', p.prioridade || '—');

    const prog = (p.progresso != null) ? Number(p.progresso) : null;
    const progBar = byId('detailProgress');
    const progTxt = byId('detailProgressText');
    if (progBar) progBar.style.width = (prog != null ? prog : 0) + '%';
    if (progTxt) progTxt.textContent = (prog != null ? prog + '%' : '—');

    setText('detailSprints', (p.sprintsConcluidas != null && p.totalSprints != null) ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—');
    setText('detailCoordenacao', p.coordenacao || '—');
    setText('detailResponsavel', p.responsavel || '—');
    setText('detailStatus', p.status || '—');
    setText('detailInicio', formatDate(p.inicio));
    setText('detailFim', formatDate(p.fim));
    setText('detailDescricao', p.descricao || '—');
    setText('detailOrcamento', formatCurrency(p.orcamento));

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
    if (!p) return toast('Projeto não encontrado');

    const form = byId('projectForm');
    if (!form) return;

    form.dataset.id = p.id; // marca edição

    setValue('projectName', p.nome);
    setValue('projectTipo', p.tipo);
    setValue('projectCoord', p.coordenacao);
    setValue('projectStatus', p.status);
    setValue('projectPrioridade', p.prioridade);
    setValue('projectProgresso', p.progresso);
    setValue('projectTotalSprints', p.totalSprints);
    setValue('projectSprintsConcluidas', p.sprintsConcluidas);
    setValue('projectResponsavel', p.responsavel);
    setValue('projectInicio', p.inicio);
    setValue('projectFim', p.fim);
    setValue('projectOrcamento', p.orcamento);
    setValue('projectDescricao', p.descricao);
    setValue('projectEquipe', p.equipe);
    setValue('projectRag', p.rag);
    setValue('projectRisco', p.riscos);

    const h = document.querySelector('#projectModal h3');
    if (h) h.textContent = 'Editar Projeto';
    const btn = byId('submitProjectBtn');
    if (btn) btn.textContent = 'Atualizar Projeto';

    const modal = byId('projectModal');
    if (modal) modal.classList.remove('hidden');
  }

  // ========= Create / Update =========
  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target;
    const id = form.dataset.id;

    // Monta o body apenas com os campos suportados pelo backend
    const formToField = {
      projectName: 'nome',
      projectTipo: 'tipo',
      projectCoord: 'coordenacao',
      projectStatus: 'status',
      projectDescricao: 'descricao',
      projectInicio: 'inicio',
      projectFim: 'fim',
      projectResponsavel: 'responsavel'
    };
    const dados = {};
    Object.entries(formToField).forEach(([inputId, apiField]) => {
      const v = getValue(inputId);
      if (BACKEND_FIELDS.includes(apiField)) dados[apiField] = v;
    });

    try {
      const url = id ? `${API}/${id}` : API;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        throw new Error(erro.erro || `Erro ao salvar projeto (${res.status})`);
      }

      // sucesso
      delete form.dataset.id;
      const h = document.querySelector('#projectModal h3');
      if (h) h.textContent = 'Novo Projeto';
      const btn = byId('submitProjectBtn');
      if (btn) btn.textContent = 'Salvar Projeto';
      form.reset();
      const modal = byId('projectModal');
      if (modal) modal.classList.add('hidden');

      await loadProjetos();
      toast(id ? 'Projeto atualizado com sucesso!' : 'Projeto cadastrado com sucesso!');
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar projeto: ' + err.message);
    }
  }

  // ========= Excluir Projeto =========
  async function deleteProject(idOrName) {
    const p = findProjeto(idOrName);
    if (!p || !p.id) {
      return toast('Não foi possível identificar o ID do projeto para excluir.');
    }

    const ok = confirm(`Excluir o projeto "${p.nome}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;

    try {
      const res = await fetch(`${API}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        throw new Error(erro.erro || `Erro ao excluir (${res.status})`);
      }

      toast('Projeto excluído com sucesso!');
      await loadProjetos();
    } catch (err) {
      console.error(err);
      toast('Erro ao excluir: ' + err.message);
    }
  }

  // ========= Helpers =========
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { const el = byId(id); if (el) el.textContent = (v ?? '—'); }
  function setValue(id, v) { const el = byId(id); if (el != null) el.value = (v ?? ''); }
  function getValue(id) { const el = byId(id); return el ? el.value : ''; }
  function js(v) { return JSON.stringify(v); } // para usar em onclick com segurança

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
  }

  // --- Patcher de KPIs: cria data-kpi automaticamente (Home + aba CODES) ---
  function patchKpiDataAttributes() {
    if (kpiPatchedOnce) return; // basta uma vez
    kpiPatchedOnce = true;

    // 1) Marcar cards que já têm onclick
    const keys = [
      ['codes', 'ativos'], ['codes', 'desenvolvimento'], ['codes', 'sustentacao'], ['codes', 'fora-prazo'],
      ['coset', 'infraestrutura'], ['coset', 'integracao'], ['coset', 'modernizacao'], ['coset', 'sistemas-integrados'], ['coset', 'compliance'],
      ['cgod', 'analytics'], ['cgod', 'datalake'], ['cgod', 'catalogos'], ['cgod', 'qualidade'], ['cgod', 'governanca']
    ];
    keys.forEach(([coord, cat]) => {
      const selA = `[onclick*="filterProjects('${coord}', '${cat}')"]`;
      const selB = `[onclick*="filterProjects('${coord}','${cat}')"]`;
      const nodes = new Set([
        ...document.querySelectorAll(selA),
        ...document.querySelectorAll(selB)
      ]);
      nodes.forEach(card => {
        card.setAttribute('data-kpi', `${coord}:${cat}`);
        // tenta marcar o elemento do número
        const val = card.querySelector('.font-bold, .count, .text-2xl');
        if (val) val.setAttribute('data-kpi-value', '');
      });
    });

    // 2) Fallback por rótulo (especialmente para a aba CODES)
    const labelMap = {
      'Projetos Ativos': 'codes:ativos',
      'Desenvolvimento': 'codes:desenvolvimento',
      'Sustentação': 'codes:sustentacao',
      'Fora de Prazo': 'codes:fora-prazo'
    };
    const allElems = Array.from(document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6'));
    Object.entries(labelMap).forEach(([label, key]) => {
      // encontra elementos cujo texto "é" o rótulo do card
      const labelNodes = allElems.filter(el => el.childElementCount === 0 && el.textContent.trim() === label);
      labelNodes.forEach(lbl => {
        const card = lbl.closest('.bg-white, .rounded-lg, .shadow, .shadow-md, .shadow-lg') || lbl.parentElement;
        if (!card) return;
        if (!card.hasAttribute('data-kpi')) card.setAttribute('data-kpi', key);
        const val = card.querySelector('.font-bold, .count, .text-2xl');
        if (val && !val.hasAttribute('data-kpi-value')) val.setAttribute('data-kpi-value', '');
      });
    });
  }

  // >>> Atualiza TODOS os cards correspondentes (Home + abas)
  function setCardCount(coordKey, cat, value) {
    // garantir que já marcamos os cards
    patchKpiDataAttributes();

    // 1) preferir cards com data-kpi
    const dataCards = Array.from(document.querySelectorAll(`[data-kpi="${coordKey}:${cat}"]`));
    if (dataCards.length) {
      dataCards.forEach(card => {
        const valueEl = card.querySelector('[data-kpi-value]') ||
          card.querySelector('.font-bold, .count, .text-2xl');
        if (valueEl) valueEl.textContent = value;
      });
      return;
    }

    // 2) fallback: localizar TODAS as ocorrências com onclick (com e sem espaços)
    const selA = `[onclick*="filterProjects('${coordKey}', '${cat}')"]`;
    const selB = `[onclick*="filterProjects('${coordKey}','${cat}')"]`;
    let nodes = Array.from(document.querySelectorAll(selA));
    const extra = Array.from(document.querySelectorAll(selB));
    extra.forEach(n => { if (!nodes.includes(n)) nodes.push(n); });

    if (!nodes.length) {
      // 3) varredura completa do DOM como último recurso
      const candidates = Array.from(document.querySelectorAll('[onclick^="filterProjects("]'));
      nodes = candidates.filter(el => {
        const raw = (el.getAttribute('onclick') || '').replace(/\s+/g, '');
        return raw.includes(`filterProjects('${coordKey}','${cat}')`);
      });
    }

    nodes.forEach(container => {
      const countEl = container.querySelector('.font-bold, .count, .text-2xl');
      if (countEl) countEl.textContent = value;
    });
  }

  function toast(msg) { alert(msg); }
  function escapeHtml(s) {
    if (s == null) return s;
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }
})();
