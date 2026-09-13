/**
 * APP.JS — Punto de entrada y coordinador principal
 * Instancia todas las Views, conecta los eventos globales
 * y suscribe las Views al ViewModel.
 */

class App {

  constructor() {
    // Elimina el perfil que versiones anteriores dejaban permanentemente en el navegador.
    localStorage.removeItem('tm_user');
    localStorage.removeItem('tm_access_mode');
    this.user = null;
    this.accessMode = sessionStorage.getItem('tm_access_mode') === 'guest' ? 'guest' : 'public';
    this.screen = 'public';
    // Instanciar Views
    this.homeView      = new HomeView(taskViewModel);
    this.dashboardView = new DashboardView(taskViewModel);
    this.modalView     = new ModalView(taskViewModel);
    this.pomodoroView  = new PomodoroView(taskViewModel);
    this.authView      = new AuthView(this);
    this.recordingView = new RecordingView(this);
    this.fileWorkspaceView = new FileWorkspaceView(this);

    this._vistaActual  = 'home';

    this._taskExpirationNotified = new Set();
    this._bindGlobalEvents();
    this._subscribirViewModel();
    this._solicitarPermisoNotificaciones();
    this._iniciar();
    this._startTaskTimers();
  }

  _startTaskTimers() {
    this._updateTaskTimers();
    this._taskTimerInterval = setInterval(() => this._updateTaskTimers(), 1000);
  }

