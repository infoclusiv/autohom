window.AutohomAutomatizarLote = (() => {
  function truncateForLog(value, max = 80) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function logPresetEvent(eventName, details = {}, level = 'info') {
    const safeDetails = Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');

    window.AutohomLogs.append(`${eventName}${safeDetails ? ` ${safeDetails}` : ''}`, level);
  }

  async function getActiveTab() {
    return await new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(Array.isArray(tabs) ? tabs[0] || null : null);
      });
    });
  }

  async function sendTabMessage(tabId, message) {
    return await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'No se pudo enviar el mensaje a la pestana.'));
          return;
        }

        if (response?.ok === false) {
          reject(new Error(response.error || 'La operacion no pudo completarse.'));
          return;
        }

        resolve(response);
      });
    });
  }

  async function ensureBatchContentScript(tabId) {
    try {
      await sendTabMessage(tabId, { type: 'AUTO_BATCH_PING' });
      return;
    } catch (_error) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['automation/batchClickContent.js'],
      });
    }
  }

  function isAllowedTargetTab(tab) {
    const url = String(tab?.url || '');
    return url.startsWith('https://crm.zoho.com/');
  }

  function buildProgressMessage(message) {
    const status = message.status || 'partial';
    const base = `Encontrados: ${message.total || 0} | Procesados: ${message.processed || 0}`;

    if (status === 'completed') {
      return `${base} | Lote completado`;
    }

    if (status === 'empty') {
      return 'No se encontraron elementos visibles que coincidan.';
    }

    return base;
  }

  async function loadPresetsIntoStore() {
    logPresetEvent('automation.batch.presets.load_started', {
      storageKey: window.AutohomAutomatizarLoteContracts.PRESETS_STORAGE_KEY,
    });

    try {
      const presets = await window.AutohomAutomatizarLotePresetsStorage.loadPresets();
      window.AutohomAutomatizarLoteStore.setPresets(presets);

      const selectedPresetId = window.AutohomAutomatizarLoteStore.getState().selectedPresetId;
      if (selectedPresetId && !window.AutohomAutomatizarLoteStore.getPresetById(selectedPresetId)) {
        window.AutohomAutomatizarLoteStore.setSelectedPresetId('');
      }

      window.AutohomAutomatizarLoteRender.setPresetsStatus(
        presets.length ? `${presets.length} configuraciones disponibles.` : '',
        'info'
      );
      window.AutohomAutomatizarLoteRender.renderState();

      logPresetEvent('automation.batch.presets.loaded', {
        count: presets.length,
        storageKey: window.AutohomAutomatizarLoteContracts.PRESETS_STORAGE_KEY,
      });
      return presets;
    } catch (error) {
      const message = error?.message || String(error);
      window.AutohomAutomatizarLoteStore.setPresets([]);
      window.AutohomAutomatizarLoteStore.setPresetsError(message);
      window.AutohomAutomatizarLoteRender.setPresetsStatus(
        'No se pudieron cargar las configuraciones guardadas.',
        'error'
      );
      window.AutohomAutomatizarLoteRender.renderState();
      logPresetEvent(
        'automation.batch.presets.load_failed',
        {
          expected: 'valid chrome.storage.local payload',
          actual: 'storage read failed',
          error: message,
        },
        'error'
      );
      return [];
    }
  }

  async function runBatchWithConfig(config, source = 'manual', preset = null) {
    const normalizedConfig = window.AutohomAutomatizarLoteContracts.normalizeConfig(config);
    const validation = window.AutohomAutomatizarLoteContracts.validateConfig(normalizedConfig);

    if (!validation.ok) {
      const message = validation.errors.join(' ');
      window.AutohomAutomatizarLoteStore.setError(message);
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show(message);
      window.AutohomLogs.append(`automation.batch.validation_failed ${message}`, 'error');

      if (source === 'preset') {
        logPresetEvent(
          'automation.batch.preset.run_failed',
          {
            expected: 'valid executable config',
            actual: 'invalid preset config',
            errors: message,
            presetId: preset?.id || '',
            name: preset?.name || '',
          },
          'error'
        );
      }

      return false;
    }

    const runId = window.AutohomAutomatizarLoteContracts.buildRunId();

    try {
      window.AutohomAutomatizarLoteStore.setRunning(true);
      window.AutohomAutomatizarLoteStore.setConfig(normalizedConfig, runId);
      window.AutohomAutomatizarLoteRender.setStatus('Buscando elementos...');
      window.AutohomAutomatizarLoteRender.renderState();

      const tab = await getActiveTab();
      if (!tab) {
        throw new Error('No hay pestana activa.');
      }
      if (!isAllowedTargetTab(tab)) {
        throw new Error('La automatizacion por lote esta habilitada solo para pestanas de Zoho CRM en este MVP.');
      }

      window.AutohomLogs.append(
        `automation.batch.run_requested run=${runId} source=${source} tab=${tab.id} text="${truncateForLog(normalizedConfig.text)}" selector="${normalizedConfig.selector}" batch=${normalizedConfig.batchSize}`
      );

      window.AutohomLogs.append(`automation.batch.active_tab tab=${tab.id} url=${tab.url || ''}`);

      await ensureBatchContentScript(tab.id);

      await sendTabMessage(tab.id, {
        type: 'AUTO_BATCH_RUN',
        runId,
        text: normalizedConfig.text,
        selector: normalizedConfig.selector,
        batchSize: normalizedConfig.batchSize,
      });

      window.AutohomAutomatizarLoteStore.setProgress({
        total: 0,
        processed: 0,
        message: 'Lote enviado. Esperando progreso...',
      });
      window.AutohomAutomatizarLoteStore.setStatusLevel('info');
      window.AutohomAutomatizarLoteRender.renderState();
      return true;
    } catch (error) {
      const message = error?.message || String(error);
      const isTabMessageError =
        message.includes('Receiving end does not exist') ||
        message.includes('Could not establish connection') ||
        message.includes('No se pudo enviar el mensaje a la pestana') ||
        message.includes('Cannot access contents of the page');
      const visibleMessage = isTabMessageError
        ? `No se pudo contactar el content script. Detalle: ${message}`
        : message;

      window.AutohomAutomatizarLoteStore.setError(visibleMessage);
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show(`Error: ${message}`);
      window.AutohomLogs.append(
        `${isTabMessageError ? 'automation.batch.tab_message_failed' : 'automation.batch.run_failed'} ${message}`,
        'error'
      );

      if (source === 'preset') {
        logPresetEvent(
          'automation.batch.preset.run_failed',
          {
            expected: 'AUTO_BATCH_RUN dispatched',
            actual: message,
            presetId: preset?.id || '',
            name: preset?.name || '',
          },
          'error'
        );
      }

      return false;
    } finally {
      window.AutohomAutomatizarLoteStore.setRunning(false);
      window.AutohomAutomatizarLoteRender.renderState();
    }
  }

  async function runBatch() {
    const config = window.AutohomAutomatizarLoteRender.readConfigFromDom();
    return await runBatchWithConfig(config, 'manual');
  }

  async function saveCurrentConfigAsPreset() {
    const name = window.AutohomAutomatizarLoteRender.readPresetNameFromDom();
    const config = window.AutohomAutomatizarLoteRender.readConfigFromDom();
    logPresetEvent('automation.batch.preset.save_requested', {
      name,
      source: 'current_form',
      selector: config.selector,
      batchSize: config.batchSize,
      text: truncateForLog(config.text),
    });

    try {
      const preset = await window.AutohomAutomatizarLotePresetsStorage.savePresetFromConfig({ name, config });
      window.AutohomAutomatizarLoteStore.setSelectedPresetId(preset.id);
      window.AutohomAutomatizarLoteRender.writePresetName(preset.name);
      await loadPresetsIntoStore();
      window.AutohomAutomatizarLoteRender.setPresetsStatus('Configuracion guardada correctamente.', 'success');
      window.AutohomToast.show('Configuracion guardada');
      logPresetEvent('automation.batch.preset.saved', {
        presetId: preset.id,
        name: preset.name,
        totalPresets: window.AutohomAutomatizarLoteStore.getState().presets.length,
      });
    } catch (error) {
      const message = error?.message || String(error);
      window.AutohomAutomatizarLoteRender.setPresetsStatus(message, 'error');
      window.AutohomToast.show(message);
      logPresetEvent(
        'automation.batch.preset.save_failed',
        {
          expected: 'valid preset contract',
          actual: 'invalid preset',
          errors: message,
          name,
        },
        'error'
      );
    }
  }

  async function updateSelectedPresetFromCurrentConfig() {
    const selectedPresetId = window.AutohomAutomatizarLoteStore.getState().selectedPresetId;
    const selectedPreset = window.AutohomAutomatizarLoteStore.getPresetById(selectedPresetId);
    const config = window.AutohomAutomatizarLoteRender.readConfigFromDom();
    const name = window.AutohomAutomatizarLoteRender.readPresetNameFromDom() || selectedPreset?.name || '';

    if (!selectedPresetId || !selectedPreset) {
      window.AutohomAutomatizarLoteRender.setPresetsStatus(
        'Selecciona una configuracion antes de actualizarla.',
        'error'
      );
      return;
    }

    try {
      const preset = await window.AutohomAutomatizarLotePresetsStorage.savePresetFromConfig({
        name,
        config,
        existingPresetId: selectedPresetId,
      });
      window.AutohomAutomatizarLoteRender.writePresetName(preset.name);
      await loadPresetsIntoStore();
      window.AutohomAutomatizarLoteRender.setPresetsStatus('Configuracion actualizada correctamente.', 'success');
      window.AutohomToast.show('Configuracion actualizada');
      logPresetEvent('automation.batch.preset.saved', {
        presetId: preset.id,
        name: preset.name,
        mode: 'update',
        totalPresets: window.AutohomAutomatizarLoteStore.getState().presets.length,
      });
    } catch (error) {
      const message = error?.message || String(error);
      window.AutohomAutomatizarLoteRender.setPresetsStatus(message, 'error');
      window.AutohomToast.show(message);
      logPresetEvent(
        'automation.batch.preset.save_failed',
        {
          expected: 'valid preset update',
          actual: message,
          presetId: selectedPresetId,
          name,
        },
        'error'
      );
    }
  }

  function selectPreset(presetId) {
    const preset = window.AutohomAutomatizarLoteStore.getPresetById(presetId);
    if (!preset) {
      return null;
    }

    window.AutohomAutomatizarLoteStore.setSelectedPresetId(preset.id);
    if (!window.AutohomAutomatizarLoteRender.readPresetNameFromDom()) {
      window.AutohomAutomatizarLoteRender.writePresetName(preset.name);
    }
    window.AutohomAutomatizarLoteRender.renderState();
    return preset;
  }

  async function applyPresetToForm(presetId) {
    const preset = window.AutohomAutomatizarLoteStore.getPresetById(presetId);
    if (!preset) {
      window.AutohomAutomatizarLoteRender.setPresetsStatus('No se encontro la configuracion seleccionada.', 'error');
      return;
    }

    window.AutohomAutomatizarLoteStore.setSelectedPresetId(preset.id);
    window.AutohomAutomatizarLoteRender.writeConfig(preset.config);
    window.AutohomAutomatizarLoteRender.writePresetName(preset.name);
    window.AutohomAutomatizarLoteRender.setPresetsStatus(`Configuracion "${preset.name}" cargada.`, 'success');
    window.AutohomAutomatizarLoteRender.renderState();
    logPresetEvent('automation.batch.preset.applied', {
      presetId: preset.id,
      name: preset.name,
    });
  }

  async function runPreset(presetId) {
    const preset = window.AutohomAutomatizarLoteStore.getPresetById(presetId);
    if (!preset) {
      window.AutohomAutomatizarLoteRender.setPresetsStatus('No se encontro la configuracion seleccionada.', 'error');
      return;
    }

    window.AutohomAutomatizarLoteStore.setSelectedPresetId(preset.id);
    window.AutohomAutomatizarLoteRender.writeConfig(preset.config);
    window.AutohomAutomatizarLoteRender.writePresetName(preset.name);
    window.AutohomAutomatizarLoteRender.renderState();

    logPresetEvent('automation.batch.preset.run_requested', {
      presetId: preset.id,
      name: preset.name,
      selector: preset.config.selector,
      batchSize: preset.config.batchSize,
      text: truncateForLog(preset.config.text),
    });

    const ok = await runBatchWithConfig(preset.config, 'preset', preset);
    if (!ok) {
      return;
    }

    try {
      await window.AutohomAutomatizarLotePresetsStorage.markPresetRun(preset.id);
      await loadPresetsIntoStore();
    } catch (error) {
      logPresetEvent(
        'automation.batch.preset.run_failed',
        {
          expected: 'preset usage metadata updated',
          actual: error?.message || String(error),
          presetId: preset.id,
          name: preset.name,
        },
        'error'
      );
    }
  }

  async function deletePreset(presetId) {
    const preset = window.AutohomAutomatizarLoteStore.getPresetById(presetId);
    if (!preset) {
      window.AutohomAutomatizarLoteRender.setPresetsStatus('No se encontro la configuracion seleccionada.', 'error');
      return;
    }

    const shouldDelete = window.confirm(`Eliminar la configuracion "${preset.name}"?`);
    if (!shouldDelete) {
      return;
    }

    logPresetEvent('automation.batch.preset.delete_requested', {
      presetId: preset.id,
      name: preset.name,
    });

    try {
      const nextPresets = await window.AutohomAutomatizarLotePresetsStorage.deletePreset(preset.id);
      window.AutohomAutomatizarLoteStore.removePresetFromMemory(preset.id);
      window.AutohomAutomatizarLoteRender.writePresetName('');
      await loadPresetsIntoStore();
      window.AutohomAutomatizarLoteRender.setPresetsStatus('Configuracion eliminada.', 'success');
      window.AutohomToast.show('Configuracion eliminada');
      logPresetEvent('automation.batch.preset.deleted', {
        presetId: preset.id,
        name: preset.name,
        remaining: nextPresets.length,
      });
    } catch (error) {
      const message = error?.message || String(error);
      window.AutohomAutomatizarLoteRender.setPresetsStatus(message, 'error');
      window.AutohomToast.show(message);
      logPresetEvent(
        'automation.batch.preset.delete_failed',
        {
          expected: 'preset removed from storage',
          actual: message,
          presetId: preset.id,
          name: preset.name,
        },
        'error'
      );
    }
  }

  async function resetBatch() {
    try {
      const tab = await getActiveTab();
      if (!tab) {
        throw new Error('No hay pestana activa.');
      }
      if (!isAllowedTargetTab(tab)) {
        throw new Error('La pestana activa no es Zoho CRM.');
      }

      await ensureBatchContentScript(tab.id);
      await sendTabMessage(tab.id, { type: 'AUTO_BATCH_RESET' });

      window.AutohomAutomatizarLoteStore.reset();
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show('Progreso reiniciado');
      window.AutohomLogs.append(`automation.batch.reset tab=${tab.id}`);
    } catch (error) {
      window.AutohomAutomatizarLoteStore.setError(error.message);
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show(`Error: ${error.message}`);
      window.AutohomLogs.append(`automation.batch.reset_failed ${error.message}`, 'error');
    }
  }

  function handlePresetListClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) {
      return;
    }

    const presetCard = actionEl.closest('[data-preset-id]');
    const presetId = presetCard?.dataset?.presetId || '';
    if (!presetId) {
      return;
    }

    const action = actionEl.dataset.action;
    if (action === 'apply-preset') {
      applyPresetToForm(presetId);
      return;
    }
    if (action === 'run-preset') {
      runPreset(presetId);
      return;
    }
    if (action === 'update-preset') {
      const preset = selectPreset(presetId);
      if (preset) {
        updateSelectedPresetFromCurrentConfig();
      }
      return;
    }
    if (action === 'delete-preset') {
      deletePreset(presetId);
    }
  }

  function handleRuntimeMessage(message) {
    if (message.type !== 'AUTO_BATCH_PROGRESS') {
      return;
    }

    const progressMessage = buildProgressMessage(message);
    window.AutohomAutomatizarLoteStore.setProgress({
      total: message.total || 0,
      processed: message.processed || 0,
      message: progressMessage,
    });
    window.AutohomAutomatizarLoteStore.setStatusLevel(
      message.status === 'completed' ? 'success' : 'info'
    );

    window.AutohomAutomatizarLoteRender.renderState();

    window.AutohomLogs.append(
      `automation.batch.progress run=${message.runId || ''} total=${message.total || 0} processed=${message.processed || 0} status=${message.status || 'partial'}`
    );
  }

  function handleRuntimeEvent(message) {
    if (message.type !== 'AUTO_BATCH_EVENT') {
      return;
    }

    if (message.eventName === 'automation.batch.progress') {
      return;
    }

    const level = message.level || 'info';
    const details = String(message.details || '').trim();
    const suffix = details ? ` ${details}` : '';
    window.AutohomLogs.append(`${message.eventName || 'automation.batch.event'}${suffix}`, level);
  }

  function init() {
    const els = window.AutohomAutomatizarLoteRender.getEls();
    if (!els.runButton || !els.resetButton) {
      return;
    }

    window.AutohomAutomatizarLoteRender.writeConfig({
      batchSize: window.AutohomAutomatizarLoteContracts.DEFAULT_BATCH_SIZE,
    });
    window.AutohomAutomatizarLoteRender.renderState();

    els.runButton.addEventListener('click', runBatch);
    els.resetButton.addEventListener('click', resetBatch);
    els.presetSaveButton?.addEventListener('click', saveCurrentConfigAsPreset);
    els.presetUpdateButton?.addEventListener('click', updateSelectedPresetFromCurrentConfig);
    els.presetsList?.addEventListener('click', handlePresetListClick);

    [els.text, els.selector, els.batchSize].forEach((el) => {
      el?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runBatch();
        }
      });
    });

    els.presetName?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveCurrentConfigAsPreset();
      }
    });

    loadPresetsIntoStore().catch((error) => {
      logPresetEvent(
        'automation.batch.presets.load_failed',
        {
          expected: 'presets loaded during init',
          actual: error?.message || String(error),
        },
        'error'
      );
    });
  }

  return {
    init,
    handleRuntimeMessage,
    handleRuntimeEvent,
  };
})();
