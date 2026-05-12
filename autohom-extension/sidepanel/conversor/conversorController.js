window.AutohomConversor = (() => {
  async function init() {
    window.AutohomSidepanelDom.byId('btn-scan').addEventListener('click', scanFolder);
    window.AutohomSidepanelDom.byId('btn-convert-all').addEventListener('click', convertAll);
    window.AutohomSidepanelDom.byId('btn-clear-list').addEventListener('click', clearList);
    window.AutohomSidepanelDom.byId('btn-browse').addEventListener('click', browseFolder);
    window.AutohomSidepanelDom.byId('btn-clear-logs').addEventListener('click', () => {
      window.AutohomLogs.clear();
    });

    await loadCurrentFolder();
    startPolling();
    checkBridge();
  }

  async function loadCurrentFolder() {
    try {
      const data = await window.AutohomConversorApi.getConfig();
      if (data.ok && data.current_folder) {
        window.AutohomSidepanelDom.byId('folder-input').value = data.current_folder;
        chrome.storage.local.set({ ilovepdf_last_folder: data.current_folder });
        return;
      }
    } catch (error) {
      // Python app may be down; fall back to cached folder below.
    }

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
    } catch (error) {
      if (!silent) {
        throw new Error('No se pudo conectar con la app Python. Verifica que esté iniciada.');
      }
    }
  }

  function convertOne(pdfId, filename) {
    chrome.runtime.sendMessage({ type: 'ILOVEPDF_CONVERT', pdfId, filename });
    window.AutohomLogs.append(`🔄 Enviado a convertir: ${filename}`);
    window.AutohomToast.show(`🔄 Convirtiendo ${filename}...`);
  }

  function convertAll() {
    const pending = window.AutohomConversorStore.getPendingPdfs();
    if (pending.length === 0) {
      return;
    }
    chrome.runtime.sendMessage({
      type: 'ILOVEPDF_CONVERT_ALL',
      pdfs: pending.map((pdf) => ({ pdfId: pdf.id, filename: pdf.filename })),
    });
    window.AutohomLogs.append(`⚡ Convertir todos: ${pending.length} PDFs en cola`);
    window.AutohomToast.show(`🔄 ${pending.length} PDFs en cola de conversión`);
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

  function handleProgress(message) {
    const { pdfId, status, message: detail } = message;
    const short = pdfId?.substring(0, 8) || '?';
    const icon = {
      starting: '🚀',
      uploading: '📤',
      converting: '🔄',
      downloading: '⬇️',
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

    const mappingId = window.AutohomActasStore.getActaConversion(pdfId);
    if (mappingId) {
      window.AutohomActas.updateMappingConversionStatus(
        mappingId,
        status,
        status === 'error' && detail ? `Error: ${detail}` : ''
      );
      if (status === 'completed' || status === 'error') {
        window.AutohomActasStore.clearActaConversion(pdfId);
      }
    }
  }

  function startPolling() {
    const timer = setInterval(() => {
      const tab = window.AutohomSidepanelDom.qs('.tab-btn[data-tab="conversor"]');
      if (tab && tab.classList.contains('active')) {
        refreshPdfs();
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

  return {
    init: fullInit,
    loadCurrentFolder,
    browseFolder,
    scanFolder,
    refreshPdfs,
    convertOne,
    convertAll,
    clearList,
    handleProgress,
    startPolling,
    checkBridge,
    updateBridgeUI,
  };
})();
