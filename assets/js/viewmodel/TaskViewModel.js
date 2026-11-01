/**
 * CAPA VIEWMODEL — TaskViewModel.js
 * Coordina entre el Model y las Views.
 * Gestiona el estado global de la aplicación.
 * NO manipula el DOM directamente.
 */

class TaskViewModel {

  constructor(model, materiaModel) {
    this._model        = model;
    this._matModel     = materiaModel;

    // Mapeo de nombres genéricos para mostrar categorías más universales
    this._genericNamesPool = ['Trabajo','Estudio','Personal','Bienestar','Recados','Planificación','Creatividad','Investigación','Salud','Finanzas'];
    this._genericMap = {}; // materia_id -> generic name

    // Categorías generales para tareas (nombres en español)
    this._generalCategories = ['Trabajo','Estudio','Personal','Bienestar','Recados','Planificación','Otros'];
    this._categoryKeywords = {
      'Trabajo': ['trabajo','proyecto','empresa','reunion','programaci','gestion'],
      'Estudio': ['estudio','examen','practica','laboratorio','clase','curso','materia'],
      'Personal': ['personal','hogar','familia','cumple','casa'],
      'Bienestar': ['salud','meditar','gym','ejercicio','bienestar'],
      'Recados': ['compras','recado','mandado','pagar','entregar'],
      'Planificación': ['plan','planificacion','objetivo','roadmap','planificar'],
      'Otros': []
    };

    // Estado observable
    this._state = {
      tareas:         [],
      filtroActivo:   'todas',   // 'todas' o id de materia
      tareaActiva:    null,      // tarea abierta en detalle
      cargando:       false,
      error:          null,
    };

    // Suscriptores (Views que escuchan cambios)
    this._listeners = [];
  }

  // ── Suscripción al estado ─────────────────────────────────────────────────

  /** Registra una función que se llama cuando el estado cambia */
  subscribe(fn) { this._listeners.push(fn); }

  /** Notifica a todos los suscriptores */
  _notify(evento, payload = {}) {
    this._listeners.forEach(fn => fn(evento, { ...this._state, ...payload }));
  }

  // ── Getters del estado ────────────────────────────────────────────────────

  getTareas()       { return [...this._state.tareas]; }
  getTareaActiva()  { return this._state.tareaActiva; }
  getMaterias()     { return this._matModel.getAll(); }

  /** Devuelve un nombre genérico para una materia (persistente por id) */
  getDisplayMateriaName(materia) {
    if (!materia) return '';
    const id = materia.id;
    if (this._genericMap[id]) return this._genericMap[id];
    // Asignar por índice para consistencia
    const pool = this._genericNamesPool;
    const name = pool[(id - 1) % pool.length] || materia.nombre;
    this._genericMap[id] = name;
    return name;
  }
  getFiltroActivo() { return this._state.filtroActivo; }

