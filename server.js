import express from 'express';
import cors from 'cors';
import { json } from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { google } from 'googleapis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Hostinger publica la aplicación detrás de un proxy HTTPS.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, false);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(json({ limit: '100kb' }));
// Publicar únicamente los recursos del frontend. Nunca exponer .env,
// serviceAccountKey.json, logs, código del servidor ni archivos internos.
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  dotfiles: 'deny',
  index: false,
  fallthrough: false,
}));

function requestOriginAllowed(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  const hostOrigin = `${req.protocol}://${req.get('host')}`;
  return origin === hostOrigin;
}

function requireTrustedOrigin(req, res, next) {
  if (!requestOriginAllowed(req)) {
    return res.status(403).json({ success: false, error: 'Origen de solicitud no permitido.' });
  }
  next();
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => ['session', 'logout'].includes(req.query.action || req.body?.action),
  message: { success: false, error: 'Demasiados intentos. Intenta nuevamente en 15 minutos.' },
});

const serviceAccountPath = path.resolve(
  __dirname,
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
);

let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'))
    : JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
} catch (err) {
  console.error('❌ No se pudo leer la credencial de Firebase.');
  console.error('   Descarga tu clave de servicio desde Firebase Console → Configuración del proyecto → Cuentas de servicio,');
  console.error('   define FIREBASE_SERVICE_ACCOUNT_BASE64 o usa FIREBASE_SERVICE_ACCOUNT_PATH y vuelve a iniciar el servidor.');
  console.error('   Detalle:', err.message);
  process.exit(1);
}

let firebaseApp;
try {
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
} catch (err) {
  console.error('❌ La credencial de Firebase no es válida.');
  console.error('   Verifica que el archivo JSON descargado de Firebase no haya sido modificado.');
  console.error('   Detalle:', err.message);
  process.exit(1);
}

const db = getFirestore(firebaseApp);

// ── Sesiones seguras ────────────────────────────────────────────────────────

const SESSION_COOKIE = 'tm_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GOOGLE_STATE_COOKIE = 'tm_google_state';
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

function parseCookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createPkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function sessionCookie(token, maxAgeSeconds = null) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const lifetime = maxAgeSeconds === null ? '' : `; Max-Age=${maxAgeSeconds}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/${lifetime}${secure}`;
}

function shortLivedCookie(name, value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function googleOAuthClient() {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Login no está configurado.');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function integrationKey() {
  const value = process.env.INTEGRATION_TOKEN_KEY || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_TOKEN_KEY debe ser una clave base64 de 32 bytes.');
  return key;
}

function encryptTokens(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', integrationKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { data: encrypted.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function decryptTokens(value) {
  const decipher = createDecipheriv('aes-256-gcm', integrationKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}

const integrationRef = (userId, provider) => db.collection('_integrations').doc(`${userId}_${provider}`);
async function saveIntegration(userId, provider, tokens) {
  await integrationRef(userId, provider).set({ provider, user_id: Number(userId), tokens: encryptTokens({ ...tokens, acquired_at: Date.now() }), updated_at: new Date().toISOString() }, { merge: true });
}
async function readIntegration(userId, provider) {
  const snap = await integrationRef(userId, provider).get();
  return snap.exists ? decryptTokens(snap.data().tokens) : null;
}

function googleIntegrationClient(tokens = null) {
  const client = new google.auth.OAuth2(process.env.GOOGLE_LOGIN_CLIENT_ID, process.env.GOOGLE_LOGIN_CLIENT_SECRET, process.env.GOOGLE_INTEGRATION_REDIRECT_URI);
  if (tokens) client.setCredentials(tokens);
  return client;
}

function youtubeIntegrationClient(tokens = null) {
  const redirectUri = process.env.YOUTUBE_INTEGRATION_REDIRECT_URI;
  if (!redirectUri) throw new Error('YouTube todavía no está configurado para vincularse.');
  const client = new google.auth.OAuth2(process.env.GOOGLE_LOGIN_CLIENT_ID, process.env.GOOGLE_LOGIN_CLIENT_SECRET, redirectUri);
  if (tokens) client.setCredentials(tokens);
  return client;
}

async function createSession(res, user, additionalCookies = []) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  await db.collection('_sessions').doc(tokenHash).set({
    user_id: Number(user.id),
    created_at: new Date().toISOString(),
    expires_at: Date.now() + SESSION_TTL_MS,
  });
  res.setHeader('Set-Cookie', [
    ...additionalCookies,
    sessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)),
  ]);
}

