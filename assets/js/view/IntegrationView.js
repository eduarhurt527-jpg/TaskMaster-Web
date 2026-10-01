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
    document.querySelectorAll('[data-integration-query]').forEach(button => {
      button.addEventListener('click', () => this.queryService(button));
    });
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
    const accountType = document.getElementById('microsoft-account-type')?.value || 'personal';
    window.location.assign(`/api/integrations/${provider}/start${provider === 'microsoft' ? `?account_type=${encodeURIComponent(accountType)}` : ''}`);
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
      const data = await taskMasterApi.request(`/api/integrations/${provider}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }, 'integration');
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
      const data = await taskMasterApi.request('/api/integrations/status', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }, 'integration');

      for (const provider of ['google', 'youtube', 'microsoft']) {
        const connection = data.connections?.[provider];
        this._render(provider, connection ? connection.connected === true : Boolean(data[provider]), connection?.state);
      }
      this._renderService('drive', Boolean(data.google));
      this._renderService('classroom', Boolean(data.google));
      this._renderService('gmail', Boolean(data.google));
      this._renderService('teams', Boolean(data.microsoft));
      document.querySelectorAll('[data-integration-query]').forEach(button => {
        button.disabled = !data[button.dataset.provider];
      });

      if (!data.google) this.closeGmailComposer();
      const needsAttention = Object.values(data.connections || {}).some(connection => ['unavailable', 'reconnect'].includes(connection.state));
      if (notice) notice.textContent = needsAttention
        ? 'Una o más conexiones necesitan revisión. Las demás se muestran por separado. Si la conexión no se puede comprobar, inténtalo más tarde; si caducó, vuelve a vincularla.'
        : data.google || data.youtube || data.microsoft
        ? 'Estas cuentas están vinculadas. Si una función pide permisos adicionales, vuelve a autorizar esa cuenta.'
        : 'Todavía no has vinculado servicios. Puedes abrirlos directamente o vincularlos para trabajar desde TaskMaster.';
    } catch (error) {
      console.warn('No se pudo consultar integraciones', error);
      if (error.status === 401) {
        this._reset();
        if (notice) notice.textContent = 'Tu sesión terminó. Inicia sesión nuevamente para consultar tus conexiones.';
        return;
      }
      for (const provider of ['google', 'youtube', 'microsoft']) this._render(provider, false, 'unavailable');
      document.querySelectorAll('[data-integration-query]').forEach(button => { button.disabled = true; });
      this.closeGmailComposer();
      if (this.gmail) this.gmail.disabled = true;
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
    document.querySelectorAll('[data-integration-query]').forEach(button => { button.disabled = true; });
    const results = document.getElementById('integration-results');
    if (results) { results.hidden = true; results.replaceChildren(); }
  }

  _render(provider, connected, state = '') {
    const status = document.getElementById(`${provider}-status`);
    const connectButton = this._providerButton(provider);
    const disconnectButton = document.getElementById(`disconnect-${provider}`);

    if (status) {
      status.textContent = state === 'unavailable' ? 'No se pudo comprobar' : state === 'reconnect' ? 'Vuelve a vincular' : connected ? 'Vinculada' : 'Sin vincular';
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
      status.textContent = connected ? 'Cuenta vinculada' : 'Acceso externo';
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
    if (this._sending) return;
    const submit = document.getElementById('send-gmail');
    const payload = {
      to: document.getElementById('gmail-to').value.trim(),
      subject: document.getElementById('gmail-subject').value.trim(),
      message: document.getElementById('gmail-message').value.trim(),
    };

    this._sending = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Enviando…';
    try {
      const data = await taskMasterApi.request('/api/integrations/google/gmail/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      }, 'integration');

      this.gmailCompose.reset();
      this.closeGmailComposer();
      this.app.showToast('Correo enviado con Gmail', 'success');
    } catch (error) {
      if (error.status === 409) await this.refresh();
      this.app.showToast(error.message || 'No se pudo enviar el correo.', 'error');
    } finally {
      this._sending = false;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Enviar con Gmail';
    }
  }

  async _readJson(response) {
    return taskMasterApi.readJson(response, 'integration');
  }

  async queryService(button) {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const services = {
      calendar: { route: '/api/integrations/google/calendar/events', key: 'events', name: 'Google Calendar' },
      classroom: { route: '/api/integrations/google/classroom/courses', key: 'courses', name: 'Google Classroom' },
      microsoft_calendar: { route: '/api/integrations/microsoft/calendar/events', key: 'events', name: 'Calendario de Microsoft' },
      teams: { route: '/api/integrations/microsoft/teams', key: 'teams', name: 'Microsoft Teams' }
    };
    const service = services[button.dataset.integrationQuery];
    if (!service || button.disabled) return;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Consultando…';
    button.setAttribute('aria-busy', 'true');
    const results = document.getElementById('integration-results');
    try {
      const data = await taskMasterApi.request(service.route, {}, 'integration');
      if (!Array.isArray(data[service.key])) throw new Error('No pudimos mostrar la información. Inténtalo nuevamente.');
      if (results) {
        results.replaceChildren();
        const heading = document.createElement('h3'); heading.textContent = service.name; results.appendChild(heading);
        const list = document.createElement('ul');
        for (const item of data[service.key]) {
          const row = document.createElement('li');
          row.textContent = item.name || item.summary || item.subject || item.displayName || 'Sin título';
          list.appendChild(row);
        }
        if (!list.children.length) { const row=document.createElement('li'); row.textContent='No hay elementos para mostrar en esta cuenta.'; list.appendChild(row); }
        results.appendChild(list); results.hidden=false;
      }
    } catch (error) {
      this.app.showToast(error.message, 'error');
      if (results) { results.replaceChildren(); results.textContent=error.message; results.hidden=false; }
    } finally {
      button.disabled=false; button.textContent=originalLabel; button.removeAttribute('aria-busy');
    }
  }
}
