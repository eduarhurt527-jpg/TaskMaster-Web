class FileWorkspaceView {
  constructor(app) {
    this.app = app;
    this.input = document.getElementById('workspace-files');
    this.list = document.getElementById('workspace-file-list');
    this.clearButton = document.getElementById('clear-workspace-files');
    this.input?.addEventListener('change', () => this.render());
    this.clearButton?.addEventListener('click', () => this.clear());
  }

  render() {
    const files = [...(this.input?.files || [])];
    this.clearButton.disabled = files.length === 0;
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
