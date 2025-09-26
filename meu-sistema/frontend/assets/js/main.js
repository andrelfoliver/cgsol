/**
 * SigSOL main.js — versão limpa (sem localStorage)
 * Todos os dados persistem no backend (Postgres).
 */

(function () {
  'use strict';

  const API = 'http://localhost:5001/api/projetos';
  const API_ROOT = 'http://localhost:5001/api';

  // Cache em memória
  let cacheProjetos = [];
  let chartCoordenacao = null;
  let chartStatus = null;
  let chartIntern = null;
  let chartCodes = null;
  let chartCoset = null;
  let chartCgod = null;
  let confirmCallback = null;
  let cancelCallback = null;
  let chartSustDistrib = null;

  // 👇 adicione
  let chartStatusDistrib = null;
  let chartRag = null;
  let chartTimeline = null;

  let sustentacaoTotal = null; // override do card "Em Sustentação"

  // main.js
  window.showConfirm = function (msg, onConfirm, onCancel, opts = {}) {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const titleEl = document.getElementById('confirmTitle');     // novo
    const iconEl = document.getElementById('confirmIcon');       // novo
    const primaryBtn = document.getElementById('confirmPrimary'); // novo
    const cancelBtn = document.getElementById('confirmCancel');   // opcional

    if (msgEl) msgEl.textContent = msg || 'Tem certeza?';
    if (titleEl) titleEl.textContent = opts.title || 'Confirmar ação';
    if (iconEl) iconEl.textContent = opts.icon || '❓';

    if (primaryBtn) {
      primaryBtn.textContent = opts.confirmText || 'Confirmar';
      // classe base + cor opcional
      primaryBtn.className =
        'px-4 py-2 rounded text-white ' +
        (opts.confirmClass || 'bg-blue-600 hover:bg-blue-700');
    }
    if (cancelBtn && opts.cancelText) cancelBtn.textContent = opts.cancelText;

    modal.classList.remove('hidden');
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
  };


  window.confirmDelete = function () {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('hidden');
    if (typeof confirmCallback === 'function') confirmCallback();
  };

  window.cancelDelete = function () {
    const modal = document.getElementById('confirmModal');
    modal.classList.add('hidden');
    if (typeof cancelCallback === 'function') cancelCallback();
  };

  // ========= boot =========



  onReady(async () => {
    // estado neutro das áreas
    document.getElementById('codesSustentacaoWrapper')?.classList.add('hidden');
    document.getElementById('tableView')?.classList.remove('hidden');

    // form
    const form = byId('projectForm');
    if (form) {
      const coordSel = byId('projectCoord');
      if (coordSel) {
        coordSel.addEventListener('change', () => toggleFormByCoord(coordSel.value));
        toggleFormByCoord(coordSel.value);
      }
      form.addEventListener('submit', handleCreateOrUpdate);
    }

    // Expor funções no escopo global
    window.filterProjects = filterProjects;
    window.showProjectDetail = showProjectDetail;
    window.editProject = editProject;
    window.deleteProject = deleteProject;
    window.openNewProject = openNewProject;
    window.showSustentacao = showSustentacao;

    // ── bind: clique nos cards da CODES ──
    // Desenvolvimento (pode haver 2 instâncias no DOM: home + aba CODES)
    document.querySelectorAll('[data-card="codes:desenvolvimento"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        // mostra a view de fábrica/desenvolvimento
        document.getElementById('codesSustentacaoWrapper')?.classList.add('hidden');
        document.getElementById('tableView')?.classList.remove('hidden');
        // restaura charts da fábrica
        document.getElementById('codesSprintsWrapper')?.classList.remove('hidden');
        document.getElementById('codesInternWrapper')?.classList.remove('hidden');
        // destaca o card correto
        setCodesCardHighlight('fabrica');
        // restaura clones/top-cards (remove clones e mostra originais)
        try { restoreDevTopCards(); } catch (e) { /* ignora */ }

        // aplica filtro (opcional) para exibir apenas "desenvolvimento"
        if (typeof filterProjects === 'function') filterProjects('CODES', 'desenvolvimento');
      });
    });

    // Sustentação (pode ter acento ou não)
    document.querySelectorAll('[data-card="codes:sustentacao"], [data-card="codes:sustentação"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        // função central que já cuida da navegação e carregamento
        if (typeof showSustentacao === 'function') showSustentacao();
      });
    });

    // 1) carrega projetos (tabelas/gráficos/kpis)
    await loadProjetos();

    // 2) SEMPRE carrega Sustentação para atualizar o CARD já na Home
    await loadSustKPI();     // só KPI/card na Home

    // 3) garante visibilidade dos wrappers das tabelas (ajuste os IDs se forem outros)
    document.getElementById('codesTableWrapper')?.classList.remove('hidden');
    document.getElementById('cosetTableWrapper')?.classList.remove('hidden');
    document.getElementById('cgodTableWrapper')?.classList.remove('hidden');

    updateLastUpdateTime();
  });


  // ========= funções =========
  async function loadProjetos() {
    try {
      const resp = await fetch(API);
      if (!resp.ok) throw new Error("Erro ao buscar projetos");
      cacheProjetos = await resp.json();
      renderProjects(cacheProjetos);
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
    }
  }
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else fn();
  }
  // ========= destaque visual dos cards CODES (robusto, sem depender do Tailwind em runtime) =========
  function setCodesCardHighlight(mode /* 'fabrica' | 'sust' | null */) {
    // util: escolhe o candidato visível, preferindo o que está na aba CODES
    const pickVisible = (selector) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      // 1) prioriza o que está dentro de #codesPage e não está escondido
      const inCodes = nodes.find(el => el.closest('#codesPage') && !el.closest('.hidden'));
      if (inCodes) return inCodes;
      // 2) qualquer visível na tela
      const visible = nodes.find(el => el.offsetParent !== null);
      if (visible) return visible;
      // 3) fallback: primeiro
      return nodes[0] || null;
    };

    // Na Fábrica (há 2 no DOM: Home e CODES) → escolha o visível/da aba CODES
    const fabr = pickVisible('[data-card="codes:desenvolvimento"]');

    // Sustentação (só existe na aba CODES, mas deixo robusto)
    const sust = pickVisible('[data-card="codes:sustentacao"], [data-card="codes:sustentação"]');

    const clear = el => el && el.classList.remove('card-hi', 'card-hi--fabrica', 'card-hi--sust');
    const add = (el, cls) => el && (el.classList.add('card-hi'), el.classList.add(cls));

    clear(fabr); clear(sust);

    if (mode === 'fabrica') add(fabr, 'card-hi--fabrica');
    else if (mode === 'sust') add(sust, 'card-hi--sust');
    // se mode === null, fica tudo limpo
  }


  // expõe p/ showPage e outros pontos chamarem
  window.setCodesCardHighlight = setCodesCardHighlight;



  // ========= helpers DOM =========
  function byId(id) { return document.getElementById(id); }
  function setText(id, v) { const el = byId(id); if (el) el.textContent = (v ?? '—'); }
  const norm = s => String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();


  function setValue(id, v) {
    const el = byId(id);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!v;
    } else if (el.type === 'date') {
      // aceita 'YYYY-MM-DD' ou ISO, fatia os 10 primeiros
      el.value = v ? String(v).slice(0, 10) : '';
    } else {
      el.value = (v ?? '');
    }
  }
  // ---------- Injeção/Restauro dos cards do topo (Sustentação) ----------
  window.__sustTopState = {
    injected: false,
    clones: [],     // nodes injetados
    originals: {}   // map key->original node (clonados para restaurar)
  };

  // ----------------- INJETAR / RESTAURAR TOP CARDS (SUSTENTACAO) -----------------

  // Mapa de ícones (SVG) por chave - evita repetição e facilita manutenção
  const SUST_ICONS = {
    'fora-prazo': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 7v6l4 2" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'concluido': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'a-desenvolver': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h18" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3v18" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    'pendente': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 2v10l3 3" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="#f59e0b" stroke-width="1.6"/></svg>`,
    'em-dev': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="7" width="18" height="11" rx="2" stroke="#10b981" stroke-width="1.6"/><path d="M7 11h10" stroke="#10b981" stroke-width="1.6"/></svg>`,
    'homologacao': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h18" stroke="#8b5cf6" stroke-width="1.6"/><path d="M12 3v18" stroke="#8b5cf6" stroke-width="1.6"/></svg>`,
    'suspenso': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6h12v12H6z" stroke="#6b7280" stroke-width="1.6"/></svg>`,
    'em-testes': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 7h16v10H4z" stroke="#6366f1" stroke-width="1.6"/><path d="M8 11h8" stroke="#6366f1" stroke-width="1.6"/></svg>`
  };

  // Re-usa o estado global existente (garante compatibilidade)
  window.__sustTopState = window.__sustTopState || { injected: false, clones: [], originals: {} };

  const SUST_TOP_ORDER = [
    ['fora-prazo', 'Fora do Prazo'],
    ['a-desenvolver', 'A Desenvolver'],
    ['pendente', 'Pendente'],
    ['em-dev', 'Em Dev.'],
    ['homologacao', 'Em Homologação'],
    ['suspenso', 'Suspenso'],
    ['em-testes', 'Em Testes'],
    ['concluido', 'Concluído']
  ];

  // injeta/ajusta os cards do topo para o modo Sustentação
  function injectSustTopCards(itens) {
    try {
      const list = Array.isArray(itens) ? itens : [];
      const parentTemplate = document.querySelector('#codesPage [data-card^="codes:"]') || document.querySelector('[data-card^="codes:"]');
      const parent = parentTemplate ? parentTemplate.parentElement : document;

      // helpers
      const normStr = s => (String(s || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const isOverdue = (it) => {
        const now = Date.now();
        for (const k of Object.keys(it || {})) {
          if (/(prazo|due|deadline|venc|date|data|termino|conclusao)/.test(String(k).toLowerCase())) {
            const d = new Date(it[k]); if (!isNaN(d) && d.getTime() < now) return true;
          }
        }
        return /atras|vencid|vencido|atrasad/.test(normStr(it.status || it.situacao || it.etapa || ''));
      };
      const counts = {
        'fora-prazo': list.filter(isOverdue).length,
        'a-desenvolver': list.filter(x => /(a desenvolver|adesenvolver|a-desenvolver)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'pendente': list.filter(x => /pendente|pend\W/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'em-dev': list.filter(x => /(desenvolv|dev|em desenvolvimento|em dev)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'homologacao': list.filter(x => /homolog/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'suspenso': list.filter(x => /(suspens|suspend|bloquead)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'em-testes': list.filter(x => /(teste|qa|test)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'concluido': list.filter(x => /(conclu|fech|resolvid|done|closed)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length
      };

      // 1) esconder APENAS os cards de desenvolvimento que não existem na Sustentação
      const devOnly = ['planejado', 'pausado']; // ✅ só esses somem
      devOnly.forEach(k => {
        const el = parent.querySelector(`[data-card="codes:${k}"]`);
        if (el) {
          window.__sustTopState.originals[k] = el; // salva para restaurar depois
          el.classList.add('hidden');
        }
      });

      // 2) para cada card da Sustentação, reutilize o existente (se houver) OU clone o template
      const ensureIcon = (node, key) => {
        const iconWrap = node.querySelector('.w-12.h-12, .icon, .icon-wrap, svg') || node.querySelector('svg') || null;
        if (!iconWrap) return;
        const svg = SUST_ICONS[key] || '';
        if (!svg) return;
        if (iconWrap.tagName && iconWrap.tagName.toLowerCase() === 'svg') iconWrap.outerHTML = svg;
        else iconWrap.innerHTML = svg;
      };
      const bindClick = (node, key) => {
        if (!node || node.dataset.sustBound === '1') return;
        node.dataset.sustBound = '1';
        node.addEventListener('click', () => {
          (parent.querySelectorAll('[data-card^="codes:"]') || []).forEach(n => n.classList.remove('ring-2', 'ring-blue-500'));
          node.classList.add('ring-2', 'ring-blue-500');
          try { applyTopSustFilter(key); } catch (e) { /* ignore */ }
        });
      };
      const setCount = (node, val) => {
        let countEl =
          node.querySelector('p.text-2xl.font-bold') ||
          node.querySelector('p.text-2xl') ||
          node.querySelector('.count') ||
          node.querySelector('.sust-count');
        if (!countEl) {
          const cands = Array.from(node.querySelectorAll('p, span')).reverse();
          countEl = cands.find(n => /\d+/.test(n.textContent || ''));
        }
        if (!countEl) {
          const p = document.createElement('p'); p.className = 'text-2xl font-bold'; node.appendChild(p); countEl = p;
        }
        countEl.textContent = String(val ?? 0);
      };

      SUST_TOP_ORDER.forEach(([key, label]) => {
        const selector = `[data-card="codes:${key}"]`;
        let card = parent.querySelector(selector);

        if (!card) {
          // não existe no topo original → clona o primeiro card como base
          const template = parentTemplate || document.querySelector('[data-card^="codes:"]');
          if (!template) return;
          card = template.cloneNode(true);
          card.dataset.card = `codes:${key}`;
          card.classList.remove('hidden');
          // título/label
          const tl = card.querySelector('.text-sm') || card.querySelector('h3') || card.querySelector('p');
          if (tl) tl.textContent = label;
          // injeta no final do grid
          template.parentElement.appendChild(card);
          window.__sustTopState.clones.push(card);
        }

        // para EXISTENTE ou CLONE: ícone, número e clique de filtro
        ensureIcon(card, key);
        setCount(card, counts[key] ?? 0);
        bindClick(card, key);
      });

      window.__sustTopState.injected = true;
    } catch (e) {
      console.error('injectSustTopCards erro', e);
    }
  }


  // Restaura os cards originais da Fábrica/Desenvolvimento e remove clones
  function restoreDevTopCards() {
    window.__codesView = 'fabrica';

    try {
      // remove clones injetados
      document.querySelectorAll('[data-card^="codes:"]').forEach(n => n.classList.remove('ring-2', 'ring-blue-500'));

      (window.__sustTopState.clones || []).forEach(n => { if (n && n.parentNode) n.parentNode.removeChild(n); });
      window.__sustTopState.clones = [];

      // mostra novamente os originais que havíamos escondido
      Object.values(window.__sustTopState.originals || {}).forEach(orig => {
        if (orig) orig.classList.remove('hidden');
      });

      // limpa flag
      window.__sustTopState.injected = false;
      window.__sustTopState.originals = {};
    } catch (e) { console.error('restoreDevTopCards erro', e); }
  }

  // Atualiza contadores dos clones (usado quando for só atualizar contagens)
  function updateInjectedCounts(itens) {
    try {
      const lista = Array.isArray(itens) ? itens : (window._lastSustItems || []);
      const normStr = s => (String(s || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const isOverdue = (it) => {
        const now = Date.now();
        for (const k of Object.keys(it || {})) {
          if (/(prazo|due|deadline|venc|date|data|termino|conclusao)/.test(String(k).toLowerCase())) {
            const d = new Date(it[k]); if (!isNaN(d) && d.getTime() < now) return true;
          }
        }
        return /atras|vencid|vencido|atrasad/.test(normStr(it.status || it.situacao || it.etapa || ''));
      };

      const counts = {
        'fora-prazo': lista.filter(isOverdue).length,
        'a-desenvolver': lista.filter(x => /(a desenvolver|adesenvolver|a-desenvolver)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'pendente': lista.filter(x => /pendente|pend\W/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'em-dev': lista.filter(x => /(desenvolv|dev|em desenvolvimento|em dev)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'homologacao': lista.filter(x => /homolog/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'suspenso': lista.filter(x => /(suspens|suspend|bloquead)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'em-testes': lista.filter(x => /(teste|qa|test)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
        'concluido': lista.filter(x => /(conclu|fech|resolvid|done|closed)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length
      };

      // atualiza clones no DOM
      (window.__sustTopState.clones || []).forEach(clone => {
        const k = (clone.dataset.card || '').split(':')[1];
        const p = clone.querySelector('p.text-2xl.font-bold, p.text-2xl, .count, .sust-count');
        if (p) p.textContent = String(counts[k] ?? 0);
      });

      // também atualiza quaisquer elementos já existentes com data-card
      SUST_TOP_ORDER.forEach(([key, label]) => {
        const existing = document.querySelector(`[data-card="codes:${key}"]`);
        if (existing) {
          const p = existing.querySelector('p.text-2xl.font-bold, p.text-2xl, .count, .sust-count');
          if (p) p.textContent = String(counts[key] ?? 0);
        }
      });
    } catch (e) {
      console.error('updateInjectedCounts erro', e);
    }
  }

  // expose para debug/uso externo
  window.injectSustTopCards = injectSustTopCards;
  window.restoreDevTopCards = restoreDevTopCards;
  window.updateInjectedCounts = updateInjectedCounts;


  // filtro local disparado ao clicar num top-card injetado
  function applyTopSustFilter(key) {
    const items = window._lastSustItems || [];
    if (!key || key === 'todos') return renderSustentacaoTable(items);
    const filtered = items.filter(x => {
      const s = (x.status || x.etapa || x.situacao || '') + '';
      const sn = (s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      try {
        switch (key) {
          case 'fora-prazo': {
            const now = Date.now(); for (const k of Object.keys(x || {})) { if (/(prazo|due|deadline|venc|date|data|termino|conclusao)/.test(k.toLowerCase())) { const d = new Date(x[k]); if (!isNaN(d) && d.getTime() < now) return true; } } return /atras|vencid|vencido|atrasad/.test(sn);
          }
          case 'a-desenvolver': return /(a desenvolver|adesenvolver|a-desenvolver)/.test(sn);
          case 'pendente': return /pendente|pend\W/.test(sn);
          case 'em-dev': return /(desenvolv|dev|em desenvolvimento|em dev)/.test(sn);
          case 'homologacao': return /homolog/.test(sn);
          case 'suspenso': return /(suspens|suspend|bloquead)/.test(sn);
          case 'em-testes': return /(teste|qa|test)/.test(sn);
          case 'concluido': return /(conclu|fech|resolvid|done|closed)/.test(sn);
        }
      } catch (e) { return false; }
      return false;
    });
    renderSustentacaoTable(filtered);
  }

  const isSust = v => {
    const n = norm(v);
    // pega “sustentacao”, “sustentacao/operacao”, etc.
    return n.startsWith('sustentacao');
  };

  function getValue(id) {
    const el = byId(id);
    if (!el) return '';
    if (el.type === 'checkbox') return !!el.checked;
    return (el.value ?? '').toString().trim();
  }

  async function safeJsonOrNull(res) {
    try { return await res.json(); } catch { return null; }
  }

  function js(v) { return JSON.stringify(v); }
  function escapeHtml(s) {
    if (s == null) return s;
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }


  function formatDateTimeRaw(raw) {
    if (!raw) return '—';
    // pega só YYYY-MM-DD HH:mm:ss
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})/);
    if (m) return `${m[1]} ${m[2]}`;
    return raw;
  }

  function formatToBrasilia(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d)) return '—';

    // Força ajuste de -3h (UTC → Brasília)
    d.setHours(d.getHours() - 3);

    return d.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }


  // 👇 ADICIONE ISSO
  window.addAndamento = addAndamento;
  window.confirmEditAndamento = confirmEditAndamento;
  window.deleteAndamento = deleteAndamento;
  window.startEditAndamento = startEditAndamento;
  window.loadAndamentos = loadAndamentos;


  // ========= Carregar projetos =========
  async function loadProjetos() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
      const projetos = await res.json();
      cacheProjetos = Array.isArray(projetos) ? projetos : [];

      window.cacheProjetos = cacheProjetos;

      renderRecentTable(cacheProjetos);
      renderAllCoordTables(cacheProjetos);
      updateKPIs(cacheProjetos);
      drawCharts(cacheProjetos);
      drawCodesSprintsChart(cacheProjetos);
      drawCodesInternChart(cacheProjetos);
      ensureDynamicStatusCards(cacheProjetos);



      updateLastUpdateTime(); // 👈 atualiza timestamp
    } catch (err) {
      console.error(err);
      updateLastUpdateTime(); // 👈 ainda atualiza (indica momento da última tentativa)
    }
  }

  function startEditAndamento(andamentoId, projetoId, descricaoRaw) {
    const item = document.getElementById(`andamento-${andamentoId}`);
    if (!item) return;

    // Reescapa para uso seguro dentro do atributo value
    const descricaoEsc = escapeHtml(descricaoRaw ?? '');

    item.innerHTML = `
      <input id="edit-input-${andamentoId}" type="text" class="border p-1 flex-1 rounded" value="${descricaoEsc}">
      <div class="flex gap-2 ml-2">
        <button class="px-2 py-1 text-xs bg-green-600 text-white rounded"
                onclick="confirmEditAndamento(${andamentoId}, ${projetoId}, document.getElementById('edit-input-${andamentoId}').value)">💾 Salvar</button>
        <button class="px-2 py-1 text-xs bg-gray-500 text-white rounded"
                onclick="loadAndamentos(${projetoId})">❌ Cancelar</button>
      </div>
    `;
  }




  // Exibir andamentos no modal
  function renderAndamentos(projetoId, andamentos) {
    const container = document.getElementById("detailAndamentos");
    container.innerHTML = "";

    if (andamentos.length === 0) {
      container.innerHTML = "<p>Nenhum andamento registrado.</p>";
      return;
    }

    andamentos.forEach(a => {
      const item = document.createElement("div");
      item.className = "flex justify-between items-center p-2 border rounded bg-gray-50";
      item.id = `andamento-${a.id}`;

      item.innerHTML = `
<span class="desc">${formatToBrasilia(a.data)} — ${escapeHtml(a.descricao)}</span>
      <div class="flex gap-2">
        <button class="px-2 py-1 text-xs bg-yellow-500 text-white rounded"
                data-id="${a.id}"
                data-projeto="${projetoId}"
                data-desc="${escapeHtml(a.descricao)}"
                onclick="startEditAndamento(this.dataset.id, this.dataset.projeto, this.dataset.desc)">✏️ Editar</button>
        <button class="px-2 py-1 text-xs bg-red-600 text-white rounded"
                onclick="deleteAndamento(${a.id}, ${projetoId})">🗑️ Excluir</button>
      </div>
    `;
      container.appendChild(item);
    });
  }



  // Adicionar andamento (já existente, mas adaptado p/ recarregar lista)
  async function addAndamento(projetoId) {
    const pid = projetoId || window.currentProjectId;
    if (!pid) { toast('Erro', 'Projeto não identificado.', 'error'); return; }
    const input = document.getElementById("newAndamento");
    const descricao = input.value.trim();
    if (!descricao) return;

    const resp = await fetch(`${API_ROOT}/projetos/${pid}/andamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao })
    });
    if (!resp.ok) {
      const j = await safeJsonOrNull(resp);
      return toast('Erro', (j && (j.erro || j.message)) || `Falha ao criar andamento (${resp.status})`, 'error');
    }
    input.value = "";
    loadAndamentos(pid);
  }

  // Editar andamento
  async function confirmEditAndamento(andamentoId, projetoId, novaDescricao) {
    if (!novaDescricao.trim()) return;
    const resp = await fetch(`${API_ROOT}/andamentos/${andamentoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: novaDescricao })
    });
    if (!resp.ok) {
      const j = await safeJsonOrNull(resp);
      return toast('Erro', (j && (j.erro || j.message)) || `Falha ao editar (${resp.status})`, 'error');
    }
    loadAndamentos(projetoId);
  }


  async function deleteAndamento(andamentoId, projetoId) {
    showConfirm("Tem certeza que deseja excluir este andamento?", async () => {
      await fetch(`${API_ROOT}/andamentos/${andamentoId}`, { method: "DELETE" });
      loadAndamentos(projetoId);
    });
  }



  // Carregar lista de andamentos
  async function loadAndamentos(projetoId) {
    try {
      const res = await fetch(`http://localhost:5001/api/projetos/${projetoId}/andamentos`);
      if (!res.ok) throw new Error("Erro ao buscar andamentos");

      const data = await res.json();
      renderAndamentos(projetoId, data);
    } catch (err) {
      console.error("Erro ao carregar andamentos", err);
    }
  }
  // ========= Ações (links com ícones) =========
  function actionLinksHtml(idArg) {
    return `
      <a href="#" onclick="showProjectDetail(${idArg}); return false;"
         class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mr-4" role="button">
        <span>👁️</span><span>Ver</span>
      </a>
      <a href="#" onclick="editProject(${idArg}); return false;"
         class="inline-flex items-center gap-1 text-green-600 hover:text-green-800 mr-4" role="button">
        <span>✏️</span><span>Editar</span>
      </a>
      <a href="#" onclick="deleteProject(${idArg}); return false;"
         class="inline-flex items-center gap-1 text-red-600 hover:text-red-800" role="button">
        <span>🗑️</span><span>Excluir</span>
      </a>
    `;
  }

  // === Ações da tabela de Sustentação ===
  function sustActionLinksHtml(numeroArg) {
    return `
      <div class="flex items-center gap-3">
        <a href="#"
           onclick="window.verChamadoByNumero && window.verChamadoByNumero(${numeroArg}); return false;"
           class="btn-ico bg-[#1555D6] text-white shadow-sm" aria-label="Ver" title="Ver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </a>
  
        <a href="#"
           onclick="window.editarChamado && window.editarChamado(${numeroArg}); return false;"
           class="btn-ico bg-white text-[#1555D6] ring-2 ring-[#1555D6]" aria-label="Editar" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5 20.5 7.5 7 21H3v-4L16.5 3.5z"/>
          </svg>
        </a>
  
        <a href="#"
           onclick="window.concluirChamado && window.concluirChamado(${numeroArg}); return false;"
           class="btn-ico bg-[#16a34a] text-white shadow-sm" aria-label="Concluir" title="Concluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </a>
      </div>
    `;
  }



  // stubs mínimos:
  window.sustView = id => window.verChamadoByNumero && window.verChamadoByNumero(id);
  window.sustEdit = id => window.editarChamado && window.editarChamado(id);
  window.sustDelete = id => window.excluirChamado ? window.excluirChamado(id) : null;





  // Handlers mínimos (adeque quando tiver os modais/rotas reais)
  function viewChamado(id) {
    // se existir um modal próprio, chame-o aqui
    toast('Chamado', `Abrir detalhes do chamado ${id}`, 'info');
  }
  function editChamado(id) {
    // idem para modal de edição
    toast('Editar', `Abrir edição do chamado ${id}`, 'info');
  }
  async function deleteChamado(id) {
    showConfirm(`Excluir chamado ${id}?`, async () => {
      try {
        const r = await fetch(`${API_ROOT}/sustentacao/${id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error(`Falha ao excluir (${r.status})`);
        toast('Sucesso', 'Chamado excluído', 'success');
        await loadSustKPI();
      } catch (e) {
        console.error(e);
        toast('Erro', e.message, 'error');
      }
    });
  }

  // deixe acessível no onclick do HTML
  window.viewChamado = viewChamado;
  window.editChamado = editChamado;
  window.deleteChamado = deleteChamado;

  // ========= Projetos Recentes =========
  function renderRecentTable(list) {
    const tbody = byId('projectsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto cadastrado.</td></tr>`;
      return;
    }

    // 🔽 Ordena pelos mais recentes (data início ou fim)
    const sorted = [...list].sort((a, b) => {
      const da = new Date(a.inicio || a.fim || 0);
      const db = new Date(b.inicio || b.fim || 0);
      return db - da;
    });

    // 🔽 Pega só os 5 primeiros
    const recent = sorted.slice(0, 5);

    recent.forEach(p => {
      const idArg = js(p.id ?? p.nome);
      const progresso = (p.progresso != null) ? Number(p.progresso) : null;
      const sprints = (p.sprintsConcluidas != null && p.totalSprints != null)
        ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—';

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

    const rows = list.filter(p => norm(p.coordenacao) === norm(coord));
    const colCount = (tbodyId === 'codesTableBody') ? 7 : 6;
    const emptyMsg = `<tr><td colspan="${colCount}" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum projeto encontrado.</td></tr>`;
    if (!rows.length) { tbody.innerHTML = emptyMsg; return; }

    sortByStatus(rows).forEach(p => {
      const idArg = js(p.id);
      const progresso = (p.progresso != null) ? Number(p.progresso) : 0;
      const sprints = (p.sprintsConcluidas != null && p.totalSprints != null)
        ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—';

      let rowHtml = `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${escapeHtml(p.nome) || '-'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">
              ${escapeHtml(p.status) || '-'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag || p.farol)}">
              ${escapeHtml(p.rag || p.farol) || '—'}
            </span>

          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${progresso}%"></div>
            </div>
            <span class="ml-2">${progresso}%</span>
          </td>`;

      // 👇 Só CODES mostra a coluna de Sprints
      if (tbodyId === 'codesTableBody') {
        rowHtml += `
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${sprints}</td>`;
      }

      rowHtml += `
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(p.responsavel) || '—'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            ${actionLinksHtml(idArg)}
          </td>
        </tr>`;

      tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
  }



  // ========= KPIs =========
  function updateKPIs(list) {



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
      if (!p.fim) return false;
      const s = norm(p.status);
      if (s === 'concluido') return false;
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
    const ativos = list.filter(p => {
      const s = norm(p.status);
      return ['em andamento', 'em risco', 'sustentacao'].includes(s);
    }).length;
    setText('kpiProjetosAtivos', ativos);


    // Totais Home
    const totalVG = (codes.length + (sustentacaoTotal ?? 0)) + coset.length + cgod.length;
    setText('totalProjetos', totalVG);
    setText('projetosCodes', codes.length + (sustentacaoTotal ?? 0));
    setText('projetosCoset', coset.length);
    setText('projetosCgod', cgod.length);

    // Home – Detalhamento CODES
    setCardCount('codes', 'desenvolvimento', codes.filter(p => norm(p.status) === 'em andamento').length);
    // CODES – contagem Sustentação (fallback por status, mas prioriza os chamados, se já carregados)
    const sustCount = codes.filter(p => isSust(p.status)).length;
    applySustCard(sustentacaoTotal ?? sustCount);

    // Home – Detalhamento COSET
    setCardCount('coset', 'infraestrutura', coset.filter(p => norm(p.tipo).includes('infraestrutura')).length);
    setCardCount('coset', 'integracao', coset.filter(p => norm(p.tipo).includes('integracao')).length);

    // Home – Detalhamento CGOD
    setCardCount('cgod', 'analytics', cgod.filter(p => /dashboard|bi/.test(norm(p.tipo))).length);
    setCardCount('cgod', 'datalake', cgod.filter(p => norm(p.tipo).includes('dados')).length);

    // CODES page
    setCardCount('codes', 'ativos', codes.filter(p => ['em andamento', 'sustentacao'].includes(norm(p.status))).length);

    // ⛔ quando em Sustentação, não reescreva os cards de status (já vêm dos chamados)
    if (window.__codesView !== 'sustentacao') {
      setCardCount('codes', 'fora-prazo',
        codes.filter(p => {
          if (!p.fim || p.status === 'Concluído') return false;
          const d = new Date(p.fim);
          return !isNaN(d) && d < new Date();
        }).length
      );
      setCardCount('codes', 'planejado', codes.filter(p => norm(p.status) === 'planejado').length);
      setCardCount('codes', 'concluido', codes.filter(p => norm(p.status) === 'concluido').length);
      setCardCount('codes', 'pausado', codes.filter(p => norm(p.status) === 'pausado').length);
    }

    setCardCount('codes', 'total', codes.length + (sustentacaoTotal ?? 0));

    // COSET page
    setCardCount('coset', 'sistemas-integrados', coset.filter(p => norm(p.tipo).includes('sistema integrado')).length);
    setCardCount('coset', 'modernizacao', coset.filter(p => norm(p.tipo).includes('modernizacao')).length);
    setCardCount('coset', 'compliance', coset.filter(p => norm(p.tipo).includes('compliance')).length);

    // CGOD page
    setCardCount('cgod', 'catalogos', cgod.filter(p => /catalogo/.test(norm(p.nome)) || norm(p.tipo).includes('dados')).length);
    setCardCount('cgod', 'qualidade', cgod.filter(p => norm(p.tipo).includes('qualidade')).length);
    setCardCount('cgod', 'governanca', cgod.filter(p => norm(p.tipo).includes('governanca')).length);
  }
  // --- override do card "Em Sustentação" vindo dos chamados ---
  function applySustCard(total) {
    sustentacaoTotal = Number.isFinite(total) ? total : 0;
    // cobre cards com e sem acento no data-card
    setCardCount('codes', 'sustentacao', sustentacaoTotal);
    setCardCount('codes', 'sustentação', sustentacaoTotal);
  }
  // (opcional p/ debugar no console)
  window.applySustCard = applySustCard;

  function setCardCount(coordKey, cat, value) {
    // 🔒 não deixe nada sobrescrever os cards da Sustentação
    const isSust = window.__codesView === 'sustentacao';
    if (isSust && String(coordKey).toLowerCase() === 'codes') {
      const block = new Set([
        'fora-prazo', 'a-desenvolver', 'pendente', 'em-dev',
        'homologacao', 'suspenso', 'em-testes', 'concluido'
      ]);
      const catNorm = String(cat || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (block.has(catNorm)) return; // 👉 evita overwrite em Sustentação
    }

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


  function drawSustDistribChart(itens) {
    const canvas = byId('sustDistribChart');
    if (!canvas || !window.Chart) return;

    // agrupa por status (normalizado) mas mantém o primeiro rótulo “bonito”
    const map = new Map();
    (Array.isArray(itens) ? itens : []).forEach(x => {
      const raw = (x.status || x.situacao || x.etapa || '-').toString().trim();
      const key = norm(raw);
      if (!map.has(key)) map.set(key, { label: raw, count: 0 });
      map.get(key).count++;
    });

    const labels = [...map.values()].map(v => v.label);
    const data = [...map.values()].map(v => v.count);

    if (chartSustDistrib) chartSustDistrib.destroy();
    chartSustDistrib = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#14b8a6', '#f43f5e'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: { legend: { position: 'bottom' } }
      }
    });
    // dá cara de card e espaço antes da tabela
    const card = canvas.closest('.bg-white, .card, .rounded, .shadow') || canvas.parentElement;
    if (card) {
      card.classList.add('bg-white', 'p-6', 'rounded', 'shadow', 'mb-6'); // <-- margem inferior
    }

  }

  // ========= GRÁFICOS (Home) =========
  function drawCharts(list) {
    const codes = list.filter(p => (p.coordenacao || '').toUpperCase() === 'CODES').length;
    const coset = list.filter(p => (p.coordenacao || '').toUpperCase() === 'COSET').length;
    const cgod = list.filter(p => (p.coordenacao || '').toUpperCase() === 'CGOD').length;

    // compara normalizando para evitar 'Concluido' vs 'Concluído'
    const stNorm = alvo => list.filter(p => norm(p.status) === norm(alvo)).length;

    const statusData = {
      'Planejado': stNorm('Planejado'),
      'Em Andamento': stNorm('Em Andamento'),
      'Em Risco': stNorm('Em Risco'),
      'Concluído': stNorm('Concluído'),
      'Sustentação': stNorm('Sustentação')
    };

    if (chartCoordenacao) chartCoordenacao.destroy();
    if (chartStatus) chartStatus.destroy();

    // Projetos por Coordenação
    const coordCanvas = byId('coordenacaoChart');
    if (coordCanvas && window.Chart) {
      // Projetos por Coordenação (donut)
      chartCoordenacao = new Chart(coordCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['CODES', 'COSET', 'CGOD'],
          datasets: [{
            data: [codes, coset, cgod],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#f97316'],
            borderColor: '#fff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 20,
                font: { size: 12 }
              }
            }
          }
        }
      });

    }
    // Distribuição por Status
    const distribCanvas = byId('statusDistribChart');
    if (distribCanvas && window.Chart) {
      if (chartStatusDistrib) chartStatusDistrib.destroy();   // 👈 destrói antes
      chartStatusDistrib = new Chart(distribCanvas.getContext('2d'), {
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
      if (chartRag) chartRag.destroy();   // 👈 destrói antes
      chartRag = new Chart(ragCanvas.getContext('2d'), {
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
      if (chartTimeline) chartTimeline.destroy();   // 👈 destrói antes
      chartTimeline = new Chart(timelineCanvas.getContext('2d'), {
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
    // --- Status (BARRAS HORIZONTAIS) ---
    const statusCanvas = byId('statusChart');
    if (statusCanvas && window.Chart) {
      // calcula altura ideal (48px por categoria, mínimo 260px)
      const statusLabels = Object.keys(statusData);
      const wrapper = statusCanvas.closest('.chart-wrapper');
      if (wrapper) wrapper.style.height = Math.max(260, statusLabels.length * 48) + 'px';

      if (chartStatus) chartStatus.destroy();

      chartStatus = new Chart(statusCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: statusLabels,
          datasets: [{
            data: Object.values(statusData),
            backgroundColor: ['#6b7280', '#16a34a', '#dc2626', '#2563eb', '#f59e0b'],
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',              // 👈 horizontal
          layout: { padding: { right: 8, left: 8, bottom: 4, top: 4 } },
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: {
                autoSkip: false,
                padding: 6,
                font: { size: 12 },   // rótulos legíveis
                crossAlign: 'near'
              },
              grid: { display: false } // sem linhas verticais
            },
            x: {
              beginAtZero: true,
              grid: { color: '#f3f4f6' },
              ticks: { precision: 0 }
            }
          },
          categoryPercentage: 0.8,
          barPercentage: 0.9
        }
      });
    }

  }

  // ========= Gráficos por aba =========
  function drawCodesSprintsChart(projects) {
    const ctx = byId('codesSprintsChart');
    if (!ctx) return;

    const ativos = projects.filter(
      p => (p.coordenacao || '').toUpperCase() === 'CODES' &&
        (p.status || '').toLowerCase() === 'em andamento' &&
        p.totalSprints &&
        p.sprintsConcluidas != null &&
        p.sprintsConcluidas < p.totalSprints
    );


    if (!ativos.length) {
      if (chartCodes) chartCodes.destroy();
      const c = ctx.getContext("2d");
      c.clearRect(0, 0, ctx.width, ctx.height);
      c.font = "16px Arial";
      c.fillStyle = "#666";
      c.textAlign = "center";
      c.fillText("Nenhum projeto em andamento", ctx.width / 2, ctx.height / 2);
      return;
    }

    const labels = ativos.map(p => p.nome);
    const progresso = ativos.map(p => Math.round((p.sprintsConcluidas / p.totalSprints) * 100));

    if (chartCodes) chartCodes.destroy();
    chartCodes = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "% concluído", data: progresso, backgroundColor: "#3b82f6" }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const proj = ativos[ctx.dataIndex];
                return [
                  `Projeto: ${proj.nome}`,
                  `Progresso: ${ctx.parsed.x}% (${proj.sprintsConcluidas}/${proj.totalSprints})`,
                  proj.equipe ? `Equipe: ${proj.equipe}` : null,
                  proj.responsavel ? `Responsável: ${proj.responsavel}` : null,
                  `Status: ${proj.status || '—'}`
                ].filter(Boolean);
              }
            }
          }


        },
        scales: {
          x: {
            min: 0, max: 100,
            ticks: { callback: v => v + "%" },
            title: { display: true, text: "% das Sprints concluídas" }
          }
        }
      }
    });
  }

  function drawCodesInternChart(projects) {
    const ctx = byId('codesInternChart');
    if (!ctx) return;

    const now = Date.now();

    function isInternalizacaoTrue(val) {
      if (val === true) return true;
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'string') {
        const v = val.trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'sim' || v === 'yes';
      }
      return false;
    }

    // FILTRA apenas projetos da coordenação CODES marcados como internalizacao
    const items = projects
      .filter(p => (p.coordenacao || '').toUpperCase() === 'CODES' && isInternalizacaoTrue(p.internalizacao))
      .map(p => {
        const ini = p.inicio ? new Date(p.inicio).getTime() : null;
        const fim = p.fim ? new Date(p.fim).getTime() : null;
        if (!ini || !fim) return null;

        const daysToEnd = Math.ceil((fim - now) / (1000 * 60 * 60 * 24));
        let cor = '#16a34a';
        if (fim < now) cor = '#dc2626';
        else if (daysToEnd <= 7) cor = '#f59e0b';

        return { y: p.nome, x: [ini, fim], responsavel: p.responsavel, equipe: p.equipe, status: p.status, cor };
      })
      .filter(Boolean)
      .sort((a, b) => a.x[0] - b.x[0]);

    if (!items.length) {
      if (chartIntern) { chartIntern.destroy(); chartIntern = null; }
      // limpa canvas para mensagem amigável
      const c = ctx.getContext("2d");
      c.clearRect(0, 0, ctx.width, ctx.height);
      c.font = "14px Arial";
      c.fillStyle = "#666";
      c.textAlign = "center";
      c.fillText("Nenhum projeto de internalização com datas válidas.", ctx.width / 2, ctx.height / 2);
      return;
    }

    const minX = Math.min(...items.map(d => d.x[0]));
    const maxX = Math.max(...items.map(d => d.x[1]));
    const pad = 3 * 24 * 3600 * 1000;

    if (chartIntern) chartIntern.destroy();
    chartIntern = new Chart(ctx, {
      type: 'bar',
      data: {
        datasets: [{
          data: items,
          backgroundColor: items.map(d => d.cor),
          borderRadius: 6,
          barPercentage: 0.9,
          categoryPercentage: 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx) {
                const d = ctx.raw;
                const ini = new Date(d.x[0]).toLocaleDateString('pt-BR');
                const fim = new Date(d.x[1]).toLocaleDateString('pt-BR');
                return [
                  `Projeto: ${d.y}`,
                  `Período: ${ini} → ${fim}`,
                  d.responsavel ? `Responsável: ${d.responsavel}` : null,
                  d.equipe ? `Equipe: ${d.equipe}` : null,
                  d.status ? `Status: ${d.status}` : null
                ].filter(Boolean);
              }
            }
          },
          annotation: {
            annotations: {
              hoje: {
                type: 'line',
                xMin: now,
                xMax: now,
                borderColor: '#111827',
                borderWidth: 2,
                label: {
                  enabled: true,
                  content: 'Hoje',
                  position: 'start',
                  backgroundColor: '#111827',
                  color: '#fff',
                  font: { size: 10 },
                  yAdjust: -6
                }
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            min: minX - pad,
            max: maxX + pad,
            time: {
              unit: 'day',
              tooltipFormat: 'dd/MM/yyyy',
              displayFormats: { day: 'dd/MM' }
            },
            title: { display: true, text: 'Período' }
          },
          y: { title: { display: true, text: 'Projetos' } }
        }
      }
    });

    // Legenda manual
    const legendEl = ctx.parentNode.querySelector('.custom-legend');
    if (!legendEl) {
      const div = document.createElement('div');
      div.className = 'custom-legend text-xs text-gray-600 mt-2 flex justify-center gap-6';
      div.innerHTML = `
        <span class="flex items-center gap-1"><span class="w-3 h-3 inline-block rounded-full" style="background:#16a34a"></span> Dentro do prazo</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 inline-block rounded-full" style="background:#f59e0b"></span> Próximo do prazo</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 inline-block rounded-full" style="background:#dc2626"></span> Atrasado</span>
      `;
      ctx.parentNode.appendChild(div);
    }
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


  // ================== FILTRO DE PROJETOS ==================
  function filterProjects(coordenacao, categoria) {
    console.log("Filtro acionado:", coordenacao, categoria);

    // sempre que filtrar CODES (fábrica), volta o modo p/ 'fabrica'
    if ((coordenacao || '').toUpperCase() === 'CODES') {
      window.__codesView = 'fabrica';
    }

    // Esconde Sustentação ao aplicar filtros da fábrica
    document.getElementById("codesSustentacaoWrapper")?.classList.add("hidden");

    // Mostra a tabela padrão + gráficos da fábrica
    document.getElementById("tableView")?.classList.remove("hidden");
    if ((coordenacao || '').toUpperCase() === 'CODES') {
      document.getElementById('codesSprintsWrapper')?.classList.remove('hidden');
      document.getElementById('codesInternWrapper')?.classList.remove('hidden');

      if (typeof drawCodesSprintsChart === 'function') drawCodesSprintsChart(cacheProjetos);
      if (typeof drawCodesInternChart === 'function') drawCodesInternChart(cacheProjetos);

      try { window._charts?.codes?.resize?.(); window._charts?.codes?.update?.(); } catch { }
      try { window._charts?.intern?.resize?.(); window._charts?.intern?.update?.(); } catch { }

      // ⭐ reforça o destaque “Na Fábrica” quando o usuário filtra pelos cards da fábrica
      setCodesCardHighlight('fabrica');
    }

    // Filtra os projetos
    let filtrados = cacheProjetos.filter(
      p => norm(p.coordenacao) === norm(coordenacao)
    );

    if (categoria && categoria !== "total") {
      const catLower = categoria.toLowerCase();
      const now = new Date();

      filtrados = filtrados.filter(p => {
        const status = (p.status || "").toLowerCase();
        switch (catLower) {
          case "ativos":
            return ["em andamento", "em risco", "sustentação", "sustentacao"].includes(status);
          case "desenvolvimento":
            return status === "em andamento";
          case "fora-prazo":
            return p.fim && new Date(p.fim) < now && status !== "concluído";
          case "planejado":
            return status === "planejado";
          case "pausado":
            return status === "pausado";
          case "concluido":
            return status === "concluído" || status === "concluido";
          default:
            return true;
        }
      });
    }

    // Renderiza usando o layout oficial
    const mapTbody = {
      CODES: "codesTableBody",
      COSET: "cosetTableBody",
      CGOD: "cgodTableBody"
    };
    if (mapTbody[(coordenacao || '').toUpperCase()]) {
      renderCoordTable(coordenacao.toUpperCase(), mapTbody[coordenacao.toUpperCase()], filtrados);
    }
  }




  function showSustentacao() {
    // entra em modo Sustentação ANTES de navegar
    window.__codesView = 'sustentacao';
    setCodesCardHighlight('sust');

    // vai para a aba CODES
    const btn = (typeof window.getNavButtonFor === 'function') ? getNavButtonFor('codes') : null;
    showPage('codes', btn);

    // garante que os gráficos da fábrica não apareçam
    document.getElementById('codesSprintsWrapper')?.classList.add('hidden');
    document.getElementById('codesInternWrapper')?.classList.add('hidden');
    document.getElementById('tableView')?.classList.add('hidden');

    if (chartCodes) { chartCodes.destroy(); chartCodes = null; }
    if (chartIntern) { chartIntern.destroy(); chartIntern = null; }

    // mostra a área de Sustentação
    document.getElementById('codesSustentacaoWrapper')?.classList.remove('hidden');

    // CARREGA e RENDERIZA: cards + tabela (essa função faz o fetch e atualiza tudo)
    loadSustentacaoView();

    // chama o loader adicional do arquivo assets/js/sustentacao.js (se existir) —
    // mantemos chamada para compatibilidade, mas agora não dependemos exclusivamente dela.
    if (typeof window.loadSustentacao === 'function') {
      try { window.loadSustentacao(); } catch (e) { /* não fatal */ }
    }
  }






  // ========= DETALHE =========
  function showProjectDetail(idOrName) {
    const p = findProjeto(idOrName);
    if (!p) return toast('Não encontrado', 'Projeto não encontrado', 'warn');

    // guarda o ID do projeto atual
    window.currentProjectId = p.id;
    loadAndamentos(p.id);

    setText('detailProjectName', p.nome || '—');
    setText('detailProjectType', `${p.tipo || '—'} • ${p.coordenacao || '—'}`);

    const ragEl = byId('detailRagStatus');
    if (ragEl) {
      ragEl.textContent = p.rag || '—';
      ragEl.className = `w-full h-8 rounded flex items-center justify-center text-white font-medium ${ragClass(p.rag)}`;
    }

    setText('detailPrioridade', p.prioridade || '—');
    setText('detailSprints',
      (p.sprintsConcluidas != null && p.totalSprints != null)
        ? `${p.sprintsConcluidas} de ${p.totalSprints}` : '—'
    );
    setText('detailCoordenacao', p.coordenacao || '—');
    setText('detailResponsavel', p.responsavel || '—');
    setText('detailStatus', p.status || '—');

    // ✅ Ajustado para horário de Brasília
    setText('detailInicio', formatToBrasilia(p.inicio));
    setText('detailFim', formatToBrasilia(p.fim));

    setText('detailDescricao', p.descricao || '—');
    setText('detailOrcamento', formatCurrency(p.orcamento));
    setText('detailRiscos', p.riscos || '—');
    setText('detailInternalizacao', p.internalizacao ? 'Sim' : 'Não');

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

    // carrega os andamentos do projeto
    loadAndamentos(p.id);

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
    const chk = byId('projectInternalizacao');
    if (chk) chk.checked = !!p.internalizacao;

    const h = document.querySelector('#projectModal h3');
    if (h) h.textContent = 'Editar Projeto';

    const btn = byId('submitProjectBtn');
    if (btn) btn.textContent = 'Atualizar Projeto';

    // Garante abertura correta do modal (mesma lógica do "Novo Projeto")
    if (typeof window.showModal === 'function') {
      window.showModal('projectModal');
    } else {
      const modal = byId('projectModal');
      if (modal) modal.classList.remove('hidden');
    }

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
  async function loadSustKPI() {
    try {
      const res = await fetch(`${API_ROOT}/sustentacao`);
      if (!res.ok) throw new Error(`Falha ao carregar Sustentação (${res.status})`);
      const itens = await res.json();

      // OK manter o gráfico do card e o total:
      drawSustDistribChart(itens);                 // 🍩 do card
      applySustCard(Array.isArray(itens) ? itens.length : 0);
      updateLastUpdateTime();
    } catch (e) {
      console.error(e);
      drawSustDistribChart([]);
      applySustCard(0);
      updateLastUpdateTime();
    }
  }

  function renderSustentacaoTable(itens) {
    const lista = Array.isArray(itens) ? itens : [];
    window._lastSustItems = lista;

    const wrapper = document.getElementById('codesSustentacaoWrapper');
    const tbody = document.getElementById('sustentacaoTableBody');
    if (!wrapper || !tbody) {
      console.warn('renderSustentacaoTable: element(s) faltando (#codesSustentacaoWrapper / #sustentacaoTableBody)');
      return;
    }

    // limpa injeções antigas e wrapper antigo
    document.querySelectorAll('.sust-injected-card').forEach(n => n.remove());
    const prevWrap = document.getElementById('sustCardsWrapper');
    if (prevWrap) prevWrap.remove();

    // --- contagens e heurísticas (mesma lógica que no main.js) ---
    const normStr = s => (String(s || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isOverdue = (it) => {
      const now = Date.now();
      for (const k of Object.keys(it || {})) {
        const nk = String(k).toLowerCase();
        if (/(prazo|due|deadline|venc|date|data|termino|conclusao)/.test(nk)) {
          const d = new Date(it[k]);
          if (!isNaN(d) && d.getTime() < now) return true;
        }
      }
      return /atras|vencid|vencido|atrasad/.test(normStr(it.status || it.situacao || it.etapa || ''));
    };

    const counts = {
      todos: lista.length,
      'fora-prazo': lista.filter(isOverdue).length,
      'a-desenvolver': lista.filter(x => /(a desenvolver|adesenvolver|a-desenvolver)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'pendente': lista.filter(x => /pendente|pend\W/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'em-dev': lista.filter(x => /(desenvolv|dev|em desenvolvimento|em dev)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'homologacao': lista.filter(x => /homolog/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'suspenso': lista.filter(x => /(suspens|suspend|bloquead)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'em-testes': lista.filter(x => /(teste|qa|test)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length,
      'concluido': lista.filter(x => /(conclu|fech|resolvid|done|closed)/.test(normStr(x.status || x.etapa || x.situacao || ''))).length
    };

    // helper: cria card no estilo "top" caso precise do fallback
    function makeTopStyleCard(key, label, value) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.sustKey = key;
      btn.className = 'bg-white p-4 rounded shadow flex items-center justify-between hover:shadow-md sust-injected-card';
      btn.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm icon-wrap">
          </div>
          <div class="text-left">
            <div class="text-sm font-medium text-gray-700">${escapeHtml(label)}</div>
            <div class="text-xs text-gray-500">Projetos / chamados</div>
          </div>
        </div>
        <p class="text-2xl font-bold text-gray-800">${value}</p>
      `;
      btn.addEventListener('click', () => {
        Array.from(btn.parentElement.children).forEach(c => c.classList.remove('ring-2', 'ring-blue-500'));
        btn.classList.add('ring-2', 'ring-blue-500');
        try { if (typeof window.applyTopSustFilter === 'function') window.applyTopSustFilter(key); else applyTopSustFilter(key); } catch (e) { /* ignora */ }
      });
      return btn;
    }

    // --- tenta injetar no mesmo container dos top-cards (se possível) ---
    const topTemplate = document.querySelector('#codesPage [data-card^="codes:"]') || document.querySelector('[data-card^="codes:"]');
    const topParent = topTemplate ? topTemplate.parentElement : null;
    const order = [
      ['fora-prazo', 'Fora do Prazo'],
      ['a-desenvolver', 'A Desenvolver'],
      ['pendente', 'Pendente'],
      ['em-dev', 'Em Dev.'],
      ['homologacao', 'Em Homologação'],
      ['suspenso', 'Suspenso'],
      ['em-testes', 'Em Testes'],
      ['concluido', 'Concluído']
    ];

    if (!topParent) {
      // fallback: cria wrapper local (grid) e insere antes da tabela
      const cardsWrapper = document.createElement('div');
      cardsWrapper.id = 'sustCardsWrapper';
      cardsWrapper.className = 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6';
      order.forEach(([key, label]) => {
        const c = makeTopStyleCard(key, label, counts[key] ?? 0);
        // ícones no fallback
        const iconWrap = c.querySelector('.icon-wrap');
        if (iconWrap) {
          let svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="11" width="4" height="8" rx="1" stroke="#6b7280" stroke-width="1.6"/><rect x="10" y="7" width="4" height="12" rx="1" stroke="#6b7280" stroke-width="1.6"/><rect x="17" y="3" width="4" height="16" rx="1" stroke="#6b7280" stroke-width="1.6"/></svg>`;
          if (key === 'fora-prazo') svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 7v6l4 2" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          if (key === 'concluido') svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          iconWrap.innerHTML = svg;
        }
        cardsWrapper.appendChild(c);
      });
      const firstInside = wrapper.querySelector(':scope > *');
      if (firstInside) wrapper.insertBefore(cardsWrapper, firstInside);
      else wrapper.prepend(cardsWrapper);
    } else {
      // insere clones no container do topo (mantém estilo)
      order.forEach(([key, label]) => {
        const dataCard = `codes:${key}`;

        // se já existe um element com esse data-card, atualiza contador e segue
        const existing = topParent.querySelector(`[data-card="${dataCard}"]`);
        if (existing) {
          // atualiza contador dentro do existente (se houver)
          const countEl = existing.querySelector('p.text-2xl.font-bold, p.text-2xl, .count, .sust-count');
          if (countEl) countEl.textContent = String(counts[key] ?? 0);
          return;
        }

        // clone do template visual (se houver)
        const clone = topTemplate.cloneNode(true);
        clone.classList.add('sust-injected-top');
        clone.dataset.card = dataCard;
        clone.classList.remove('hidden');

        // atualiza label/título
        const titleEl = clone.querySelector('.text-sm') || clone.querySelector('h3') || clone.querySelector('p');
        if (titleEl) titleEl.textContent = label;

        // atualiza contador/valor
        let countEl = clone.querySelector('p.text-2xl.font-bold, p.text-2xl, .count, .sust-count');
        if (!countEl) {
          // tenta encontrar qualquer <p> ou <span> com dígito, senão cria um
          const cands = Array.from(clone.querySelectorAll('p, span')).reverse();
          countEl = cands.find(n => /\d+/.test(n.textContent || ''));
        }
        if (!countEl) {
          const p = document.createElement('p');
          p.className = 'text-2xl font-bold';
          clone.appendChild(p);
          countEl = p;
        }
        countEl.textContent = String(counts[key] ?? 0);

        // atualiza ícone (procura container do ícone padrão)
        const iconWrap = clone.querySelector('.w-12.h-12, .icon, .icon-wrap') || clone.querySelector('svg') || null;
        if (iconWrap) {
          let svg = '';
          if (key === 'fora-prazo') {
            svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 7v6l4 2" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          } else if (key === 'concluido') {
            svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M20 6L9 17l-5-5" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          } else if (key === 'a-desenvolver') {
            svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 12h18" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3v18" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round"/></svg>`;
          } else {
            svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="11" width="4" height="8" rx="1" stroke="#6b7280" stroke-width="1.6"/><rect x="10" y="7" width="4" height="12" rx="1" stroke="#6b7280" stroke-width="1.6"/><rect x="17" y="3" width="4" height="16" rx="1" stroke="#6b7280" stroke-width="1.6"/></svg>`;
          }
          // Se iconWrap for um SVG existente, substitui seu parentHTML adequado
          if (iconWrap.tagName.toLowerCase() === 'svg') {
            iconWrap.outerHTML = svg;
          } else {
            iconWrap.innerHTML = svg;
          }
        }

        // clique: destaca e aplica filtro local
        clone.addEventListener('click', () => {
          Array.from(topParent.querySelectorAll('.sust-injected-top')).forEach(n => n.classList.remove('ring-2', 'ring-blue-500'));
          clone.classList.add('ring-2', 'ring-blue-500');
          try { if (typeof window.applyTopSustFilter === 'function') window.applyTopSustFilter(key); else applyTopSustFilter(key); } catch (e) { /* ignora */ }
        });

        // adiciona ao container do topo (apende no final para manter ordem visual)
        topParent.appendChild(clone);
      });
    }

    // --- monta o cabeçalho da tabela (padrão) ---
    const table = tbody.closest('table');
    if (table) {
      const thead = table.querySelector('thead') || table.createTHead();
      thead.innerHTML = `
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projeto</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desenvolvedor</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
        </tr>
      `;
    }

    // helper para pegar campos com nomes variados
    function pickSmart(obj, aliases) {
      const map = {};
      for (const k of Object.keys(obj || {})) map[norm(k)] = k;
      for (const a of aliases) {
        const nk = norm(a);
        if (map[nk] != null) {
          const v = obj[map[nk]];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
      }
      return null;
    }

    // renderiza tabela (linhas)
    function internalRenderTable(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">Nenhum chamado.</td></tr>`;
        return;
      }
      tbody.innerHTML = rows.map(x => {
        const numero = pickSmart(x, ['numero_chamado', 'numero', 'número', 'chamado', 'ticket', 'protocolo']) || '-';
        const proj = pickSmart(x, ['projeto', 'sistema', 'projetoNome', 'projeto_nome']) || '-';
        const status = pickSmart(x, ['status', 'situacao', 'situação', 'etapa']) || '-';
        const dev = pickSmart(x, ['desenvolvedor', 'dev', 'responsavel', 'responsável']) || '-';
        const solicit = pickSmart(x, ['solicitante', 'requerente', 'demandante', 'cliente']) || '-';
        const numArg = js(String(numero));
        return `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(proj)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(String(numero))}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(status)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(dev)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${escapeHtml(solicit)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
              ${sustActionLinksHtml(numArg)}
            </td>
          </tr>
        `;
      }).join('');
    }

    // exibe todos por padrão
    internalRenderTable(lista);
  }





  // Loader da view de Sustentação (cards + gráfico + tabela)
  async function loadSustentacaoView() {
    try {
      const res = await fetch(`${API_ROOT}/sustentacao`);
      if (!res.ok) throw new Error(`Falha ao carregar sustentação (${res.status})`);
      const itens = await res.json();

      // 1) garante que estamos em modo Sustentação visualmente
      setCodesCardHighlight('sust');

      // 2) injeta/ajusta os TOP CARDS (esconde Planejado/Pausado, atualiza números e ícones, liga o clique)
      injectSustTopCards(itens);

      // 3) gráfico do card "Sustentação" + total override
      drawSustDistribChart(itens);
      applySustCard(Array.isArray(itens) ? itens.length : 0);

      // 4) tabela + filtros (o click nos cards chama applyTopSustFilter)
      renderSustentacaoTable(itens);

      updateLastUpdateTime();
    } catch (err) {
      console.error('loadSustentacaoView erro:', err);
      renderSustentacaoTable([]);
      drawSustDistribChart([]);
      applySustCard(0);
      updateLastUpdateTime();
    }
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
      qualidade: numOrNull(getValue('projectQualidade')),
      internalizacao: byId('projectInternalizacao')?.checked || false
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

      // UI após salvar/atualizar
      delete form.dataset.id;
      form.reset();

      const h = document.querySelector('#projectModal h3');
      if (h) h.textContent = 'Novo Projeto';

      const btn = byId('submitProjectBtn');
      if (btn) btn.textContent = 'Salvar Projeto';

      // fecha o modal
      const modal = byId('projectModal');
      if (modal) modal.classList.add('hidden');


      await loadProjetos();
      toast('Sucesso', isEdit ? 'Projeto atualizado com sucesso!' : 'Projeto cadastrado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro', err.message, 'error');
    }
  }
  // Excluir projeto
  async function deleteProject(idOrName) {
    const p = findProjeto(idOrName);
    if (!p || !p.id) {
      return toast('Ação inválida', 'Não foi possível identificar o ID do projeto.', 'warn');
    }

    showConfirm(
      `Tem certeza que deseja excluir o projeto "${p.nome}"? Esta ação não pode ser desfeita.`,
      async () => {
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
    );
  }



  // ========= Utils =========
  function sortByStatus(list) {
    const order = { 'Em Andamento': 1, 'Não iniciada': 2, 'Concluída': 3 };
    return [...list].sort((a, b) => {
      const sa = order[a.status] || 99;
      const sb = order[b.status] || 99;
      return sa - sb;
    });
  }

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
      case 'Planejado': return 'bg-gray-300 text-gray-800';
      case 'Pausado': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function ragClass(rag) {
    if (!rag) return 'bg-gray-300 text-gray-800';
    const r = String(rag).trim().toLowerCase();
    if (r === 'verde') return 'bg-green-600 text-white';
    if (r === 'amarelo' || r === 'amarelo claro' || r === 'amarelo-escuro') return 'bg-yellow-500 text-white';
    if (r === 'vermelho') return 'bg-red-600 text-white';
    // aceitar também versões em inglês ou abreviações (opcional)
    if (r === 'green') return 'bg-green-600 text-white';
    if (r === 'yellow') return 'bg-yellow-500 text-white';
    if (r === 'red') return 'bg-red-600 text-white';
    return 'bg-gray-300 text-gray-800';
  }


  function formatDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d)
      ? '—'
      : d.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
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
    const ts = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const topEl = document.getElementById('lastUpdateTop');
    const footEl = document.getElementById('lastUpdateFooter');
    if (topEl) topEl.textContent = ts;
    if (footEl) footEl.textContent = ts;

    const yEl = document.getElementById('footerYear');
    if (yEl) yEl.textContent = String(now.getFullYear());
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
  /* ==== Exports mínimos para index.html/showPage ==== */
  window.cacheProjetos = window.cacheProjetos || cacheProjetos; // garante existência inicial

  window.drawCharts = (list) => drawCharts(list || cacheProjetos);
  window.drawCodesSprintsChart = (list) => drawCodesSprintsChart(list || cacheProjetos);
  window.drawCodesInternChart = (list) => drawCodesInternChart(list || cacheProjetos);
  window.drawCosetTiposChart = (list) => (typeof drawCosetTiposChart === 'function') ? drawCosetTiposChart(list || cacheProjetos) : null;
  window.renderAllCoordTables = (list) => (typeof renderAllCoordTables === 'function') ? renderAllCoordTables(list || cacheProjetos) : null;
  window.renderRecentTable = (list) => (typeof renderRecentTable === 'function') ? renderRecentTable(list || cacheProjetos) : null;
  window.updateKPIs = (list) => (typeof updateKPIs === 'function') ? updateKPIs(list || cacheProjetos) : null;

  /* opcional: expõe referências de charts para resize() sem quebrar encapsulamento */
  window._charts = {
    get coord() { return chartCoordenacao; },
    get status() { return chartStatus; },
    get distrib() { return chartStatusDistrib; },
    get rag() { return chartRag; },
    get timeline() { return chartTimeline; },
    get codes() { return chartCodes; },
    get intern() { return chartIntern; }
  };

})(); // 🔚 fim do IIFE
