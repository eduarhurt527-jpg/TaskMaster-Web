import express from 'express';
import { obtenerAccessToken } from '../lib/googleOAuth.js';
import { db } from '../lib/firestore.js';

const router = express.Router();

router.post('/api/google/calendar/evento', async (req, res) => {
  try {
    const { tarea_id } = req.body;
    if (!tarea_id) return res.status(400).json({ success: false, error: 'tarea_id es obligatorio.' });

    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const data = await r.json();
    const tarea = (data.tareas || []).find(t => Number(t.id) === Number(tarea_id));
    if (!tarea) return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });

    const accessToken = await obtenerAccessToken(req.user.id);

    const inicio = new Date(tarea.fecha_limite);
    const fin = new Date(inicio.getTime() + 30 * 60 * 1000);

    const evento = {
      summary: tarea.titulo,
      description: tarea.descripcion || '',
      start: { dateTime: inicio.toISOString() },
      end: { dateTime: fin.toISOString() },
    };

    const gres = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(evento),
    });
    const gdata = await gres.json();

    if (!gres.ok) {
      throw new Error(gdata.error?.message || 'Error creando evento en Google Calendar');
    }

    await db.collection('int_calendar_log').add({
      tarea_id: Number(tarea_id),
      evento_id: gdata.id,
      link: gdata.htmlLink,
      fecha: new Date().toISOString(),
    });

    res.json({ success: true, link: gdata.htmlLink });
  } catch (error) {
    console.error('GOOGLE CALENDAR ERROR:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

export default router;