async function revokeSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await db.collection('_sessions').doc(hashSessionToken(token)).delete();
}

async function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const ref = db.collection('_sessions').doc(hashSessionToken(token));
  const sessionDoc = await ref.get();
  if (!sessionDoc.exists) return null;

  const session = sessionDoc.data();
  if (!session.expires_at || session.expires_at <= Date.now()) {
    await ref.delete();
    return null;
  }

  const userDoc = await db.collection('usuarios').doc(String(session.user_id)).get();
  if (!userDoc.exists) {
    await ref.delete();
    return null;
  }

  const user = userDoc.data();
  return { id: user.id, nombre: user.nombre, email: user.email };
}

async function requireAuth(req, res, next) {
  try {
    const user = await readSession(req);
    if (!user) return res.status(401).json({ success: false, error: 'Debes iniciar sesión.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('SESSION ERROR:', error.message);
    res.status(500).json({ success: false, error: 'No se pudo validar la sesión.' });
  }
}

async function cleanupExpiredSessions() {
  const expired = await db.collection('_sessions').where('expires_at', '<=', Date.now()).limit(200).get();
  if (expired.empty) return;
  const batch = db.batch();
  expired.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

cleanupExpiredSessions().catch(error => console.error('SESSION CLEANUP ERROR:', error.message));
const sessionCleanupTimer = setInterval(
  () => cleanupExpiredSessions().catch(error => console.error('SESSION CLEANUP ERROR:', error.message)),
  60 * 60 * 1000
);
sessionCleanupTimer.unref();

// ── Google Login OAuth 2.0 / OpenID Connect ────────────────────────────────

app.get('/api/auth/google/start', authLimiter, async (req, res) => {
  try {
    const state = randomBytes(32).toString('base64url');
    const stateHash = hashSessionToken(state);
    await db.collection('_google_login_states').doc(stateHash).set({
      expires_at: Date.now() + GOOGLE_STATE_TTL_MS,
      created_at: new Date().toISOString(),
    });
    res.setHeader('Set-Cookie', shortLivedCookie(
      GOOGLE_STATE_COOKIE,
      state,
      Math.floor(GOOGLE_STATE_TTL_MS / 1000)
    ));
    const url = googleOAuthClient().generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
    });
    res.redirect(url);
  } catch (error) {
    console.error('GOOGLE LOGIN START ERROR:', error.message);
    res.redirect('/?auth_error=google_config');
  }
});

app.get('/api/auth/google/callback', authLimiter, async (req, res) => {
  const clearStateCookie = shortLivedCookie(GOOGLE_STATE_COOKIE, '', 0);
  try {
    if (req.query.error || !req.query.code || !req.query.state) {
      throw new Error('Autorización cancelada o incompleta.');
    }

    const cookieState = parseCookies(req)[GOOGLE_STATE_COOKIE];
    if (!cookieState || cookieState !== req.query.state) {
      throw new Error('Estado OAuth inválido.');
    }

    const stateRef = db.collection('_google_login_states').doc(hashSessionToken(req.query.state));
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists) throw new Error('Estado OAuth inexistente.');
    await stateRef.delete();
    if (stateDoc.data().expires_at <= Date.now()) throw new Error('Estado OAuth expirado.');

    const client = googleOAuthClient();
    const { tokens } = await client.getToken(req.query.code);
    if (!tokens.id_token) throw new Error('Google no devolvió un ID token.');

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_LOGIN_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) {
      throw new Error('La cuenta de Google no tiene un correo verificado.');
    }

    const normalizedEmail = profile.email.trim().toLowerCase();
    const existing = await db.collection('usuarios')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    let user;
    if (existing.empty) {
      const id = await nextId('usuarios');
      user = {
        id,
        nombre: String(profile.name || normalizedEmail.split('@')[0]).slice(0, 100),
        email: normalizedEmail,
        password_hash: null,
        auth_provider: 'google',
        google_sub: profile.sub,
        fecha_creacion: new Date().toISOString(),
      };
      await db.collection('usuarios').doc(String(id)).set(user);
    } else {
      const ref = existing.docs[0].ref;
      const current = existing.docs[0].data();
      if (current.google_sub && current.google_sub !== profile.sub) {
        throw new Error('La cuenta Google no coincide con la cuenta vinculada.');
      }
      await ref.set({
        google_sub: profile.sub,
        auth_provider: current.password_hash ? 'local+google' : 'google',
      }, { merge: true });
      user = { ...current, google_sub: profile.sub };
    }

    const publicUser = { id: user.id, nombre: user.nombre, email: user.email };
    await createSession(res, publicUser, [clearStateCookie]);
    res.redirect('/?login=google');
  } catch (error) {
    console.error('GOOGLE LOGIN CALLBACK ERROR:', error.message);
    res.setHeader('Set-Cookie', clearStateCookie);
    res.redirect('/?auth_error=google');
  }
});

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

