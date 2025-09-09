document.addEventListener('DOMContentLoaded', function () {
  createCharts();
  const defaultTab = document.querySelector('[onclick*="showPage(\'home\')"]');
  if (defaultTab) showPage('home', defaultTab);
});

function createCharts() {
  const coordCtx = document.getElementById('coordenacaoChart');
  if (coordCtx) {
    new Chart(coordCtx, {
      type: 'doughnut',
      data: {
        labels: ['CODES', 'COSET', 'CGOD'],
        datasets: [{
          data: [3, 2, 2],
          backgroundColor: ['#3b82f6', '#8b5cf6', '#f97316'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: { size: 12 }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  const statusCtx = document.getElementById('statusChart');
  if (statusCtx) {
    new Chart(statusCtx, {
      type: 'bar',
      data: {
        labels: ['Planejado', 'Em Andamento', 'Em Risco', 'Concluído', 'Sustentação'],
        datasets: [{
          label: 'Quantidade',
          data: [1, 2, 1, 1, 2],
          backgroundColor: ['#6b7280', '#16a34a', '#dc2626', '#2563eb', '#f59e0b'],
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 11 } },
            grid: { color: '#f3f4f6' }
          },
          x: {
            ticks: { font: { size: 11 } },
            grid: { display: false }
          }
        },
        layout: { padding: { top: 10 } }
      }
    });
  }
}

function showPage(pageId, btn) {
  // Oculta todas as páginas
  document.querySelectorAll(".page-content").forEach(p => p.classList.add("hidden"));
  document.getElementById(`${pageId}Page`).classList.remove("hidden");

  // Remove destaque de todas as abas
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("border-b-blue-500", "text-blue-600");
    b.classList.add("border-transparent", "text-gray-500");
  });

  // Adiciona destaque na aba ativa
  btn.classList.remove("border-transparent", "text-gray-500");
  btn.classList.add("border-b-blue-500", "text-blue-600");
}