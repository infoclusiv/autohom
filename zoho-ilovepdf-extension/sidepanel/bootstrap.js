async function initSidepanel() {
  window.AutohomTabsController.init();
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
    if (message.type === 'ILOVEPDF_SELECTOR_ALERT') {
      window.AutohomAlerts.addOrUpdate(message);
    }
  });

  await window.AutohomActas.restorePendingDownloads();
}

document.addEventListener('DOMContentLoaded', initSidepanel);
