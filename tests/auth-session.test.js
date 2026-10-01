import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { isTrustedOrigin } from '../lib/request-origin.js';

function request(origin, host = 'www.taskmaster-app.com', protocol = 'https') {
  return { protocol, get: name => name === 'origin' ? origin : name === 'host' ? host : undefined };
}
test('el dominio www funciona aunque la lista CORS conserve el dominio Vercel', () => {
  assert.equal(isTrustedOrigin(request('https://www.taskmaster-app.com'), ['https://task-master-web-xi.vercel.app']), true);
});
test('no se permiten otros dominios, subdominios similares ni downgrade HTTP', () => {
  for (const origin of ['https://atacante.example', 'https://www.taskmaster-app.com.atacante.example', 'http://www.taskmaster-app.com']) {
    assert.equal(isTrustedOrigin(request(origin), ['https://task-master-web-xi.vercel.app']), false);
  }
});
test('conserva orígenes externos autorizados y solicitudes sin cabecera Origin', () => {
  assert.equal(isTrustedOrigin(request('https://autorizado.example'), ['https://autorizado.example']), true);
  assert.equal(isTrustedOrigin(request(undefined)), true);
});

const source = await readFile(new URL('../assets/js/view/AuthView.js', import.meta.url), 'utf8');
function fixture({ status = 200, body = { success: true, user: { id: 7, nombre: 'Prueba' } }, type = 'application/json' } = {}) {
  const store = new Map();
  const location = { search: '?login=google', pathname: '/' };
  const notices = [];
  const app = { accessMode: 'public', user: null, screen: 'public', showToast: (message, kind) => notices.push({message,kind}),
    setUser(user) { this.user = user; this.accessMode = user ? 'authenticated' : 'public'; } };
  const context = vm.createContext({ console: {warn(){}}, URLSearchParams, window: { location, history: {replaceState(_a,_b,url){location.search=url.includes('?')?'?'+url.split('?')[1]:'';}} },
    sessionStorage: {getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
    fetch:async()=>({ok:status>=200&&status<300,status,headers:{get:()=>type},text:async()=>typeof body==='string'?body:JSON.stringify(body)})});
  vm.runInContext(source+'\nthis.AuthClass = AuthView;',context);
  const auth = Object.create(context.AuthClass.prototype); auth.app = app;
  return {auth,app,notices,location};
}
test('regreso de Google con sesión válida abre el espacio de trabajo', async () => {
  const {auth,app,notices,location} = fixture(); await auth._restoreUser();
  assert.equal(app.screen,'workspace'); assert.equal(app.accessMode,'authenticated');
  assert.equal(notices.at(-1).kind,'success'); assert.match(location.search,/workspace=1/);
});
test('abrir la raíz con cookie válida restaura el panel sin cerrar sesión', async () => {
  const {auth,app,location} = fixture();
  location.search = '';
  const actions = [];
  const original = auth._requestAuth;
  auth._requestAuth = function(action) { actions.push(action); return original.call(this, action); };
  await auth._restoreUser();
  assert.deepEqual(actions, ['session']);
  assert.equal(app.screen, 'workspace');
  assert.equal(app.accessMode, 'authenticated');
  assert.match(location.search, /workspace=1/);
});
test('abrir la raíz sin sesión conserva la portada y no anuncia acceso', async () => {
  const {auth,app,location,notices} = fixture({status:401,body:{success:false,error:'Sesión no válida.'}});
  location.search = '';
  await auth._restoreUser();
  assert.equal(app.screen, 'public');
  assert.equal(app.user, null);
  assert.equal(notices.some(n=>n.kind==='success'), false);
});
test('regreso de Google con HTTP 500 HTML no muestra un éxito falso', async () => {
  const {auth,app,notices} = fixture({status:500,type:'text/html',body:'<!DOCTYPE html><title>Error</title>'});
  await auth._restoreUser(); assert.equal(app.user,null); assert.equal(app.screen,'public');
  assert.equal(notices.at(-1).kind,'error'); assert.match(notices.at(-1).message,/HTTP 500/);
  assert.equal(notices.some(n=>n.kind==='success'),false);
});
test('sesión caducada, JSON corrupto y respuesta vacía mantienen la portada pública', async () => {
  for (const response of [{status:401,body:{success:false,error:'Sesión no válida.'}}, {body:'{'}, {body:''}]) {
    const {auth,app,notices}=fixture(response); await auth._restoreUser();
    assert.equal(app.user,null); assert.equal(notices.some(n=>n.kind==='success'),false);
  }
});
test('respuesta success sin usuario no se considera una sesión válida', async () => {
  const {auth,app,notices}=fixture({body:{success:true}}); await auth._restoreUser();
  assert.equal(app.user,null); assert.equal(notices.at(-1).kind,'error');
});

