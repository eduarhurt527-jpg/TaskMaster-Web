/**
 * CAPA VIEW — DashboardView.js
 * Renderiza el dashboard semanal: gráfico por materia, Pomodoros y avance.
 */

class DashboardView {

  constructor(viewModel) {
    this._vm = viewModel;
    this.$barChart       = document.getElementById('bar-chart');
    this.$pomStats       = document.getElementById('pomodoro-stats');
    this.$materiaProgress= document.getElementById('materia-progress');
  }

  render() {
    const { porDia, pomTotal, avanceCategorias, categorias } = this._vm.getDatosDashboard();
    this._renderBarChart(porDia, categorias);
    this._renderPomStats(pomTotal);
    this._renderCategoriaProgress(avanceCategorias);
  }

  _renderBarChart(porDia, categorias) {
    const MAX = 6;
    this.$barChart.innerHTML = porDia.map(({ dia, tareas, esHoy }) => {
      const overload = tareas.length >= MAX;
      // Agrupar segmentos por categoría general
      const segmentos = categorias.map(c => {
        const n = tareas.filter(t => this._vm.getGeneralCategory(t) === c.key).length;
        if (!n) return '';
        const h = Math.max(6, Math.round((n / MAX) * 90));
        return `<div class="bar-stack-seg" style="height:${h}px;background:${this._vm.getCategoryColor(c.key)}" title="${c.label}: ${n}"></div>`;
      }).join('');

      return `
        <div class="bar-day ${overload ? 'bar-day--overload' : ''}" data-dia="${dia}">
          <div class="bar-day__stacks">${segmentos || '<div style="height:4px;width:100%;background:#E0E0E0;border-radius:3px"></div>'}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="bar-day__label">${esHoy ? `<b>${dia}</b>` : dia} ${overload ? '⚠' : ''}</span>
            <button class="btn btn--small btn--ghost btn-add-day" data-dia="${dia}">+</button>
          </div>
        </div>`;
    }).join('');

    // Agregar listeners para botones + por día
    this.$barChart.querySelectorAll('.btn-add-day').forEach(b => {
      b.addEventListener('click', () => {
        const dia = b.dataset.dia;
        // abrir modal prellenando la fecha al día seleccionado (próxima ocurrencia)
        const ahora = new Date();
        const targetDayIndex = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].indexOf(dia);
        const todayIndex = ahora.getDay();
        let diff = targetDayIndex - todayIndex;
        if (diff < 0) diff += 7;
        const target = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diff, 9, 0, 0);
        app.modalView.abrirNueva({ fecha_limite: target.toISOString(), pomodoros_est: 1 });
      });
    });
  }

  _renderPomStats(pomTotal) {
    this.$pomStats.innerHTML = `
      <div class="pom-stat">
        <div class="pom-stat__num">🍅 ${pomTotal}</div>
        <div class="pom-stat__label">Sesiones registradas en tus tareas</div>
      </div>
      <div class="pom-stat">
        <div class="pom-stat__num">⏱ ${pomTotal * 25}</div>
        <div class="pom-stat__label">Minutos estimados (25 por sesión)</div>
      </div>`;
    // añadir botón para crear tarea de enfoque rápido
    const btn = document.createElement('button');
    btn.className = 'btn btn--small btn--primary';
    btn.textContent = '+ Nueva sesión de enfoque';
    btn.addEventListener('click', () => {
      const ahora = new Date();
      app.modalView.abrirNueva({ titulo: 'Sesión de enfoque', fecha_limite: ahora.toISOString(), pomodoros_est: 1, prioridad: 'Media' });
    });
    this.$pomStats.appendChild(btn);
  }

  _renderCategoriaProgress(avance) {
    if (!avance.length) {
      this.$materiaProgress.innerHTML = '<p style="color:var(--color-text-muted);font-size:13px">Sin datos aún.</p>';
      return;
    }
    this.$materiaProgress.innerHTML = avance.map(({ categoria, pct }) => `
      <div class="mat-prog-row">
        <span class="mat-prog-name" style="color:${this._vm.getCategoryColor(categoria.key)}">${categoria.label}</span>
        <div class="mat-prog-bar">
          <div class="mat-prog-fill" style="width:${pct}%;background:${this._vm.getCategoryColor(categoria.key)}"></div>
        </div>
        <span class="mat-prog-pct" style="color:${this._vm.getCategoryColor(categoria.key)}">${pct}%</span>
        <button class="btn btn--small btn--ghost btn-add-categoria" data-cat="${categoria.key}">+</button>
      </div>`).join('');

    // listeners para agregar tarea por categoría
    this.$materiaProgress.querySelectorAll('.btn-add-categoria').forEach(b => {
      b.addEventListener('click', () => {
        const cat = b.dataset.cat;
        app.modalView.abrirNueva({ general_categoria: cat, prioridad: 'Media' });
      });
    });
  }
}
