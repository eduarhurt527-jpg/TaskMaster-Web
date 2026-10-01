const $statusEl = document.getElementById('status-conexion');

let tareas = [];

function poblarSelects(ids) {
  const opciones = tareas.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opciones || '<option value="">Sin tareas</option>';
  });
}

async function cargarTareas() {
  try {
    const res = await fetch('/api/tareas-espejo');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error desconocido');

    tareas = data.tareas || [];
    $statusEl.textContent = `✅ Conectado — ${tareas.length} tarea(s) encontradas en la app principal.`;
    $statusEl.className = 'status status--ok';

    poblarSelects(['select-tarea-email', 'select-tarea-calendar', 'select-tarea-drive', 'select-tarea-onedrive', 'select-tarea-teams']);

    const opciones = tareas.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('');
    document.getElementById('select-tarea-ics').innerHTML = '<option value="">Todas las tareas</option>' + opciones;
  } catch (e) {
    $statusEl.textContent = '❌ No se pudo conectar con la app principal (¿está corriendo npm start en el puerto 3000?): ' + e.message;
    $statusEl.className = 'status status--error';
  }
}

// ── Estado de cuentas conectadas ───────────────────────────────────────────

async function actualizarEstadoCuentas() {
  try {
    const [g, m] = await Promise.all([
      fetch('/api/google/estado').then(r => r.json()),
      fetch('/api/microsoft/estado').then(r => r.json()),
    ]);
    marcarCuenta('google', g.conectado);
    marcarCuenta('microsoft', m.conectado);
  } catch (e) {
    console.warn('No se pudo verificar el estado de las cuentas', e);
  }
}

function marcarCuenta(proveedor, conectado) {
  const estadoEl = document.getElementById(`estado-${proveedor}`);
  const btnEl = document.getElementById(`btn-conectar-${proveedor}`);
  const disconnectEl = document.getElementById(`btn-desconectar-${proveedor}`);
  if (conectado) {
    estadoEl.textContent = '✅ Conectado';
    estadoEl.className = 'cuenta__estado cuenta__estado--ok';
    btnEl.textContent = 'Reconectar';
  } else {
    estadoEl.textContent = 'No conectado';
    estadoEl.className = 'cuenta__estado';
    btnEl.textContent = 'Conectar';
  }
  if (disconnectEl) disconnectEl.hidden = !conectado;
  document.querySelectorAll(`[data-requiere="${proveedor}"]`).forEach(card => {
    card.classList.toggle('habilitada', conectado);
  });
}

['google', 'microsoft'].forEach(proveedor => {
  document.getElementById(`btn-desconectar-${proveedor}`)?.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/${proveedor}/desconectar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo desconectar.');
      await actualizarEstadoCuentas();
    } catch (error) {
      $statusEl.textContent = `❌ ${error.message}`;
      $statusEl.className = 'status status--error';
    }
  });
});

function mostrarResultado(id, ok, mensaje) {
  const el = document.getElementById(id);
  el.textContent = (ok ? '✅ ' : '❌ ') + mensaje;
  el.className = 'card__result ' + (ok ? 'card__result--ok' : 'card__result--error');
}

// ── Google Calendar ──────────────────────────────────────────────────────

