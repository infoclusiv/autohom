window.AutohomAlerts = (() => {
  function init() {
    loadFromStorage();
  }

  function loadFromStorage() {
    const storageKey = window.AutohomAlertsStore.getStorageKey();
    chrome.storage.local.get(storageKey, (result) => {
      const section = window.AutohomSidepanelDom.byId('alerts-section');
      const alerts = Array.isArray(result[storageKey]) ? result[storageKey] : [];
      const seen = new Set();

      section.innerHTML = '';
      alerts.forEach((alert) => {
        if (!alert?.selectorName || seen.has(alert.selectorName)) {
          return;
        }
        seen.add(alert.selectorName);
        window.AutohomAlertsRender.render(alert);
      });
      window.AutohomAlertsRender.toggleWrapper();
    });
  }

  function addOrUpdate(alert) {
    if (!alert?.selectorName) {
      return;
    }

    const existing = document.querySelector(`[data-alert-selector="${alert.selectorName}"]`);
    if (existing) {
      existing.remove();
    }

    window.AutohomAlertsRender.render(alert);
    window.AutohomAlertsRender.toggleWrapper();

    const selectorNames = window.AutohomAlertsStore.getSelectorNames();
    if (alert.level === 'error') {
      window.AutohomToast.show(`❌ Selector roto: ${selectorNames[alert.selectorName] || alert.selectorName}`);
    } else {
      window.AutohomToast.show(`⚠️ Selector desactualizado: ${selectorNames[alert.selectorName] || alert.selectorName}`);
    }
  }

  function dismiss(selectorName) {
    const element = document.querySelector(`[data-alert-selector="${selectorName}"]`);
    if (element) {
      element.style.opacity = '0';
      element.style.transform = 'translateX(-8px)';
      setTimeout(() => {
        element.remove();
        window.AutohomAlertsRender.toggleWrapper();
      }, 250);
    }

    const storageKey = window.AutohomAlertsStore.getStorageKey();
    chrome.storage.local.get(storageKey, (result) => {
      const alerts = Array.isArray(result[storageKey]) ? result[storageKey] : [];
      chrome.storage.local.set({
        [storageKey]: alerts.filter((alert) => alert.selectorName !== selectorName),
      });
    });
  }

  function clearAll() {
    window.AutohomSidepanelDom.byId('alerts-section').innerHTML = '';
    window.AutohomAlertsRender.toggleWrapper();
    chrome.storage.local.remove(window.AutohomAlertsStore.getStorageKey());
  }

  return {
    init,
    loadFromStorage,
    addOrUpdate,
    dismiss,
    clearAll,
  };
})();
