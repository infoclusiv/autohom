window.AutohomLogs = {
  append(msg, level = 'info') {
    const container = window.AutohomSidepanelDom.byId('log-container');
    const ts = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    entry.innerHTML = `<span class="log-time">${ts}</span>${msg}`;
    container.prepend(entry);
    while (container.children.length > 100) {
      container.removeChild(container.lastChild);
    }
  },

  clear() {
    window.AutohomSidepanelDom.byId('log-container').innerHTML =
      '<div class="log-entry"><span class="log-time">--:--</span> Log limpiado.</div>';
  },
};
