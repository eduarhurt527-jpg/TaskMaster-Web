/* Preferencias locales de presentación; no almacena datos de la cuenta. */
class Preferences {
  constructor() {
    const defaults = { theme: 'system', language: 'es', density: 'comfortable', motion: false, focus: 25, break: 5, alerts: true };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('tm_preferences') || '{}') || {}; } catch (_) { /* datos antiguos inválidos */ }
    this.values = { ...defaults, ...saved };
    this.translations = {
      preferences: 'PREFERENCES', settings: 'Settings', settingsIntro: 'Customize TaskMaster to work your way.',
      appearance: 'Appearance and language', theme: 'Theme', system: 'Automatic (system)', light: 'Light', dark: 'Dark',
      language: 'Language', density: 'Density', comfortable: 'Comfortable', compact: 'Compact', motion: 'Reduce animations',
      focus: 'Focus and reminders', focusMinutes: 'Focus duration', breakMinutes: 'Break duration',
      timerHelp: 'New durations take effect when the timer resets.', alerts: 'Task reminders and notifications',
      alertsHelp: 'Your browser may request permission to show timer notifications.', privacy: 'Session privacy',
      privacyHelp: 'Sign out when finished, especially on a shared device. Preferences are saved in this browser.',
      publicPage: 'View public page'
    };
    this.ui = {
      'Inicio': 'Home', 'Mi Panel': 'My dashboard', 'Mi panel': 'My dashboard', 'Mis tareas': 'My tasks',
      'Calendario': 'Calendar', 'Integraciones': 'Integrations', 'Archivos': 'Files', 'Grabaciones': 'Recordings',
      'Configuración': 'Settings', 'Cerrar sesión': 'Sign out', 'Nueva tarea': 'New task',
      'Bienvenido': 'Welcome', 'Modo invitado': 'Guest mode', 'Cuenta sincronizada': 'Synced account',
      'Iniciar sesión': 'Sign in', 'Registrarse': 'Sign up', 'Iniciar con Google': 'Continue with Google',
      'TAREAS TOTALES': 'TOTAL TASKS', 'URGENTES': 'URGENT', 'COMPLETADAS HOY': 'COMPLETED TODAY',
      'Filtra tu día': 'Filter your day', 'Todas': 'All', 'Urgentes': 'Urgent', 'Tareas': 'Tasks',
      'Totales': 'Total', 'Completadas hoy': 'Completed today', 'Carga semanal': 'Weekly workload',
      'Ver carga': 'View workload', 'Ritmo y carga': 'Pace and workload', 'VISIÓN SEMANAL': 'WEEKLY OVERVIEW',
      'Carga por día': 'Daily workload', 'Enfoque': 'Focus', 'Avance por categoría': 'Progress by category',
      'INTEGRACIONES': 'INTEGRATIONS', 'Administrar conexiones': 'Manage connections',
      'CONTACTO': 'CONTACT', 'Contacto y sugerencias': 'Contact and suggestions',
      'Abrir una consulta ↗': 'Open a request ↗',
      '¿Encontraste un problema o tienes una idea? Envíanos tu consulta desde el repositorio del proyecto.':
        'Found a problem or have an idea? Send your request through the project repository.',
      'Describe tu consulta para que el equipo pueda revisarla.': 'Describe your request so the team can review it.',
      '¿Tienes una pregunta sobre TaskMaster?': 'Have a question about TaskMaster?'
    };
    this.originals = new WeakMap();
    this.apply();
    this.bind();
  }

  bind() {
    for (const key of ['theme', 'language', 'density', 'focus', 'break', 'motion', 'alerts']) {
      const element = document.getElementById(`setting-${key}`);
      if (!element) continue;
      element.checked = Boolean(this.values[key]);
      if (element.type !== 'checkbox') element.value = String(this.values[key]);
      element.addEventListener('change', () => {
        this.values[key] = element.type === 'checkbox' ? element.checked :
          ['focus', 'break'].includes(key) ? Number(element.value) : element.value;
        localStorage.setItem('tm_preferences', JSON.stringify(this.values));
        this.apply();
      });
    }
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.apply());
  }

  apply() {
    const v = this.values;
    document.documentElement.dataset.theme = v.theme === 'system' ?
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : v.theme;
    document.documentElement.dataset.density = v.density;
    document.documentElement.dataset.reduceMotion = String(v.motion);
    document.documentElement.lang = v.language;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (!this.originals.has(el)) this.originals.set(el, el.textContent);
      el.textContent = v.language === 'en' ? this.translations[el.dataset.i18n] || this.originals.get(el) : this.originals.get(el);
    });
    // Textos de navegación y títulos conocidos; no se recorren tareas ni contenido del usuario.
    document.querySelectorAll('.sidebar-link b, .header-nav button, .public-nav a, .header-summary .stat-label, #access-badge, #header-welcome, .contact-section h2, .contact-section p, .contact-section h3, .contact-section a, .dashboard-header h2, .dashboard-card h3').forEach(el => {
      const current = el.textContent.trim();
      if (!this.originals.has(el) && this.ui[current]) this.originals.set(el, current);
      const original = this.originals.get(el);
      if (original) el.textContent = v.language === 'en' ? this.ui[original] || original : original;
    });
  }
}
