import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('el backend principal aplica sesión segura, bcrypt, CORS y límites', async () => {
  const server = await read('../server.js');
  assert.match(server, /HttpOnly; SameSite=Lax/);
  assert.match(server, /bcrypt\.compare/);
  assert.match(server, /allowedOrigins\.includes/);
  assert.match(server, /rateLimit\(/);
  assert.match(server, /hashSessionToken\(token\)/);
});

test('OAuth usa state, PKCE S256, tokens cifrados y revocación', async () => {
  const server = await read('../server.js');
  assert.match(server, /code_challenge_method: 'S256'/);
  assert.match(server, /code_verifier: snap\.data\(\)\.code_verifier/);
  assert.match(server, /createCipheriv\('aes-256-gcm'/);
  assert.match(server, /revokeToken\(token\)/);
  assert.match(server, /integrationRef\(req\.user\.id, req\.params\.provider\)\.delete/);
  assert.match(server, /\/api\/integrations\/youtube\/start/);
  assert.match(server, /\/api\/integrations\/youtube\/callback/);
  const googleScopes = server.match(/app\.get\('\/api\/integrations\/google\/start'[\s\S]*?res\.redirect\(url\);/)?.[0] || '';
  assert.doesNotMatch(googleScopes, /youtube\.upload/);
});

test('las rutas privadas derivan el propietario de la sesión', async () => {
  const server = await read('../server.js');
  assert.match(server, /app\.use\('\/api\/tareas', requireTrustedOrigin, requireAuth\)/);
  assert.match(server, /req\.user\.id/);
  assert.match(server, /\/api\/integrations\/google\/calendar\/events/);
  assert.match(server, /\/api\/integrations\/google\/classroom\/courses/);
  assert.match(server, /\/api\/integrations\/microsoft\/teams/);
  assert.match(server, /\/api\/integrations\/google\/gmail\/send/);
  assert.match(server, /google\.gmail\(\{ version: 'v1'/);
  assert.match(server, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
});

test('el frontend no usa PHP para autenticación', async () => {
  const auth = await read('../assets/js/view/AuthView.js');
  assert.doesNotMatch(auth, /api\/(login|registro|google-auth)\.php/);
  assert.match(auth, /api\/auth\?action=/);
});

test('solo el backend raíz queda habilitado para iniciar', async () => {
  const integrationsPackage = JSON.parse(await read('../integraciones/package.json'));
  assert.match(integrationsPackage.scripts.start, /unico backend activo/);
});

test('las integraciones implementadas no se presentan como próximas', async () => {
  const index = await read('../index.html');
  const integrationView = await read('../assets/js/view/IntegrationView.js');
  const authView = await read('../assets/js/view/AuthView.js');
  for (const id of ['drive-status', 'classroom-status', 'youtube-status', 'teams-status']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
  assert.match(integrationView, /_renderService\('drive', data\.google\)/);
  assert.match(index, /https:\/\/drive\.google\.com\/drive\/my-drive/);
  assert.match(index, /https:\/\/classroom\.google\.com\//);
  assert.match(index, /https:\/\/mail\.google\.com\//);
  assert.match(index, /https:\/\/teams\.microsoft\.com\//);
  assert.match(index, /id="gmail-compose"/);
  assert.match(integrationView, /google\/gmail\/send/);
  assert.match(integrationView, /_renderService\('gmail', data\.google\)/);
  assert.match(integrationView, /_render\('youtube', data\.youtube\)/);
  assert.match(index, /id="connect-youtube"/);
  assert.match(index, /Cómo funcionan las integraciones/);
  assert.match(index, /aria-live="polite"/);
  assert.match(integrationView, /Abriendo \$\{providerName\}/);
  assert.match(authView, /params\.has\('integration'\)/);
  assert.match(authView, /Google Workspace conectado/);
  assert.match(authView, /Microsoft 365 conectado/);
  assert.match(authView, /YouTube conectado/);
});

test('los principios UX exigen lenguaje humano y recuperación clara', async () => {
  const principles = await read('../docs/UX-PRINCIPLES.md');
  assert.match(principles, /Lenguaje humano/);
  assert.match(principles, /Recuperación clara/);
  assert.match(principles, /Accesibilidad/);
});

test('la sesión se restaura antes del primer render y la cabecera no se superpone', async () => {
  const index = await read('../index.html');
  const app = await read('../assets/js/app.js');
  const auth = await read('../assets/js/view/AuthView.js');
  const css = await read('../assets/css/main.css');
  assert.match(index, /data-screen="loading"/);
  assert.match(auth, /this\.ready = this\._restoreUser\(\)/);
  assert.match(app, /await this\.authView\.ready/);
  assert.match(css, /\.header-inner\s*\{[\s\S]*?display:\s*grid/);
  const headerActions = css.match(/\.header-actions\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.doesNotMatch(headerActions, /position:\s*absolute/);
  assert.match(headerActions, /flex-wrap:\s*wrap/);
});
