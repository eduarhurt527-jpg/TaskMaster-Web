/**
 * CAPA VIEW — HomeView.js
 * Renderiza la pantalla principal: barra semanal, filtros y lista de tareas.
 * Solo manipula el DOM. No contiene lógica de negocio.
 */

class HomeView {

  constructor(viewModel) {
    this._vm = viewModel;

    // Referencias DOM
    this.$weeklyChart = document.getElementById('weekly-chart');
    this.$cargaBadge  = document.getElementById('carga-badge');
    this.$filterRow   = document.getElementById('filter-row');
    this.$taskList    = document.getElementById('task-list');
    this.$specialSelect = document.getElementById('special-filter');
    this.$statTotal   = document.getElementById('stat-total');
    this.$statUrgent  = document.getElementById('stat-urgent');
    this.$statDone    = document.getElementById('stat-done');

    if (this.$specialSelect) {
      this.$specialSelect.addEventListener('change', () => {
        this._vm.setFiltro(this.$specialSelect.value);
      });
    }
  }

  // ── Barra de carga semanal ────────────────────────────────────────────────

  renderWeeklyBar() {
    const { porDia } = this._vm.getDatosDashboard();
    const MAX = 6;

    this.$weeklyChart.innerHTML = porDia.map(({ dia, tareas, esHoy }) => {
      const n         = tareas.length;
      const pct       = Math.min(100, Math.round((n / MAX) * 100));
      const heightPx  = Math.max(4, Math.round((pct / 100) * 52));
      let cls = 'weekly-col--low';
      if (n >= MAX)   cls = 'weekly-col--overload';
      else if (n >= 4) cls = 'weekly-col--high';
      else if (n >= 2) cls = 'weekly-col--normal';

      return `
        <div class="weekly-col ${cls}">
          <div class="weekly-bar-fill" style="height:${heightPx}px"></div>
          <span class="weekly-col-label">${esHoy ? `<b>${dia}</b>` : dia}</span>
        </div>`;
    }).join('');

    // Badge de nivel de carga
    const maxDia = Math.max(...porDia.map(d => d.tareas.length));
    if (maxDia >= MAX) {
      this.$cargaBadge.textContent = 'Alta';
      this.$cargaBadge.className   = 'badge badge--danger';
    } else if (maxDia >= 3) {
      this.$cargaBadge.textContent = 'Media';
      this.$cargaBadge.className   = 'badge badge--warning';
    } else {
      this.$cargaBadge.textContent = 'Normal';
      this.$cargaBadge.className   = 'badge badge--success';
    }
  }

  // ── Chips de filtro por materia ───────────────────────────────────────────

  static CATEGORY_ICONS = {
    'Trabajo': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M7 7V5.5C7 4.67157 7.67157 4 8.5 4H11.5C12.3284 4 13 4.67157 13 5.5V7" stroke="currentColor" stroke-width="1.6"/><path d="M3 11H17" stroke="currentColor" stroke-width="1.6"/></svg>',
    'Estudio': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4.5C4 3.67157 4.67157 3 5.5 3H10V17H5.5C4.67157 17 4 16.3284 4 15.5V4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 4.5C16 3.67157 15.3284 3 14.5 3H10V17H14.5C15.3284 17 16 16.3284 16 15.5V4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    'Personal': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="6.5" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 17C3.5 13.9624 6.46243 11.5 10 11.5C13.5376 11.5 16.5 13.9624 16.5 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'Bienestar': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 17S3 12.5 3 7.8C3 5.7 4.7 4 6.8 4C8 4 9.2 4.6 10 5.6C10.8 4.6 12 4 13.2 4C15.3 4 17 5.7 17 7.8C17 12.5 10 17 10 17Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    'Recados': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 7H15L14.3 16.5C14.25 17.15 13.7 17.65 13.05 17.65H6.95C6.3 17.65 5.75 17.15 5.7 16.5L5 7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 7V5.5C7.5 4.11929 8.61929 3 10 3C11.3807 3 12.5 4.11929 12.5 5.5V7" stroke="currentColor" stroke-width="1.6"/></svg>',
    'Planificación': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4.5" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M3 8H17" stroke="currentColor" stroke-width="1.6"/><path d="M7 3V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13 3V5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    'Otros': '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="15" cy="10" r="1.6" fill="currentColor"/></svg>',
  };

  static ICON_TODAS = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>';

