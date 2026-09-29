import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('el temporizador respeta las duraciones y no registra un descanso como enfoque', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      style: {}, classList: { add() {}, remove() {} }, addEventListener() {}, textContent: ''
    });
    return elements.get(id);
  };
  let registered = 0;
  const context = {
    document: { getElementById: element },
    window: { app: { preferences: { values: { focus: 45, break: 10, alerts: false } } } },
    app: { showToast() {} },
    clearInterval() {}, setInterval() { return 1; },
    Math
  };
  const code = fs.readFileSync(new URL('../assets/js/view/PomodoroView.js', import.meta.url), 'utf8');
  const PomodoroView = vm.runInNewContext(`${code}\nPomodoroView`, context);
  const timer = new PomodoroView({ async registrarPomodoro() { registered++; } });
  timer.iniciar({ id: 1, pomodoros_est: 2 });
  assert.equal(timer._restantes, 45 * 60);
  await timer._completarSesion();
  assert.equal(registered, 1);
  assert.equal(timer._restantes, 10 * 60);
  assert.equal(timer._fase, 'break');
  await timer._completarSesion();
  assert.equal(registered, 1);
  assert.equal(timer._restantes, 45 * 60);
  assert.equal(timer._fase, 'focus');
});
