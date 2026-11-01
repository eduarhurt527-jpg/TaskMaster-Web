import express from 'express';
import { db } from '../lib/firestore.js';
import { enviarEmail } from '../lib/brevo.js';

const router = express.Router();

router.post('/email/recordatorio', async (req, res) => {
  try {
    const { tarea_id, email, nombre } = req.body;
    if (!tarea_id || !email) {
      return res.status(400).json({ success: false, error: 'tarea_id y email son obligatorios.' });
    }

    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const data = await r.json();
    const tarea = (data.tareas || []).find(t => Number(t.id) === Number(tarea_id));
    if (!tarea) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada en la app principal.' });
    }

    const asunto = `Recordatorio: ${tarea.titulo}`;
    const mensaje = `Tu tarea "${tarea.titulo}" (prioridad ${tarea.prioridad}) vence el ${new Date(tarea.fecha_limite).toLocaleString('es-EC')}.\n\n${tarea.descripcion || ''}`;

    const resultado = await enviarEmail({ destinatarioEmail: email, destinatarioNombre: nombre, asunto, mensaje });

    await db.collection('int_notificaciones_log').add({
      tarea_id: Number(tarea_id),
      usuario_id: Number(req.user.id),
      email,
      asunto,
      estado: resultado.success ? 'enviado' : 'error',
      error: resultado.success ? null : resultado.error,
      fecha_envio: new Date().toISOString(),
    });

    if (!resultado.success) {
      return res.status(502).json({ success: false, error: resultado.error });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
