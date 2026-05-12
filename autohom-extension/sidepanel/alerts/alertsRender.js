window.AutohomAlertsRender = (() => {
  function render(alert) {
    const section = window.AutohomSidepanelDom.byId('alerts-section');
    if (!section) {
      return;
    }

    const isError = alert.level === 'error';
    const selectorNames = window.AutohomAlertsStore.getSelectorNames();
    const friendlyName = selectorNames[alert.selectorName] || alert.selectorName;
    const timestamp = alert.timestamp || Date.now();
    const ts = new Date(timestamp).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const configuredSelector = alert.configuredSelector || '(vacío)';
    const usedStrategy = alert.usedStrategy || 'desconocida';

    const div = document.createElement('div');
    div.className = `alert-banner ${alert.level}`;
    div.dataset.alertSelector = alert.selectorName;
    div.innerHTML = `
      <div class="alert-header">
        <span class="alert-icon">${isError ? '🔴' : '🟡'}</span>
        <span class="alert-title">${isError ? 'Selector roto' : 'Selector desactualizado'}: ${friendlyName}</span>
        <span style="font-size:9px;color:var(--text-dim);font-family:'DM Mono',monospace;">${ts}</span>
      </div>
      <div class="alert-body">
        ${isError
          ? `El selector <span class="alert-selector">${configuredSelector}</span> no encontró el elemento y <strong>ningún fallback funcionó</strong>. La conversión falló.`
          : `El selector <span class="alert-selector">${configuredSelector}</span> no funcionó, pero la conversión continuó usando la estrategia <span class="alert-selector">${usedStrategy}</span>.`
        }
        <br>Actualiza el selector en el Site Profile Editor para evitar problemas futuros.
      </div>
      <div class="alert-actions">
        <button class="btn-alert-fix" data-selector="${alert.selectorName}">⚙️ Ir al editor</button>
        <button class="btn-alert-dismiss" data-selector="${alert.selectorName}">Ignorar</button>
      </div>
    `;

    div.querySelector('.btn-alert-fix').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('site-profile-editor.html') });
      window.AutohomAlerts.dismiss(alert.selectorName);
    });

    div.querySelector('.btn-alert-dismiss').addEventListener('click', () => {
      window.AutohomAlerts.dismiss(alert.selectorName);
    });

    section.prepend(div);
  }

  function toggleWrapper() {
    const wrapper = window.AutohomSidepanelDom.byId('alerts-wrapper');
    const section = window.AutohomSidepanelDom.byId('alerts-section');
    const hasAlerts = !!section && section.children.length > 0;
    wrapper.style.display = hasAlerts ? 'block' : 'none';
  }

  return {
    render,
    toggleWrapper,
  };
})();
