import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { integrationStatuses } from '../lib/integration-status.js';
import { microsoftScopes } from '../lib/microsoft-scopes.js';
import { integrationFailure } from '../lib/integration-errors.js';

const apiSource = await readFile(new URL('../assets/js/ApiClient.js', import.meta.url), 'utf8');
function apiFixture(fetchImplementation = async () => { throw new Error('Failed to fetch'); }) {
  const diagnostics = [];
  const context = vm.createContext({ console: {warn: (...args) => diagnostics.push(args)}, fetch: fetchImplementation });
  vm.runInContext(apiSource + '\nthis.api = taskMasterApi;', context);
  return {api: context.api, context, diagnostics};
}
function response(status, body, type = 'application/json') {
  return {status,ok:status>=200&&status<300,headers:{get:()=>type},text:async()=>typeof body==='string'?body:JSON.stringify(body)};
}

test('una conexión indescifrable no oculta las demás y pide volver a vincular', async () => {
  const result = await integrationStatuses(async provider => {
    if (provider === 'google') throw new Error('Unsupported state or unable to authenticate data');
    return provider === 'microsoft' ? {access_token:'unit-test-only'} : null;
  });
  assert.deepEqual(result.google, {connected:false,state:'reconnect'});
  assert.deepEqual(result.youtube, {connected:false,state:'disconnected'});
  assert.deepEqual(result.microsoft, {connected:true,state:'linked'});
});
test('un error de almacenamiento indica estado desconocido, no cuenta desvinculada', async () => {
  const result = await integrationStatuses(async () => {throw new Error('Storage unavailable');});
  assert.equal(result.google.connected, null);
  assert.equal(result.google.state, 'unavailable');
});
test('un permiso caducado sin renovación requiere volver a vincular', async () => {
  const result = await integrationStatuses(async () => ({access_token:'unit-test-only',expiry_date:Date.now()-1000}));
  assert.equal(result.google.state,'reconnect');
});
test('HTML, JSON corrupto y respuestas vacías no muestran texto técnico ni éxito', async () => {
  const {api} = apiFixture();
  for (const r of [response(500,'<html>secret-placeholder</html>','text/html'),response(200,'{'),response(200,'')]) {
    await assert.rejects(api.readJson(r), error => !/JSON|HTTP|SyntaxError|secret-placeholder|<html>/.test(error.message));
  }
});
test('los mensajes distinguen contraseña incorrecta, sesión vencida, permisos y archivo grande', async () => {
  const {api} = apiFixture();
  for (const [status,context,pattern] of [[401,'login',/correo o la contraseña/],[401,'integration',/sesión terminó/],[403,'integration',/permiso/],[413,'integration',/archivo/],[429,'login',/Espera/]]) {
    await assert.rejects(api.readJson(response(status,{success:false,error:'technical-placeholder'}),context), pattern);
  }
});
test('success false con HTTP 200 tampoco anuncia una operación completada', async () => {
  const {api} = apiFixture();
  await assert.rejects(api.readJson(response(200,{success:false,error:'No se completó la operación.'})), /No se completó/);
});
test('la solicitud incluye cookie y Accept JSON, y el fallo de red ofrece recuperación', async () => {
  let options;
  const {api} = apiFixture(async (_url,input) => {options=input;return response(200,{success:true});});
  await api.request('/api/integrations/status');
  assert.equal(options.credentials,'include');assert.equal(options.headers.Accept,'application/json');
  await assert.rejects(apiFixture().api.request('/api/integrations/status'),/conexión a Internet/);
});
test('un fallo de subida libera los botones y no muestra éxito falso', async () => {
  const {context} = apiFixture();
  const source = await readFile(new URL('../assets/js/view/FileWorkspaceView.js', import.meta.url),'utf8');
  vm.runInContext(source+'\nthis.FileView = FileWorkspaceView;',context);
  const notices=[];
  const view=Object.create(context.FileView.prototype);
  view.app={accessMode:'authenticated',showToast:(message,kind)=>notices.push({message,kind})};
  view.input={files:[{name:'archivo-unidad.txt',size:10,type:'text/plain'}]};
  view.driveButton={disabled:false};view.oneDriveButton={disabled:false};
  view.render=()=>{view.driveButton.disabled=false;view.oneDriveButton.disabled=false;};
  await view.upload('google/drive');
  assert.equal(view._uploading,false);assert.equal(view.driveButton.disabled,false);
  assert.equal(notices.some(n=>n.kind==='success'),false);assert.equal(notices.at(-1).kind,'error');
});
test('archivos mayores del límite no se envían al servidor', async () => {
  const {context} = apiFixture(async()=>{throw new Error('No debe enviarse');});
  const source=await readFile(new URL('../assets/js/view/FileWorkspaceView.js',import.meta.url),'utf8');
  vm.runInContext(source+'\nthis.FileView = FileWorkspaceView;',context);
  const notices=[];const view=Object.create(context.FileView.prototype);
  view.app={accessMode:'authenticated',showToast:(message,kind)=>notices.push({message,kind})};
  view.input={files:[{name:'grande.txt',size:5*1024*1024}]};
  await view.upload('google/drive');
  assert.match(notices[0].message,/4 MB/);assert.equal(notices[0].kind,'warning');
});
test('Microsoft personal no solicita permisos de Teams y la cuenta de organización sí', () => {
  assert.doesNotMatch(microsoftScopes('personal'), /Team/);
  assert.match(microsoftScopes('organization'), /Team.ReadBasic.All/);
});
test('los permisos revocados requieren volver a vincular, no volver a iniciar sesión en TaskMaster', () => {
  const error = {response:{status:400,data:{error:'invalid_grant'}}};
  assert.equal(integrationFailure(error,'Google').status,409);
  assert.match(integrationFailure(error,'Google').message,/Vuelve a vincular/);
  assert.equal(integrationFailure({status:403},'Google').status,403);
  assert.equal(integrationFailure(new Error('network'),'Google').status,502);
});
