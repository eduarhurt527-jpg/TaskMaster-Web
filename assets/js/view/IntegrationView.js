class IntegrationView {
  constructor(app) {
    this.app = app;
    this.google = document.getElementById('connect-google');
    this.youtube = document.getElementById('connect-youtube');
    this.microsoft = document.getElementById('connect-microsoft');
    this.gmail = document.getElementById('use-gmail');
    this.gmailCompose = document.getElementById('gmail-compose');

    this.google?.addEventListener('click', () => this.connect('google'));
    this.youtube?.addEventListener('click', () => this.connect('youtube'));
    this.microsoft?.addEventListener('click', () => this.connect('microsoft'));
    document.getElementById('disconnect-google')?.addEventListener('click', () => this.disconnect('google'));
    document.getElementById('disconnect-youtube')?.addEventListener('click', () => this.disconnect('youtube'));
    document.getElementById('disconnect-microsoft')?.addEventListener('click', () => this.disconnect('microsoft'));
    this.gmail?.addEventListener('click', () => this.openGmailComposer());
    this.gmailCompose?.addEventListener('submit', event => this.sendGmail(event));
    document.getElementById('close-gmail-compose')?.addEventListener('click', () => this.closeGmailComposer());
  }

  _providerButton(provider) {
    return { google: this.google, youtube: this.youtube, microsoft: this.microsoft }[provider];
  }

  _providerName(provider) {
    return { google: 'Google Workspace', youtube: 'YouTube', microsoft: 'Microsoft 365' }[provider] || provider;
  }

  connect(provider) {
    if (this.app.accessMode !== 'authenticated') {
      this.app.showToast('Inicia sesión para vincular este servicio.', 'warning');
      return this.app.authView.openMode('login');
    }
    const button = this._providerButton(provider);
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = `Abriendo ${this._providerName(provider)}…`;
    }
    window.location.assign(`/api/integrations/${provider}/start`);
  }

  async disconnect(provider) {
    if (this.app.accessMode !== 'authenticated') {
      this.app.showToast('Tu sesión terminó. Inicia sesión nuevamente.', 'warning');
      return this.app.authView.openMode('login');
    }

    const button = document.getElementById(`disconnect-${provider}`);
    const providerName = this._providerName(provider);
    if (!window.confirm(`¿Desconectar ${providerName} de TaskMaster? Dejarás de usar sus funciones dentro de la aplicación.`)) return;

    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Desconectando…';
    }

    try {
      const response = await fetch(`/api/integrations/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await this._readJson(response);
      if (response.status === 401) {
        this.app.showToast('Tu sesión terminó. Inicia sesión nuevamente.', 'warning');
        await this.app.authView.logout();
        return;
      }
      if (!response.ok) throw new Error(data.error || `No se pudo desconectar ${providerName}.`);
      this.closeGmailComposer();
      await this.refresh();
      this.app.showToast(`${providerName} se desconectó correctamente`, 'success');
    } catch (error) {
      this.app.showToast(error.message || `No se pudo desconectar ${providerName}.`, 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = 'Desconectar';
      }
    }
  }

  async refresh() {
    const notice = document.getElementById('integration-auth-notice');
    if (this.app.accessMode !== 'authenticated') {
      this._reset();
      if (notice) notice.textContent = 'Inicia sesión para vincular servicios. También puedes abrir sus aplicaciones oficiales sin conceder permisos a TaskMaster.';
      return;
    }

    if (notice) notice.textContent = 'Estamos comprobando tus conexiones…';
    try {
      const response = await fetch('/api/integrations/status', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const data = await this._readJson(response);
      if (response.status === 401) {
        this._reset();
        if (notice) notice.textContent = 'Tu sesión terminó. Inicia sesión nuevamente para consultar tus conexiones.';
        return;
      }
      if (!response.ok) throw new Error(data.error || 'No pudimos comprobar tus conexiones en este momento.');

      this._render('google', Boolean(data.google));
      this._render('youtube', Boolean(data.youtube));
      this._render('microsoft', Boolean(data.microsoft));
      this._renderService('drive', Boolean(data.google));
      this._renderService('classroom', Boolean(data.google));
      this._renderService('gmail', Boolean(data.google));
      this._renderService('teams', Boolean(data.microsoft));

      if (!data.google) this.closeGmailComposer();
      if (notice) notice.textContent = data.google || data.youtube || data.microsoft
        ? 'Tus servicios vinculados están listos. Puedes volver a autorizar o desconectar cada cuenta cuando lo necesites.'
        : 'Todavía no has vinculado servicios. Puedes abrirlos directamente o vincularlos para trabajar desde TaskMaster.';
    } catch (error) {
      console.warn('No se pudo consultar integraciones', error);
      this._reset();
      if (notice) notice.textContent = 'No pudimos comprobar tus conexiones. Revisa tu conexión e inténtalo nuevamente.';
      this.app.showToast(error.message || 'No se pudieron consultar las integraciones.', 'error');
    }
  }

  _reset() {
    this._render('google', false);
    this._render('youtube', false);
    this._render('microsoft', false);
    this._renderService('drive', false);
    this._renderService('classroom', false);
    this._renderService('gmail', false);
    this._renderService('teams', false);
    this.closeGmailComposer();
  }

  _render(provider, connected) {
    const status = document.getElementById(`${provider}-status`);
    const connectButton = this._providerButton(provider);
    const disconnectButton = document.getElementById(`disconnect-${provider}`);

    if (status) {
      status.textContent = connected ? 'Vinculada' : 'Sin vincular';
      status.classList.toggle('integration-status--available', connected);
    }
    if (connectButton) {
      connectButton.disabled = false;
      connectButton.removeAttribute('aria-busy');
      connectButton.textContent = connected
        ? 'Cambiar cuenta o permisos'
        : provider === 'youtube' ? 'Vincular YouTube' : 'Vincular con TaskMaster';
    }
    if (disconnectButton) {
      disconnectButton.hidden = !connected;
      disconnectButton.disabled = !connected;
    }
  }

  _renderService(service, connected) {
    const status = document.getElementById(`${service}-status`);
    if (status) {
      status.textContent = connected ? 'Disponible en TaskMaster' : 'Acceso externo';
      status.classList.toggle('integration-status--available', connected);
    }

    const button = document.getElementById(`use-${service}`);
    if (button?.tagName === 'BUTTON') {
      button.disabled = !connected;
      button.setAttribute('aria-disabled', String(!connected));
    }
  }

  closeGmailComposer() {
    if (!this.gmailCompose) return;
    this.gmailCompose.hidden = true;
  }

  openGmailComposer() {
    if (this.app.accessMode !== 'authenticated' || this.gmail?.disabled) {
      this.app.showToast('Vincula Google Workspace para enviar correo desde TaskMaster.', 'warning');
      return;
    }
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
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Enviando…';
    try {
      const response = await fetch('/api/integrations/google/gmail/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await this._readJson(response);
      if (response.status === 401) {
        throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
      }
      if (response.status === 409) {
        await this.refresh();
        throw new Error(data.error || 'Vincula Google Workspace nuevamente.');
      }
      if (!response.ok) throw new Error(data.error || 'No se pudo enviar el correo.');

      this.gmailCompose.reset();
      this.closeGmailComposer();
      this.app.showToast('Correo enviado con Gmail', 'success');
    } catch (error) {
      this.app.showToast(error.message || 'No se pudo enviar el correo.', 'error');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Enviar con Gmail';
    }
  }

  async _readJson(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('El servidor devolvió una respuesta inesperada.');
    }
    return response.json();
  }
}
