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
});

test('las rutas privadas derivan el propietario de la sesión', async () => {
  const server = await read('../server.js');
  assert.match(server, /app\.use\('\/api\/tareas', requireTrustedOrigin, requireAuth\)/);
  assert.match(server, /req\.user\.id/);
  assert.match(server, /\/api\/integrations\/google\/calendar\/events/);
  assert.match(server, /\/api\/integrations\/google\/classroom\/courses/);
  assert.match(server, /\/api\/integrations\/microsoft\/teams/);
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
