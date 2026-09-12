import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3002')
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(json());
app.set('trust proxy', 1);
app.use(session({
  name: 'tm.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
}));
app.use(express.static(path.join(__dirname, '/')));

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, error: 'Inicia sesión para continuar.' });
  }
  next();
}

const serviceAccountPath = path.resolve(
  __dirname,
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
);

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
} catch (err) {
  console.error('❌ No se pudo leer la credencial de Firebase en:', serviceAccountPath);
  console.error('   Descarga tu clave de servicio desde Firebase Console → Configuración del proyecto → Cuentas de servicio,');
  console.error('   guárdala en la ruta anterior (o define FIREBASE_SERVICE_ACCOUNT_PATH en un archivo .env) y vuelve a iniciar el servidor.');
  console.error('   Detalle:', err.message);
  process.exit(1);
}

let firebaseApp;
try {
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
} catch (err) {
  console.error('❌ La credencial de Firebase en', serviceAccountPath, 'no es válida.');
  console.error('   Verifica que el archivo JSON descargado de Firebase no haya sido modificado.');
  console.error('   Detalle:', err.message);
  process.exit(1);
}

const db = getFirestore(firebaseApp);

// Verificar conexión a Firebase al arrancar
db.collection('_healthcheck').limit(1).get()
  .then(() => {
    console.log('✅ Firebase Firestore conectado correctamente');
  })
  .catch(err => {
    console.error('❌ Error conectando a Firestore:', err.message);
    console.error('Verifica el archivo de credenciales de Firebase (serviceAccountKey.json)');
  });

// ── Utilidades Firestore ────────────────────────────────────────────────────

async function nextId(collectionName) {
  const counterRef = db.collection('_counters').doc(collectionName);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const next = (doc.exists ? doc.data().value : 0) + 1;
    tx.set(counterRef, { value: next });
    return next;
  });
}

async function ensureSeed(collectionName, seedRows) {
  const snap = await db.collection(collectionName).limit(1).get();
  if (!snap.empty) return;
  const batch = db.batch();
  for (const row of seedRows) {
    batch.set(db.collection(collectionName).doc(String(row.id)), row);
  }
  await batch.commit();
  const maxId = Math.max(...seedRows.map(r => r.id));
  await db.collection('_counters').doc(collectionName).set({ value: maxId });
}

const MATERIAS_SEED = [
  { id: 1, nombre: 'Trabajo',  color: '#4F8EF7', bg: '#E8EAF6' },
  { id: 2, nombre: 'Personal', color: '#F7C34F', bg: '#FFF8E1' },
  { id: 3, nombre: 'Salud',    color: '#4FD18A', bg: '#E8F5E9' },
  { id: 4, nombre: 'Hogar',    color: '#F7934F', bg: '#FFF3E0' },
  { id: 5, nombre: 'Estudio',  color: '#A04FF7', bg: '#F3E5F5' },
  { id: 6, nombre: 'Urgente',  color: '#F74F4F', bg: '#FFEBEE' },
  { id: 7, nombre: 'Ideas',    color: '#4FF7F0', bg: '#E0F7FA' },
];

const CATEGORIAS_SEED = [
  { id: 1, nombre: 'Personal' },
  { id: 2, nombre: 'Academico' },
  { id: 3, nombre: 'Trabajo' },
];

ensureSeed('materias', MATERIAS_SEED).catch(err => console.error('Error sembrando materias:', err.message));
ensureSeed('categorias', CATEGORIAS_SEED).catch(err => console.error('Error sembrando categorías:', err.message));

// ── Materias ─────────────────────────────────────────────────────────────

app.get('/api/materias', async (req, res) => {
  try {
    const snap = await db.collection('materias').get();
    const materias = snap.docs.map(d => d.data()).sort((a, b) => a.id - b.id);
    res.json({ success: true, materias });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error leyendo materias.' });
  }
});

// ── Categorías ───────────────────────────────────────────────────────────

app.get('/api/categorias', async (req, res) => {
  try {
    const snap = await db.collection('categorias').get();
    const categorias = snap.docs.map(d => d.data()).sort((a, b) => a.id - b.id);
    res.json({ success: true, categorias });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error leyendo categorías.' });
  }
});

// ── Tareas ───────────────────────────────────────────────────────────────

app.get('/api/tareas', requireAuth, async (req, res) => {
  try {
    const [tareasSnap, materiasSnap] = await Promise.all([
      db.collection('tareas').get(),
      db.collection('materias').get(),
    ]);

    const materiasMap = {};
    materiasSnap.docs.forEach(d => {
      const m = d.data();
      materiasMap[m.id] = m;
    });

    // Filtrar por usuario cuando el cliente lo indica; las tareas antiguas
    // (usuario_id null, creadas antes del soporte multiusuario) siguen visibles
    const usuarioId = Number(req.session.userId);

    const tareas = tareasSnap.docs
      .map(d => {
        const t = d.data();
        const m = materiasMap[t.materia_id];
        return {
          ...t,
          materia_nombre: m ? m.nombre : null,
          materia_color: m ? m.color : null,
        };
      })
      .filter(t => t.usuario_id === usuarioId)
      .sort((a, b) => {
        if (a.completada !== b.completada) return a.completada - b.completada;
        return new Date(a.fecha_limite) - new Date(b.fecha_limite);
      });

    res.json({ success: true, tareas });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error leyendo tareas.' });
  }
});

