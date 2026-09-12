import { guardarTokens, leerTokens } from './tokenStore.js';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

const SCOPES = [
  'offline_access',
  'User.Read',
  'Files.ReadWrite',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'ChannelMessage.Send',
].join(' ');

export function construirUrlAutorizacion(state) {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    response_type: 'code',
    response_mode: 'query',
    scope: SCOPES,
    prompt: 'select_account',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function intercambiarCodigo(usuarioId, code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      redirect_uri: process.env.AZURE_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error intercambiando código de Microsoft');

  await guardarTokens(usuarioId, 'microsoft', {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expira_en: Date.now() + data.expires_in * 1000,
  });
  return data;
}

async function refrescarToken(usuarioId) {
  const guardado = await leerTokens(usuarioId, 'microsoft');
  if (!guardado || !guardado.refresh_token) throw new Error('Microsoft no está conectado.');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: guardado.refresh_token,
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error refrescando token de Microsoft');

  await guardarTokens(usuarioId, 'microsoft', {
    access_token: data.access_token,
    refresh_token: data.refresh_token || guardado.refresh_token,
    expira_en: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export async function obtenerAccessToken(usuarioId) {
  const guardado = await leerTokens(usuarioId, 'microsoft');
  if (!guardado || !guardado.refresh_token) throw new Error('Microsoft no está conectado. Ve a la tarjeta de OneDrive/Teams y haz clic en Conectar.');
  if (guardado.expira_en && Date.now() < guardado.expira_en - 60_000) {
    return guardado.access_token;
  }
  return refrescarToken(usuarioId);
}
