(function () {
    'use strict';

    let chartSustentacao = null;

    async function loadSustentacao() {
        try {
            const res = await fetch("http://localhost:5001/api/sustentacao");
            if (!res.ok) throw new Error(`Erro ao buscar sustentação (${res.status})`);
            const dados = await res.json();

            renderSustentacaoTable(dados);
            drawSustentacaoChart(dados);
        } catch (err) {
            console.error("Falha ao carregar sustentação", err);
            toast("Erro", "Não foi possível carregar dados de Sustentação", "error");
        }
    }

    function renderSustentacaoTable(list) {
        const tbody = document.getElementById("sustentacaoTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">Nenhum dado encontrado.</td></tr>`;
            return;
        }

        list.forEach(item => {
            tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="px-6 py-3">${item.aplicacao}</td>
            <td class="px-6 py-3">${item.status}</td>
            <td class="px-6 py-3">${item.sla}</td>
          </tr>
        `);
        });
    }

    function drawSustentacaoChart(list) {
        const ctx = document.getElementById("codesSustentacaoChart");
        if (!ctx) return;

        const apps = [...new Set(list.map(x => x.aplicacao))];
        const abertos = apps.map(app => list.filter(x => x.aplicacao === app && x.status === "Aberto").length);
        const fechados = apps.map(app => list.filter(x => x.aplicacao === app && x.status === "Fechado").length);

        if (chartSustentacao) chartSustentacao.destroy();
        chartSustentacao = new Chart(ctx, {
            type: "bar",
            data: {
                labels: apps,
                datasets: [
                    { label: "Abertos", data: abertos, backgroundColor: "#dc2626" },
                    { label: "Fechados", data: fechados, backgroundColor: "#16a34a" }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    window.loadSustentacao = loadSustentacao;
})();