app.post('/api/tareas', requireAuth, async (req, res) => {
  try {
    const {
      titulo = '', descripcion = '', materia_id = 6,
      prioridad = 'Media', fecha_limite = '', general_categoria = '',
      pomodoros_est = 1, min_anticipacion = 30,
    } = req.body;

    if (!titulo.trim()) {
      return res.status(400).json({ success: false, error: 'El título es obligatorio.' });
    }
    if (!fecha_limite) {
      return res.status(400).json({ success: false, error: 'La fecha límite es obligatoria.' });
    }

    const id = await nextId('tareas');
    const tarea = {
      id,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      materia_id: Number(materia_id),
      categoria_id: null,
      subcategoria: null,
      general_categoria,
      prioridad,
      fecha_limite,
      completada: 0,
      pomodoros_est: Number(pomodoros_est),
      pomodoros_real: 0,
      min_anticipacion: Number(min_anticipacion),
      aviso_enviado: 0,
      nota: null,
      usuario_id: Number(req.session.userId),
      fecha_creacion: new Date().toISOString(),
    };

    await db.collection('tareas').doc(String(id)).set(tarea);
    res.status(201).json({ success: true, tarea });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creando tarea.' });
  }
});

app.put('/api/tareas', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const id = Number(data.id || 0);
    if (!id) return res.status(400).json({ success: false, error: 'ID requerido.' });

    const allowed = ['titulo', 'descripcion', 'materia_id', 'prioridad', 'fecha_limite', 'general_categoria', 'pomodoros_est', 'pomodoros_real', 'completada', 'min_anticipacion'];
    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        updates[key] = data[key];
      }
    }

    if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'Sin campos para actualizar.' });

    const ref = db.collection('tareas').doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });
    }
    if (doc.data().usuario_id !== Number(req.session.userId)) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para modificar esta tarea.' });
    }

    await ref.update(updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error actualizando tarea.' });
  }
});

app.delete('/api/tareas', requireAuth, async (req, res) => {
  try {
    const id = Number(req.body.id || 0);
    if (!id) return res.status(400).json({ success: false, error: 'ID requerido.' });

    const tareaRef = db.collection('tareas').doc(String(id));
    const tareaDoc = await tareaRef.get();
    if (!tareaDoc.exists) return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });
    if (tareaDoc.data().usuario_id !== Number(req.session.userId)) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para eliminar esta tarea.' });
    }
    await tareaRef.delete();

    const alertasSnap = await db.collection('alertas').where('tarea_id', '==', id).get();
    if (!alertasSnap.empty) {
      const batch = db.batch();
      alertasSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando tarea.' });
  }
});

// ── Auth ─────────────────────────────────────────────────────────────────

app.post('/api/auth', async (req, res) => {
  try {
    const action = req.query.action || req.body.action;
    const { nombre = '', email = '', password = '' } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    if (!['login', 'register', 'google'].includes(action)) {
      return res.status(405).json({ success: false, error: 'Acción no soportada.' });
    }

    if (action === 'register') {
      if (!nombre.trim() || !normalizedEmail || !password) {
        return res.status(400).json({ success: false, error: 'Campos incompletos' });
      }

      const existing = await db.collection('usuarios').where('email', '==', normalizedEmail).limit(1).get();
      if (!existing.empty) {
        return res.status(409).json({ success: false, error: 'Este correo ya está registrado.' });
      }

      const hash = await bcrypt.hash(password, 10);
      const id = await nextId('usuarios');
      const usuario = {
        id,
        nombre: nombre.trim(),
        email: normalizedEmail,
        password_hash: hash,
        fecha_creacion: new Date().toISOString(),
      };
      await db.collection('usuarios').doc(String(id)).set(usuario);
      req.session.userId = id;
      return res.json({ success: true, user_id: id });
    }

    if (action === 'login') {
      if (!normalizedEmail || !password) {
        return res.status(400).json({ success: false, error: 'Campos incompletos' });
      }

      const snap = await db.collection('usuarios').where('email', '==', normalizedEmail).limit(1).get();
      if (snap.empty) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });

      const user = snap.docs[0].data();
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });

      req.session.userId = user.id;
      return res.json({ success: true, user: { id: user.id, nombre: user.nombre, email: user.email } });
    }

    if (action === 'google') return res.status(501).json({ success: false, error: 'Usa Cuenta → Integraciones para conectar Google de forma segura.' });
  } catch (error) {
    console.error('AUTH ERROR:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: 'Error en auth: ' + error.message
    });
  }
});

app.get('/api/session', async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ success: false });
  const doc = await db.collection('usuarios').doc(String(req.session.userId)).get();
  if (!doc.exists) return req.session.destroy(() => res.status(401).json({ success: false }));
  const user = doc.data();
  res.json({ success: true, user: { id: user.id, nombre: user.nombre, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ success: false, error: 'No se pudo cerrar la sesión.' });
    res.clearCookie('tm.sid');
    res.json({ success: true });
  });
});

// ── Notificaciones ───────────────────────────────────────────────────────

app.post('/api/notify', async (req, res) => {
  try {
    const { email = '', asunto = 'Notificación TaskMaster', mensaje = '' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requerido.' });
    }

    // Intento de envío local simple: escribir en archivo de log
    const logMsg = `${new Date().toISOString()} | to:${email} | msg:${mensaje.replace(/\n|\r/g, ' ')}\n`;
    await import('fs').then(fs => fs.promises.appendFile(path.join(__dirname, 'notify.log'), logMsg));
    res.json({ success: true, warning: 'Notificación registrada en el servidor.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error en notificación.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`TaskMaster Node server running on http://localhost:${port}`);
});
