async function initSidepanel() {
  window.AutohomTabsController.init();
  window.AutohomAutomatizarLote?.init();
  await window.AutohomActas.init();
  await window.AutohomConversor.init();
  window.AutohomAlerts.init();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'DOWNLOAD_PENDING') {
      window.AutohomActas.handlePendingDownload(message);
    }
    if (message.type === 'MAPPING_SAVED') {
      window.AutohomActas.handleMappingSaved(message.mapping);
    }
    if (message.type === 'ILOVEPDF_PROGRESS') {
      window.AutohomConversor.handleProgress(message);
    }
    if (message.type === 'ILOVEPDF_BRIDGE_STATUS') {
      window.AutohomConversor.updateBridgeUI(message.connected);
    }
    if (message.type === 'AUTOHOM_OBSERVABILITY_CONTEXT') {
      window.AutohomConversor.updateObservabilityContext(message);
    }
    if (message.type === 'ILOVEPDF_SELECTOR_ALERT') {
      window.AutohomAlerts.addOrUpdate(message);
    }
    if (message.type === 'AUTO_BATCH_PROGRESS') {
      window.AutohomAutomatizarLote?.handleRuntimeMessage(message);
    }
  });

  await window.AutohomActas.restorePendingDownloads();
}

document.addEventListener('DOMContentLoaded', initSidepanel);
