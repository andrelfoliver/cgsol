// codes-sustentacao.js
(function () {
    'use strict';

    let chartSustentacao = null;

    // 🔹 Função para desenhar gráficos de Sustentação
    window.drawCodesSustentacaoCharts = function (projects) {
        const ctx = document.getElementById('codesSustentacaoChart');
        if (!ctx) return;

        if (chartSustentacao) chartSustentacao.destroy();

        // Exemplo: gráfico de barras mostrando quantidade por status
        const statusCounts = projects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {});

        chartSustentacao = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: 'Projetos em Sustentação',
                    data: Object.values(statusCounts),
                    backgroundColor: '#f59e0b'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    };

    // 🔹 Função para abrir formulário de sustentação
    window.openNewSustentacao = function () {
        const form = document.getElementById('sustentacaoForm');
        if (!form) return;

        form.reset();
        delete form.dataset.id;

        const modal = document.getElementById('sustentacaoModal');
        if (modal) modal.classList.remove('hidden');
    };

})();
