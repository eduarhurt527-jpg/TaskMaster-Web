import { createHash, randomBytes } from 'crypto';
import { db } from './firestore.js';

const SESSION_COOKIE = 'tm_session';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function parseCookies(req) {
  const cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const ref = db.collection('_sessions').doc(sha256(token));
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;

  const session = snapshot.data();
  if (!session.expires_at || session.expires_at <= Date.now()) {
    await ref.delete();
    return null;
  }

  const userDoc = await db.collection('usuarios').doc(String(session.user_id)).get();
  if (!userDoc.exists) return null;
  const user = userDoc.data();
  return { id: Number(user.id), nombre: user.nombre, email: user.email };
}

export async function requireAuth(req, res, next) {
  try {
    const user = await readSession(req);
    if (!user) return res.status(401).json({ success: false, error: 'Debes iniciar sesión.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('INTEGRATIONS SESSION ERROR:', error.message);
    res.status(500).json({ success: false, error: 'No se pudo validar la sesión.' });
  }
}

export async function createOAuthState(userId, provider) {
  const state = randomBytes(32).toString('base64url');
  await db.collection('_oauth_states').doc(sha256(state)).set({
    user_id: Number(userId),
    provider,
    expires_at: Date.now() + OAUTH_STATE_TTL_MS,
  });
  return state;
}

export async function consumeOAuthState(state, provider) {
  if (!state) return null;
  const ref = db.collection('_oauth_states').doc(sha256(state));
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  await ref.delete();
  if (data.provider !== provider || !data.expires_at || data.expires_at <= Date.now()) return null;
  return Number(data.user_id);
}
