document.addEventListener('DOMContentLoaded', function () {
  createCharts();
  showPage('home'); // mostra a seção inicial
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

function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(section => {
    section.classList.add('hidden');
  });

  const targetSection = document.getElementById(pageId + 'Page');
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }
}
