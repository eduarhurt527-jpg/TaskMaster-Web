class IntegrationsView {
  constructor(app) {
    this.app = app;
    this.baseUrl = window.TASKMASTER_INTEGRATIONS_URL || 'http://localhost:3002';
    this.$cards = [...document.querySelectorAll('.integration-card')];
    this.$status = document.getElementById('integration-global-status');
    this.$count = document.getElementById('integration-connected-count');
    this._bind();
    this.refresh();
  }

  _bind() {
    document.getElementById('btn-refresh-integrations')?.addEventListener('click', () => this.refresh(true));
    document.querySelectorAll('.integration-filter').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.integration-filter').forEach(item => item.classList.toggle('active', item === button));
        const filter = button.dataset.provider;
        this.$cards.forEach(card => {
          const providers = card.dataset.provider?.split(' ') || [];
          card.hidden = filter !== 'all' && !providers.includes(filter);
        });
      });
    });
  }

  async _accountState(provider) {
    const response = await fetch(`${this.baseUrl}/api/${provider}/estado`, { credentials: 'include' });
    if (!response.ok) throw new Error(`No se pudo consultar ${provider}`);
    return response.json();
  }

  _paint(provider, connected, hasError = false) {
    document.querySelectorAll(`[data-account="${provider}"]`).forEach(card => {
      const badge = card.querySelector('.connection-badge');
      const connect = card.querySelector('.connect-action');
      const use = card.querySelector('.use-action');
      badge.classList.toggle('connected', connected);
      badge.classList.toggle('error', hasError);
      badge.textContent = hasError ? 'Sin servicio' : connected ? 'Conectada' : 'No conectada';
      if (connect) connect.textContent = connected ? 'Reconectar' : 'Conectar';
      use?.classList.toggle('is-enabled', connected);
    });
  }

  async refresh(showToast = false) {
    this.$status.textContent = 'Comprobando conexiones…';
    const results = await Promise.allSettled([this._accountState('google'), this._accountState('microsoft')]);
    let connected = 0;
    ['google', 'microsoft'].forEach((provider, index) => {
      const result = results[index];
      const ok = result.status === 'fulfilled' && Boolean(result.value.conectado);
      if (ok) connected += 1;
      this._paint(provider, ok, result.status === 'rejected');
    });
    this.$count.textContent = connected;
    const offline = results.every(result => result.status === 'rejected');
    this.$status.textContent = offline
      ? 'Inicia el microservicio de integraciones en el puerto 3002 para conectar cuentas.'
      : connected ? `${connected} proveedor${connected === 1 ? '' : 'es'} conectado${connected === 1 ? '' : 's'}.` : 'Tus cuentas todavía no están conectadas.';
    if (showToast) this.app.showToast(offline ? 'Servicio de integraciones no disponible' : 'Estados actualizados', offline ? 'warning' : 'success');
  }
}
