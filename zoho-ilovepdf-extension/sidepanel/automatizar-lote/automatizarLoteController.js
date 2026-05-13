window.AutohomAutomatizarLote = (() => {
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
          const rawMessage = chrome.runtime.lastError.message || '';
          const hint = rawMessage.includes('Receiving end does not exist')
            ? 'recarga la pagina o abre una pagina compatible.'
            : rawMessage;
          reject(new Error(hint));
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

  async function runBatch() {
    const config = window.AutohomAutomatizarLoteRender.readConfigFromDom();
    const validation = window.AutohomAutomatizarLoteContracts.validateConfig(config);

    if (!validation.ok) {
      const message = validation.errors.join(' ');
      window.AutohomAutomatizarLoteStore.setError(message);
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show(message);
      window.AutohomLogs.append(`automation.batch.validation_failed ${message}`, 'error');
      return;
    }

    const runId = window.AutohomAutomatizarLoteContracts.buildRunId();

    try {
      window.AutohomAutomatizarLoteStore.setRunning(true);
      window.AutohomAutomatizarLoteStore.setConfig(config, runId);
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
        `automation.batch.run_requested run=${runId} tab=${tab.id} text="${config.text}" selector="${config.selector}" batch=${config.batchSize}`
      );

      await sendTabMessage(tab.id, {
        type: 'AUTO_BATCH_RUN',
        runId,
        text: config.text,
        selector: config.selector,
        batchSize: config.batchSize,
      });

      window.AutohomAutomatizarLoteStore.setProgress({
        total: 0,
        processed: 0,
        message: 'Lote enviado. Esperando progreso...',
      });
      window.AutohomAutomatizarLoteStore.setStatusLevel('info');
      window.AutohomAutomatizarLoteRender.renderState();
    } catch (error) {
      window.AutohomAutomatizarLoteStore.setError(error.message);
      window.AutohomAutomatizarLoteRender.renderState();
      window.AutohomToast.show(`Error: ${error.message}`);
      window.AutohomLogs.append(`automation.batch.run_failed ${error.message}`, 'error');
    } finally {
      window.AutohomAutomatizarLoteStore.setRunning(false);
      window.AutohomAutomatizarLoteRender.renderState();
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

    [els.text, els.selector, els.batchSize].forEach((el) => {
      el?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runBatch();
        }
      });
    });
  }

  return {
    init,
    handleRuntimeMessage,
  };
})();