// Todas las operaciones persistentes requieren una sesión válida.
app.use('/api/tareas', requireTrustedOrigin, requireAuth);

app.get('/api/tareas', async (req, res) => {
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

    const usuarioId = Number(req.user.id);

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
      .filter(t => Number(t.usuario_id) === usuarioId)
      .sort((a, b) => {
        if (a.completada !== b.completada) return a.completada - b.completada;
        return new Date(a.fecha_limite) - new Date(b.fecha_limite);
      });

    res.json({ success: true, tareas });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error leyendo tareas.' });
  }
});

app.post('/api/tareas', async (req, res) => {
  try {
    const {
      titulo = '', descripcion = '', materia_id = 6,
      prioridad = 'Media', fecha_limite = '', general_categoria = '',
      pomodoros_est = 1, min_anticipacion = 30, usuario_id = null,
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
      usuario_id: Number(req.user.id),
      fecha_creacion: new Date().toISOString(),
    };

    await db.collection('tareas').doc(String(id)).set(tarea);
    res.status(201).json({ success: true, tarea });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creando tarea.' });
  }
});

app.put('/api/tareas', async (req, res) => {
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

    if (Number(doc.data().usuario_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'No puedes modificar una tarea de otro usuario.' });
    }

    await ref.update(updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error actualizando tarea.' });
  }
});

