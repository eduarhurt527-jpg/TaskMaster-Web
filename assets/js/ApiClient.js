/** Respuestas de la aplicación: mensajes comprensibles y diagnóstico sin secretos. */
const taskMasterApi = {
  async readJson(response, context = 'general') {
    const status = response.status;
    let data;
    try {
      const text = await response.text();
      if ((response.headers.get('content-type') || '').includes('application/json') && text.trim()) data = JSON.parse(text);
    } catch (_) { /* La respuesta dañada se explica con un mensaje seguro. */ }
    const messages = {
      401: context === 'login' ? 'El correo o la contraseña no coinciden. Revísalos e inténtalo nuevamente.' : 'Tu sesión terminó. Inicia sesión nuevamente.',
      403: 'No tienes permiso para realizar esta acción. Revisa los permisos de la cuenta vinculada.',
      413: 'El archivo supera el tamaño permitido. Selecciona uno más pequeño.',
      429: 'Has realizado varios intentos seguidos. Espera unos minutos y vuelve a intentarlo.'
    };
    if (!response.ok || !data || typeof data.success !== 'boolean' || !data.success) {
      console.warn('TaskMaster: solicitud fallida', { status, context });
      const safeMessage = typeof data?.error === 'string' && data.error.length <= 300 && !/[<>]/.test(data.error) ? data.error : '';
      const message = status >= 500
        ? 'El servicio no está disponible en este momento. Inténtalo nuevamente más tarde.'
        : messages[status] || safeMessage || 'No pudimos completar la solicitud. Inténtalo nuevamente.';
      throw Object.assign(new Error(message), { status });
    }
    return data;
  },
  async request(url, options = {}, context = 'general') {
    let response;
    try {
      response = await fetch(url, { ...options, credentials: 'include', headers: { Accept: 'application/json', ...options.headers } });
    } catch (_) {
      throw new Error('No pudimos conectar. Revisa tu conexión a Internet e inténtalo nuevamente.');
    }
    return this.readJson(response, context);
  }
};
