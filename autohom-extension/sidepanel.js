// sidepanel.js

let allMappings = [];
let pendingItems = {};
let actaConversionsByPdfId = {};
const SELECTOR_ALERTS_STORAGE_KEY = 'ilovepdf_selector_alerts';

// ═══════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'conversor') {
      convRefreshPdfs();
      convCheckBridge();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ACTAS
// ═══════════════════════════════════════════════════════════════════════════

async function init() {
  await loadMappings();
  renderMappings(allMappings);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'DOWNLOAD_PENDING') handlePendingDownload(message);
    if (message.type === 'MAPPING_SAVED') {
      allMappings.unshift(message.mapping);
      renderMappings(filterMappings());
      updateStats();
      showToast('✅ Acta mapeada correctamente');
    }
    if (message.type === 'ILOVEPDF_PROGRESS') {
      convHandleProgress(message);
    }
    if (message.type === 'ILOVEPDF_BRIDGE_STATUS') {
      convUpdateBridgeUI(message.connected);
    }
    if (message.type === 'ILOVEPDF_SELECTOR_ALERT') {
      alertsAddOrUpdate(message);
    }
  });

  const sessionData = await chrome.storage.session.get(null);
  for (const [key, value] of Object.entries(sessionData)) {
    if (key.startsWith('pending_')) {
      handlePendingDownload({ downloadId: value.downloadId, pendingKey: key, _data: value });
    }
  }

  convInit();
}

async function loadMappings() {
  const stored = await chrome.storage.local.get('mappings');
  allMappings = stored.mappings || [];
  updateStats();
}

function renderMappings(mappings, newId = null) {
  const list  = document.getElementById('mappings-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';
  if (mappings.length === 0) {
    empty.style.display = 'block';
    document.getElementById('count-label').textContent = '0 registros';
    return;
  }
  empty.style.display = 'none';
  document.getElementById('count-label').textContent = `${mappings.length} registro${mappings.length !== 1 ? 's' : ''}`;
  mappings.forEach(m => list.appendChild(createCard(m, m.id === newId)));
}

function createCard(m, isNew = false) {
  const card    = document.createElement('div');
  card.className = `mapping-card${isNew ? ' new-entry' : ''}`;
  card.dataset.id = m.id;
  const date    = new Date(m.savedAt);
  const dateStr = date.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const shortUrl = m.zohoUrl.replace('https://crm.zoho.com/crm/', '').substring(0, 48) + '…';
  card.innerHTML = `
    <button class="btn-delete" data-id="${m.id}" title="Eliminar">×</button>
    <div class="mapping-filename"><span class="pdf-icon">PDF</span>${m.filename}</div>
    <a class="mapping-url" href="${m.zohoUrl}" target="_blank" title="${m.zohoUrl}">🔗 ${shortUrl}</a>
    <div class="mapping-convert-status"></div>
    <div class="mapping-footer">
      <span class="mapping-date">${dateStr}</span>
      <div class="card-actions">
        <button class="btn-convert-mapping" data-id="${m.id}">Convertir</button>
        <button class="btn-copy" data-url="${m.zohoUrl}">Copiar URL</button>
      </div>
    </div>`;
  card.querySelector('.btn-delete').addEventListener('click', (e) => {
    e.stopPropagation(); deleteMapping(m.id, card);
  });
  card.querySelector('.btn-convert-mapping').addEventListener('click', async (e) => {
    e.stopPropagation();
    await actasConvertMapping(m, card);
  });
  card.querySelector('.btn-copy').addEventListener('click', async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(m.zohoUrl);
    const btn = e.currentTarget;
    btn.textContent = '✓ Copiado'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copiar URL'; btn.classList.remove('copied'); }, 1500);
  });
  if (isNew) setTimeout(() => card.classList.remove('new-entry'), 3000);
  return card;
}