app.delete('/api/tareas', async (req, res) => {
  try {
    const id = Number(req.body.id || 0);
    if (!id) return res.status(400).json({ success: false, error: 'ID requerido.' });

    const tareaRef = db.collection('tareas').doc(String(id));
    const tareaDoc = await tareaRef.get();
    if (!tareaDoc.exists) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada.' });
    }
    if (Number(tareaDoc.data().usuario_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'No puedes eliminar una tarea de otro usuario.' });
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

app.post('/api/auth', requireTrustedOrigin, authLimiter, async (req, res) => {
  try {
    const action = req.query.action || req.body.action;
    const { nombre = '', email = '', password = '' } = req.body;

    if (!['login', 'register', 'google', 'session', 'logout'].includes(action)) {
      return res.status(405).json({ success: false, error: 'Acción no soportada.' });
    }

    if (action === 'session') {
      const user = await readSession(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sesión no válida.' });
      // Convierte también cookies antiguas persistentes en cookies de sesión del navegador.
      const token = parseCookies(req)[SESSION_COOKIE];
      if (token) res.setHeader('Set-Cookie', sessionCookie(token));
      return res.json({ success: true, user });
    }

    if (action === 'logout') {
      await revokeSession(req);
      res.setHeader('Set-Cookie', sessionCookie('', 0));
      return res.json({ success: true });
    }

    if (action === 'register') {
      if (!nombre.trim() || !email.trim() || !password) {
        return res.status(400).json({ success: false, error: 'Campos incompletos' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, error: 'Introduce un correo válido.' });
      }
      if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.' });
      }
      if (nombre.trim().length > 100 || normalizedEmail.length > 254) {
        return res.status(400).json({ success: false, error: 'Nombre o correo demasiado largo.' });
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
      const publicUser = { id, nombre: usuario.nombre, email: usuario.email };
      await createSession(res, publicUser);
      return res.status(201).json({ success: true, user_id: id, user: publicUser });
    }

    if (action === 'login') {
      if (!email.trim() || !password) {
        return res.status(400).json({ success: false, error: 'Campos incompletos' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      }
      const snap = await db.collection('usuarios').where('email', '==', normalizedEmail).limit(1).get();
      if (snap.empty) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });

      const user = snap.docs[0].data();
      const match = typeof user.password_hash === 'string'
        ? await bcrypt.compare(password, user.password_hash)
        : false;
      if (!match) return res.status(401).json({ success: false, error: 'Credenciales inválidas' });

      const publicUser = { id: user.id, nombre: user.nombre, email: user.email };
      await createSession(res, publicUser);
      return res.json({ success: true, user: publicUser });
    }

    if (action === 'google') {
      return res.status(501).json({
        success: false,
        error: 'El acceso con Google está deshabilitado hasta configurar OAuth real.'
      });

    }
  } catch (error) {
    console.error('AUTH ERROR:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'No se pudo completar la autenticación.' });
  }
});

// ── Integraciones OAuth y archivos ──────────────────────────────────────
app.get('/api/integrations/status', requireAuth, async (req, res) => {
  try {
    const [google, youtube, microsoft] = await Promise.all([
      readIntegration(req.user.id, 'google'),
      readIntegration(req.user.id, 'youtube'),
      readIntegration(req.user.id, 'microsoft'),
    ]);
    res.json({
      success: true,
      google: Boolean(google),
      youtube: Boolean(youtube),
      microsoft: Boolean(microsoft),
    });
  } catch (error) {
    console.error('INTEGRATION STATUS ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: 'No se pudieron validar las conexiones guardadas. Vuelve a vincularlas.',
    });
  }
});

app.get('/api/integrations/google/start', requireAuth, async (req, res) => {
  try {
    if (!process.env.GOOGLE_INTEGRATION_REDIRECT_URI) throw new Error('Falta GOOGLE_INTEGRATION_REDIRECT_URI.');
    const state = randomBytes(32).toString('base64url');
    const pkce = createPkce();
    await db.collection('_integration_states').doc(hashSessionToken(state)).set({ user_id: req.user.id, provider: 'google', code_verifier: pkce.verifier, expires_at: Date.now() + GOOGLE_STATE_TTL_MS });
    const url = googleIntegrationClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: true, state, code_challenge: pkce.challenge, code_challenge_method: 'S256', scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ] });
    res.redirect(url);
  } catch (error) { res.redirect('/?integration_error=google_config'); }
});

app.get('/api/integrations/youtube/start', requireAuth, async (req, res) => {
  try {
    const state = randomBytes(32).toString('base64url');
    const pkce = createPkce();
    await db.collection('_integration_states').doc(hashSessionToken(state)).set({
      user_id: req.user.id,
      provider: 'youtube',
      code_verifier: pkce.verifier,
      expires_at: Date.now() + GOOGLE_STATE_TTL_MS,
    });
    const url = youtubeIntegrationClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
    });
    res.redirect(url);
  } catch (error) {
    console.error('YOUTUBE INTEGRATION START ERROR:', error.message);
    res.redirect('/?integration_error=youtube_config');
  }
});

app.get('/api/integrations/youtube/callback', requireAuth, async (req, res) => {
  try {
    const ref = db.collection('_integration_states').doc(hashSessionToken(String(req.query.state || '')));
    const snap = await ref.get();
    if (!snap.exists || snap.data().provider !== 'youtube' || Number(snap.data().user_id) !== Number(req.user.id) || snap.data().expires_at < Date.now()) throw new Error('La autorización ya no es válida. Intenta vincular YouTube nuevamente.');
    await ref.delete();
    const { tokens } = await youtubeIntegrationClient().getToken({ code: req.query.code, codeVerifier: snap.data().code_verifier });
    await saveIntegration(req.user.id, 'youtube', tokens);
    res.redirect('/?integration=youtube');
  } catch (error) {
    console.error('YOUTUBE INTEGRATION ERROR:', error.message);
    res.redirect('/?integration_error=youtube');
  }
});

