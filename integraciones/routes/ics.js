import express from 'express';
import { generarICS } from '../lib/icsBuilder.js';

const router = express.Router();

router.get('/ics', async (req, res) => {
  try {
    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const data = await r.json();
    if (!r.ok || !data.success) {
      return res.status(502).json({ success: false, error: 'No se pudo leer la app principal.' });
    }

    let tareas = data.tareas || [];
    if (req.query.tarea_id) {
      tareas = tareas.filter(t => Number(t.id) === Number(req.query.tarea_id));
      if (!tareas.length) {
        return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });
      }
    }

    const ics = generarICS(tareas);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="taskmaster-${req.query.tarea_id || 'todas'}.ics"`);
    res.send(ics);
  } catch (error) {
    res.status(502).json({ success: false, error: 'No se pudo conectar con la app principal: ' + error.message });
  }
});

export default router;
