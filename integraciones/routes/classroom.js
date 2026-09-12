import express from 'express';
import { obtenerAccessToken } from '../lib/googleOAuth.js';

const router = express.Router();

async function classroomGet(path, accessToken) {
  const r = await fetch(`https://classroom.googleapis.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Error de Classroom en ${path}`);
  return data;
}

router.get('/api/google/classroom/cursos', async (req, res) => {
  try {
    const accessToken = await obtenerAccessToken(req.user.id);
    const data = await classroomGet('/courses?courseStates=ACTIVE', accessToken);
    res.json({ success: true, cursos: (data.courses || []).map(c => ({ id: c.id, nombre: c.name })) });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

router.get('/api/google/classroom/tareas', async (req, res) => {
  try {
    const { curso_id } = req.query;
    if (!curso_id) return res.status(400).json({ success: false, error: 'curso_id es obligatorio.' });
    const accessToken = await obtenerAccessToken(req.user.id);
    const data = await classroomGet(`/courses/${curso_id}/courseWork`, accessToken);
    const tareas = (data.courseWork || []).map(t => ({
      id: t.id,
      titulo: t.title,
      descripcion: t.description || '',
      fecha_limite: t.dueDate
        ? new Date(Date.UTC(t.dueDate.year, t.dueDate.month - 1, t.dueDate.day, t.dueTime?.hours || 23, t.dueTime?.minutes || 59)).toISOString()
        : null,
    }));
    res.json({ success: true, tareas });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
});

router.post('/api/google/classroom/importar', async (req, res) => {
  try {
    const { titulo, descripcion, fecha_limite } = req.body;
    if (!titulo) return res.status(400).json({ success: false, error: 'titulo es obligatorio.' });

    const base = process.env.MAIN_API_URL || 'http://localhost:3000';
    const r = await fetch(`${base}/api/tareas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: req.headers.cookie || '' },
      body: JSON.stringify({
        titulo,
        descripcion: descripcion || '',
        materia_id: 5,
        general_categoria: 'Estudio',
        prioridad: 'Media',
        fecha_limite: fecha_limite || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
        pomodoros_est: 2,
        min_anticipacion: 30,
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.error || 'No se pudo crear la tarea en la app principal.');

    res.json({ success: true, tarea: data.tarea });
  } catch (error) {
    console.error('CLASSROOM IMPORT ERROR:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

export default router;
