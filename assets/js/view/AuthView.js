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
    const data = await taskMasterApi.request(`api/auth?action=${action}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }, action === 'login' ? 'login' : 'session');
    if (action !== 'logout' && (!data.user || data.user.id == null)) {
      throw new Error('No pudimos confirmar tu sesión. Vuelve a iniciar sesión.');
    }
    return data;
  }

  async _submit() {
    if (this._submitting) return;
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
    this._submitting = true;
    this.$submit.disabled = true;
    this.$submit.setAttribute('aria-busy', 'true');
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
    } finally {
      this._submitting = false;
      this.$submit.disabled = false;
      this.$submit.removeAttribute('aria-busy');
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
    const integrationReturn = params.has('integration') || params.has('integration_error');
    if (params.get('login') === 'google') {
      if (this.app.user && this.app.accessMode === 'authenticated') {
        this.app.showToast('Sesión iniciada con Google', 'success');
      } else {
        this.app.showToast(this._sessionError || 'No se pudo recuperar tu sesión de Google. Vuelve a iniciar sesión.', 'error');
      }
    } else if (params.has('integration') && (!this.app.user || this.app.accessMode !== 'authenticated')) {
      this.app.showToast('Inicia sesión nuevamente para comprobar la conexión del servicio.', 'warning');
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
      this.app.showToast('El acceso con Google no está disponible en este momento. Puedes usar tu correo y contraseña o volver a intentarlo más tarde.', 'error');
    } else if (params.get('auth_error') === 'google') {
      this.app.showToast('No se completó el acceso con Google. Vuelve a intentarlo y completa la autorización.', 'error');
    } else if (params.get('integration_error')) {
      const provider = params.get('integration_error').split('_')[0];
      const name = { google: 'Google Workspace', microsoft: 'Microsoft 365', youtube: 'YouTube' }[provider] || 'el servicio';
      const message = params.get('integration_error').endsWith('_config')
        ? `La conexión con ${name} no está disponible en este momento. Puedes abrir su aplicación oficial e intentarlo más tarde.`
        : `No se completó la conexión con ${name}. Vuelve a vincular tu cuenta y completa la autorización.`;
      this.app.showToast(message, 'error');
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
    if (this.app.accessMode === 'authenticated' && integrationReturn) {
      // Los regresos de las integraciones deben mostrar sus controles, no la portada.
      if (this.app._cambiarVista && this.app.integrationView) this.app._cambiarVista('integrations');
    }
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
