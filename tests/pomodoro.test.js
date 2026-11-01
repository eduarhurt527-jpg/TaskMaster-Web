import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/viewmodel/TaskViewModel.js', import.meta.url), 'utf8');
const viewSource = await readFile(new URL('../assets/js/view/PomodoroView.js', import.meta.url), 'utf8');
function fixture(update) {
  const context = vm.createContext({taskModel:{update,agruparPorDia:()=>[]},materiaModel:{getById:()=>null}});
  vm.runInContext(source + '\nthis.subject = taskViewModel;', context);
  const subject = context.subject;
  subject._state.tareas = [{id:1,pomodoros_real:2,general_categoria:'Trabajo'}];
  return subject;
}
test('un guardado rechazado no incrementa sesiones ni anuncia éxito', async () => {
  const subject = fixture(async () => ({success:false,error:'Sesión vencida'}));
  const events=[];
  subject.subscribe(e=>events.push(e));
  assert.equal((await subject.registrarPomodoro(1)).success,false);
  assert.equal(subject.getTareas()[0].pomodoros_real,2);
  assert.equal(events.length,0);
});
test('un fallo de red conserva el contador', async () => {
  const subject=fixture(async()=>{throw new Error('network');});
  assert.equal((await subject.registrarPomodoro(1)).success,false);
  assert.equal(subject.getTareas()[0].pomodoros_real,2);
});
test('la sesión confirmada incrementa números recibidos como texto', async () => {
  const subject=fixture(async(_id,changes)=>{assert.equal(changes.pomodoros_real,3);return {success:true};});
  subject._state.tareas[0].pomodoros_real='2';
  assert.equal((await subject.registrarPomodoro(1)).pomodoros_real,3);
  assert.equal(subject.getTareas()[0].pomodoros_real,3);
  assert.equal(subject.getDatosDashboard().pomTotal,3);
});
function timerFixture(register) {
  const context=vm.createContext({clearInterval:()=>{},app:{showToast:()=>{}}});
  vm.runInContext(viewSource+'\nthis.Timer = PomodoroView;',context);
  const timer=Object.create(context.Timer.prototype);
  Object.assign(timer,{_vm:{registrarPomodoro:register},_tareaId:1,_duracion:1500,_duracionActual:1500,_sesionAct:2,
    $btnToggle:{classList:{remove:()=>{}}},$btnReset:{},$btnSkip:{},$label:{},
    _actualizarUI:()=>{},_renderSessions:()=>{},_notificar:()=>{},reset:()=>{timer._duracionActual=1500;}});
  return timer;
}
test('terminar el descanso no guarda otra sesión',async()=>{
  let calls=0; const timer=timerFixture(async()=>{calls++;});
  timer._duracionActual=300;
  await timer._completarSesion();
  assert.equal(calls,0);
  assert.equal(timer._sesionAct,2);
});
test('dos clics simultáneos solo guardan una sesión',async()=>{
  let resolve, calls=0;
  const timer=timerFixture(()=>{calls++;return new Promise(r=>{resolve=r;});});
  const first=timer._completarSesion();
  await timer._completarSesion();
  resolve({success:true,pomodoros_real:3});
  await first;
  assert.equal(calls,1);
  assert.equal(timer._sesionAct,3);
  assert.equal(timer.$btnSkip.disabled,false);
});
test('el temporizador libera controles y conserva el contador si falla el guardado',async()=>{
  const timer=timerFixture(async()=>({success:false}));
  await timer._completarSesion();
  assert.equal(timer._sesionAct,2);
  assert.equal(timer.$label.textContent,'Sesión sin guardar');
  assert.equal(timer.$btnSkip.disabled,false);
});
