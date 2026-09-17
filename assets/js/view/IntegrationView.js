class IntegrationView {
  constructor(app) {
    this.app = app;
    this.google = document.getElementById('connect-google');
    this.microsoft = document.getElementById('connect-microsoft');
    this.google?.addEventListener('click', () => this.connect('google'));
    this.microsoft?.addEventListener('click', () => this.connect('microsoft'));
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
    if (button) button.textContent = connected ? 'Volver a vincular' : 'Vincular con TaskMaster';
  }

  _renderService(service, connected) {
    const status = document.getElementById(`${service}-status`);
    if (status) {
      status.textContent = connected ? 'Vinculada' : 'Acceso externo';
      status.classList.toggle('integration-status--available', connected);
    }
  }
}
