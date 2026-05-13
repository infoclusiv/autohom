window.AutohomAutomatizarLoteStore = (() => {
  const state = {
    isRunning: false,
    lastRunId: '',
    lastConfig: null,
    total: 0,
    processed: 0,
    lastError: '',
    lastStatusLevel: 'info',
    lastStatusMessage: 'Esperando configuracion...',
  };

  function getState() {
    return { ...state };
  }

  function setRunning(isRunning) {
    state.isRunning = Boolean(isRunning);
  }

  function setConfig(config, runId) {
    state.lastConfig = config ? { ...config } : null;
    state.lastRunId = runId || '';
  }

  function setProgress({ total = 0, processed = 0, message = '' } = {}) {
    state.total = total;
    state.processed = processed;
    state.lastError = '';
    state.lastStatusLevel = 'info';
    state.lastStatusMessage = message || `Encontrados: ${total} | Procesados: ${processed}`;
  }

  function setError(error) {
    state.lastError = String(error || '');
    state.lastStatusLevel = state.lastError ? 'error' : 'info';
    state.lastStatusMessage = state.lastError ? `Error: ${state.lastError}` : '';
  }

  function setStatusLevel(level) {
    state.lastStatusLevel = level || 'info';
  }

  function reset() {
    state.isRunning = false;
    state.lastRunId = '';
    state.lastConfig = null;
    state.total = 0;
    state.processed = 0;
    state.lastError = '';
    state.lastStatusLevel = 'info';
    state.lastStatusMessage = 'Progreso reiniciado.';
  }

  return {
    getState,
    setRunning,
    setConfig,
    setProgress,
    setError,
    setStatusLevel,
    reset,
  };
})();
