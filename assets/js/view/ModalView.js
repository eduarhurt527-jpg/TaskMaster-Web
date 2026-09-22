/**
 * CAPA VIEW — ModalView.js
 * Controla el modal de nueva/editar tarea y el modal de detalle.
 */

class ModalView {

  constructor(viewModel) {
    this._vm = viewModel;

    // Modal formulario
    this.$overlay  = document.getElementById('modal-overlay');
    this.$title    = document.getElementById('modal-title');
    this.$form     = document.getElementById('form-tarea');
    this.$id       = document.getElementById('tarea-id');
    this.$titulo   = document.getElementById('tarea-titulo');
    this.$desc     = document.getElementById('tarea-descripcion');
    this.$materia        = document.getElementById('tarea-materia');
    this.$categoriaGeneral = null; // will be created in DOM if exists
    this.$prioridadInput = document.getElementById('tarea-prioridad');
    this.$priorityBtns   = [...document.querySelectorAll('.priority-btn')];
    this.$fecha          = document.getElementById('tarea-fecha');
    this.$pomodoros      = document.getElementById('tarea-pomodoros');
    this.$pomodoroCount  = document.getElementById('pomodoro-count');
    this.$recCheck       = document.getElementById('tarea-recordatorio');
    this.$recOpts        = document.getElementById('recordatorio-opts');
    this.$anticip        = document.getElementById('tarea-anticipacion');
    this.$errTit         = document.getElementById('error-titulo');
    this.$errFecha       = document.getElementById('error-fecha');

    // Modal detalle
    this.$detalleOverlay = document.getElementById('modal-detalle-overlay');
    this.$detalleMateria = document.getElementById('detalle-materia');
    this.$detalleTitulo  = document.getElementById('detalle-titulo');
    this.$detalleDesc    = document.getElementById('detalle-desc');
    this.$detalleFecha   = document.getElementById('detalle-fecha');
    this.$detallePrio    = document.getElementById('detalle-prioridad');
    this.$detalleSubtitle= document.getElementById('detalle-subtitle');
    this.$detalleRecordatorio = document.getElementById('detalle-recordatorio');
    this.$detalleProgreso = document.getElementById('detalle-progreso');
    this.$btnCompletar   = document.getElementById('btn-completar');
    this.$btnEditar      = document.getElementById('btn-editar-tarea');
    this.$btnEliminar    = document.getElementById('btn-eliminar-tarea');

    this._bindEvents();
    this._populateMaterias();
  }

  // ── Poblar select de materias ─────────────────────────────────────────────

  _populateMaterias() {
    const materias = this._vm.getMaterias();
    this.$materia.innerHTML = materias.map(m =>
      `<option value="${m.id}">${this._vm.getDisplayMateriaName(m)}</option>`
    ).join('');

    // Añadir select de categoría general si existe en el DOM
    const gen = document.getElementById('tarea-general-categoria');
    if (gen) {
      this.$categoriaGeneral = gen;
      gen.innerHTML = '';
      gen.appendChild(new Option('Seleccionar categoría', ''));
      this._vm.getGeneralCategories().forEach(c => {
        gen.appendChild(new Option(c.label, c.key));
      });
    }
  }

  // ── Eventos ───────────────────────────────────────────────────────────────

