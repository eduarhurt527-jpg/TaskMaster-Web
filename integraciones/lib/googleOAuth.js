import { guardarTokens, leerTokens } from './tokenStore.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function construirUrlAutorizacion(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function intercambiarCodigo(userId, code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error intercambiando código de Google');

  await guardarTokens(userId, 'google', {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expira_en: Date.now() + data.expires_in * 1000,
  });
  return data;
}

async function refrescarToken(userId) {
  const guardado = await leerTokens(userId, 'google');
  if (!guardado || !guardado.refresh_token) throw new Error('Google no está conectado.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: guardado.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error refrescando token de Google');

  await guardarTokens(userId, 'google', {
    access_token: data.access_token,
    refresh_token: guardado.refresh_token,
    expira_en: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export async function obtenerAccessToken(userId) {
  const guardado = await leerTokens(userId, 'google');
  if (!guardado || !guardado.refresh_token) throw new Error('Google no está conectado. Ve a la tarjeta de Google y haz clic en Conectar.');
  if (guardado.expira_en && Date.now() < guardado.expira_en - 60_000) {
    return guardado.access_token;
  }
  return refrescarToken(userId);
}
