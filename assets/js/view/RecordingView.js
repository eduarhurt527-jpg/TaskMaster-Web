class RecordingView {
  constructor(app) {
    this.app = app;
    this.video = document.getElementById('recorder-video');
    this.placeholder = document.getElementById('recorder-placeholder');
    this.status = document.getElementById('recorder-status');
    this.indicator = document.getElementById('recording-indicator');
    this.timer = document.getElementById('recording-timer');
    this.startButton = document.getElementById('record-start');
    this.pauseButton = document.getElementById('record-pause');
    this.stopButton = document.getElementById('record-stop');
    this.discardButton = document.getElementById('record-discard');
    this.download = document.getElementById('record-download');
    this.stream = null;
    this.recorder = null;
    this.parts = [];
    this.objectUrl = null;
    this.seconds = 0;
    this.clock = null;
    this.discarding = false;
    this._bind();
    this._setSupported();
  }

  _bind() {
    document.querySelectorAll('[data-record-source]').forEach(button => {
      button.addEventListener('click', () => this.prepare(button.dataset.recordSource));
    });
    this.startButton?.addEventListener('click', () => this.start());
    this.pauseButton?.addEventListener('click', () => this.togglePause());
    this.stopButton?.addEventListener('click', () => this.stop());
    this.discardButton?.addEventListener('click', () => this.discard());
  }

  _setSupported() {
    const supported = Boolean(navigator.mediaDevices && window.MediaRecorder);
    if (!supported) {
      this.status.textContent = 'Este navegador no admite la grabación mediante MediaRecorder.';
      document.querySelectorAll('[data-record-source]').forEach(button => { button.disabled = true; });
    }
  }

  async prepare(source) {
    this.cleanupStream();
    this._clearDownload();
    try {
      this.status.textContent = 'Esperando autorización del navegador…';
      let stream;
      if (source === 'screen' || source === 'screen-mic') {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (source === 'screen-mic') {
          const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream = new MediaStream([...display.getVideoTracks(), ...microphone.getAudioTracks()]);
        } else {
          stream = display;
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: source === 'camera-mic' });
      }
      this.stream = stream;
      this.video.srcObject = stream;
      this.placeholder.hidden = true;
      this.startButton.disabled = false;
      this.discardButton.disabled = false;
      this.status.textContent = 'Vista previa preparada. Pulsa Iniciar cuando estés listo.';
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => this.stop()));
    } catch (error) {
      this.cleanupStream();
      this.status.textContent = error.name === 'NotAllowedError'
        ? 'Permiso cancelado. TaskMaster no activó ni guardó ningún dispositivo.'
        : `No fue posible preparar la grabación: ${error.message}`;
    }
  }

  start() {
    if (!this.stream || !window.MediaRecorder) return;
    this.parts = [];
    this.recorder = new MediaRecorder(this.stream, this._recorderOptions());
    this.recorder.addEventListener('dataavailable', event => { if (event.data.size) this.parts.push(event.data); });
    this.recorder.addEventListener('stop', () => this._finish());
    this.recorder.start(1000);
    this.seconds = 0;
    this._renderTime();
    this.clock = window.setInterval(() => { this.seconds += 1; this._renderTime(); }, 1000);
    this.indicator.hidden = false;
    this.startButton.disabled = true;
    this.pauseButton.disabled = false;
    this.stopButton.disabled = false;
    this.status.textContent = 'Grabación en curso. El archivo permanece local en este navegador.';
  }

  togglePause() {
    if (!this.recorder) return;
    if (this.recorder.state === 'recording') {
      this.recorder.pause();
      clearInterval(this.clock);
      this.pauseButton.textContent = 'Reanudar';
      this.status.textContent = 'Grabación pausada.';
    } else if (this.recorder.state === 'paused') {
      this.recorder.resume();
      this.clock = window.setInterval(() => { this.seconds += 1; this._renderTime(); }, 1000);
      this.pauseButton.textContent = 'Pausar';
      this.status.textContent = 'Grabación reanudada.';
    }
  }

  stop() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    else this.cleanupStream();
  }

  _finish() {
    clearInterval(this.clock);
    const type = this.recorder?.mimeType || 'video/webm';
    const blob = new Blob(this.parts, { type });
    this.cleanupStream();
    this.indicator.hidden = true;
    this.pauseButton.disabled = true;
    this.pauseButton.textContent = 'Pausar';
    this.stopButton.disabled = true;
    this.discardButton.disabled = false;
    if (this.discarding) {
      this.discarding = false;
      return;
    }
    if (blob.size) {
      this.objectUrl = URL.createObjectURL(blob);
      this.video.srcObject = null;
      this.video.src = this.objectUrl;
      this.video.controls = true;
      this.download.href = this.objectUrl;
      this.download.download = `taskmaster-grabacion-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      this.download.hidden = false;
      this.status.textContent = 'Grabación lista. Puedes revisarla o descargarla; no se ha subido al servidor.';
    }
  }

  discard() {
    if ((this.stream || this.objectUrl) && !window.confirm('¿Descartar esta grabación local?')) return;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.discarding = true;
      this.recorder.stop();
    }
    this.cleanupStream();
    this._clearDownload();
    this.video.removeAttribute('src');
    this.video.controls = false;
    this.video.load();
    this.placeholder.hidden = false;
    this.startButton.disabled = true;
    this.pauseButton.disabled = true;
    this.stopButton.disabled = true;
    this.discardButton.disabled = true;
    this.indicator.hidden = true;
    this.status.textContent = 'La grabación fue descartada y no se almacenó.';
  }

  cleanupStream() {
    clearInterval(this.clock);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.video?.srcObject) this.video.srcObject = null;
  }

  _clearDownload() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.download?.removeAttribute('href');
    if (this.download) this.download.hidden = true;
  }

  _renderTime() {
    const minutes = String(Math.floor(this.seconds / 60)).padStart(2, '0');
    const seconds = String(this.seconds % 60).padStart(2, '0');
    this.timer.textContent = `${minutes}:${seconds}`;
  }

  _recorderOptions() {
    const preferred = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type));
    return mimeType ? { mimeType } : {};
  }
}