  _updateTaskTimers() {
    const tareas = taskViewModel.getTareas();
    const ahora = Date.now();
    const mapa = new Map(tareas.map(t => [String(t.id), t]));

    document.querySelectorAll('.task-timer').forEach(el => {
      const id = String(el.dataset.id || '');
      const tarea = mapa.get(id);
      if (!tarea) return;

      const countdown = el.querySelector('.timer-countdown');
      if (!countdown) return;

      const diff = new Date(tarea.fecha_limite).getTime() - ahora;
      el.classList.remove('timer-urgent', 'timer-medium', 'timer-low', 'timer-blink');

      if (diff <= 0) {
        el.classList.add('timer-urgent');
        countdown.textContent = '¡Tiempo Expirado!';
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');

      let texto = days > 0
        ? `Faltan ${days} días, ${hh}:${mm}:${ss}`
        : `Faltan ${hh}:${mm}:${ss}`;

      if (tarea.prioridad === 'Alta') {
        el.classList.add('timer-urgent');
        if (diff <= 3 * 3600 * 1000) {
          el.classList.add('timer-blink');
        }
        if (diff <= 3600 * 1000) {
          texto += ' ⚠️ Próxima a expirar';
        }
      } else if (tarea.prioridad === 'Media') {
        el.classList.add('timer-medium');
        if (diff <= 6 * 3600 * 1000) {
          texto += ' ⚠️ Próxima a vencer';
        }
      } else {
        el.classList.add('timer-low');
      }

      countdown.textContent = texto;
      this._maybeNotifyExpiration(tarea, diff);
    });
  }

  _maybeNotifyExpiration(tarea, diff) {
    if (tarea.completada || diff <= 0) return;

    const key = `${tarea.id}-${tarea.prioridad}`;
    if (tarea.prioridad === 'Alta' && diff <= 3600 * 1000 && !this._taskExpirationNotified.has(key)) {
      this._taskExpirationNotified.add(key);
      this.showToast(`¡Aviso! La tarea "${tarea.titulo}" está muy cerca de expirar`, 'warning');
      return;
    }

    if (tarea.prioridad === 'Media' && diff <= 2 * 3600 * 1000 && !this._taskExpirationNotified.has(key)) {
      this._taskExpirationNotified.add(key);
      this.showToast(`¡Aviso! La tarea "${tarea.titulo}" está muy cerca de expirar`, 'warning');
    }
  }

  _checkDueWarnings() {
    const tareas = taskViewModel.getTareas().filter(t => t.fecha_limite && !t.completada);
    const now = new Date();
    tareas.forEach(t => {
      const diff = new Date(t.fecha_limite) - now;
      const hrs = diff / 3_600_000;
      if (hrs <= 1 && hrs > 0) {
        this.showToast(`⚠ Tarea "${t.titulo}" vence en menos de 1 hora`, 'error');
      } else if (hrs <= 24 && hrs > 0) {
        this.showToast(`⏰ Tarea "${t.titulo}" vence en ${Math.floor(hrs)} horas`, 'warning');
      }
    });
  }

  // ── Suscripción al ViewModel ──────────────────────────────────────────────

  _subscribirViewModel() {
    taskViewModel.subscribe((evento, estado) => {
      switch (evento) {

        case 'tareasActualizadas':
        case 'tareaCreada':
        case 'tareaActualizada':
        case 'tareaEliminada':
        case 'pomodoroRegistrado':
          this.homeView.render();
          if (this._vistaActual === 'overview') this.dashboardView.render();
          this._updateCountdown();
          this._checkDueWarnings();
          break;

        case 'filtroChanged':
          this.homeView.renderFiltros();
          this.homeView.renderTareas();
          break;

        case 'tareaActivaChanged':
          const tarea = taskViewModel.getTareaActiva();
          if (tarea) {
            this.modalView.abrirDetalle(tarea);
            this.pomodoroView.iniciar(tarea);
          } else {
            this.pomodoroView.detener();
          }
          break;
      }
    });
  }

  // ── Eventos globales ──────────────────────────────────────────────────────

  _bindGlobalEvents() {
    // Navegación entre vistas
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const vista = btn.dataset.view;
        this._cambiarVista(vista);
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.scroll) {
          window.setTimeout(() => document.getElementById(btn.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }), 0);
        }
      });
    });

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Contraer menú');
    });
    const sidebarLogout = document.getElementById('sidebar-logout');
    if (sidebarLogout) sidebarLogout.addEventListener('click', () => {
      if (this.accessMode === 'authenticated') this.authView.logout();
      else this.exitGuest();
    });

    // FAB: abrir modal nueva tarea
    const btnNew = document.getElementById('btn-nueva-tarea');
    if (btnNew) btnNew.addEventListener('click', () => {
      if (!this._canUseWorkspace()) return this._requestAccess();
      this.modalView.abrirNueva();
    });
    const btnFab = document.getElementById('btn-fab-nueva-tarea');
    if (btnFab) btnFab.addEventListener('click', () => {
      if (!this._canUseWorkspace()) return this._requestAccess();
      this.modalView.abrirNueva();
    });

    // Login buttons
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', () => this.authView.openMode('login'));
    const btnReg = document.getElementById('btn-registrarse');
    if (btnReg) btnReg.addEventListener('click', () => this.authView.openMode('register'));
    const publicLogin = document.getElementById('btn-public-login');
    if (publicLogin) publicLogin.addEventListener('click', () => this.authView.openMode('login'));
    const publicRegister = document.getElementById('btn-public-register');
    if (publicRegister) publicRegister.addEventListener('click', () => this.authView.openMode('register'));
    const publicWorkspace = document.getElementById('btn-public-workspace');
    if (publicWorkspace) publicWorkspace.addEventListener('click', () => this.enterWorkspace());
    const publicLogout = document.getElementById('btn-public-logout');
    if (publicLogout) publicLogout.addEventListener('click', () => this.authView.logout());
    const btnHeroReg = document.getElementById('btn-hero-registrarse');
    if (btnHeroReg) btnHeroReg.addEventListener('click', () => this.authView.openMode('register'));
    const btnGoogle = document.getElementById('btn-google-login');
    if (btnGoogle) btnGoogle.addEventListener('click', () => this.authView.loginWithProvider('google'));
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => this.authView.logout());
    document.querySelectorAll('[data-action="guest"]').forEach(btn => {
      btn.addEventListener('click', () => this.enterGuest());
    });
    document.querySelectorAll('[data-action="public"]').forEach(btn => {
      btn.addEventListener('click', () => this.showPublic());
    });
    document.querySelectorAll('[data-requires-account]').forEach(el => {
      el.addEventListener('click', event => {
        if (this.accessMode === 'authenticated') return;
        event.preventDefault();
        this.showToast('Esta función necesita una cuenta para mantener tus datos e integraciones protegidos.', 'warning');
      });
    });
    const btnCarga = document.getElementById('btn-carga-semanal');
    if (btnCarga) btnCarga.addEventListener('click', () => {
      this._cambiarVista('overview');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const nav = document.querySelector('.nav-btn[data-view="overview"]'); if (nav) nav.classList.add('active');
    });
    const contactForm = document.getElementById('contact-form');
    if (contactForm) contactForm.addEventListener('submit', event => {
      event.preventDefault();
      this.showToast('Formulario listo para conectar con el canal de contacto.', 'info');
    });
    const year = document.getElementById('current-year');
    if (year) year.textContent = String(new Date().getFullYear());

    // Teclado: ESC cierra modales
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.modalView.cerrar();
        this.modalView.cerrarDetalle();
        this.pomodoroView.detener();
      }
    });
  }

  // ── Cambio de vista ───────────────────────────────────────────────────────

  _cambiarVista(vista) {
    this._vistaActual = vista;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(`view-${vista}`);
    if (el) el.classList.add('active');

    if (vista === 'overview') this.dashboardView.render();
    if (vista === 'home')      this.homeView.render();
  }


  setUser(user) {
    this.user = user;
    if (user) {
      this.accessMode = 'authenticated';
      sessionStorage.setItem('tm_access_mode', 'authenticated');
    } else if (sessionStorage.getItem('tm_access_mode') === 'guest') {
      this.accessMode = 'guest';
    } else {
      this.accessMode = 'public';
      sessionStorage.removeItem('tm_access_mode');
    }
    this._applyAccessState();
    const el = document.getElementById('header-welcome');
    if (el) el.textContent = user && user.nombre ? `Hola, ${user.nombre}` : 'Bienvenido';

    const loggedIn = ['btn-login', 'btn-registrarse', 'btn-google-login'];
    loggedIn.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = user ? 'none' : '';
    });
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.style.display = user ? '' : 'none';

  }

  _canUseWorkspace() {
    return this.accessMode === 'guest' || this.accessMode === 'authenticated';
  }

  _requestAccess() {
    this.showToast('Inicia sesión, regístrate o continúa como invitado.', 'info');
    this.authView.openMode('login');
  }

  async enterGuest() {
    this.user = null;
    this.accessMode = 'guest';
    sessionStorage.removeItem('tm_user');
    sessionStorage.setItem('tm_access_mode', 'guest');
    this.screen = 'workspace';
    this._applyAccessState();
    await taskViewModel.cargarTareas();
    this.homeView.render();
    this.showToast('Estás usando TaskMaster como invitado', 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showPublic() {
    this.recordingView?.cleanupStream();
    this.screen = 'public';
    this._applyAccessState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  exitGuest() {
    sessionStorage.removeItem('tm_user');
    sessionStorage.removeItem('tm_access_mode');
    this.user = null;
    this.accessMode = 'public';
    this.showPublic();
  }

  enterWorkspace() {
    if (!this._canUseWorkspace()) return this._requestAccess();
    this.screen = 'workspace';
    this._applyAccessState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _applyAccessState() {
    // Una pantalla de trabajo nunca puede permanecer abierta sin invitado o cuenta.
    if (!this._canUseWorkspace()) this.screen = 'public';
    document.body.dataset.access = this.accessMode;
    document.body.dataset.screen = this.screen;
    const badge = document.getElementById('access-badge');
    if (badge) {
      badge.textContent = this.accessMode === 'guest' ? 'Modo invitado' : 'Cuenta sincronizada';
      badge.className = `access-badge access-badge--${this.accessMode}`;
    }
    document.querySelectorAll('[data-auth-only]').forEach(el => {
      el.classList.toggle('is-locked', this.accessMode !== 'authenticated');
      el.setAttribute('aria-disabled', String(this.accessMode !== 'authenticated'));
    });
    const publicLogin = document.getElementById('btn-public-login');
    const publicRegister = document.getElementById('btn-public-register');
    const publicWorkspace = document.getElementById('btn-public-workspace');
    const publicLogout = document.getElementById('btn-public-logout');
    // La portada siempre permite que una persona distinta inicie o cree su cuenta.
    if (publicLogin) publicLogin.hidden = false;
    if (publicRegister) publicRegister.hidden = false;
    if (publicWorkspace) {
      publicWorkspace.hidden = this.accessMode === 'public';
      publicWorkspace.textContent = this.accessMode === 'guest' ? 'Volver al panel' : 'Ir a mi panel';
    }
    if (publicLogout) publicLogout.hidden = this.accessMode !== 'authenticated';
  }

  _updateCountdown() {
    // Muestra el tiempo restante hasta la tarea más próxima
    const tareas = taskViewModel.getTareas().filter(t => t.fecha_limite && !t.completada);
    if (!tareas.length) {
      const el = document.getElementById('header-countdown'); if (el) el.textContent = '';
      return;
    }
    let proximas = tareas.map(t => ({ t, diff: new Date(t.fecha_limite) - new Date() }));
    proximas = proximas.filter(p => p.diff > 0);
    if (!proximas.length) { const el = document.getElementById('header-countdown'); if (el) el.textContent = 'No hay próximas tareas'; return; }
    proximas.sort((a,b) => a.diff - b.diff);
    const next = proximas[0];
    const ms = next.diff;
    const dias = Math.floor(ms / 86_400_000);
    const horas = Math.floor((ms % 86_400_000) / 3_600_000);
    const el = document.getElementById('header-countdown');
    if (el) el.textContent = `Próxima: ${next.t.titulo} — Falta ${dias}d ${horas}h`;
  }

  // ── Notificaciones del navegador ──────────────────────────────────────────

  _solicitarPermisoNotificaciones() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ── Inicialización ────────────────────────────────────────────────────────

  async _iniciar() {
    this._applyAccessState();
    await taskViewModel.cargarTareas();
    this.homeView.render();
  }

  // ── Toast global ──────────────────────────────────────────────────────────

  showToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast     = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// Arrancar la app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });
