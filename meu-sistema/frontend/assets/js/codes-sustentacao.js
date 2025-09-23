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
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">Nenhum chamado encontrado.</td></tr>`;
            return;
        }

        list.forEach(item => {
            tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="px-4 py-2">${item.numero_chamado}</td>
            <td class="px-4 py-2">${item.projeto}</td>
            <td class="px-4 py-2">${item.desenvolvedor || "-"}</td>
            <td class="px-4 py-2">${item.data_chamado ? new Date(item.data_chamado).toLocaleString("pt-BR") : "-"}</td>
            <td class="px-4 py-2">${item.solicitante || "-"}</td>
            <td class="px-4 py-2">${item.status}</td>
            <td class="px-4 py-2">${item.observacao || "-"}</td>
          </tr>
        `);
        });
    }

    function drawSustentacaoChart(list) {
        const ctx = document.getElementById("codesSustentacaoChart");
        if (!ctx) return;

        // Conta quantidade de chamados por status
        const statusCounts = {};
        list.forEach(ch => {
            const st = ch.status || "Indefinido";
            statusCounts[st] = (statusCounts[st] || 0) + 1;
        });

        if (chartSustentacao) chartSustentacao.destroy();
        chartSustentacao = new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: "Chamados",
                    data: Object.values(statusCounts),
                    backgroundColor: "#3b82f6"
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    window.loadSustentacao = loadSustentacao;
})();
