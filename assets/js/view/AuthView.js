class AuthView {
  constructor(app) {
    this.app = app;
    this.$overlay = document.getElementById('modal-auth-overlay');
    this.$form = document.getElementById('form-auth');
    this.$nombre = document.getElementById('auth-nombre');
    this.$email = document.getElementById('auth-email');
    this.$password = document.getElementById('auth-password');
    this.$btnClose = document.getElementById('btn-cerrar-auth');
    this.$btnSwitch = document.getElementById('btn-switch-auth');
    this.$modeLabel = document.getElementById('auth-mode-label');
    this.$title = document.getElementById('auth-title');
    this.$submit = document.getElementById('btn-auth-submit');
    this.$rowNombre = document.getElementById('row-nombre');
    this.$rowPassword = document.getElementById('row-password');
    this.$rowSocialLogin = document.getElementById('row-social-login');
    this.$googleNote = document.getElementById('auth-google-note');

    this.mode = 'login'; // or 'register'

    this._bind();
    // App espera esta promesa antes del primer render. Así la portada y el
    // espacio privado no se alternan mientras se comprueba la cookie.
    this.ready = this._restoreUser();
  }

  _bind() {
    // Triggered from App: open(mode) will be used. Keep bind for safety.
    this.$btnClose.addEventListener('click', () => this.close());
    this.$overlay.addEventListener('click', e => { if (e.target === this.$overlay) this.close(); });
    this.$btnSwitch.addEventListener('click', () => this._toggleMode());
    this.$form.addEventListener('submit', e => { e.preventDefault(); this._submit(); });
    const btnGoogleModal = document.getElementById('btn-modal-google');
    if (btnGoogleModal) btnGoogleModal.addEventListener('click', () => this.loginWithProvider('google'));
  }

  open() {
    this.$overlay.classList.add('open');
  }

  openMode(mode = 'login') {
    // abrir modal en modo 'login' o 'register'
    this.mode = mode;
    this.$modeLabel.textContent = this.mode === 'login' ? 'Cuenta' : 'Registro';
    this.$title.textContent = this.mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
    this.$btnSwitch.textContent = this.mode === 'login' ? 'Cambiar a Registrar' : 'Cambiar a Iniciar sesión';
    this.$nombre.style.display = this.mode === 'login' ? 'none' : 'block';
    this.$rowNombre.style.display = '';
    this.$rowPassword.style.display = '';
    this.$rowSocialLogin.style.display = '';
    this.$btnSwitch.style.display = '';
    this.$googleNote.style.display = 'none';
    this.$password.required = true;
    this.$submit.textContent = 'Continuar';
    this.open();
  }

  /** Inicia el flujo OAuth real de Google en el backend. */
  openGoogleMode() {
    this.mode = 'google';
    this.$modeLabel.textContent = 'Google';
    this.$title.textContent = 'Continuar con Google';
    this.$rowNombre.style.display = 'none';
    this.$rowPassword.style.display = 'none';
    this.$rowSocialLogin.style.display = 'none';
    this.$btnSwitch.style.display = 'none';
    this.$googleNote.style.display = 'flex';
    this.$password.required = false;
    this.$submit.textContent = 'Continuar con Google';
    this.open();
  }

  async loginWithProvider(provider) {
    if (provider === 'google') {
      window.location.assign('/api/auth/google/start');
    } else {
      this.openMode('login');
    }
  }

  async _submitGoogle() {
    window.location.assign('/api/auth/google/start');
  }

  close() {
    this.$overlay.classList.remove('open');
  }

  _toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.$modeLabel.textContent = this.mode === 'login' ? 'Cuenta' : 'Registro';
    this.$title.textContent = this.mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
    this.$btnSwitch.textContent = this.mode === 'login' ? 'Cambiar a Registrar' : 'Cambiar a Iniciar sesión';
    this.$nombre.style.display = this.mode === 'login' ? 'none' : 'block';
  }

  async _requestAuth(action, payload = {}) {
    const response = await fetch(`api/auth?action=${action}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const ok = response.ok;
    const raw = await response.text();
    let data;
    if ((response.headers.get('content-type') || '').includes('application/json') && raw.trim()) {
      try { data = JSON.parse(raw); } catch (_) { /* Mensaje controlado debajo. */ }
    }
    if (!data || typeof data.success !== 'boolean') {
      throw Object.assign(new Error(`El servidor no devolvió JSON válido (HTTP ${response.status}).`), { status: response.status });
    }
    if (!ok || !data.success) {
      throw Object.assign(new Error(data.error || `No se pudo completar la solicitud (HTTP ${response.status}).`), { status: response.status });
    }
    if (action !== 'logout' && (!data.user || data.user.id == null)) {
      throw new Error('El servidor no devolvió una sesión válida.');
    }
    return data;
  }

  async _submit() {
    if (this.mode === 'google') {
      return this._submitGoogle();
    }
    const nombre = this.$nombre.value.trim();
    const email = this.$email.value.trim();
    const password = this.$password.value;
    if (!email || !password || (this.mode === 'register' && !nombre)) {
      this.app.showToast('Completa los campos', 'error');
      return;
    }

    const payload = { nombre, email, password };
    const action = this.mode === 'login' ? 'login' : 'register';
    try {
      const data = await this._requestAuth(action, payload);
      if (data.success) {
        // Mantener la identidad solo durante la sesión de esta pestaña.
        const user = data.user;
        sessionStorage.setItem('tm_user', JSON.stringify(user));
        this.app.setUser(user);
        this.app.enterWorkspace();
        if (typeof taskViewModel !== 'undefined') await taskViewModel.cargarTareas();
        if (this.app && this.app.homeView) this.app.homeView.render();
        this.app.integrationView?.refresh();
        this.app.showToast(this.mode === 'login' ? 'Bienvenido' : 'Cuenta creada', 'success');
        this.$form.reset();
        this.close();
      } else {
        this.app.showToast(data.error || 'Error', 'error');
      }
    } catch (e) {
      console.error(e);
      this.app.showToast(e.message || 'No se pudo conectar con el servidor.', 'error');
    }
  }

  async _restoreUser() {
    const params = new URLSearchParams(window.location.search);
    // La cookie del servidor determina el acceso, también al abrir la URL raíz.
    // Visitar la portada no debe revocar una sesión válida.
    try {
      const data = await this._requestAuth('session');
      if (data.user) {
        sessionStorage.setItem('tm_user', JSON.stringify(data.user));
        this.app.screen = 'workspace';
        this.app.setUser(data.user);
        params.set('workspace', '1');
        window.history.replaceState({}, '', window.location.pathname + `?${params.toString()}`);
        this._handleOAuthResult();
        return;
      }
    } catch (e) {
      console.warn('No se pudo restaurar la sesión:', e.message);
      this._sessionError = e.message;
    }
    sessionStorage.removeItem('tm_user');
    this.app.setUser(null);
    if (this.app.accessMode === 'guest' && params.get('workspace') === '1') {
      this.app.enterWorkspace();
    } else {
      params.delete('workspace');
      const query = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
    }
    this._handleOAuthResult();
  }

  _handleOAuthResult() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'google') {
      if (this.app.user && this.app.accessMode === 'authenticated') {
        this.app.showToast('Sesión iniciada con Google', 'success');
      } else {
        this.app.showToast(this._sessionError || 'No se pudo recuperar tu sesión de Google. Vuelve a iniciar sesión.', 'error');
      }
    } else if (params.get('integration') === 'google') {
      this.app.showToast('Google Workspace conectado', 'success');
      this.app.integrationView?.refresh();
    } else if (params.get('integration') === 'microsoft') {
      this.app.showToast('Microsoft 365 conectado', 'success');
      this.app.integrationView?.refresh();
    } else if (params.get('integration') === 'youtube') {
      this.app.showToast('YouTube conectado', 'success');
      this.app.integrationView?.refresh();
    } else if (params.get('auth_error') === 'google_config') {
      this.app.showToast('Google Login todavía no está configurado en el servidor', 'error');
    } else if (params.get('auth_error') === 'google') {
      this.app.showToast('Google no pudo verificar el inicio de sesión', 'error');
    } else if (params.get('integration_error')) {
      this.app.showToast('No se pudo completar la conexión de la integración', 'error');
    } else {
      return;
    }
    params.delete('login');
    params.delete('auth_error');
    params.delete('integration');
    params.delete('integration_error');
    if (this.app.accessMode === 'authenticated') params.set('workspace', '1');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }

  async logout() {
    try {
      await this._requestAuth('logout');
    } catch (e) {
      this.app.showToast(e.message || 'No se pudo cerrar la sesión en el servidor.', 'error');
      return;
    }
    sessionStorage.removeItem('tm_user');
    sessionStorage.removeItem('tm_access_mode');
    this.app.setUser(null);
    this.app.showPublic();
    this.$form.reset();
    // Recargar tareas sin usuario para no seguir mostrando las de la sesión cerrada
    if (typeof taskViewModel !== 'undefined') await taskViewModel.cargarTareas();
    if (this.app && this.app.homeView) this.app.homeView.render();
    this.app.showToast('Sesión cerrada', 'info');
  }
}

// export not necessary; App will instantiate AuthView