async function handlePendingDownload(message) {
  let data = message._data;
  if (!data) { const result = await chrome.storage.session.get(message.pendingKey); data = result[message.pendingKey]; }
  if (!data) return;
  pendingItems[message.pendingKey] = data;
  renderPendingSection();
  updateStats();
}

function renderPendingSection() {
  const section = document.getElementById('pending-section');
  const keys    = Object.keys(pendingItems);
  if (keys.length === 0) { section.style.display = 'none'; section.innerHTML = ''; return; }
  section.style.display = 'block';
  section.innerHTML = '';
  keys.forEach(pendingKey => {
    const item     = pendingItems[pendingKey];
    const filename = (item.filename || '').split('/').pop().split('\\').pop() || 'archivo.pdf';
    const shortUrl = (item.zohoUrl  || '').replace('https://crm.zoho.com/crm/', '');
    const card     = document.createElement('div');
    card.className = 'pending-card';
    card.innerHTML = `
      <div class="pending-header"><div class="pending-dot"></div><span class="pending-label">Descarga detectada</span></div>
      <div class="pending-filename">📄 ${filename}</div>
      <div class="pending-question">¿Este PDF es un <strong>acta de homologación</strong>?<br/>
        <small style="opacity:0.7;font-family:'DM Mono',monospace;font-size:9px;">${shortUrl}</small></div>
      <div class="pending-actions">
        <button class="btn-confirm" data-key="${pendingKey}" data-id="${item.downloadId}">✅ Sí, mapear</button>
        <button class="btn-reject"  data-key="${pendingKey}">❌ No, ignorar</button>
      </div>`;
    card.querySelector('.btn-confirm').addEventListener('click', async (e) => {
      const key = e.currentTarget.dataset.key; const dlId = parseInt(e.currentTarget.dataset.id);
      await chrome.runtime.sendMessage({ type: 'CONFIRM_MAPPING', downloadId: dlId, pendingKey: key });
      delete pendingItems[key]; renderPendingSection(); updateStats();
    });
    card.querySelector('.btn-reject').addEventListener('click', async (e) => {
      const key = e.currentTarget.dataset.key;
      await chrome.runtime.sendMessage({ type: 'REJECT_MAPPING', pendingKey: key });
      delete pendingItems[key]; renderPendingSection(); updateStats();
    });
    section.appendChild(card);
  });
}

async function deleteMapping(id, card) {
  card.style.opacity = '0.4'; card.style.transform = 'translateX(-10px)';
  await chrome.runtime.sendMessage({ type: 'DELETE_MAPPING', id });
  allMappings = allMappings.filter(m => m.id !== id);
  Object.keys(actaConversionsByPdfId).forEach((pdfId) => {
    if (actaConversionsByPdfId[pdfId] === id) delete actaConversionsByPdfId[pdfId];
  });
  setTimeout(() => {
    card.remove(); updateStats();
    document.getElementById('count-label').textContent = `${filterMappings().length} registro${filterMappings().length !== 1 ? 's' : ''}`;
    if (filterMappings().length === 0) document.getElementById('empty-state').style.display = 'block';
  }, 300);
}

function filterMappings() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  if (!q) return allMappings;
  return allMappings.filter(m => m.filename.toLowerCase().includes(q) || m.zohoUrl.toLowerCase().includes(q));
}

document.getElementById('search').addEventListener('input', () => renderMappings(filterMappings()));

function updateStats() {
  document.getElementById('stat-total').textContent   = allMappings.length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  document.getElementById('stat-today').textContent   = allMappings.filter(m => m.savedAt >= today.getTime()).length;
  document.getElementById('stat-pending').textContent = Object.keys(pendingItems).length;
}

