window.AutohomAutomatizarLoteRender = (() => {
  function getEls() {
    return {
      text: window.AutohomSidepanelDom.byId('auto-batch-text'),
      selector: window.AutohomSidepanelDom.byId('auto-batch-selector'),
      batchSize: window.AutohomSidepanelDom.byId('auto-batch-size'),
      runButton: window.AutohomSidepanelDom.byId('btn-auto-batch-run'),
      resetButton: window.AutohomSidepanelDom.byId('btn-auto-batch-reset'),
      status: window.AutohomSidepanelDom.byId('auto-batch-status'),
    };
  }

  function readConfigFromDom() {
    const els = getEls();

    return window.AutohomAutomatizarLoteContracts.normalizeConfig({
      text: els.text?.value,
      selector: els.selector?.value,
      batchSize: els.batchSize?.value,
    });
  }

  function writeConfig(config = {}) {
    const els = getEls();

    if (els.text) {
      els.text.value = config.text || '';
    }
    if (els.selector) {
      els.selector.value = config.selector || '';
    }
    if (els.batchSize) {
      els.batchSize.value = String(
        config.batchSize || window.AutohomAutomatizarLoteContracts.DEFAULT_BATCH_SIZE
      );
    }
  }

  function setStatus(message, level = 'info') {
    const { status } = getEls();
    if (!status) {
      return;
    }

    status.textContent = message || '';
    status.classList.toggle('is-error', level === 'error');
    status.classList.toggle('is-success', level === 'success');
  }

  function renderState() {
    const state = window.AutohomAutomatizarLoteStore.getState();
    const { runButton, batchSize } = getEls();

    if (runButton) {
      runButton.disabled = state.isRunning;
      runButton.textContent = state.isRunning ? 'Ejecutando...' : 'Ejecutar lote';
    }

    if (batchSize && !batchSize.value) {
      batchSize.value = String(window.AutohomAutomatizarLoteContracts.DEFAULT_BATCH_SIZE);
    }

    setStatus(
      state.lastStatusMessage || 'Esperando configuracion...',
      state.lastStatusLevel || (state.lastError ? 'error' : 'info')
    );
  }

  return {
    getEls,
    readConfigFromDom,
    writeConfig,
    setStatus,
    renderState,
  };
})();
