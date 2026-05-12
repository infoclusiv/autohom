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

  async function registerLocalPdf(payload) {
    return await readJson(`${API_BASE}/pdfs/register-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return {
    getConfig,
    setConfig,
    openFolderDialog,
    listPdfs,
    clearPdfs,
    registerLocalPdf,
  };
})();
