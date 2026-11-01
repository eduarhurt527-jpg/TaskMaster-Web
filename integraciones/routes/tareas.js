import express from 'express';

const router = express.Router();

router.get('/tareas-espejo', async (req, res) => {
  try {
    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      headers: { Cookie: req.headers.cookie || '' },
    });
    const data = await r.json();
    if (!r.ok || !data.success) {
      return res.status(502).json({ success: false, error: 'No se pudo leer la app principal (¿está corriendo npm start en el puerto 3000?)' });
    }
    res.json(data);
  } catch (error) {
    res.status(502).json({ success: false, error: 'No se pudo conectar con la app principal: ' + error.message });
  }
});

export default router;