  /** Tareas filtradas según el filtro activo */
  getTareasFiltradas() {
    const { tareas, filtroActivo } = this._state;
    if (filtroActivo === 'todas') return tareas;
    // Soporte para filtros generales: 'general:Work' etc.
    if (String(filtroActivo).startsWith('general:')) {
      const cat = String(filtroActivo).split(':')[1];
      return tareas.filter(t => this.getGeneralCategory(t) === cat);
    }
    if (String(filtroActivo).startsWith('especial:')) {
      const cat = String(filtroActivo).split(':')[1];
      switch (cat) {
        case 'urgentes':
          return tareas.filter(t => t.prioridad === 'Alta' && !t.completada);
        case 'tareas':
          return tareas;
        case 'totales':
          return tareas;
        case 'completadas':
          return tareas.filter(t => t.completada);
        default:
          return tareas;
      }
    }
    return tareas.filter(t => String(t.materia_id) === String(filtroActivo));
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  /** Carga inicial de tareas desde la API */
  async cargarTareas() {
    this._state.cargando = true;
    this._notify('loading');
    const tareas = await this._model.getAll();
    this._state.tareas   = tareas;
    this._state.cargando = false;
    this._notify('tareasActualizadas');
  }

  /** Crea una nueva tarea con validación */
  async crearTarea(datos) {
    const resultado = await this._model.create(datos);
    if (!resultado.success) {
      this._notify('error', { error: resultado.error });
      return resultado;
    }
    await this.cargarTareas();
    this._notify('tareaCreada');
    return resultado;
  }

  /** Actualiza una tarea existente */
  async actualizarTarea(id, cambios) {
    const resultado = await this._model.update(id, cambios);
    if (!resultado.success) {
      this._notify('error', { error: 'No se pudo actualizar la tarea.' });
      return resultado;
    }
    await this.cargarTareas();
    this._notify('tareaActualizada');
    return resultado;
  }

  /** Elimina una tarea */
  async eliminarTarea(id) {
    const resultado = await this._model.delete(id);
    if (resultado.success) {
      this._state.tareaActiva = null;
      await this.cargarTareas();
      this._notify('tareaEliminada');
    }
    return resultado;
  }

  /** Marca o desmarca una tarea como completada */
  async toggleCompletada(id) {
    await this._model.toggleCompleta(id);
    await this.cargarTareas();
  }

  /** Registra un Pomodoro completado en la tarea activa */
  async registrarPomodoro(id) {
    const tarea = this._state.tareas.find(t => t.id === id);
    if (!tarea) return { success: false, error: 'La tarea ya no está disponible.' };
    const real = (Number(tarea.pomodoros_real) || 0) + 1;
    let resultado;
    try {
      resultado = await this._model.update(id, { pomodoros_real: real });
    } catch {
      return { success: false, error: 'No se pudo guardar la sesión. Comprueba tu conexión e inténtalo de nuevo.' };
    }
    if (!resultado?.success) return resultado || { success: false, error: 'No se pudo guardar la sesión.' };
    this._state.tareas = this._state.tareas.map(t =>
      t.id === id ? { ...t, pomodoros_real: real } : t
    );
    this._notify('pomodoroRegistrado');
    return { success: true, pomodoros_real: real };
  }

  /** Cambia el filtro de materia */
  setFiltro(filtro) {
    this._state.filtroActivo = filtro;
    this._notify('filtroChanged');
  }

  /** Abre una tarea en el detalle */
  setTareaActiva(tarea) {
    this._state.tareaActiva = tarea;
    this._notify('tareaActivaChanged');
  }

  /** Cierra el detalle */
  cerrarTareaActiva() {
    this._state.tareaActiva = null;
    this._notify('tareaActivaChanged');
  }

  // ── Datos para el dashboard ───────────────────────────────────────────────

  getDatosDashboard() {
    const tareas    = this._state.tareas;
    const porDia    = this._model.agruparPorDia(tareas);
    const categorias = this.getGeneralCategories();

    // Los registros actuales solo conservan el total, sin fechas de cada sesión.
    const pomTotal = tareas.reduce((s, t) => s + (Number(t.pomodoros_real) || 0), 0);

    // Avance por categoría general
    const avanceCategorias = categorias.map(c => {
      const cKey = c.key;
      const cTareas = tareas.filter(t => this.getGeneralCategory(t) === cKey);
      if (!cTareas.length) return null;
      const hechas = cTareas.filter(t => t.completada).length;
      return { categoria: c, pct: Math.round((hechas / cTareas.length) * 100) };
    }).filter(Boolean);

    return { porDia, pomTotal, avanceCategorias, categorias };
  }

  // ── Utilidades de presentación (cálculos sin DOM) ─────────────────────────

  urgenciaColor(prioridad) {
    return { Alta: '--color-alta', Media: '--color-media', Baja: '--color-baja' }[prioridad] || '--color-baja';
  }

  etiquetaFecha(fechaLimite) {
    return this._model.etiquetaFecha(fechaLimite);
  }

  calcularUrgencia(fechaLimite) {
    return this._model.calcularUrgencia(fechaLimite);
  }

  getMateriaById(id) {
    return this._matModel.getById(id);
  }

  /** Devuelve las categorías generales con etiquetas en español */
  getGeneralCategories() {
    return this._generalCategories.map(k => ({ key: k, label: k }));
  }

  getCategoryLabel(key) {
    const cat = this.getGeneralCategories().find(c => c.key === key);
    return cat ? cat.label : key;
  }

  /** Determina la categoría general de una tarea (p.ej. Work, Study) */
  getGeneralCategory(tarea) {
    if (!tarea) return 'Otros';
    // Si la tarea ya trae una categoría explícita, usarla
    if (tarea.general_categoria) return tarea.general_categoria;

    const materia = this.getMateriaById(tarea.materia_id) || { nombre: '' };
    const text = ((tarea.titulo || '') + ' ' + (tarea.descripcion || '') + ' ' + (materia.nombre || '')).toLowerCase();

    for (const cat of this._generalCategories) {
      const kws = this._categoryKeywords[cat] || [];
      for (const kw of kws) {
        if (text.includes(kw.toLowerCase())) return cat;
      }
    }
    return 'Otros';
  }

  /** Devuelve color hex para una categoría general */
  getCategoryColor(cat) {
    const map = {
      'Trabajo': '#7C4DFF',
      'Estudio': '#00B8D9',
      'Personal': '#FFB020',
      'Bienestar': '#4CAF50',
      'Recados': '#FF7043',
      'Planificación': '#2196F3',
      'Otros': '#9E9E9E'
    };
    return map[cat] || '#9E9E9E';
  }
}

// Instancia global
const taskViewModel = new TaskViewModel(taskModel, materiaModel);
