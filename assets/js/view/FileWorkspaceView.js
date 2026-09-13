class FileWorkspaceView {
  constructor(app) {
    this.app = app;
    this.input = document.getElementById('workspace-files');
    this.list = document.getElementById('workspace-file-list');
    this.clearButton = document.getElementById('clear-workspace-files');
    this.driveButton = document.getElementById('upload-drive');
    this.oneDriveButton = document.getElementById('upload-onedrive');
    this.createDocButton = document.getElementById('create-google-doc');
    this.input?.addEventListener('change', () => this.render());
    this.clearButton?.addEventListener('click', () => this.clear());
    this.driveButton?.addEventListener('click', () => this.upload('google/drive'));
    this.oneDriveButton?.addEventListener('click', () => this.upload('microsoft/onedrive'));
    this.createDocButton?.addEventListener('click', () => this.createGoogleDoc());
  }

  render() {
    const files = [...(this.input?.files || [])];
    this.clearButton.disabled = files.length === 0;
    this.driveButton.disabled = files.length === 0;
    this.oneDriveButton.disabled = files.length === 0;
    if (!files.length) {
      this.list.innerHTML = '<li class="file-empty">Todavía no has seleccionado archivos.</li>';
      return;
    }
    this.list.innerHTML = files.map(file => `<li><span class="file-type">${this._extension(file.name)}</span><span><strong>${this._escape(file.name)}</strong><small>${this._size(file.size)}</small></span><em>Local</em></li>`).join('');
  }

  clear() {
    this.input.value = '';
    this.render();
    this.app.showToast('Selección local eliminada', 'info');
  }

  async upload(destination) {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const files = [...this.input.files];
    for (const file of files) {
      this.app.showToast(`Subiendo ${file.name}…`, 'info');
      const response = await fetch(`/api/integrations/${destination}/upload`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), 'X-File-Type': file.type || 'application/octet-stream' }, body: file });
      const data = await response.json();
      if (!response.ok) { this.app.showToast(data.error || 'No se pudo subir el archivo', 'error'); return; }
    }
    this.app.showToast('Archivos subidos correctamente', 'success');
  }

  async createGoogleDoc() {
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const title = window.prompt('Nombre del nuevo documento', 'Documento TaskMaster');
    if (!title) return;
    const response = await fetch('/api/integrations/google/docs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    const data = await response.json();
    if (!response.ok) return this.app.showToast(data.error || 'No se pudo crear el documento', 'error');
    window.open(data.url, '_blank', 'noopener');
    this.app.showToast('Documento creado en Google Docs', 'success');
  }

  _extension(name) {
    const extension = String(name).split('.').pop();
    return extension && extension !== name ? extension.slice(0, 4).toUpperCase() : 'FILE';
  }

  _size(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  _escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
  }
}
