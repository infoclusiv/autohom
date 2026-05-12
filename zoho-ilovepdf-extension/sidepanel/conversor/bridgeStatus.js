window.AutohomConversorBridge = (() => {
  async function checkBridge() {
    try {
      const response = await window.AutohomChromeMessages.sendRuntimeMessage({ type: 'ILOVEPDF_STATUS' });
      if (response?.ok) {
        updateBridgeUI(response.bridgeConnected);
      }
    } catch (error) {
      // Ignore transient runtime messaging failures.
    }
  }

  function updateBridgeUI(connected) {
    const dot = window.AutohomSidepanelDom.byId('bridge-dot');
    const label = window.AutohomSidepanelDom.byId('bridge-label');
    dot.className = `bridge-dot ${connected ? 'connected' : 'disconnected'}`;
    label.textContent = connected
      ? 'Conectado a Python App'
      : 'Desconectado — inicia python app.py';
    if (connected) {
      window.AutohomConversor.refreshPdfs();
    }
  }

  return {
    checkBridge,
    updateBridgeUI,
  };
})();
