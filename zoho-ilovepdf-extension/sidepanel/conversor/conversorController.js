window.AutohomConversor = (() => {
  async function init() {
    window.AutohomSidepanelDom.byId('btn-scan').addEventListener('click', scanFolder);
    window.AutohomSidepanelDom.byId('btn-convert-all').addEventListener('click', convertAll);
    window.AutohomSidepanelDom.byId('btn-clear-list').addEventListener('click', clearList);
    window.AutohomSidepanelDom.byId('btn-browse').addEventListener('click', browseFolder);
    window.AutohomSidepanelDom.byId('btn-export-diagnostic')?.addEventListener('click', exportDiagnosticPackage);
    window.AutohomSidepanelDom.byId('btn-copy-run-id')?.addEventListener('click', copyRunId);
    window.AutohomSidepanelDom.byId('btn-copy-workflow-id')?.addEventListener('click', copyWorkflowId);
    window.AutohomSidepanelDom.byId('btn-show-recent-errors')?.addEventListener('click', showRecentErrors);
    window.AutohomSidepanelDom.byId('btn-clear-logs').addEventListener('click', () => {
      window.AutohomLogs.clear();
    });

    await loadCurrentFolder();
    await refreshObservabilityState();
    startPolling();
    checkBridge();
  }

  let observabilityContext = {
    runId: '',
    workflowId: '',
    traceId: '',
  };

  async function loadCurrentFolder() {
    try {
      const data = await window.AutohomConversorApi.getConfig();
      if (data.ok && data.current_folder) {
        window.AutohomSidepanelDom.byId('folder-input').value = data.current_folder;
        chrome.storage.local.set({ ilovepdf_last_folder: data.current_folder });
        return;
      }
    } catch (_error) {}

    chrome.storage.local.get('ilovepdf_last_folder', (result) => {
      if (result.ilovepdf_last_folder) {
        window.AutohomSidepanelDom.byId('folder-input').value = result.ilovepdf_last_folder;
      }
    });
  }

  async function browseFolder() {
    const button = window.AutohomSidepanelDom.byId('btn-browse');
    const folderInput = window.AutohomSidepanelDom.byId('folder-input');
    const initialFolder = folderInput.value.trim();

    button.disabled = true;
    window.AutohomLogs.append('📂 Solicitando selector de carpeta a Python...');

    try {
      const data = await window.AutohomConversorApi.openFolderDialog(initialFolder);
      if (!data.ok) {
        throw new Error(data.error || 'No se pudo abrir el selector nativo');
      }
      if (!data.selected || !data.folder) {
        window.AutohomLogs.append('ℹ️ Selección de carpeta cancelada desde Python');
        return;
      }

      folderInput.value = data.folder;
      chrome.storage.local.set({ ilovepdf_last_folder: data.folder });
      window.AutohomLogs.append(`📁 Carpeta seleccionada desde Python: ${data.folder}`);
      window.AutohomToast.show('📁 Carpeta seleccionada');
    } catch (error) {
      window.AutohomLogs.append(`❌ No se pudo abrir el selector nativo: ${error.message}`);
      window.AutohomToast.show('❌ No se pudo abrir el selector de carpeta');
    } finally {
      button.disabled = false;
    }
  }

  async function scanFolder() {
    const folderInput = window.AutohomSidepanelDom.byId('folder-input');
    const folder = folderInput.value.trim();
    if (!folder) {
      window.AutohomToast.show('⚠️ Escribe o selecciona una carpeta');
      return;
    }

    const button = window.AutohomSidepanelDom.byId('btn-scan');
    button.disabled = true;
    button.textContent = 'Escaneando...';
    window.AutohomLogs.append(`🔍 Escaneando: ${folder}`);

    try {
      chrome.storage.local.set({ ilovepdf_last_folder: folder });
      const configData = await window.AutohomConversorApi.setConfig(folder);
      if (!configData.ok) {
        window.AutohomLogs.append(`❌ Config error: ${configData.error || 'Error desconocido'}`);
        window.AutohomToast.show(`❌ ${configData.error || 'Error'}`);
        return;
      }

      if (configData.current_folder) {
        folderInput.value = configData.current_folder;
        chrome.storage.local.set({ ilovepdf_last_folder: configData.current_folder });
        window.AutohomLogs.append(`📂 Carpeta activa en Python: ${configData.current_folder}`);
      }

      await refreshPdfs({ silent: false });
      window.AutohomLogs.append(`✅ Escaneo completo: ${window.AutohomConversorStore.getPdfs().length} PDFs encontrados`);
      window.AutohomToast.show(`✅ ${window.AutohomConversorStore.getPdfs().length} PDFs encontrados`);
    } catch (error) {
      window.AutohomLogs.append(`❌ No se pudo conectar con Python app: ${error.message}`);
      window.AutohomToast.show('❌ No se pudo conectar con la app Python');
    } finally {
      button.disabled = false;
      button.textContent = 'Escanear';
    }
  }

  async function refreshPdfs(options = {}) {
    const { silent = true } = options;
    try {
      const data = await window.AutohomConversorApi.listPdfs();
      if (data.ok) {
        window.AutohomConversorStore.setPdfs(data.pdfs || []);
        if (data.folder) {
          window.AutohomSidepanelDom.byId('folder-input').value = data.folder;
          chrome.storage.local.set({ ilovepdf_last_folder: data.folder });
        }
        window.AutohomConversorRender.renderPdfList();
        window.AutohomConversorRender.updateStats();
      }
    } catch (_error) {
      if (!silent) {
        throw new Error('No se pudo conectar con la app Python. Verifica que esté iniciada.');
      }
    }
  }

  function convertOne(pdfOrId, maybeFilename) {
    const descriptor = buildConversionDescriptor(pdfOrId, maybeFilename);

    chrome.runtime.sendMessage({
      type: 'ILOVEPDF_CONVERT',
      pdfId: descriptor.pdfId,
      filename: descriptor.filename,
      source: descriptor.source || 'conversor-scan',
      mappingId: descriptor.mappingId || null,
      outputDirectory: descriptor.outputDirectory || null,
      sourcePdfPath: descriptor.sourcePdfPath || null,
      traceId: descriptor.traceId || null,
      batchId: descriptor.batchId || null,
    });
    window.AutohomLogs.append(`🔄 Enviado a convertir: ${descriptor.filename}`);
    window.AutohomToast.show(`🔄 Convirtiendo ${descriptor.filename}...`);
  }

  function convertAll() {
    const pending = window.AutohomConversorStore.getPendingPdfs();
    if (pending.length === 0) {
      return;
    }
    chrome.runtime.sendMessage({
      type: 'ILOVEPDF_CONVERT_ALL',
      pdfs: pending.map((pdf) => buildConversionDescriptor(pdf)),
    });
    window.AutohomLogs.append(`⚡ Convertir todos: ${pending.length} PDFs en cola`);
    window.AutohomToast.show(`🔄 ${pending.length} PDFs en cola de conversión`);
  }

  function buildConversionDescriptor(pdfOrId, maybeFilename) {
    const pdf = resolvePdfForConversion(pdfOrId, maybeFilename);
    const sourcePdfPath = String(pdf?.sourcePdfPath || pdf?.filepath || '').trim();

    return {
      pdfId: pdf?.pdfId || pdf?.id || pdfOrId,
      filename: pdf?.filename || maybeFilename || '',
      source: pdf?.source || 'conversor-scan',
      mappingId: pdf?.mappingId || null,
      outputDirectory: resolveOutputDirectory(pdf, sourcePdfPath),
      sourcePdfPath: sourcePdfPath || null,
      traceId: pdf?.traceId || null,
      batchId: pdf?.batchId || null,
    };
  }

  function resolvePdfForConversion(pdfOrId, maybeFilename) {
    if (pdfOrId && typeof pdfOrId === 'object') {
      return pdfOrId;
    }

    const matched = window.AutohomConversorStore.getPdfs().find(
      (pdf) => pdf.id === pdfOrId || pdf.pdfId === pdfOrId
    );
    if (matched) {
      return matched;
    }

    return {
      id: pdfOrId,
      pdfId: pdfOrId,
      filename: maybeFilename || '',
      source: 'conversor-scan',
    };
  }

  function resolveOutputDirectory(pdf, filepath) {
    const explicitOutputDirectory = String(pdf?.outputDirectory || '').trim();
    if (explicitOutputDirectory) {
      return explicitOutputDirectory;
    }

    const requested = String(pdf?.requestedOutputDirectory || '').trim();
    if (requested) {
      return requested;
    }

    const directory = String(pdf?.directory || '').trim();
    if (directory) {
      return directory;
    }

    if (!filepath) {
      return null;
    }

    const normalizedPath = filepath.replace(/[\\/]+$/, '');
    const parts = normalizedPath.split(/[\\/]/);
    if (parts.length <= 1) {
      return null;
    }

    return parts.slice(0, -1).join('\\') || null;
  }

  async function clearList() {
    if (!confirm('¿Limpiar toda la lista de PDFs en la app Python?')) {
      return;
    }
    try {
      const data = await window.AutohomConversorApi.clearPdfs();
      if (!data.ok) {
        window.AutohomLogs.append(`❌ No se pudo limpiar en Python: ${data.error || 'Error desconocido'}`, 'error');
        window.AutohomToast.show(`❌ ${data.error || 'No se pudo limpiar la lista'}`);
        return;
      }

      await refreshPdfs({ silent: false });
      window.AutohomLogs.append(`🗑️ Lista limpiada en Python. PDFs actuales: ${window.AutohomConversorStore.getPdfs().length}`);
      window.AutohomToast.show('🗑️ Lista limpiada');
    } catch (error) {
      window.AutohomLogs.append(`❌ No se pudo limpiar en Python: ${error.message}`, 'error');
      window.AutohomToast.show('❌ No se pudo limpiar la lista');
    }
  }

  async function handleProgress(message) {
    const { pdfId, status, message: detail } = message;
    const short = pdfId?.substring(0, 8) || '?';
    const icon = {
      starting: '🚀',
      uploading: '📤',
      converting: '🔄',
      downloading: '⬇️',
      finalizing: '💾',
      completed: '✅',
      error: '❌',
    }[status] || '•';
    window.AutohomLogs.append(
      `${icon} [${short}] ${status}${detail ? ' — ' + detail : ''}`,
      status === 'error' ? 'error' : status === 'completed' ? 'success' : 'info'
    );

    const pdf = window.AutohomConversorStore.updatePdfStatus(pdfId, status, detail || '');
    if (pdf) {
      window.AutohomConversorRender.renderPdfList();
      window.AutohomConversorRender.updateStats();
    }
    if (message.traceId) {
      observabilityContext.traceId = message.traceId;
    }
    if (message.workflowId) {
      observabilityContext.workflowId = message.workflowId;
    }
    renderObservabilityContext(status);

    const mappingLink = window.AutohomActasStore.getActaConversion(pdfId);
    const mappingId = mappingLink?.mappingId || message.mappingId || null;
    if (mappingId) {
      window.AutohomActas.updateMappingConversionStatus(
        mappingId,
        status,
        status === 'error' && detail ? `Error: ${detail}` : '',
        message.finalExcelPath ? { finalExcelPath: message.finalExcelPath } : {}
      );
      if (!['completed', 'error'].includes(status)) {
        await window.AutohomActasStore.updateMappingConversion(mappingId, {
          lastStatus: status,
          lastPdfId: pdfId,
          lastError: null,
        });
      }
      if (status === 'completed') {
        await window.AutohomActasStore.updateMappingConversion(mappingId, {
          lastStatus: 'completed',
          lastPdfId: pdfId,
          lastExcelPath: message.finalExcelPath || '',
          lastError: null,
        });
      }
      if (status === 'error') {
        await window.AutohomActasStore.updateMappingConversion(mappingId, {
          lastStatus: 'error',
          lastPdfId: pdfId,
          lastExcelPath: '',
          lastError: detail || 'Error desconocido',
        });
      }
      if (status === 'completed' || status === 'error') {
        window.AutohomActasStore.clearActaConversion(pdfId);
      }
      window.AutohomActasBatchConversion?.updateButtonState();
    }
  }

  function startPolling() {
    const timer = setInterval(() => {
      const tab = window.AutohomSidepanelDom.qs('.tab-btn[data-tab="conversor"]');
      if (tab && tab.classList.contains('active')) {
        refreshPdfs();
        refreshObservabilityState();
      }
    }, 5000);
    window.AutohomConversorStore.setPollingTimer(timer);
  }

  async function openSiteProfileEditor(event) {
    event.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('site-profile-editor.html') });
  }

  function bindEditorLink() {
    window.AutohomSidepanelDom.byId('btn-open-site-profile-editor').addEventListener('click', openSiteProfileEditor);
  }

  async function initAlertsHooks() {
    window.AutohomSidepanelDom.byId('btn-clear-alerts').addEventListener('click', () => {
      window.AutohomAlerts.clearAll();
    });
  }

  async function fullInit() {
    await init();
    bindEditorLink();
    await initAlertsHooks();
  }

  function checkBridge() {
    window.AutohomConversorBridge.checkBridge();
  }

  function updateBridgeUI(connected) {
    window.AutohomConversorBridge.updateBridgeUI(connected);
  }

  async function refreshObservabilityState() {
    try {
      const data = await window.AutohomConversorApi.getObservabilityState();
      if (!data.ok) return;
      observabilityContext.runId = data.runId || '';
      if (!observabilityContext.workflowId && Array.isArray(data.activeWorkflows) && data.activeWorkflows.length > 0) {
        observabilityContext.workflowId = data.activeWorkflows[data.activeWorkflows.length - 1].workflowId || '';
        observabilityContext.traceId = data.activeWorkflows[data.activeWorkflows.length - 1].traceId || '';
      }
      renderObservabilityContext();
    } catch (_error) {}
  }

  function updateObservabilityContext(message) {
    observabilityContext = {
      ...observabilityContext,
      runId: message.runId || observabilityContext.runId,
      workflowId: message.workflowId || observabilityContext.workflowId,
      traceId: message.traceId || observabilityContext.traceId,
    };
    renderObservabilityContext();
  }

  function renderObservabilityContext(currentStep = '') {
    const runEl = window.AutohomSidepanelDom.byId('diag-run-id');
    const workflowEl = window.AutohomSidepanelDom.byId('diag-workflow-id');
    const traceEl = window.AutohomSidepanelDom.byId('diag-trace-id');
    const stepEl = window.AutohomSidepanelDom.byId('diag-current-step');
    if (runEl) runEl.textContent = observabilityContext.runId || '—';
    if (workflowEl) workflowEl.textContent = observabilityContext.workflowId || '—';
    if (traceEl) traceEl.textContent = observabilityContext.traceId || '—';
    if (stepEl) stepEl.textContent = currentStep || stepEl.textContent || 'idle';
  }

  async function exportDiagnosticPackage() {
    try {
      const data = await window.AutohomConversorApi.exportDiagnosticPackage({
        scope: 'latest',
        workflowId: observabilityContext.workflowId || undefined,
        includeBrowserEvents: true,
        includeDebugPrompt: true,
      });
      if (!data.ok) {
        throw new Error(data.error || 'No se pudo exportar el paquete');
      }
      chrome.tabs.create({ url: `http://localhost:7790${data.downloadPath}` });
      window.AutohomLogs.append(`🧪 Paquete diagnóstico listo: ${data.packageName}`, 'success');
      window.AutohomToast.show('Paquete diagnóstico exportado');
    } catch (error) {
      window.AutohomLogs.append(`❌ No se pudo exportar diagnóstico: ${error.message}`, 'error');
      window.AutohomToast.show('❌ No se pudo exportar diagnóstico');
    }
  }

  async function showRecentErrors() {
    try {
      const data = await window.AutohomConversorApi.getRecentObservabilityEvents(20);
      if (!data.ok) return;
      const errors = Array.isArray(data.errors) ? data.errors : [];
      if (errors.length === 0) {
        window.AutohomLogs.append('ℹ️ No hay errores recientes en observabilidad.');
        return;
      }
      for (const event of errors.slice(-5)) {
        window.AutohomLogs.append(`❌ [${event.component}] ${event.eventName}: ${event.message || event.error?.message || 'sin detalle'}`, 'error');
      }
    } catch (error) {
      window.AutohomLogs.append(`❌ No se pudieron leer errores recientes: ${error.message}`, 'error');
    }
  }

  async function copyRunId() {
    await navigator.clipboard.writeText(observabilityContext.runId || '');
    window.AutohomToast.show('Run ID copiado');
  }

  async function copyWorkflowId() {
    await navigator.clipboard.writeText(observabilityContext.workflowId || '');
    window.AutohomToast.show('Workflow ID copiado');
  }

  return {
    init: fullInit,
    loadCurrentFolder,
    browseFolder,
    scanFolder,
    refreshPdfs,
    buildConversionDescriptor,
    convertOne,
    convertAll,
    clearList,
    handleProgress,
    startPolling,
    checkBridge,
    updateBridgeUI,
    refreshObservabilityState,
    updateObservabilityContext,
  };
})();