document.getElementById('btn-export').addEventListener('click', () => {
  if (allMappings.length === 0) { showToast('No hay registros para exportar'); return; }
  const rows = [['Archivo PDF','URL Tarea Zoho','Fecha']];
  allMappings.forEach(m => {
    const date = new Date(m.savedAt).toLocaleString('es-CO');
    rows.push([`"${m.filename}"`, `"${m.zohoUrl}"`, `"${date}"`]);
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `actas_mapeadas_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url); showToast('📊 CSV exportado');
});

document.getElementById('btn-clear-mappings').addEventListener('click', clearAllMappings);

async function clearAllMappings() {
  if (allMappings.length === 0) {
    showToast('No hay registros para limpiar');
    return;
  }

  const ok = confirm(
    '¿Seguro que quieres limpiar todos los registros de Actas? Esto no eliminará archivos PDF del PC ni la lista del Conversor PDF.'
  );
  if (!ok) return;

  await chrome.storage.local.set({ mappings: [] });
  allMappings = [];
  actaConversionsByPdfId = {};
  renderMappings([]);
  updateStats();
  showToast('🗑️ Registros de Actas limpiados');
}

function actasNormalizeFilename(filename) {
  return String(filename || '')
    .split('/')
    .pop()
    .split('\\')
    .pop()
    .trim()
    .toLowerCase();
}

function actasFindPdfByFilename(mapping) {
  const target = actasNormalizeFilename(mapping?.filename);
  if (!target) return null;

  const exact = convPdfs.filter((pdf) => actasNormalizeFilename(pdf.filename) === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return { __ambiguous: true, matches: exact };
  return null;
}

function actasUpdateMappingConversionStatus(mappingId, status, message = '') {
  const card = document.querySelector(`.mapping-card[data-id="${mappingId}"]`);
  if (!card) return;

  const statusEl = card.querySelector('.mapping-convert-status');
  if (!statusEl) return;

  const textByStatus = {
    idle: 'Listo para convertir',
    searching: 'Buscando PDF en Conversor...',
    queued: 'Enviado a conversión',
    starting: 'Enviado a conversión',
    uploading: 'Subiendo PDF...',
    converting: 'Convirtiendo...',
    downloading: 'Descargando resultado...',
    completed: 'Convertido correctamente',
  };

  statusEl.textContent = message || textByStatus[status] || status || '';
  statusEl.classList.remove('is-error', 'is-success', 'is-active');

  if (status === 'error') {
    statusEl.classList.add('is-error');
  } else if (status === 'completed') {
    statusEl.classList.add('is-success');
  } else if (statusEl.textContent) {
    statusEl.classList.add('is-active');
  }
}

async function actasConvertMapping(mapping, card) {
  const button = card.querySelector('.btn-convert-mapping');

  try {
    button.disabled = true;
    actasUpdateMappingConversionStatus(mapping.id, 'searching');

    await convRefreshPdfs({ silent: false });

    if (!Array.isArray(convPdfs) || convPdfs.length === 0) {
      throw new Error('No hay PDFs escaneados en el Conversor. Escanea primero la carpeta desde Conversor PDF.');
    }

    const bridgeStatus = await chrome.runtime.sendMessage({ type: 'ILOVEPDF_STATUS' });
    if (!bridgeStatus?.ok || !bridgeStatus.bridgeConnected) {
      throw new Error('El bridge con iLovePDF no está conectado. Inicia la app Python y vuelve a intentarlo.');
    }

    const pdf = actasFindPdfByFilename(mapping);
    if (!pdf) {
      throw new Error('PDF no encontrado en Conversor. Escanea primero la carpeta donde está este PDF.');
    }
    if (pdf.__ambiguous) {
      throw new Error('Hay más de un PDF con el mismo nombre en el Conversor. Revisa la lista antes de convertir.');
    }

    actaConversionsByPdfId[pdf.id] = mapping.id;
    convConvertOne(pdf.id, pdf.filename);
    actasUpdateMappingConversionStatus(mapping.id, 'queued');
  } catch (error) {
    actasUpdateMappingConversionStatus(mapping.id, 'error', `Error: ${error.message}`);
    showToast(`❌ ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: CONVERSOR PDF
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:7790/api';
let convPdfs         = [];
let convPollingTimer = null;

function convInit() {
  document.getElementById('btn-scan').addEventListener('click', convScanFolder);
  document.getElementById('btn-convert-all').addEventListener('click', convConvertAll);
  document.getElementById('btn-clear-alerts').addEventListener('click', alertsClearAll);
  document.getElementById('btn-open-site-profile-editor').addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('site-profile-editor.html') });
  });
  document.getElementById('btn-clear-list').addEventListener('click', convClearList);
  document.getElementById('btn-browse').addEventListener('click', convBrowseFolder);
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    document.getElementById('log-container').innerHTML =
      '<div class="log-entry"><span class="log-time">--:--</span> Log limpiado.</div>';
  });

  // Load saved folder
  convLoadCurrentFolder();

  convStartPolling();
  convCheckBridge();
  alertsLoadFromStorage();
}

