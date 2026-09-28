/**
 * CAPA VIEW — PomodoroView.js
 * Controla el temporizador Pomodoro integrado en el modal de detalle.
 * Solo manipula el DOM del timer. No guarda estado de negocio.
 */

class PomodoroView {

  constructor(viewModel) {
    this._vm = viewModel;

    // DOM
    this.$time     = document.getElementById('pomodoro-time');
    this.$label    = document.getElementById('pomodoro-label');
    this.$ring     = document.getElementById('ring-progress');
    this.$sessions = document.getElementById('pomodoro-sessions');
    this.$btnToggle= document.getElementById('btn-pom-toggle');
    this.$btnReset = document.getElementById('btn-pom-reset');
    this.$btnSkip  = document.getElementById('btn-pom-skip');

    // Estado interno del timer
    this._duracion   = (window.app?.preferences?.values.focus || 25) * 60;
    this._duracionActual = this._duracion; // duración de la fase en curso (enfoque o descanso)
    this._restantes  = this._duracion;
    this._intervalo  = null;
    this._corriendo  = false;
    this._sesionAct  = 0;
    this._sesionTotal= 1;
    this._tareaId    = null;

    // Circunferencia del anillo SVG (r=50 → 2πr ≈ 314)
    this._circunf = 2 * Math.PI * 50;
    this.$ring.style.strokeDasharray = this._circunf;

    this._bindEvents();
  }

  // ── Inicializar para una tarea específica ─────────────────────────────────

  iniciar(tarea) {
    this._tareaId    = tarea.id;
    this._sesionAct  = tarea.pomodoros_real || 0;
    this._sesionTotal= tarea.pomodoros_est  || 1;
    this.reset();
    this._renderSessions();
  }

  // ── Eventos de botones ────────────────────────────────────────────────────

  _bindEvents() {
    this.$btnToggle.addEventListener('click', () => {
      this._corriendo ? this._pausar() : this._iniciarConteo();
    });
    this.$btnReset.addEventListener('click',  () => this.reset());
    this.$btnSkip.addEventListener('click',   () => this._completarSesion());
  }

  // ── Control del timer ─────────────────────────────────────────────────────

  _iniciarConteo() {
    if (this._restantes <= 0) this.reset();
    this._corriendo = true;
    this.$btnToggle.textContent = '⏸';
    this.$btnToggle.classList.add('running');
    this.$label.textContent = 'Enfocado';

    this._intervalo = setInterval(() => {
      this._restantes--;
      this._actualizarUI();
      if (this._restantes <= 0) {
        clearInterval(this._intervalo);
        this._completarSesion();
      }
    }, 1000);
  }

  _pausar() {
    clearInterval(this._intervalo);
    this._corriendo = false;
    this.$btnToggle.textContent = '▶';
    this.$btnToggle.classList.remove('running');
    this.$label.textContent = 'Pausado';
  }

  reset() {
    clearInterval(this._intervalo);
    this._corriendo  = false;
    this._duracion = (window.app?.preferences?.values.focus || 25) * 60;
    this._duracionActual = this._duracion;
    this._restantes  = this._duracion;
    this.$btnToggle.textContent = '▶';
    this.$btnToggle.classList.remove('running');
    this.$label.textContent = 'Listo';
    this._actualizarUI();
  }

  async _completarSesion() {
    clearInterval(this._intervalo);
    this._corriendo = false;
    this.$btnToggle.classList.remove('running');

    // Registrar en el ViewModel
    if (this._tareaId) {
      await this._vm.registrarPomodoro(this._tareaId);
      this._sesionAct++;
    }

    // Notificación del navegador
    this._notificar('🍅 ¡Sesión completada!', 'Toma un descanso de 5 minutos.');

    // Mostrar descanso
    this._duracionActual = (window.app?.preferences?.values.break || 5) * 60;
    this._restantes = this._duracionActual;
    this.$label.textContent = '☕ Descanso';
    this.$btnToggle.textContent = '▶';
    this._actualizarUI();
    this._renderSessions();
    app.showToast('¡Pomodoro completado! 🍅 Toma un descanso.', 'success');
  }

  // ── Actualizar UI del timer ───────────────────────────────────────────────

  _actualizarUI() {
    const min = Math.floor(this._restantes / 60).toString().padStart(2, '0');
    const seg = (this._restantes % 60).toString().padStart(2, '0');
    this.$time.textContent = `${min}:${seg}`;

    // Anillo SVG
    const progreso = this._restantes / this._duracionActual;
    const offset   = this._circunf * (1 - progreso);
    this.$ring.style.strokeDashoffset = offset;

    // Color del anillo según tiempo restante
    if (progreso < 0.25)      this.$ring.style.stroke = '#E53935';
    else if (progreso < 0.5)  this.$ring.style.stroke = '#FB8C00';
    else                      this.$ring.style.stroke = '#7B1FA2';
  }

  // ── Puntos de sesión ──────────────────────────────────────────────────────

  _renderSessions() {
    const dots = [];
    for (let i = 0; i < this._sesionTotal; i++) {
      let cls = 'session-dot';
      if (i < this._sesionAct)       cls += ' done';
      else if (i === this._sesionAct) cls += ' active';
      dots.push(`<div class="${cls}"></div>`);
    }
    this.$sessions.innerHTML = dots.join('');
  }

  // ── Notificación del navegador ────────────────────────────────────────────

  _notificar(titulo, cuerpo) {
    if (!window.app?.preferences?.values.alerts) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(titulo, { body: cuerpo, icon: '🍅' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(titulo, { body: cuerpo });
      });
    }
  }

  /** Detener timer al cerrar el modal */
  detener() {
    clearInterval(this._intervalo);
    this._corriendo = false;
    this.$btnToggle.textContent = '▶';
    this.$btnToggle.classList.remove('running');
  }
}
