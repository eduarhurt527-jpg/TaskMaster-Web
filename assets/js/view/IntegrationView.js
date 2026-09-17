class IntegrationView {
  constructor(app) {
    this.app = app;
    this.google = document.getElementById('connect-google');
    this.microsoft = document.getElementById('connect-microsoft');
    this.drive = document.getElementById('use-drive');
    this.classroom = document.getElementById('use-classroom');
    this.teams = document.getElementById('use-teams');
    this.google?.addEventListener('click', () => this.connect('google'));
    this.microsoft?.addEventListener('click', () => this.connect('microsoft'));
    this.drive?.addEventListener('click', () => this.openFiles());
    this.classroom?.addEventListener('click', () => this.checkCollection(
      '/api/integrations/google/classroom/courses',
      'courses',
      'cursos activos'
    ));
    this.teams?.addEventListener('click', () => this.checkCollection(
      '/api/integrations/microsoft/teams',
      'teams',
      'equipos disponibles'
    ));
  }
  connect(provider) {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    window.location.assign(`/api/integrations/${provider}/start`);
  }
  async refresh() {
    if (this.app.accessMode !== 'authenticated') return;
    try {
      const response = await fetch('/api/integrations/status', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) return;
      this._render('google', data.google);
      this._render('microsoft', data.microsoft);
      this._renderService('drive', data.google);
      this._renderService('classroom', data.google);
      this._renderService('teams', data.microsoft);
    } catch (error) { console.warn('No se pudo consultar integraciones', error); }
  }
  _render(provider, connected) {
    const status = document.getElementById(`${provider}-status`);
    const button = provider === 'google' ? this.google : this.microsoft;
    if (status) { status.textContent = connected ? 'Conectada' : 'Desconectada'; status.classList.toggle('integration-status--available', connected); }
    if (button) button.textContent = connected ? 'Reconectar' : 'Conectar';
  }

  _renderService(service, connected) {
    const status = document.getElementById(`${service}-status`);
    const button = document.getElementById(`use-${service}`);
    if (status) {
      status.textContent = connected ? 'Disponible' : 'Requiere conexión';
      status.classList.toggle('integration-status--available', connected);
    }
    if (button) button.disabled = !connected;
  }

  openFiles() {
    if (this.drive?.disabled) return;
    this.app._cambiarVista('files');
    document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));
    document.querySelector('.nav-btn[data-view="files"]')?.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async checkCollection(url, key, label) {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    try {
      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el servicio.');
      const total = Array.isArray(data[key]) ? data[key].length : 0;
      this.app.showToast(`${total} ${label}`, 'success');
    } catch (error) {
      this.app.showToast(error.message, 'error');
    }
  }
}