async function convLoadCurrentFolder() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const data = await res.json();
    if (data.ok && data.current_folder) {
      document.getElementById('folder-input').value = data.current_folder;
      chrome.storage.local.set({ ilovepdf_last_folder: data.current_folder });
      return;
    }
  } catch (e) {
    // Python app not running — use cached value below
  }

  chrome.storage.local.get('ilovepdf_last_folder', (result) => {
    if (result.ilovepdf_last_folder) {
      document.getElementById('folder-input').value = result.ilovepdf_last_folder;
    }
  });
}

async function convBrowseFolder() {
  const btn = document.getElementById('btn-browse');
  const folderInput = document.getElementById('folder-input');
  const initialFolder = folderInput.value.trim();

  btn.disabled = true;
  convAppendLog('📂 Solicitando selector de carpeta a Python...');

  try {
    const res = await fetch(`${API_BASE}/folder-dialog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_folder: initialFolder }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'No se pudo abrir el selector nativo');
    }
    if (!data.selected || !data.folder) {
      convAppendLog('ℹ️ Selección de carpeta cancelada desde Python');
      return;
    }

    folderInput.value = data.folder;
    chrome.storage.local.set({ ilovepdf_last_folder: data.folder });
    convAppendLog(`📁 Carpeta seleccionada desde Python: ${data.folder}`);
    showToast('📁 Carpeta seleccionada');
  } catch (e) {
    convAppendLog(`❌ No se pudo abrir el selector nativo: ${e.message}`);
    showToast('❌ No se pudo abrir el selector de carpeta');
  } finally {
    btn.disabled = false;
  }
}

async function convScanFolder() {
  const folderInput = document.getElementById('folder-input');
  const folder      = folderInput.value.trim();
  if (!folder) { showToast('⚠️ Escribe o selecciona una carpeta'); return; }

  const btn = document.getElementById('btn-scan');
  btn.disabled = true; btn.textContent = 'Escaneando...';
  convAppendLog(`🔍 Escaneando: ${folder}`);

  try {
    chrome.storage.local.set({ ilovepdf_last_folder: folder });

    const configRes  = await fetch(`${API_BASE}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
    const configData = await configRes.json();
    if (!configData.ok) {
      convAppendLog(`❌ Config error: ${configData.error || 'Error desconocido'}`);
      showToast(`❌ ${configData.error || 'Error'}`);
      return;
    }

    if (configData.current_folder) {
      folderInput.value = configData.current_folder;
      chrome.storage.local.set({ ilovepdf_last_folder: configData.current_folder });
      convAppendLog(`📂 Carpeta activa en Python: ${configData.current_folder}`);
    }

    await convRefreshPdfs({ silent: false });
    convAppendLog(`✅ Escaneo completo: ${convPdfs.length} PDFs encontrados`);
    showToast(`✅ ${convPdfs.length} PDFs encontrados`);
  } catch (e) {
    convAppendLog(`❌ No se pudo conectar con Python app: ${e.message}`);
    showToast('❌ No se pudo conectar con la app Python');
  } finally {
    btn.disabled = false; btn.textContent = 'Escanear';
  }
}

async function convRefreshPdfs(options = {}) {
  const { silent = true } = options;
  try {
    const res  = await fetch(`${API_BASE}/pdfs`);
    const data = await res.json();
    if (data.ok) {
      convPdfs = data.pdfs || [];
      if (data.folder) {
        document.getElementById('folder-input').value = data.folder;
        chrome.storage.local.set({ ilovepdf_last_folder: data.folder });
      }
      convRenderPdfList();
      convUpdateStats();
    }
  } catch (e) {
    if (silent) return;
    throw new Error('No se pudo conectar con la app Python. Verifica que esté iniciada.');
  }
}

function convRenderPdfList() {
  const list = document.getElementById('pdf-list');
  list.innerHTML = '';

  if (convPdfs.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:11px;font-family:\'DM Mono\',monospace;">Sin PDFs. Pega una ruta y escanea.</div>';
    return;
  }

  const statusEmoji = { pending:'⏳', uploading:'📤', converting:'🔄', downloading:'⬇️', completed:'✅', error:'❌', missing:'⚠️' };
  const statusText  = { pending:'Pendiente', uploading:'Subiendo...', converting:'Convirtiendo...', downloading:'Descargando...', completed:'Convertido', error:'Error', missing:'No encontrado' };

  convPdfs.forEach(pdf => {
    const status = pdf.status || 'pending';
    const div    = document.createElement('div');
    div.className    = 'pdf-item';
    div.dataset.pdfId = pdf.id;
    const canRetry = status === 'pending' || status === 'error';
    div.innerHTML = `
      <div class="pdf-item-info">
        <div class="pdf-item-name"><span class="pdf-icon">PDF</span>${pdf.filename}</div>
        <div class="pdf-item-status ${status}">
          ${statusEmoji[status] || '❓'} ${statusText[status] || status}
          ${pdf.message ? '<br><span class="status-detail">' + pdf.message + '</span>' : ''}
        </div>
      </div>
      ${canRetry ? `<button class="btn-convert-one" data-pdf-id="${pdf.id}" data-filename="${pdf.filename}">Convertir</button>` : ''}
    `;
    const btn = div.querySelector('.btn-convert-one');
    if (btn) btn.addEventListener('click', () => convConvertOne(pdf.id, pdf.filename));
    list.appendChild(div);
  });
}

function convUpdateStats() {
  const total   = convPdfs.length;
  const pending = convPdfs.filter(p => p.status === 'pending' || p.status === 'error').length;
  const done    = convPdfs.filter(p => p.status === 'completed').length;

  document.getElementById('conv-total').textContent   = total;
  document.getElementById('conv-pending').textContent = pending;
  document.getElementById('conv-done').textContent    = done;

  const btn = document.getElementById('btn-convert-all');
  btn.disabled    = pending === 0;
  btn.textContent = pending > 0
    ? `⚡ Convertir ${pending} Pendiente${pending !== 1 ? 's' : ''}`
    : '⚡ Todo Convertido';
}

function convConvertOne(pdfId, filename) {
  chrome.runtime.sendMessage({ type: 'ILOVEPDF_CONVERT', pdfId, filename });
  convAppendLog(`🔄 Enviado a convertir: ${filename}`);
  showToast(`🔄 Convirtiendo ${filename}...`);
}

function convConvertAll() {
  const pending = convPdfs.filter(p => p.status === 'pending' || p.status === 'error');
  if (pending.length === 0) return;
  chrome.runtime.sendMessage({
    type: 'ILOVEPDF_CONVERT_ALL',
    pdfs: pending.map(p => ({ pdfId: p.id, filename: p.filename })),
  });
  convAppendLog(`⚡ Convertir todos: ${pending.length} PDFs en cola`);
  showToast(`🔄 ${pending.length} PDFs en cola de conversión`);
}

// ── Limpiar lista ─────────────────────────────────────────────────────────
async function convClearList() {
  if (!confirm('¿Limpiar toda la lista de PDFs en la app Python?')) return;
  try {
    const res  = await fetch(`${API_BASE}/pdfs/clear`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) {
      convAppendLog(`❌ No se pudo limpiar en Python: ${data.error || 'Error desconocido'}`, 'error');
      showToast(`❌ ${data.error || 'No se pudo limpiar la lista'}`);
      return;
    }

    await convRefreshPdfs({ silent: false });
    convAppendLog(`🗑️ Lista limpiada en Python. PDFs actuales: ${convPdfs.length}`);
    showToast('🗑️ Lista limpiada');
  } catch (e) {
    convAppendLog(`❌ No se pudo limpiar en Python: ${e.message}`, 'error');
    showToast('❌ No se pudo limpiar la lista');
  }
}

function convHandleProgress(message) {
  const { pdfId, status, message: msg } = message;
  const short = pdfId?.substring(0, 8) || '?';

  // Log detallado con nivel visual
  const icon = { starting:'🚀', uploading:'📤', converting:'🔄', downloading:'⬇️', completed:'✅', error:'❌' }[status] || '•';
  convAppendLog(`${icon} [${short}] ${status}${msg ? ' — ' + msg : ''}`, status === 'error' ? 'error' : status === 'completed' ? 'success' : 'info');

  // Actualizar estado local
  const pdf = convPdfs.find(p => p.id === pdfId);
  if (pdf) {
    pdf.status  = status;
    pdf.message = msg || '';
    convRenderPdfList();
    convUpdateStats();
  }

  const mappingId = actaConversionsByPdfId[pdfId];
  if (mappingId) {
    actasUpdateMappingConversionStatus(mappingId, status, status === 'error' && msg ? `Error: ${msg}` : '');
    if (status === 'completed' || status === 'error') {
      delete actaConversionsByPdfId[pdfId];
    }
  }
}

function convCheckBridge() {
  chrome.runtime.sendMessage({ type: 'ILOVEPDF_STATUS' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.ok) convUpdateBridgeUI(response.bridgeConnected);
  });
}

