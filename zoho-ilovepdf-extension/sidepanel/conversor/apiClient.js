window.AutohomConversorApi = (() => {
  const { API_BASE } = window.AutohomSidepanelConstants;

  async function readJson(url, options) {
    const response = await fetch(url, options);
    return await response.json();
  }

  async function getConfig() {
    return await readJson(`${API_BASE}/config`);
  }

  async function setConfig(folder) {
    return await readJson(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
  }

  async function openFolderDialog(initialFolder) {
    return await readJson(`${API_BASE}/folder-dialog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_folder: initialFolder }),
    });
  }

  async function listPdfs() {
    return await readJson(`${API_BASE}/pdfs`);
  }

  async function clearPdfs() {
    return await readJson(`${API_BASE}/pdfs/clear`, { method: 'POST' });
  }

  async function getObservabilityState() {
    return await readJson(`${API_BASE}/observability/state`);
  }

  async function getRecentObservabilityEvents(limit = 20) {
    return await readJson(`${API_BASE}/observability/events/recent?limit=${encodeURIComponent(limit)}`);
  }

  async function exportDiagnosticPackage(payload = {}) {
    return await readJson(`${API_BASE}/observability/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async function registerLocalPdf(payload) {
    return await readJson(`${API_BASE}/pdfs/register-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async function movePdfToPending(payload) {
    return await readJson(`${API_BASE}/pdfs/move-to-pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  function buildPdfFileUrl(pdfId, options = {}) {
    const disposition = options.disposition || 'attachment';
    return `${API_BASE}/pdfs/${encodeURIComponent(pdfId)}/file?disposition=${encodeURIComponent(disposition)}`;
  }

  return {
    getConfig,
    setConfig,
    openFolderDialog,
    listPdfs,
    clearPdfs,
    getObservabilityState,
    getRecentObservabilityEvents,
    exportDiagnosticPackage,
    registerLocalPdf,
    movePdfToPending,
    buildPdfFileUrl,
  };
})();
