document.addEventListener('DOMContentLoaded', () => {
  loadRecentProjects();

  const createForm = document.getElementById('projectForm');
  if (createForm) createForm.addEventListener('submit', handleCreateOrUpdate);
});

let cacheProjetos = [];

// ===== LISTAR NA TABELA "Projetos Recentes" =====
async function loadRecentProjects() {
  try {
    const res = await fetch('http://localhost:5000/api/projetos');
    if (!res.ok) throw new Error('Falha ao carregar projetos');
    const projetos = await res.json();
    cacheProjetos = projetos;

    const tbody = document.getElementById('projectsTableBody');
    tbody.innerHTML = '';

    if (!projetos.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-sm text-gray-500">
        Nenhum projeto cadastrado.
      </td></tr>`;
      return;
    }

    projetos.forEach(p => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${p.nome || '-'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${p.coordenacao || '-'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(p.status)}">
              ${p.status || '-'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs font-semibold rounded text-white ${ragClass(p.rag)}">
              ${p.rag || '—'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${p.responsavel || '—'}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <button class="text-blue-600 hover:text-blue-900 mr-3" onclick="showProjectDetail('${p.id}')">👁️ Ver</button>
            <button class="text-green-600 hover:text-green-900" onclick="editProject(${p.id})">✏️ Editar</button>
          </td>
        </tr>
      `);
    });
  } catch (err) {
    alert('Erro ao carregar projetos: ' + err.message);
    console.error(err);
  }
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

// ===== ABRIR MODAL PARA EDITAR (usa o MESMO form do "Novo Projeto") =====
function editProject(id) {
  const p = cacheProjetos.find(x => String(x.id) === String(id));
  if (!p) return alert('Projeto não encontrado');

  const form = document.getElementById('projectForm');
  form.dataset.id = p.id; // marca que é edição

  document.getElementById('projectName').value = p.nome || '';
  document.getElementById('projectTipo').value = p.tipo || '';
  document.getElementById('projectCoord').value = p.coordenacao || '';
  document.getElementById('projectStatus').value = p.status || '';
  document.getElementById('projectDescricao').value = p.descricao || '';
  document.getElementById('projectInicio').value = p.inicio || '';
  document.getElementById('projectFim').value = p.fim || '';

  document.querySelector('#projectModal h3').textContent = 'Editar Projeto';
  document.getElementById('submitProjectBtn').textContent = 'Atualizar Projeto';
  document.getElementById('projectModal').classList.remove('hidden');
}

// ===== CRIAR / ATUALIZAR (POST/PUT no mesmo handler) =====
async function handleCreateOrUpdate(e) {
  e.preventDefault();
  // Se ainda houver algum outro listener no HTML, isto garante que só este rode:
  e.stopImmediatePropagation();

  const form = e.target;
  const id = form.dataset.id; // se existir, é edição
  const dados = {
    nome: document.getElementById('projectName').value,
    tipo: document.getElementById('projectTipo').value,
    coordenacao: document.getElementById('projectCoord').value,
    status: document.getElementById('projectStatus').value,
    descricao: document.getElementById('projectDescricao').value,
    inicio: document.getElementById('projectInicio').value,
    fim: document.getElementById('projectFim').value
  };

  try {
    const url = id
      ? `http://localhost:5000/api/projetos/${id}`
      : 'http://localhost:5000/api/projetos';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (!res.ok) {
      const erro = await res.json().catch(() => ({}));
      throw new Error(erro.erro || 'Erro ao salvar projeto');
    }

    // sucesso
    delete form.dataset.id;
    document.querySelector('#projectModal h3').textContent = 'Novo Projeto';
    document.getElementById('submitProjectBtn').textContent = 'Salvar Projeto';
    form.reset();
    document.getElementById('projectModal').classList.add('hidden');

    await loadRecentProjects();
    alert(id ? 'Projeto atualizado com sucesso!' : 'Projeto cadastrado com sucesso!');
  } catch (err) {
    alert('Erro ao salvar projeto: ' + err.message);
    console.error(err);
  }
}