app.get('/api/integrations/google/callback', requireAuth, async (req, res) => {
  try {
    const ref = db.collection('_integration_states').doc(hashSessionToken(String(req.query.state || '')));
    const snap = await ref.get();
    if (!snap.exists || snap.data().provider !== 'google' || Number(snap.data().user_id) !== Number(req.user.id) || snap.data().expires_at < Date.now()) throw new Error('Estado OAuth inválido.');
    await ref.delete();
    const { tokens } = await googleIntegrationClient().getToken({ code: req.query.code, codeVerifier: snap.data().code_verifier });
    await saveIntegration(req.user.id, 'google', tokens);
    res.redirect('/?integration=google');
  } catch (error) { console.error('GOOGLE INTEGRATION ERROR:', error.message); res.redirect('/?integration_error=google'); }
});

app.get('/api/integrations/microsoft/start', requireAuth, async (req, res) => {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    if (!clientId || !redirectUri) throw new Error('Microsoft OAuth no configurado.');
    const state = randomBytes(32).toString('base64url');
    const pkce = createPkce();
    await db.collection('_integration_states').doc(hashSessionToken(state)).set({ user_id: req.user.id, provider: 'microsoft', code_verifier: pkce.verifier, expires_at: Date.now() + GOOGLE_STATE_TTL_MS });
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query', scope: 'offline_access User.Read Files.ReadWrite Calendars.ReadWrite Team.ReadBasic.All', state, code_challenge: pkce.challenge, code_challenge_method: 'S256' });
    res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
  } catch (error) { res.redirect('/?integration_error=microsoft_config'); }
});

app.get('/api/integrations/microsoft/callback', requireAuth, async (req, res) => {
  try {
    const ref = db.collection('_integration_states').doc(hashSessionToken(String(req.query.state || '')));
    const snap = await ref.get();
    if (!snap.exists || snap.data().provider !== 'microsoft' || Number(snap.data().user_id) !== Number(req.user.id) || snap.data().expires_at < Date.now()) throw new Error('Estado OAuth inválido.');
    await ref.delete();
    const body = new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, code: req.query.code, code_verifier: snap.data().code_verifier, redirect_uri: process.env.MICROSOFT_REDIRECT_URI, grant_type: 'authorization_code', scope: 'offline_access User.Read Files.ReadWrite Calendars.ReadWrite Team.ReadBasic.All' });
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const tokens = await response.json();
    if (!response.ok) throw new Error(tokens.error_description || 'Microsoft rechazó el token.');
    await saveIntegration(req.user.id, 'microsoft', tokens);
    res.redirect('/?integration=microsoft');
  } catch (error) { console.error('MICROSOFT INTEGRATION ERROR:', error.message); res.redirect('/?integration_error=microsoft'); }
});

app.delete('/api/integrations/:provider', requireTrustedOrigin, requireAuth, async (req, res) => {
  const provider = req.params.provider;
  if (!['google', 'youtube', 'microsoft'].includes(provider)) {
    return res.status(400).json({ success: false, error: 'No reconocemos el servicio que intentas desconectar.' });
  }

  try {
    if (['google', 'youtube'].includes(provider)) {
      const tokens = await readIntegration(req.user.id, provider);
      const token = tokens?.refresh_token || tokens?.access_token;
      const client = provider === 'youtube'
        ? youtubeIntegrationClient(tokens)
        : googleIntegrationClient(tokens);
      if (token) {
        await client.revokeToken(token).catch(error => {
          console.warn('GOOGLE TOKEN REVOCATION:', error.message);
        });
      }
    }

    // Microsoft no ofrece un endpoint universal de revocación para este flujo.
    // Borrar el refresh token cifrado impide que TaskMaster solicite nuevos accesos.
    await integrationRef(req.user.id, provider).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('INTEGRATION DISCONNECT ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: 'No se pudo desconectar el servicio. Inténtalo nuevamente.',
    });
  }
});