document.getElementById('btn-crear-evento').addEventListener('click', async () => {
  const tarea_id = document.getElementById('select-tarea-calendar').value;
  if (!tarea_id) return mostrarResultado('resultado-calendar', false, 'Elige una tarea.');
  try {
    const res = await fetch('/api/google/calendar/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    mostrarResultado('resultado-calendar', true, `Evento creado. `);
    document.getElementById('resultado-calendar').innerHTML += `<a href="${data.link}" target="_blank" style="color:var(--accent-start)">Verlo en Google Calendar</a>`;
  } catch (e) {
    mostrarResultado('resultado-calendar', false, e.message);
  }
});

// ── Google Drive ─────────────────────────────────────────────────────────

document.getElementById('btn-vincular-drive').addEventListener('click', async () => {
  const tarea_id = document.getElementById('select-tarea-drive').value;
  const url = document.getElementById('input-drive-url').value.trim();
  if (!tarea_id || !url) return mostrarResultado('resultado-drive', false, 'Elige una tarea y pega un link.');
  try {
    const res = await fetch('/api/google/drive/vincular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id, url }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    mostrarResultado('resultado-drive', true, `Vinculado: ${data.adjunto.nombre}`);
  } catch (e) {
    mostrarResultado('resultado-drive', false, e.message);
  }
});

// ── OneDrive ─────────────────────────────────────────────────────────────

document.getElementById('btn-vincular-onedrive').addEventListener('click', async () => {
  const tarea_id = document.getElementById('select-tarea-onedrive').value;
  const url = document.getElementById('input-onedrive-url').value.trim();
  if (!tarea_id || !url) return mostrarResultado('resultado-onedrive', false, 'Elige una tarea y pega un link.');
  try {
    const res = await fetch('/api/microsoft/onedrive/vincular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id, url }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    mostrarResultado('resultado-onedrive', true, `Vinculado: ${data.adjunto.nombre}`);
  } catch (e) {
    mostrarResultado('resultado-onedrive', false, e.message);
  }
});

// ── Google Classroom ─────────────────────────────────────────────────────

async function cargarCursosClassroom() {
  try {
    const res = await fetch('/api/google/classroom/cursos');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    const sel = document.getElementById('select-curso-classroom');
    sel.innerHTML = data.cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('') || '<option value="">Sin cursos</option>';
  } catch (e) {
    // silencioso hasta que el usuario conecte Google
  }
}

document.getElementById('btn-cargar-classroom').addEventListener('click', async () => {
  const curso_id = document.getElementById('select-curso-classroom').value;
  const $lista = document.getElementById('lista-classroom');
  if (!curso_id) return mostrarResultado('resultado-classroom', false, 'Elige un curso.');
  try {
    const res = await fetch(`/api/google/classroom/tareas?curso_id=${curso_id}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);

    $lista.innerHTML = data.tareas.map((t, i) => `
      <div class="classroom-item">
        <span>${t.titulo}</span>
        <button class="btn btn--small btn--primary" data-idx="${i}">Importar</button>
      </div>
    `).join('') || '<p class="card__desc">Sin tareas en este curso.</p>';

    $lista.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = data.tareas[Number(btn.dataset.idx)];
        try {
          const r = await fetch('/api/google/classroom/importar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: t.titulo, descripcion: t.descripcion, fecha_limite: t.fecha_limite }),
          });
          const d = await r.json();
          if (!r.ok || !d.success) throw new Error(d.error);
          btn.textContent = 'Importada ✓';
          btn.disabled = true;
          cargarTareas();
        } catch (e) {
          mostrarResultado('resultado-classroom', false, e.message);
        }
      });
    });
    mostrarResultado('resultado-classroom', true, `${data.tareas.length} tarea(s) encontradas.`);
  } catch (e) {
    mostrarResultado('resultado-classroom', false, e.message);
  }
});

// ── Microsoft Teams ──────────────────────────────────────────────────────

async function cargarEquiposTeams() {
  try {
    const res = await fetch('/api/microsoft/teams/equipos');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    const sel = document.getElementById('select-equipo-teams');
    sel.innerHTML = data.equipos.map(e => `<option value="${e.id}">${e.displayName}</option>`).join('') || '<option value="">Sin equipos</option>';
    if (data.equipos.length) cargarCanalesTeams(data.equipos[0].id);
  } catch (e) {
    // silencioso hasta que el usuario conecte Microsoft
  }
}

async function cargarCanalesTeams(equipo_id) {
  try {
    const res = await fetch(`/api/microsoft/teams/canales?equipo_id=${equipo_id}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    const sel = document.getElementById('select-canal-teams');
    sel.innerHTML = data.canales.map(c => `<option value="${c.id}">${c.displayName}</option>`).join('') || '<option value="">Sin canales</option>';
  } catch (e) {
    mostrarResultado('resultado-teams', false, e.message);
  }
}

document.getElementById('select-equipo-teams').addEventListener('change', e => {
  if (e.target.value) cargarCanalesTeams(e.target.value);
});

document.getElementById('btn-enviar-teams').addEventListener('click', async () => {
  const tarea_id = document.getElementById('select-tarea-teams').value;
  const equipo_id = document.getElementById('select-equipo-teams').value;
  const canal_id = document.getElementById('select-canal-teams').value;
  if (!tarea_id || !equipo_id || !canal_id) return mostrarResultado('resultado-teams', false, 'Elige tarea, equipo y canal.');
  try {
    const res = await fetch('/api/microsoft/teams/mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id, equipo_id, canal_id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error);
    mostrarResultado('resultado-teams', true, 'Mensaje enviado al canal.');
  } catch (e) {
    mostrarResultado('resultado-teams', false, e.message);
  }
});

// ── Brevo (Fase 1) ───────────────────────────────────────────────────────

document.getElementById('btn-enviar-email').addEventListener('click', async () => {
  const tarea_id = document.getElementById('select-tarea-email').value;
  const email = document.getElementById('input-email').value.trim();
  if (!tarea_id || !email) return mostrarResultado('resultado-email', false, 'Elige una tarea e introduce un correo.');
  try {
    const res = await fetch('/api/email/recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id, email }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error al enviar.');
    mostrarResultado('resultado-email', true, 'Recordatorio enviado.');
  } catch (e) {
    mostrarResultado('resultado-email', false, e.message);
  }
});

// ── Exportar .ics (Fase 1) ───────────────────────────────────────────────

document.getElementById('btn-exportar-ics').addEventListener('click', () => {
  const tarea_id = document.getElementById('select-tarea-ics').value;
  const url = tarea_id ? `/api/ics?tarea_id=${tarea_id}` : '/api/ics';
  window.location.href = url;
  mostrarResultado('resultado-ics', true, 'Descarga iniciada.');
});

// ── Inicio ───────────────────────────────────────────────────────────────

async function init() {
  await cargarTareas();
  await actualizarEstadoCuentas();
  cargarCursosClassroom();
  cargarEquiposTeams();

  const params = new URLSearchParams(window.location.search);
  if (params.get('conectado')) {
    actualizarEstadoCuentas();
    cargarCursosClassroom();
    cargarEquiposTeams();
    window.history.replaceState({}, '', window.location.pathname);
  }
}

init();
