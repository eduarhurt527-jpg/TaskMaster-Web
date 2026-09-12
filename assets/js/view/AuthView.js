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
    this._restoreUser();
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

  /** Lleva al centro de integraciones; no suplanta la autenticación de Google. */
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
      document.querySelector('.nav-btn[data-view="integrations"]')?.click();
      this.app.showToast('Conecta Google desde tu cuenta de forma segura', 'info');
    } else {
      this.openMode('login');
    }
  }

  async _submitGoogle() {
    const email = this.$email.value.trim();
    if (!email) {
      this.app.showToast('Introduce tu correo', 'error');
      return;
    }
    const nombre = email.split('@')[0];
    try {
      const res = await fetch('api/auth?action=google', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const user = { id: data.user.id, nombre: data.user.nombre, email };
        localStorage.setItem('tm_user', JSON.stringify(user));
        this.app.setUser(user);
        if (typeof taskViewModel !== 'undefined') await taskViewModel.cargarTareas();
        if (this.app && this.app.homeView) this.app.homeView.render();
        this.app.showToast('Conectado con Google', 'success');
        this.close();
        return;
      }
      this.app.showToast(data.error || 'Error Google', 'error');
    } catch (e) {
      console.error(e);
      this.app.showToast('Error de red Google', 'error');
    }
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
    const url = this.mode === 'login' ? 'api/auth?action=login' : 'api/auth?action=register';
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        // Guardar usuario localmente
        const user = { id: data.user_id || (data.user && data.user.id) || null, nombre: nombre || (data.user && data.user.nombre) || email, email };
        localStorage.setItem('tm_user', JSON.stringify(user));
        this.app.setUser(user);
        if (typeof taskViewModel !== 'undefined') await taskViewModel.cargarTareas();
        if (this.app && this.app.homeView) this.app.homeView.render();
        this.app.showToast(this.mode === 'login' ? 'Bienvenido' : 'Cuenta creada', 'success');
        this.close();
      } else {
        this.app.showToast(data.error || 'Error', 'error');
      }
    } catch (e) {
      console.error(e);
      this.app.showToast('Error de red', 'error');
    }
  }

  async _restoreUser() {
    try {
      const response = await fetch('/api/session', { credentials: 'include' });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem('tm_user', JSON.stringify(data.user));
        this.app.setUser(data.user);
      } else {
        localStorage.removeItem('tm_user');
      }
    } catch (error) {
      localStorage.removeItem('tm_user');
    }
  }

  async logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    localStorage.removeItem('tm_user');
    this.app.setUser(null);
    // Recargar tareas sin usuario para no seguir mostrando las de la sesión cerrada
    if (typeof taskViewModel !== 'undefined') await taskViewModel.cargarTareas();
    if (this.app && this.app.homeView) this.app.homeView.render();
    this.app.showToast('Sesión cerrada', 'info');
  }
}

// export not necessary; App will instantiate AuthView
