
const pdtiActions = {
    'AC.SDF.01': { descricao: 'CNES: API Cadastro Nacional de Entidades Sindicais', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.02': { descricao: 'Relatório Nacional de Igualdade Salarial - março', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.03': { descricao: 'Manutenções evolutivas no sistema legado PAT', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.04': { descricao: 'SIGFAT: módulo de Depósitos Especiais', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.05': { descricao: 'Segurança Saúde nas Escolas', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.06': { descricao: 'Migração do Processo de Carga do SESMT', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.07': { descricao: 'SEI: módulo estatístico', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.08': { descricao: 'SEI: módulo de resposta', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.09': { descricao: 'SEI: atualização do módulo PEN', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.10': { descricao: 'Internalização do Quadro Brasileiro de Qualificações (QBQ)', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.13': { descricao: 'Carteiras de Trabalho Recuperadas', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.14': { descricao: 'B-Cadastros CNPJ', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.15': { descricao: 'Aplicação Georreferenciamento – apoio Financeiro RS', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.17': { descricao: 'Sistema de Comunicação Prévia de Obras - SCPO', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.18': { descricao: 'Sistema PGR (Programa de Gerenciamento de Riscos Ocupacionais)', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.19': { descricao: 'Projeto de Inteligência Artificial do Seguro Desemprego', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.21': { descricao: 'Painel de demandas', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.39': { descricao: 'Painéis da Inspeção do Trabalho de acesso Restrito', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.43': { descricao: 'B-Cadastros CPF', situacao: 'Concluída', tipo: 'SDF' },
    'AC.SDF.11': { descricao: 'BI MEDIADOR Módulo de Arrecadação', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.12': { descricao: 'Painel de Relações do Trabalho', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.16': { descricao: 'CNES: Segurança de APIs', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.20': { descricao: 'Projeto de Inteligência Artificial Classificação Automática de CBO', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.22': { descricao: 'Canal de Denúncia', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.23': { descricao: 'Internalização do AGIR', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.24': { descricao: 'Ingestão de Dados e Internalização (Data Lake)', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.25': { descricao: 'SIGFAT: módulo FAT Constitucional', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.26': { descricao: 'Sistema Certidões', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.27': { descricao: 'Novo sistema PAT (Programa de Alimentação do Trabalhador)', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.28': { descricao: 'Sistema IPÊ (Trabalho Infantil)', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.29': { descricao: 'CNES: migração de dados', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.30': { descricao: 'CNES: alteração das APIs', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.31': { descricao: 'Relatórios Nacional de Igualdade Salarial - setembro', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.42': { descricao: 'Painel com informações dos débitos lançados no FGTS Digital', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.44': { descricao: 'SCPO – melhorias', situacao: 'Em andamento', tipo: 'SDF' },
    'AC.SDF.32': { descricao: 'Internalização do Software Cordilheira', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.33': { descricao: 'Sistema de Negociações Coletivas de Trabalho – MEDIADOR', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.34': { descricao: 'Novo SESMT', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.35': { descricao: 'Internalização do CAEPI (fases 1 e 2)', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.36': { descricao: 'Painéis da Inspeção do Trabalho de acesso para a Sociedade', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.37': { descricao: 'Sistema de Autodiagnóstico', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.38': { descricao: 'Sistema de Inteligência Trabalhista (SINTRA)', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.40': { descricao: 'Sistema IPÊ (APP)', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.41': { descricao: 'APP Ajuda Auditor', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDF.45': { descricao: 'Sistema IPÊ (Trabalho Escravo): internalização e evolução', situacao: 'Não iniciada', tipo: 'SDF' },
    'AC.SDD.01': { descricao: 'Apoio Financeiro Rio Grande do Sul', situacao: '-', tipo: 'SDD' },
    'AC.SDD.02': { descricao: 'e-Consignado (CTPS Digital e Portal do Empregador)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.03': { descricao: 'Abono Salarial (Backlog, reprocessamento, ação civil pública, recursos)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.04': { descricao: 'Seguro-Desemprego (CAEPF, modernização, fluxo de recurso e prescrição)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.05': { descricao: 'Análise de Dados (Abono, SD, CBO, IMO, Produtividade do MTE, Qualificação)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.06': { descricao: 'Aprendizagem Profissional (Desenvolvimento do novo sistema SGAP (MVP) e v2)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.07': { descricao: 'Inclusão Produtiva (Aprimoramentos SAEP/PROGER)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.08': { descricao: 'Inteligência Artificial (EmpregaAI regra e integrações: IMO, Recomendações Qualificação)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.09': { descricao: 'Intermediação de Mão de Obra - IMO (Modernização)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.10': { descricao: 'Qualificação (Módulo Cursos e Turmas + Integração. Serviços na CTPS e Portal)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.11': { descricao: 'Sistema de Gestão do Programa Nacional de Microcrédito Produtivo Orientado (PNMPO)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.12': { descricao: 'Relatório Nacional de Igualdade Salarial (Portal do Empregador)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.13': { descricao: 'CTPS digital, Portal Trabalhador e Portal Empregador (Integrações com sistemas do Ministério)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.14': { descricao: 'Estatísticas do Trabalho (RAIS 2023. Lab Inteligência. Estatísticas a partir do eSocial. Backlog)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.15': { descricao: 'Sistema de Registro Profissional (SIRPWEB) - ferramenta de solicitações (Internalização e integração com Plata. de Atendimento)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.16': { descricao: 'Análise de Riscos (Seguro-Desemprego e Abono Salarial)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.17': { descricao: 'Sistema de Gestão Operacional do CODEFAT - SIGOC (Subsistema: SGC-CTER)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.18': { descricao: 'Internalização do Sistema de Gestão e Governança do FAT - SIGFAT', situacao: '-', tipo: 'SDD' },
    'AC.SDD.19': { descricao: 'Sistema de Gestão Operacional do CODEFAT - SIGOC (Subsistema: Portal FAT)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.20': { descricao: 'Sistema de Gestão Operacional do CODEFAT - SIGOC', situacao: '-', tipo: 'SDD' },
    'AC.SDD.21': { descricao: 'CAGED Transacional (Proc. RAIS. Consulta RAIS na CTPS Digital e Portal Traba.)', situacao: '-', tipo: 'SDD' },
    'AC.SDD.22': { descricao: 'Plataforma de Atendimento (Parametrização da plataforma (SIRPWEB, Formulário))', situacao: '-', tipo: 'SDD' },
    'AC.SDD.23': { descricao: 'Pesquisa de Jovens Desligados a Pedido', situacao: '-', tipo: 'SDD' },
    'AC.SDD.24': { descricao: 'Pessoas Politicamente Expostas', situacao: '-', tipo: 'SDD' },
    'AC.SDD.25': { descricao: 'Relação Anual de Informações Sociais - RAIS', situacao: '-', tipo: 'SDD' },
    'AC.SDS.01': { descricao: 'FGTS Digital - Calamidade Pública', situacao: '-', tipo: 'SDS' },
    'AC.SDS.02': { descricao: 'e-Consignado (FGTS Digital, eSocial, DET)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.03': { descricao: 'CNES (módulo de atendimento externo)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.04': { descricao: 'CNES: API Cadastro Nacional de Entidades Sindicais', situacao: '-', tipo: 'SDS' },
    'AC.SDS.05': { descricao: 'CNES: Segurança de APIs', situacao: '-', tipo: 'SDS' },
    'AC.SDS.06': { descricao: 'FGTS Digital', situacao: '-', tipo: 'SDS' },
    'AC.SDS.07': { descricao: 'CNES (módulo de gerenciamento – usuários internos)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.08': { descricao: 'Domicílio Eletrônico Trabalhista (DET)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.09': { descricao: 'eSocial', situacao: '-', tipo: 'SDS' },
    'AC.SDS.10': { descricao: 'Sistema Federal de Inspeção do Trabalho (SFITWEB)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.11': { descricao: 'Ingestão de Dados e Internalização (Data Lake)', situacao: '-', tipo: 'SDS' },
    'AC.SDS.12': { descricao: 'B-Cadastros', situacao: '-', tipo: 'SDS' }
};

// ======================
// Funções do PDTI
// ======================
function loadPDTITable() {
    const tableBody = document.getElementById('pdtiTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    Object.entries(pdtiActions).forEach(([id, action]) => {
        const row = document.createElement('tr');

        let statusClass = '';
        let statusText = action.situacao;
        switch (action.situacao) {
            case 'Concluída': statusClass = 'bg-green-100 text-green-800'; break;
            case 'Em andamento': statusClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'Não iniciada': statusClass = 'bg-red-100 text-red-800'; break;
            case '-': statusClass = 'bg-gray-100 text-gray-800'; statusText = 'Sem Status'; break;
        }

        let tipoClass = '';
        let tipoText = '';
        switch (action.tipo) {
            case 'SDF': tipoClass = 'bg-blue-100 text-blue-800'; tipoText = 'Soluções Digitais'; break;
            case 'SDD': tipoClass = 'bg-purple-100 text-purple-800'; tipoText = 'Soluções de Dados'; break;
            case 'SDS': tipoClass = 'bg-green-100 text-green-800'; tipoText = 'Soluções de Sistemas'; break;
        }

        row.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${id}</div>
      </td>
      <td class="px-6 py-4">
        <div class="text-sm text-gray-900">${action.descricao}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
          ${statusText}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tipoClass}">
          ${tipoText}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="editPDTIAction('${id}')" class="text-blue-600 hover:text-blue-900 mr-3">✏️ Editar</button>
        <button onclick="deletePDTIAction('${id}')" class="text-red-600 hover:text-red-900">🗑️ Excluir</button>
      </td>
    `;

        tableBody.appendChild(row);
    });
}

function updatePDTIKPIs() {
    const total = Object.keys(pdtiActions).length;
    const concluidas = Object.values(pdtiActions).filter(a => a.situacao === 'Concluída').length;
    const andamento = Object.values(pdtiActions).filter(a => a.situacao === 'Em andamento').length;
    const naoIniciadas = Object.values(pdtiActions).filter(a => a.situacao === 'Não iniciada').length;

    document.getElementById('totalAcoes').textContent = total;
    document.getElementById('acoesConcluidas').textContent = concluidas;
    document.getElementById('acoesAndamento').textContent = andamento;
    document.getElementById('acoesNaoIniciadas').textContent = naoIniciadas;

    // Atualizar barra de progresso principal
    const concluidasPercent = Math.round((concluidas / total) * 100);
    const progressBar = document.querySelector('#pdtiPage .bg-gradient-to-r');
    if (progressBar) {
        progressBar.style.width = `${concluidasPercent}%`;
        progressBar.textContent = `${concluidasPercent}% Concluído`;
    }
}

// ======================
// Inicialização
// ======================
document.addEventListener('DOMContentLoaded', () => {
    loadPDTITable();
    updatePDTIKPIs();
});