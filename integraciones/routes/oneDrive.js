import express from 'express';
import { obtenerAccessToken } from '../lib/microsoftOAuth.js';
import { db } from '../lib/firestore.js';

const router = express.Router();

// Codifica una URL para usar el endpoint /shares/{shareId} de Microsoft Graph
// https://learn.microsoft.com/graph/api/shares-get
function codificarShareId(url) {
  const base64 = Buffer.from(url, 'utf-8').toString('base64');
  const base64url = base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
  return 'u!' + base64url;
}

router.post('/api/microsoft/onedrive/vincular', async (req, res) => {
  try {
    const { tarea_id, url } = req.body;
    if (!tarea_id || !url) return res.status(400).json({ success: false, error: 'tarea_id y url son obligatorios.' });

    const accessToken = await obtenerAccessToken(req.user.id);
    const shareId = codificarShareId(url);

    const gres = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem?$select=name,webUrl`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const gdata = await gres.json();
    if (!gres.ok) throw new Error(gdata.error?.message || 'No se pudo acceder al archivo (¿tienes permiso sobre él?).');

    const adjunto = {
      tarea_id: Number(tarea_id),
      proveedor: 'onedrive',
      nombre: gdata.name,
      url: gdata.webUrl,
      icono: null,
      fecha: new Date().toISOString(),
    };
    const ref = await db.collection('int_adjuntos').add(adjunto);

    res.json({ success: true, adjunto: { id: ref.id, ...adjunto } });
  } catch (error) {
    console.error('ONEDRIVE ERROR:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

export default router;
