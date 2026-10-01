class FileWorkspaceView {
  constructor(app) {
    this.app = app;
    this.input = document.getElementById('workspace-files');
    this.list = document.getElementById('workspace-file-list');
    this.clearButton = document.getElementById('clear-workspace-files');
    this.driveButton = document.getElementById('upload-drive');
    this.oneDriveButton = document.getElementById('upload-onedrive');
    this.createDocButton = document.getElementById('create-google-doc');
    this.docTitle = document.getElementById('google-doc-title');
    this.docForm = document.getElementById('google-doc-form');
    this.input?.addEventListener('change', () => this.render());
    this.clearButton?.addEventListener('click', () => this.clear());
    this.driveButton?.addEventListener('click', () => this.upload('google/drive'));
    this.oneDriveButton?.addEventListener('click', () => this.upload('microsoft/onedrive'));
    this.docForm?.addEventListener('submit', event => {
      event.preventDefault();
      this.createGoogleDoc();
    });
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
    if (this._uploading) return;
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const files = [...this.input.files];
    if (!files.length) return this.app.showToast('Selecciona al menos un archivo para subir.', 'info');
    if (files.some(file => file.size > 4 * 1024 * 1024)) return this.app.showToast('Selecciona archivos de hasta 4 MB para subir desde TaskMaster. Para archivos mayores, usa Drive o OneDrive directamente.', 'warning');
    this._uploading = true;
    this.driveButton.disabled = true;
    this.oneDriveButton.disabled = true;
    let uploaded = 0;
    try {
    for (const file of files) {
      this.app.showToast(`Subiendo ${file.name}…`, 'info');
      await taskMasterApi.request(`/api/integrations/${destination}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), 'X-File-Type': file.type || 'application/octet-stream' }, body: file }, 'integration');
      uploaded++;
    }
    this.app.showToast('Archivos subidos correctamente', 'success');
    } catch (error) {
      this.app.showToast(`${uploaded ? `Se subieron ${uploaded} de ${files.length} archivos. ` : ''}${error.message}`, 'error');
    } finally {
      this._uploading = false;
      this.render();
    }
  }

  async createGoogleDoc() {
    if (this._creatingDoc) return;
    if (this.app.accessMode !== 'authenticated') return this.app.authView.openMode('login');
    const title = this.docTitle?.value.trim();
    if (!title) {
      this.docTitle?.focus();
      return this.app.showToast('Escribe un nombre para el documento.', 'info');
    }
    this._creatingDoc = true;
    this.createDocButton.disabled = true;
    try {
    const data = await taskMasterApi.request('/api/integrations/google/docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.trim() }) }, 'integration');
    if (!data.documentId || !data.url?.startsWith('https://docs.google.com/document/d/')) throw new Error('No pudimos confirmar la creación del documento. Revisa Google Docs antes de volver a intentarlo.');
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = data.url;
    link.textContent = `Abrir ${title.trim()}`;
    link.target = '_blank';
    link.rel = 'noopener';
    item.appendChild(link);
    this.list.appendChild(item);
    window.open(data.url, '_blank', 'noopener');
    this.app.showToast('Documento creado en Google Docs', 'success');
    } catch (error) {
      this.app.showToast(error.message, 'error');
    } finally {
      this._creatingDoc = false;
      this.createDocButton.disabled = false;
    }
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