  _bindEvents() {
    // Cerrar modales
    document.getElementById('btn-cerrar-modal').addEventListener('click',  () => this.cerrar());
    document.getElementById('btn-cancelar').addEventListener('click',       () => this.cerrar());
    document.getElementById('btn-cerrar-detalle').addEventListener('click', () => this.cerrarDetalle());

    // Cerrar al hacer clic fuera
    this.$overlay.addEventListener('click',        e => { if (e.target === this.$overlay)        this.cerrar(); });
    this.$detalleOverlay.addEventListener('click', e => { if (e.target === this.$detalleOverlay) this.cerrarDetalle(); });

    // Selección de prioridad
    this.$priorityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.$priorityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.$prioridadInput.value = btn.dataset.priority;
      });
    });

    // Actualizar contador de pomodoros
    this.$pomodoros.addEventListener('input', () => {
      this.$pomodoroCount.textContent = this.$pomodoros.value;
    });

    // Quick-add: interpretar lenguaje natural en el título al salir del campo
    // (ej: "Entregar informe mañana 5pm #trabajo alta")
    this.$titulo.addEventListener('blur', () => this._intentarQuickAdd());

    // Toggle recordatorio
    this.$recCheck.addEventListener('change', () => {
      this.$recOpts.style.display = this.$recCheck.checked ? 'block' : 'none';
    });

    // Submit del formulario
    this.$form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!this._validar()) return;

      const submitBtn = this.$form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const datos = {
          titulo:           this.$titulo.value.trim(),
          descripcion:      this.$desc.value.trim(),
          materia_id:       Number(this.$materia.value),
          general_categoria: this.$categoriaGeneral ? this.$categoriaGeneral.value : '',
          prioridad:        this.$prioridadInput.value,
          fecha_limite:     this.$fecha.value,
          pomodoros_est:    Number(this.$pomodoros.value) || 1,
          min_anticipacion: this.$recCheck.checked ? Number(this.$anticip.value) : 0,
        };

        const id = this.$id.value;
        if (id) {
          const tareaActual = this._vm.getTareas().find(t => t.id === Number(id));
          datos.completada     = tareaActual ? tareaActual.completada : 0;
          datos.pomodoros_real = tareaActual ? tareaActual.pomodoros_real : 0;
        } else {
          datos.completada     = 0;
          datos.pomodoros_real = 0;
        }

        let resultado;
        if (id) {
          resultado = await this._vm.actualizarTarea(Number(id), datos);
        } else {
          resultado = await this._vm.crearTarea(datos);
        }

        if (resultado.success) {
          // Enviar notificación por email si el usuario está logueado y solicitó aviso
          try {
            const user = sessionStorage.getItem('tm_user') ? JSON.parse(sessionStorage.getItem('tm_user')) : null;
            if (user && user.email) {
              await fetch('api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: user.email,
                  prioridad: datos.prioridad,
                  asunto: `${datos.prioridad} — ${datos.titulo}`,
                  mensaje: datos.descripcion || 'Tienes una tarea registrada.'
                })
              });
            }
          } catch (e) {
            console.warn('Error enviando notificación', e);
          }
          this.cerrar();
          app.showToast(id ? 'Tarea actualizada con éxito' : 'Tarea guardada con éxito', 'success');
        } else {
          app.showToast(resultado.error || 'Error al guardar', 'error');
        }
      } catch (err) {
        console.error('Error guardando tarea:', err);
        app.showToast('Error al guardar: ' + err.message, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // Acciones en modal detalle
    this.$btnCompletar.addEventListener('click', async () => {
      const t = this._vm.getTareaActiva();
      if (!t) return;
      await this._vm.toggleCompletada(t.id);
      this.cerrarDetalle();
      app.showToast('Estado actualizado ✓', 'success');
    });

    this.$btnEditar.addEventListener('click', () => {
      const t = this._vm.getTareaActiva();
      if (!t) return;
      this.cerrarDetalle();
      this.abrirEditar(t);
    });

    this.$btnEliminar.addEventListener('click', async () => {
      const t = this._vm.getTareaActiva();
      if (!t) return;
      if (!confirm(`¿Eliminar "${t.titulo}"?`)) return;
      await this._vm.eliminarTarea(t.id);
      this.cerrarDetalle();
      app.showToast('Tarea eliminada', 'info');
    });
  }

  // ── Quick-add: lenguaje natural en el título ──────────────────────────────

  _intentarQuickAdd() {
    if (typeof quickAddParser === 'undefined') return;
    const texto = this.$titulo.value;
    if (!texto || !texto.trim()) return;

    const r = quickAddParser.parse(texto);
    if (!r.detectados.length) return; // nada que interpretar, dejar el título tal cual

    this.$titulo.value = r.titulo;

    if (r.fecha) {
      const f = new Date(r.fecha);
      f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
      this.$fecha.value = f.toISOString().slice(0, 16);
    }
    if (r.prioridad) {
      this.$prioridadInput.value = r.prioridad;
      this.$priorityBtns.forEach(b => b.classList.toggle('active', b.dataset.priority === r.prioridad));
    }
    if (r.categoria && this.$categoriaGeneral) {
      this.$categoriaGeneral.value = r.categoria;
    }

    if (app && app.showToast) {
      app.showToast(`✨ Detecté: ${r.detectados.join(', ')} — revísalo antes de guardar`, 'info');
    }
  }

  // ── Validación del formulario ─────────────────────────────────────────────

  _validar() {
    let ok = true;
    this.$errTit.textContent   = '';
    this.$errFecha.textContent = '';

    if (!this.$titulo.value.trim()) {
      this.$errTit.textContent = 'El título es obligatorio.';
      ok = false;
    }
    if (!this.$fecha.value) {
      this.$errFecha.textContent = 'La fecha límite es obligatoria.';
      ok = false;
    }
    return ok;
  }

  // ── Abrir modal nueva tarea ───────────────────────────────────────────────

  abrirNueva(defaults = {}) {
    this.$title.textContent = 'Nueva Tarea';
    this.$form.reset();
    this.$id.value = '';
    this.$prioridadInput.value = 'Media';
    this.$priorityBtns.forEach(b => b.classList.toggle('active', b.dataset.priority === 'Media'));
    this.$pomodoroCount.textContent = this.$pomodoros.value;
    this.$recCheck.checked = true;
    this.$anticip.value = '30';
    this.$recOpts.style.display = 'block';
    // Fecha mínima = ahora
    const ahora = new Date();
    ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
    this.$fecha.min = ahora.toISOString().slice(0,16);
    this.$overlay.classList.add('open');
    // Aplicar defaults si vienen
    if (defaults) {
      if (defaults.titulo) this.$titulo.value = defaults.titulo;
      if (defaults.descripcion) this.$desc.value = defaults.descripcion;
      if (defaults.materia_id) this.$materia.value = defaults.materia_id;
      if (defaults.general_categoria && this.$categoriaGeneral) this.$categoriaGeneral.value = defaults.general_categoria;
      if (defaults.prioridad) {
        this.$prioridadInput.value = defaults.prioridad;
        this.$priorityBtns.forEach(b => b.classList.toggle('active', b.dataset.priority === defaults.prioridad));
      }
      if (defaults.fecha_limite) {
        const f = new Date(defaults.fecha_limite);
        f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
        this.$fecha.value = f.toISOString().slice(0,16);
      }
      if (defaults.pomodoros_est) { this.$pomodoros.value = defaults.pomodoros_est; this.$pomodoroCount.textContent = defaults.pomodoros_est; }
    }
  }

  // ── Abrir modal editar tarea ──────────────────────────────────────────────

  abrirEditar(tarea) {
    this.$title.textContent   = 'Editar Tarea';
    this.$id.value            = tarea.id;
    this.$titulo.value        = tarea.titulo;
    this.$desc.value          = tarea.descripcion || '';
    this.$materia.value       = tarea.materia_id;
    this.$prioridadInput.value= tarea.prioridad;
    this.$priorityBtns.forEach(b => b.classList.toggle('active', b.dataset.priority === tarea.prioridad));
    this.$pomodoros.value     = tarea.pomodoros_est || 1;
    this.$pomodoroCount.textContent = this.$pomodoros.value;
    this.$recCheck.checked    = tarea.min_anticipacion > 0;
    this.$anticip.value       = tarea.min_anticipacion ? String(tarea.min_anticipacion) : '30';
    this.$recOpts.style.display = this.$recCheck.checked ? 'block' : 'none';
    if (this.$categoriaGeneral) {
      this.$categoriaGeneral.value = tarea.general_categoria || '';
    }
    if (tarea.fecha_limite) {
      const f = new Date(tarea.fecha_limite);
      f.setMinutes(f.getMinutes() - f.getTimezoneOffset());
      this.$fecha.value = f.toISOString().slice(0,16);
    }
    this.$overlay.classList.add('open');
  }

  // ── Abrir modal detalle ───────────────────────────────────────────────────

  abrirDetalle(tarea) {
    const materia = this._vm.getMateriaById(tarea.materia_id);
    const { texto } = this._vm.etiquetaFecha(tarea.fecha_limite);
    const category = this._vm.getGeneralCategory(tarea);
    const color = this._vm.getCategoryColor(category);

    this.$detalleMateria.textContent   = category;
    this.$detalleMateria.style.background = color;
    this.$detalleMateria.style.color      = '#fff';
    this.$detalleTitulo.textContent    = tarea.titulo;
    this.$detalleDesc.textContent      = tarea.descripcion || 'Sin descripción.';
    this.$detalleFecha.textContent     = `📅 ${texto}`;
    const urgencia = this._vm.calcularUrgencia(tarea.fecha_limite);
    this.$detallePrio.textContent      = `Prioridad: ${tarea.prioridad} · Urgencia: ${urgencia}%`;
    this.$detalleSubtitle.textContent  = `${category} • ${tarea.pomodoros_est || 1} sesiones estimadas`;
    this.$detalleRecordatorio.textContent = tarea.min_anticipacion > 0
      ? `Sí, ${tarea.min_anticipacion} min antes`
      : 'No programado';
    this.$detalleProgreso.textContent = `${tarea.pomodoros_real || 0}/${tarea.pomodoros_est || 1}`;

    // Actualizar texto del botón según estado
    this.$btnCompletar.textContent = tarea.completada ? '↩ Marcar pendiente' : '✓ Completar';

    this.$detalleOverlay.classList.add('open');
  }

  // ── Cerrar modales ────────────────────────────────────────────────────────

  cerrar() {
    this.$overlay.classList.remove('open');
    this.$form.reset();
    this.$errTit.textContent = '';
    this.$errFecha.textContent = '';
  }

  cerrarDetalle() {
    this.$detalleOverlay.classList.remove('open');
    this._vm.cerrarTareaActiva();
  }
}