function convUpdateBridgeUI(connected) {
  const dot   = document.getElementById('bridge-dot');
  const label = document.getElementById('bridge-label');
  dot.className  = `bridge-dot ${connected ? 'connected' : 'disconnected'}`;
  label.textContent = connected ? 'Conectado a Python App' : 'Desconectado — inicia python app.py';
  if (connected) {
    convRefreshPdfs();
  }
}

// ── Log mejorado ──────────────────────────────────────────────────────────
function convAppendLog(msg, level = 'info') {
  const container = document.getElementById('log-container');
  const ts    = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const entry = document.createElement('div');
  entry.className = `log-entry log-${level}`;
  entry.innerHTML = `<span class="log-time">${ts}</span>${msg}`;
  container.prepend(entry);
  while (container.children.length > 100) container.removeChild(container.lastChild);
}

function convStartPolling() {
  convPollingTimer = setInterval(() => {
    const tab = document.querySelector('.tab-btn[data-tab="conversor"]');
    if (tab && tab.classList.contains('active')) convRefreshPdfs();
  }, 5000);
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTOR ALERTS
// ═══════════════════════════════════════════════════════════════════════════

const SELECTOR_NAMES = {
  convertButton: 'Botón Convertir',
  downloadButton: 'Botón Descargar',
  uploadReadyIndicator: 'Indicador de carga',
  fileInput: 'Input de archivo',
};

function alertsLoadFromStorage() {
  chrome.storage.local.get(SELECTOR_ALERTS_STORAGE_KEY, (result) => {
    const section = document.getElementById('alerts-section');
    const alerts = Array.isArray(result[SELECTOR_ALERTS_STORAGE_KEY])
      ? result[SELECTOR_ALERTS_STORAGE_KEY]
      : [];
    const seen = new Set();

    section.innerHTML = '';
    alerts.forEach((alert) => {
      if (!alert?.selectorName || seen.has(alert.selectorName)) {
        return;
      }
      seen.add(alert.selectorName);
      alertsRender(alert);
    });
    alertsToggleWrapper();
  });
}

function alertsAddOrUpdate(alert) {
  if (!alert?.selectorName) {
    return;
  }

  const existing = document.querySelector(`[data-alert-selector="${alert.selectorName}"]`);
  if (existing) {
    existing.remove();
  }

  alertsRender(alert);
  alertsToggleWrapper();

  if (alert.level === 'error') {
    showToast(`❌ Selector roto: ${SELECTOR_NAMES[alert.selectorName] || alert.selectorName}`);
  } else {
    showToast(`⚠️ Selector desactualizado: ${SELECTOR_NAMES[alert.selectorName] || alert.selectorName}`);
  }
}

function alertsRender(alert) {
  const section = document.getElementById('alerts-section');
  if (!section) {
    return;
  }

  const isError = alert.level === 'error';
  const friendlyName = SELECTOR_NAMES[alert.selectorName] || alert.selectorName;
  const timestamp = alert.timestamp || Date.now();
  const ts = new Date(timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const configuredSelector = alert.configuredSelector || '(vacío)';
  const usedStrategy = alert.usedStrategy || 'desconocida';

  const div = document.createElement('div');
  div.className = `alert-banner ${alert.level}`;
  div.dataset.alertSelector = alert.selectorName;
  div.innerHTML = `
    <div class="alert-header">
      <span class="alert-icon">${isError ? '🔴' : '🟡'}</span>
      <span class="alert-title">${isError ? 'Selector roto' : 'Selector desactualizado'}: ${friendlyName}</span>
      <span style="font-size:9px;color:var(--text-dim);font-family:'DM Mono',monospace;">${ts}</span>
    </div>
    <div class="alert-body">
      ${isError
        ? `El selector <span class="alert-selector">${configuredSelector}</span> no encontró el elemento y <strong>ningún fallback funcionó</strong>. La conversión falló.`
        : `El selector <span class="alert-selector">${configuredSelector}</span> no funcionó, pero la conversión continuó usando la estrategia <span class="alert-selector">${usedStrategy}</span>.`
      }
      <br>Actualiza el selector en el Site Profile Editor para evitar problemas futuros.
    </div>
    <div class="alert-actions">
      <button class="btn-alert-fix" data-selector="${alert.selectorName}">⚙️ Ir al editor</button>
      <button class="btn-alert-dismiss" data-selector="${alert.selectorName}">Ignorar</button>
    </div>
  `;

  div.querySelector('.btn-alert-fix').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('site-profile-editor.html') });
    alertsDismiss(alert.selectorName);
  });

  div.querySelector('.btn-alert-dismiss').addEventListener('click', () => {
    alertsDismiss(alert.selectorName);
  });

  section.prepend(div);
}

