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
    presets: [],
    selectedPresetId: '',
    presetsLoaded: false,
    presetsError: '',
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

  function setPresets(presets) {
    state.presets = Array.isArray(presets) ? presets.map((preset) => ({ ...preset })) : [];
    state.presetsLoaded = true;
    state.presetsError = '';
  }

  function setSelectedPresetId(presetId) {
    state.selectedPresetId = String(presetId || '');
  }

  function setPresetsError(error) {
    state.presetsError = String(error || '');
    state.presetsLoaded = true;
  }

  function getPresetById(presetId) {
    return state.presets.find((preset) => preset.id === presetId) || null;
  }

  function upsertPresetInMemory(preset) {
    if (!preset || !preset.id) {
      return;
    }

    const index = state.presets.findIndex((item) => item.id === preset.id);
    if (index === -1) {
      state.presets = [...state.presets, { ...preset }];
      return;
    }

    state.presets = state.presets.map((item, itemIndex) =>
      itemIndex === index ? { ...preset } : item
    );
  }

  function removePresetFromMemory(presetId) {
    state.presets = state.presets.filter((preset) => preset.id !== presetId);
    if (state.selectedPresetId === presetId) {
      state.selectedPresetId = '';
    }
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
    setPresets,
    setSelectedPresetId,
    setPresetsError,
    getPresetById,
    upsertPresetInMemory,
    removePresetFromMemory,
    reset,
  };
})();