  renderFiltros() {
    const activo = this._vm.getFiltroActivo();
    const cats = this._vm.getGeneralCategories();

    // Renderizar chips/botones de categorías en español
    this.$filterRow.innerHTML = '';
    const todasBtn = document.createElement('button');
    todasBtn.className = `chip ${activo === 'todas' ? 'chip--active' : ''}`;
    todasBtn.dataset.filter = 'todas';
    todasBtn.innerHTML = `<span class="chip-icon">${HomeView.ICON_TODAS}</span>Todas`;
    this.$filterRow.appendChild(todasBtn);

    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `chip ${activo === 'general:' + c.key ? 'chip--active' : ''}`;
      btn.dataset.filter = 'general:' + c.key;
      btn.style.borderColor = this._vm.getCategoryColor(c.key);
      btn.style.color = this._vm.getCategoryColor(c.key);
      const icon = HomeView.CATEGORY_ICONS[c.key] || HomeView.ICON_TODAS;
      btn.innerHTML = `<span class="chip-icon">${icon}</span>${c.label}`;
      this.$filterRow.appendChild(btn);
    });

    this.$filterRow.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._vm.setFiltro(chip.dataset.filter);
        if (this.$specialSelect) this.$specialSelect.value = 'todas';

        // Además de filtrar, abrir el formulario de nueva tarea con la categoría precargada
        if (chip.dataset.filter !== 'todas' && window.app && window.app.modalView) {
          const categoryKey = chip.dataset.filter.replace('general:', '');
          window.app.modalView.abrirNueva({ general_categoria: categoryKey });
        }
      });
    });
  }

  // ── Lista de tareas ───────────────────────────────────────────────────────

  renderTareas() {
    const tareas = this._vm.getTareasFiltradas();

    if (!tareas.length) {
      this.$taskList.innerHTML = `
        <div class="empty-state">
          <img src="assets/img/illustrations/empty-tasks.svg" alt="Lista preparada para crear una tarea" class="empty-state__photo" width="360" height="220" />
          <p class="empty-state__text">No hay tareas. ¡Toca + para agregar una!</p>
        </div>`;
      return;
    }

    // Ordenar: incompletas primero, luego por fecha
    const ordenadas = [...tareas].sort((a, b) => {
      if (a.completada !== b.completada) return a.completada - b.completada;
      return new Date(a.fecha_limite) - new Date(b.fecha_limite);
    });

    this.$taskList.innerHTML = ordenadas.map(t => this._renderCard(t)).join('');

    // Eventos en las tarjetas
    this.$taskList.querySelectorAll('.task-card').forEach(card => {
      const id = Number(card.dataset.id);
      card.addEventListener('click', e => {
        // Botón play → abrir detalle con Pomodoro
        if (e.target.closest('.task-play-btn')) return;
        const tarea = this._vm.getTareas().find(t => t.id === id);
        if (tarea) this._vm.setTareaActiva(tarea);
      });
      const playBtn = card.querySelector('.task-play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', e => {
          e.stopPropagation();
          const tarea = this._vm.getTareas().find(t => t.id === id);
          if (tarea) this._vm.setTareaActiva(tarea);
        });
      }
    });
  }

  // ── Render de una tarjeta ─────────────────────────────────────────────────

  static _escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  // ── Indicador de estado (único icono por tarjeta) ─────────────────────────
  // Verde = completada · Rojo = urgente o vencida · Gris = pendiente normal
  static ESTADO_ICONS = {
    completada: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="currentColor" fill-opacity="0.16"/><path d="M6 10.5l2.5 2.5L14.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    alerta: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" fill="currentColor" fill-opacity="0.16"/><path d="M10 6v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.6" r="1" fill="currentColor"/></svg>',
    pendiente: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.6"/></svg>',
  };

  /** Determina el estado visual único de la tarjeta: completada, alerta (urgente/vencida) o pendiente */
  _estadoTarea(tarea) {
    if (tarea.completada) return { clave: 'completada', color: 'var(--ok)', titulo: 'Completada' };
    const vencida = new Date(tarea.fecha_limite) < new Date();
    if (vencida || tarea.prioridad === 'Alta') {
      return { clave: 'alerta', color: 'var(--urgente)', titulo: vencida ? 'Vencida' : 'Urgente' };
    }
    return { clave: 'pendiente', color: 'var(--muted)', titulo: 'Pendiente' };
  }

  _renderCard(tarea) {
    const catColor = this._vm.getCategoryColor(this._vm.getGeneralCategory(tarea));
    const { texto: fechaTxt, clase: fechaCls } = this._vm.etiquetaFecha(tarea.fecha_limite);
    const done = tarea.completada ? 'task-card--done' : '';
    const tituloSeguro = HomeView._escapeHtml(tarea.titulo);
    const estado = this._estadoTarea(tarea);

    return `
      <div class="task-card ${done}"
           data-id="${tarea.id}" style="border-left:4px solid ${catColor}">
        <div class="task-card__top">
          <span class="task-card__status" style="color:${estado.color}" title="${estado.titulo}">${HomeView.ESTADO_ICONS[estado.clave]}</span>
          <span class="task-card__title">${tituloSeguro}</span>
          <span class="task-card__vence ${fechaCls}">⏰ ${fechaTxt}</span>
        </div>
        <div class="task-timer" data-id="${tarea.id}">
          <i class="clock-icon">🕒</i>
          <span class="timer-countdown">Calculando...</span>
        </div>
        ${!tarea.completada ? `
        <div class="task-card__footer">
          <button class="task-play-btn" title="Iniciar enfoque">▶</button>
        </div>` : ''}
      </div>`;
  }

  // ── Render completo de la vista home ──────────────────────────────────────

  render() {
    this._renderHeaderStats();
    this.renderWeeklyBar();
    this.renderFiltros();
    if (this.$specialSelect) {
      this.$specialSelect.value = this._vm.getFiltroActivo().startsWith('especial:') ? this._vm.getFiltroActivo() : 'todas';
    }
    this.renderTareas();
  }

  _renderHeaderStats() {
    const tareas = this._vm.getTareas();
    const total   = tareas.length;
    const urgent  = tareas.filter(t => t.prioridad === 'Alta' && !t.completada).length;
    const done    = tareas.filter(t => t.completada).length;

    if (this.$statTotal) this.$statTotal.textContent = total;
    if (this.$statUrgent) this.$statUrgent.textContent = urgent;
    if (this.$statDone) this.$statDone.textContent = done;
  }
}
