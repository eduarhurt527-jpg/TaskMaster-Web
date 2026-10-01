import express from 'express';
import { obtenerAccessToken } from '../lib/googleOAuth.js';
import { db } from '../lib/firestore.js';

const router = express.Router();

function extraerFileId(url) {
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

router.post('/api/google/drive/vincular', async (req, res) => {
  try {
    const { tarea_id, url } = req.body;
    if (!tarea_id || !url) return res.status(400).json({ success: false, error: 'tarea_id y url son obligatorios.' });

    const fileId = extraerFileId(url);
    if (!fileId) return res.status(400).json({ success: false, error: 'No se reconoce ese link de Google Drive.' });

    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const taskResponse = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const taskData = await taskResponse.json();
    const ownsTask = (taskData.tareas || []).some(t => Number(t.id) === Number(tarea_id));
    if (!taskResponse.ok || !ownsTask) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada para este usuario.' });
    }

    const accessToken = await obtenerAccessToken(req.user.id);
    const gres = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,iconLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const gdata = await gres.json();
    if (!gres.ok) throw new Error(gdata.error?.message || 'No se pudo acceder al archivo (¿tienes permiso sobre él?).');

    const adjunto = {
      tarea_id: Number(tarea_id),
      usuario_id: Number(req.user.id),
      proveedor: 'drive',
      nombre: gdata.name,
      url: gdata.webViewLink,
      icono: gdata.iconLink,
      fecha: new Date().toISOString(),
    };
    const ref = await db.collection('int_adjuntos').add(adjunto);

    res.json({ success: true, adjunto: { id: ref.id, ...adjunto } });
  } catch (error) {
    console.error('GOOGLE DRIVE ERROR:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

router.get('/api/adjuntos', async (req, res) => {
  try {
    const { tarea_id } = req.query;
    let q = db.collection('int_adjuntos').where('usuario_id', '==', Number(req.user.id));
    if (tarea_id) q = q.where('tarea_id', '==', Number(tarea_id));
    const snap = await q.get();
    const adjuntos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, adjuntos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
