window.AutohomAutomatizarLoteRender = (() => {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPresetRunMeta(preset) {
    const batchSize = preset?.config?.batchSize || window.AutohomAutomatizarLoteContracts.DEFAULT_BATCH_SIZE;
    const runCount = Number(preset?.runCount || 0);
    const lastRunAt = String(preset?.lastRunAt || '').trim();
    const lastRunLabel = lastRunAt ? new Date(lastRunAt).toLocaleString('es-CO') : 'Nunca ejecutado';

    return `Batch: ${batchSize} · Ejecutado ${runCount} ${runCount === 1 ? 'vez' : 'veces'} · ${lastRunLabel}`;
  }

  function getEls() {
    return {
      text: window.AutohomSidepanelDom.byId('auto-batch-text'),
      selector: window.AutohomSidepanelDom.byId('auto-batch-selector'),
      batchSize: window.AutohomSidepanelDom.byId('auto-batch-size'),
      presetName: window.AutohomSidepanelDom.byId('auto-batch-preset-name'),
      runButton: window.AutohomSidepanelDom.byId('btn-auto-batch-run'),
      resetButton: window.AutohomSidepanelDom.byId('btn-auto-batch-reset'),
      presetSaveButton: window.AutohomSidepanelDom.byId('btn-auto-batch-preset-save'),
      presetUpdateButton: window.AutohomSidepanelDom.byId('btn-auto-batch-preset-update'),
      status: window.AutohomSidepanelDom.byId('auto-batch-status'),
      presetsList: window.AutohomSidepanelDom.byId('auto-batch-presets-list'),
      presetsEmpty: window.AutohomSidepanelDom.byId('auto-batch-presets-empty'),
      presetsStatus: window.AutohomSidepanelDom.byId('auto-batch-presets-status'),
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

  function readPresetNameFromDom() {
    const els = getEls();
    return window.AutohomAutomatizarLoteContracts.normalizePresetName(els.presetName?.value);
  }

  function writePresetName(name) {
    const els = getEls();
    if (els.presetName) {
      els.presetName.value = window.AutohomAutomatizarLoteContracts.normalizePresetName(name);
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

  function setPresetsStatus(message, level = 'info') {
    const { presetsStatus } = getEls();
    if (!presetsStatus) {
      return;
    }

    presetsStatus.textContent = message || '';
    presetsStatus.classList.toggle('is-error', level === 'error');
    presetsStatus.classList.toggle('is-success', level === 'success');
    presetsStatus.classList.toggle('is-hidden', !message);
  }

  function renderPresetCard(preset, selectedPresetId) {
    const name = String(preset?.name || 'Sin nombre');
    const isSelected = selectedPresetId && selectedPresetId === preset.id;
    const selector = String(preset?.config?.selector || '');
    const text = String(preset?.config?.text || '');
    const details = [
      formatPresetRunMeta(preset),
      selector ? `Selector: ${selector}` : '',
      text ? `Texto: ${text.length > 80 ? `${text.slice(0, 80)}...` : text}` : '',
    ].filter(Boolean);

    return `
      <div class="auto-batch-preset-card${isSelected ? ' is-selected' : ''}" data-preset-id="${preset.id}">
        <div class="auto-batch-preset-name">${escapeHtml(name)}</div>
        <div class="auto-batch-preset-meta">${details.map(escapeHtml).join('<br />')}</div>
        <div class="auto-batch-preset-actions">
          <button type="button" class="auto-batch-preset-btn" data-action="apply-preset">Usar</button>
          <button type="button" class="auto-batch-preset-btn primary" data-action="run-preset">Ejecutar</button>
          <button type="button" class="auto-batch-preset-btn" data-action="update-preset">Actualizar</button>
          <button type="button" class="auto-batch-preset-btn danger" data-action="delete-preset">Eliminar</button>
        </div>
      </div>
    `;
  }

  function renderPresets() {
    const state = window.AutohomAutomatizarLoteStore.getState();
    const { presetsList, presetsEmpty, presetUpdateButton } = getEls();
    if (!presetsList || !presetsEmpty) {
      return;
    }

    const presets = Array.isArray(state.presets) ? state.presets : [];
    presetsList.innerHTML = presets
      .map((preset) => renderPresetCard(preset, state.selectedPresetId))
      .join('');
    presetsEmpty.style.display = presets.length ? 'none' : 'block';

    if (presetUpdateButton) {
      presetUpdateButton.disabled = !state.selectedPresetId;
    }
  }

  function renderState() {
    const state = window.AutohomAutomatizarLoteStore.getState();
    const { runButton, batchSize, presetSaveButton, presetUpdateButton } = getEls();

    if (runButton) {
      runButton.disabled = state.isRunning;
      runButton.textContent = state.isRunning ? 'Ejecutando...' : 'Ejecutar lote';
    }

    if (presetSaveButton) {
      presetSaveButton.disabled = state.isRunning;
    }

    if (presetUpdateButton) {
      presetUpdateButton.disabled = state.isRunning || !state.selectedPresetId;
    }

    if (batchSize && !batchSize.value) {
      batchSize.value = String(window.AutohomAutomatizarLoteContracts.DEFAULT_BATCH_SIZE);
    }

    setStatus(
      state.lastStatusMessage || 'Esperando configuracion...',
      state.lastStatusLevel || (state.lastError ? 'error' : 'info')
    );
    renderPresets();
  }

  return {
    getEls,
    readConfigFromDom,
    readPresetNameFromDom,
    writeConfig,
    writePresetName,
    setStatus,
    setPresetsStatus,
    renderPresets,
    renderPresetCard,
    renderState,
  };
})();
