import crypto from 'crypto';

const mainApi = process.env.MAIN_API_URL || 'http://localhost:3000';

export async function requireMainSession(req, res, next) {
  try {
    const response = await fetch(`${mainApi}/api/session`, {
      headers: { cookie: req.headers.cookie || '' },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return res.status(401).json({ success: false, error: 'Inicia sesión en TaskMaster para continuar.' });
    }
    req.user = data.user;
    next();
  } catch (error) {
    res.status(503).json({ success: false, error: 'No se pudo validar la sesión con TaskMaster.' });
  }
}

function signingSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET no está configurado en integraciones.');
  return secret;
}

export function createOAuthState(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, expires: Date.now() + 10 * 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state = '') {
  const [payload, signature] = state.split('.');
  if (!payload || !signature) throw new Error('Estado OAuth inválido.');
  const expected = crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Estado OAuth no válido.');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.userId || Date.now() > data.expires) throw new Error('La autorización OAuth expiró.');
  return data;
}
