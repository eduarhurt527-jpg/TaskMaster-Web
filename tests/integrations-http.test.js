import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('las integraciones rechazan peticiones sin sesión y orígenes ajenos', { timeout: 30000 }, async t => {
  const port = await freePort();
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credential = Buffer.from(JSON.stringify({
    project_id: 'taskmaster-local-test',
    client_email: 'test@taskmaster-local-test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  })).toString('base64');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), FIREBASE_SERVICE_ACCOUNT_BASE64: credential,
      FIREBASE_SERVICE_ACCOUNT_PATH: '', CORS_ORIGIN: 'http://localhost:3000',
      GOOGLE_APPLICATION_CREDENTIALS: '', FIRESTORE_EMULATOR_HOST: '127.0.0.1:1' },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break;
    try { const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(300) });
      if (response.ok) { ready = true; break; }
    } catch { /* servidor aún iniciando */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'el servidor debe iniciar con una credencial de prueba');

  const privatePaths = [
    '/api/integrations/status', '/api/integrations/google/start',
    '/api/integrations/google/callback?state=falso&code=falso',
    '/api/integrations/microsoft/start', '/api/integrations/microsoft/callback?state=falso&code=falso',
    '/api/integrations/google/calendar/events', '/api/integrations/google/classroom/courses',
    '/api/integrations/microsoft/teams',
  ];
  for (const path of privatePaths) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).success, false, path);
  }
  for (const [method, path] of [
    ['DELETE', '/api/integrations/google'],
    ['POST', '/api/integrations/google/gmail/send'],
    ['POST', '/api/integrations/microsoft/onedrive/upload'],
  ]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
  const crossOrigin = await fetch(`${base}/api/integrations/google/gmail/send`, {
    method: 'POST', headers: { Origin: 'https://sitio-ajeno.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: 'test@example.com' }),
  });
  assert.ok([403, 500].includes(crossOrigin.status), 'CORS debe bloquear el origen');
  assert.notEqual(crossOrigin.headers.get('access-control-allow-origin'), 'https://sitio-ajeno.example');
});