app.get('/api/integrations/google/calendar/events', requireAuth, async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'google');
    if (!tokens) return res.status(409).json({ success: false, error: 'Conecta Google primero.' });
    const calendar = google.calendar({ version: 'v3', auth: googleIntegrationClient(tokens) });
    const result = await calendar.events.list({ calendarId: 'primary', timeMin: new Date().toISOString(), maxResults: 50, singleEvents: true, orderBy: 'startTime' });
    res.json({ success: true, events: result.data.items || [] });
  } catch (error) { res.status(502).json({ success: false, error: 'No se pudo consultar Calendar.' }); }
});

app.get('/api/integrations/google/classroom/courses', requireAuth, async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'google');
    if (!tokens) return res.status(409).json({ success: false, error: 'Conecta Google primero.' });
    const classroom = google.classroom({ version: 'v1', auth: googleIntegrationClient(tokens) });
    const result = await classroom.courses.list({ courseStates: ['ACTIVE'], pageSize: 50 });
    res.json({ success: true, courses: result.data.courses || [] });
  } catch (error) { res.status(502).json({ success: false, error: 'No se pudo consultar Classroom.' }); }
});

app.post('/api/integrations/google/docs', requireTrustedOrigin, requireAuth, async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'google');
    if (!tokens) return res.status(409).json({ success: false, error: 'Conecta Google primero.' });
    const docs = google.docs({ version: 'v1', auth: googleIntegrationClient(tokens) });
    const result = await docs.documents.create({ requestBody: { title: String(req.body.title || 'Documento TaskMaster').slice(0, 120) } });
    res.json({ success: true, documentId: result.data.documentId, url: `https://docs.google.com/document/d/${result.data.documentId}/edit` });
  } catch (error) { console.error('DOCS CREATE ERROR:', error.message); res.status(502).json({ success: false, error: 'No se pudo crear el documento.' }); }
});

app.post('/api/integrations/google/drive/upload', requireTrustedOrigin, requireAuth, express.raw({ type: 'application/octet-stream', limit: '25mb' }), async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'google');
    if (!tokens) return res.status(409).json({ success: false, error: 'Conecta Google primero.' });
    const name = decodeURIComponent(req.get('X-File-Name') || 'archivo-taskmaster');
    const { Readable } = await import('stream');
    const drive = google.drive({ version: 'v3', auth: googleIntegrationClient(tokens) });
    const result = await drive.files.create({ requestBody: { name: name.slice(0, 240) }, media: { mimeType: req.get('X-File-Type') || 'application/octet-stream', body: Readable.from(req.body) }, fields: 'id,name,webViewLink' });
    res.json({ success: true, file: result.data });
  } catch (error) { console.error('DRIVE UPLOAD ERROR:', error.message); res.status(502).json({ success: false, error: 'No se pudo subir a Drive.' }); }
});

app.post('/api/integrations/google/youtube/upload', requireTrustedOrigin, requireAuth, express.raw({ type: 'video/webm', limit: '100mb' }), async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'youtube');
    if (!tokens) return res.status(409).json({ success: false, error: 'Vincula YouTube con TaskMaster antes de subir el video.' });
    const { Readable } = await import('stream');
    const youtube = google.youtube({ version: 'v3', auth: youtubeIntegrationClient(tokens) });
    const result = await youtube.videos.insert({ part: ['snippet','status'], requestBody: { snippet: { title: String(req.get('X-Video-Title') || 'Grabación TaskMaster').slice(0, 100) }, status: { privacyStatus: 'private' } }, media: { body: Readable.from(req.body) } });
    res.json({ success: true, videoId: result.data.id, url: `https://youtu.be/${result.data.id}` });
  } catch (error) { console.error('YOUTUBE UPLOAD ERROR:', error.message); res.status(502).json({ success: false, error: 'No se pudo subir el video.' }); }
});

