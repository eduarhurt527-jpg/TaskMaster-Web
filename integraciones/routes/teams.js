import express from 'express';
import { obtenerAccessToken } from '../lib/microsoftOAuth.js';
import { db } from '../lib/firestore.js';

const router = express.Router();

async function graphGet(path, accessToken) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Error de Microsoft Graph en ${path}`);
  return data;
}

router.get('/api/microsoft/teams/equipos', async (req, res) => {
  try {
    const accessToken = await obtenerAccessToken(req.user.id);
    const data = await graphGet('/me/joinedTeams?$select=id,displayName', accessToken);
    res.json({ success: true, equipos: data.value || [] });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

router.get('/api/microsoft/teams/canales', async (req, res) => {
  try {
    const { equipo_id } = req.query;
    if (!equipo_id) return res.status(400).json({ success: false, error: 'equipo_id es obligatorio.' });
    const accessToken = await obtenerAccessToken(req.user.id);
    const data = await graphGet(`/teams/${equipo_id}/channels?$select=id,displayName`, accessToken);
    res.json({ success: true, canales: data.value || [] });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

router.post('/api/microsoft/teams/mensaje', async (req, res) => {
  try {
    const { tarea_id, equipo_id, canal_id } = req.body;
    if (!tarea_id || !equipo_id || !canal_id) {
      return res.status(400).json({ success: false, error: 'tarea_id, equipo_id y canal_id son obligatorios.' });
    }

    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const data = await r.json();
    const tarea = (data.tareas || []).find(t => Number(t.id) === Number(tarea_id));
    if (!tarea) return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });

    const accessToken = await obtenerAccessToken(req.user.id);
    const mres = await fetch(`https://graph.microsoft.com/v1.0/teams/${equipo_id}/channels/${canal_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          contentType: 'html',
          content: `<strong>📌 Tarea: ${tarea.titulo}</strong><br>Prioridad: ${tarea.prioridad}<br>Vence: ${new Date(tarea.fecha_limite).toLocaleString('es-EC')}<br>${tarea.descripcion || ''}`,
        },
      }),
    });
    const mdata = await mres.json();
    if (!mres.ok) throw new Error(mdata.error?.message || 'Error enviando mensaje a Teams');

    await db.collection('int_teams_log').add({
      tarea_id: Number(tarea_id),
      usuario_id: Number(req.user.id),
      equipo_id,
      canal_id,
      mensaje_id: mdata.id,
      fecha: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('TEAMS ERROR:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

export default router;
