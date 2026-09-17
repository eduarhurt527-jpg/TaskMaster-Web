class IntegrationView {
  constructor(app) {
    this.app = app;
    this.google = document.getElementById('connect-google');
    this.microsoft = document.getElementById('connect-microsoft');
    this.gmail = document.getElementById('use-gmail');
    this.gmailCompose = document.getElementById('gmail-compose');
    this.google?.addEventListener('click', () => this.connect('google'));
    this.microsoft?.addEventListener('click', () => this.connect('microsoft'));
    this.gmail?.addEventListener('click', () => this.openGmailComposer());
    this.gmailCompose?.addEventListener('submit', event => this.sendGmail(event));
    document.getElementById('close-gmail-compose')?.addEventListener('click', () => {
      this.gmailCompose.hidden = true;
    });
  }
  connect(provider) {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const button = provider === 'google' ? this.google : this.microsoft;
    const providerName = provider === 'google' ? 'Google' : 'Microsoft';
    if (button) {
      button.disabled = true;
      button.textContent = `Abriendo ${providerName}…`;
    }
    window.location.assign(`/api/integrations/${provider}/start`);
  }
  async refresh() {
    const notice = document.getElementById('integration-auth-notice');
    if (this.app.accessMode !== 'authenticated') {
      if (notice) notice.textContent = 'Inicia sesión para vincular servicios. También puedes abrir sus aplicaciones oficiales sin conceder permisos a TaskMaster.';
      return;
    }
    if (notice) notice.textContent = 'Estamos comprobando tus conexiones…';
    try {
      const response = await fetch('/api/integrations/status', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error('No pudimos comprobar tus conexiones en este momento.');
      this._render('google', data.google);
      this._render('microsoft', data.microsoft);
      this._renderService('drive', data.google);
      this._renderService('classroom', data.google);
      this._renderService('gmail', data.google);
      this._renderService('teams', data.microsoft);
      if (notice) notice.textContent = data.google || data.microsoft
        ? 'Tus servicios vinculados están listos. Puedes volver a autorizar una cuenta cuando necesites cambiar permisos.'
        : 'Todavía no has vinculado servicios. Puedes abrirlos directamente o vincularlos para trabajar desde TaskMaster.';
    } catch (error) {
      console.warn('No se pudo consultar integraciones', error);
      if (notice) notice.textContent = 'No pudimos comprobar tus conexiones. Revisa tu conexión a internet y vuelve a abrir esta sección.';
    }
  }
  _render(provider, connected) {
    const status = document.getElementById(`${provider}-status`);
    const button = provider === 'google' ? this.google : this.microsoft;
    if (status) { status.textContent = connected ? 'Vinculada' : 'Sin vincular'; status.classList.toggle('integration-status--available', connected); }
    if (button) button.textContent = connected ? 'Volver a vincular' : 'Vincular con TaskMaster';
  }

  _renderService(service, connected) {
    const status = document.getElementById(`${service}-status`);
    if (status) {
      status.textContent = connected ? 'Vinculada' : 'Acceso externo';
      status.classList.toggle('integration-status--available', connected);
    }
    const button = document.getElementById(`use-${service}`);
    if (button?.tagName === 'BUTTON') button.disabled = !connected;
  }

  openGmailComposer() {
    if (this.gmail?.disabled) return;
    this.gmailCompose.hidden = false;
    document.getElementById('gmail-to')?.focus();
    this.gmailCompose.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async sendGmail(event) {
    event.preventDefault();
    const submit = document.getElementById('send-gmail');
    const payload = {
      to: document.getElementById('gmail-to').value.trim(),
      subject: document.getElementById('gmail-subject').value.trim(),
      message: document.getElementById('gmail-message').value.trim(),
    };
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    try {
      const response = await fetch('/api/integrations/google/gmail/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo enviar el correo.');
      this.gmailCompose.reset();
      this.gmailCompose.hidden = true;
      this.app.showToast('Correo enviado con Gmail', 'success');
    } catch (error) {
      this.app.showToast(error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enviar con Gmail';
    }
  }
}