app.post('/api/integrations/google/gmail/send', requireTrustedOrigin, requireAuth, async (req, res) => {
  try {
    const tokens = await readIntegration(req.user.id, 'google');
    if (!tokens) return res.status(409).json({ success: false, error: 'Vincula Google con TaskMaster primero.' });

    const to = String(req.body.to || '').trim().toLowerCase();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) {
      return res.status(400).json({ success: false, error: 'Introduce un destinatario válido.' });
    }
    if (!subject || subject.length > 160) {
      return res.status(400).json({ success: false, error: 'El asunto es obligatorio y admite hasta 160 caracteres.' });
    }
    if (!message || message.length > 10000) {
      return res.status(400).json({ success: false, error: 'El mensaje es obligatorio y admite hasta 10 000 caracteres.' });
    }

    const encodedSubject = Buffer.from(subject, 'utf8').toString('base64');
    const mime = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${encodedSubject}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message,
    ].join('\r\n');
    const raw = Buffer.from(mime, 'utf8').toString('base64url');
    const gmail = google.gmail({ version: 'v1', auth: googleIntegrationClient(tokens) });
    const result = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    res.json({ success: true, messageId: result.data.id || null });
  } catch (error) {
    console.error('GMAIL SEND ERROR:', error.message);
    res.status(502).json({ success: false, error: 'No se pudo enviar el correo con Gmail.' });
  }
});

async function microsoftAccessToken(userId) {
  let tokens = await readIntegration(userId, 'microsoft');
  if (!tokens) return null;
  if (tokens.access_token && Date.now() < Number(tokens.acquired_at || 0) + (Number(tokens.expires_in || 3600) - 120) * 1000) return tokens.access_token;
  const body = new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID, client_secret: process.env.MICROSOFT_CLIENT_SECRET, refresh_token: tokens.refresh_token, grant_type: 'refresh_token', scope: 'offline_access User.Read Files.ReadWrite Calendars.ReadWrite Team.ReadBasic.All' });
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const refreshed = await response.json();
  if (!response.ok) throw new Error('No se pudo renovar Microsoft OAuth.');
  tokens = { ...tokens, ...refreshed };
  await saveIntegration(userId, 'microsoft', tokens);
  return tokens.access_token;
}

app.post('/api/integrations/microsoft/onedrive/upload', requireTrustedOrigin, requireAuth, express.raw({ type: 'application/octet-stream', limit: '25mb' }), async (req, res) => {
  try {
    const accessToken = await microsoftAccessToken(req.user.id);
    if (!accessToken) return res.status(409).json({ success: false, error: 'Conecta Microsoft primero.' });
    const safeName = decodeURIComponent(req.get('X-File-Name') || 'archivo-taskmaster').replace(/[\\/:*?"<>|]/g, '_').slice(0, 200);
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/TaskMaster/${encodeURIComponent(safeName)}:/content`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': req.get('X-File-Type') || 'application/octet-stream' }, body: req.body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Microsoft Graph rechazó el archivo.');
    res.json({ success: true, file: { id: data.id, name: data.name, webUrl: data.webUrl } });
  } catch (error) { console.error('ONEDRIVE UPLOAD ERROR:', error.message); res.status(502).json({ success: false, error: 'No se pudo subir a OneDrive.' }); }
});

async function microsoftGraph(req, res, resource, resultKey) {
  try {
    const accessToken = await microsoftAccessToken(req.user.id);
    if (!accessToken) return res.status(409).json({ success: false, error: 'Conecta Microsoft primero.' });
    const response = await fetch(`https://graph.microsoft.com/v1.0/${resource}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Microsoft Graph rechazó la solicitud.');
    res.json({ success: true, [resultKey]: data.value || [] });
  } catch (error) {
    console.error('MICROSOFT GRAPH ERROR:', error.message);
    res.status(502).json({ success: false, error: `No se pudo consultar ${resultKey}.` });
  }
}

app.get('/api/integrations/microsoft/calendar/events', requireAuth, (req, res) =>
  microsoftGraph(req, res, 'me/calendar/events?$top=50&$orderby=start/dateTime', 'events'));

app.get('/api/integrations/microsoft/teams', requireAuth, (req, res) =>
  microsoftGraph(req, res, 'me/joinedTeams', 'teams'));

// ── Notificaciones ───────────────────────────────────────────────────────

app.post('/api/notify', requireTrustedOrigin, requireAuth, async (req, res) => {
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