function alertsDismiss(selectorName) {
  const el = document.querySelector(`[data-alert-selector="${selectorName}"]`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-8px)';
    setTimeout(() => {
      el.remove();
      alertsToggleWrapper();
    }, 250);
  }

  chrome.storage.local.get(SELECTOR_ALERTS_STORAGE_KEY, (result) => {
    const alerts = Array.isArray(result[SELECTOR_ALERTS_STORAGE_KEY])
      ? result[SELECTOR_ALERTS_STORAGE_KEY]
      : [];
    chrome.storage.local.set({
      [SELECTOR_ALERTS_STORAGE_KEY]: alerts.filter((alert) => alert.selectorName !== selectorName),
    });
  });
}

function alertsClearAll() {
  document.getElementById('alerts-section').innerHTML = '';
  alertsToggleWrapper();
  chrome.storage.local.remove(SELECTOR_ALERTS_STORAGE_KEY);
}

function alertsToggleWrapper() {
  const wrapper = document.getElementById('alerts-wrapper');
  const section = document.getElementById('alerts-section');
  const hasAlerts = !!section && section.children.length > 0;
  wrapper.style.display = hasAlerts ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST (shared)
// ═══════════════════════════════════════════════════════════════════════════

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── START ────────────────────────────────────────────────────────────────
init();
