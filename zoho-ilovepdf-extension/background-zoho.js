// background-zoho.js - Codigo Zoho CRM original con captura de ruta local para actas.
// Mantiene el flujo existente de deteccion de descargas y agrega schemaVersion 2.

function resolveTaskUrl(url) {
  if (!url || !url.includes('crm.zoho.com')) return null;

  try {
    const parsed = new URL(url);
    const directMatch = parsed.pathname.match(/\/tab\/Cases\/(\d+)/);
    if (directMatch) return url.split('?')[0];

    if (parsed.pathname.includes('ViewAttachment')) {
      const parentId = parsed.searchParams.get('parentId');
      const module = parsed.searchParams.get('module');
      if (parentId && module === 'Cases') {
        const orgMatch = parsed.pathname.match(/\/(org\d+)\//);
        const org = orgMatch ? orgMatch[1] : null;
        if (org) {
          return `https://crm.zoho.com/crm/${org}/tab/Cases/${parentId}`;
        }
      }
    }
  } catch (_error) {}

  return null;
}

function getPendingKey(downloadId) {
  return `pending_${downloadId}`;
}

const autoMappingInFlight = new Set();

function normalizeFilename(filename) {
  return String(filename || '')
    .split('/')
    .pop()
    .split('\\')
    .pop()
    .trim();
}

function isPdfDownload(downloadItem) {
  const filename = String(downloadItem?.filename || '').toLowerCase();
  const url = String(downloadItem?.url || '').toLowerCase();
  const mime = String(downloadItem?.mime || '').toLowerCase();
  return filename.endsWith('.pdf') || url.includes('.pdf') || mime.includes('pdf');
}

async function getDownloadItem(downloadId) {
  const results = await chrome.downloads.search({ id: downloadId });
  return Array.isArray(results) ? results[0] || null : null;
}

function buildSourcePdf(downloadItem) {
  const absolutePath = String(downloadItem?.filename || '').trim();
  const filename = normalizeFilename(absolutePath || downloadItem?.finalUrl || downloadItem?.url || '');
  const parts = absolutePath.split(/[\\/]/);
  const directory = parts.length > 1 ? parts.slice(0, -1).join('\\') : '';
  return {
    downloadId: downloadItem.id,
    filename,
    absolutePath,
    directory,
    sizeBytes: Number(downloadItem.fileSize || 0),
    mime: downloadItem.mime || 'application/pdf',
    downloadedAt: downloadItem.endTime ? Date.parse(downloadItem.endTime) : Date.now(),
    captureMethod: 'chrome.downloads.search',
  };
}

async function getCompletedDownloadMetadata(downloadId, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const downloadItem = await getDownloadItem(downloadId);
    if (
      downloadItem &&
      downloadItem.state === 'complete' &&
      downloadItem.filename &&
      isPdfDownload(downloadItem)
    ) {
      return buildSourcePdf(downloadItem);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Esperando descarga completa del PDF...');
}

async function enrichPendingDownload(downloadId, pendingKey) {
  const result = await chrome.storage.session.get(pendingKey);
  const pending = result[pendingKey];
  if (!pending) {
    return null;
  }

  try {
    const sourcePdf = await getCompletedDownloadMetadata(downloadId, 1000);
    const nextPending = {
      ...pending,
      filename: pending.filename || sourcePdf.filename,
      sourcePdf,
    };
    await chrome.storage.session.set({ [pendingKey]: nextPending });
    return nextPending;
  } catch (_error) {
    return pending;
  }
}

function emitAutoMapTelemetry(eventName, payload = {}) {
  try {
    AutohomTelemetry.emit({
      eventName,
      component: 'extension.zoho_download_mapper',
      ...payload,
    });
  } catch (_error) {}
}

function isSameMapping(existing, pending) {
  const existingDownloadId = existing?.sourcePdf?.downloadId;
  const pendingDownloadId = pending?.sourcePdf?.downloadId || pending?.downloadId;

  if (existingDownloadId && pendingDownloadId && existingDownloadId === pendingDownloadId) {
    return true;
  }

  const existingPath = String(existing?.sourcePdf?.absolutePath || '').toLowerCase();
  const pendingPath = String(pending?.sourcePdf?.absolutePath || '').toLowerCase();
  const sameZohoUrl = existing?.zohoUrl && pending?.zohoUrl && existing.zohoUrl === pending.zohoUrl;

  return Boolean(existingPath && pendingPath && existingPath === pendingPath && sameZohoUrl);
}

async function autoMapPendingDownload(downloadId, pendingKey, context = {}) {
  if (!downloadId || autoMappingInFlight.has(downloadId)) {
    return null;
  }

  autoMappingInFlight.add(downloadId);
  try {
    const result = await chrome.storage.session.get(pendingKey);
    let pending = result[pendingKey];
    if (!pending) {
      return null;
    }

    emitAutoMapTelemetry(AutohomEventNames.ACTAS_MAPPING_AUTO_STARTED, {
      operation: 'auto_map_download',
      status: 'started',
      downloadId,
      pendingKey,
      filename: pending.filename || '',
      zohoUrl: pending.zohoUrl || '',
      reason: context.reason || 'unknown',
    });

    if (!pending.sourcePdf?.absolutePath) {
      const sourcePdf = await getCompletedDownloadMetadata(downloadId);
      pending = {
        ...pending,
        filename: pending.filename || sourcePdf.filename,
        sourcePdf,
      };
      await chrome.storage.session.set({ [pendingKey]: pending });
    }

    emitAutoMapTelemetry(AutohomEventNames.ACTAS_MAPPING_AUTO_SUCCEEDED, {
      operation: 'auto_map_download_metadata',
      status: 'succeeded',
      downloadId,
      pendingKey,
      filename: pending.filename || '',
      zohoUrl: pending.zohoUrl || '',
      sourcePdfPathPresent: Boolean(pending.sourcePdf?.absolutePath),
      reason: context.reason || 'unknown',
    });

    return await saveMapping(downloadId, pendingKey, { mode: 'automatic' });
  } catch (error) {
    emitAutoMapTelemetry(AutohomEventNames.ACTAS_MAPPING_AUTO_FAILED, {
      operation: 'auto_map_download',
      level: 'error',
      status: 'failed',
      downloadId,
      pendingKey,
      reason: context.reason || 'unknown',
      error: {
        type: error?.name || 'Error',
        message: error?.message || String(error),
      },
    });
    throw error;
  } finally {
    autoMappingInFlight.delete(downloadId);
  }
}

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('crm.zoho.com')) {
    chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
  }
});

chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!isPdfDownload(downloadItem)) return;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab || !activeTab.url) return;

  const taskUrl = resolveTaskUrl(activeTab.url);
  if (!taskUrl) return;

  let filename = downloadItem.filename || '';
  try {
    const dlUrl = new URL(downloadItem.url);
    const nameParam = dlUrl.searchParams.get('name');
    if (nameParam) filename = decodeURIComponent(nameParam);
  } catch (_error) {}
  if (!filename) filename = downloadItem.url.split('/').pop().split('?')[0] || 'archivo.pdf';
  filename = normalizeFilename(filename);

  const pendingKey = getPendingKey(downloadItem.id);
  await chrome.storage.session.set({
    [pendingKey]: {
      downloadId: downloadItem.id,
      filename,
      zohoUrl: taskUrl,
      capturedAt: Date.now(),
      sourcePdf: null,
    },
  });

  enrichPendingDownload(downloadItem.id, pendingKey).catch(() => {});
  autoMapPendingDownload(downloadItem.id, pendingKey, {
    reason: 'download_created',
  }).catch((error) => {
    chrome.runtime.sendMessage({
      type: 'MAPPING_AUTO_FAILED',
      downloadId: downloadItem.id,
      pendingKey,
      error: error.message || String(error),
    }).catch(() => {});
  });
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta?.id) {
    return;
  }
  const pendingKey = getPendingKey(delta.id);
  if (delta.state?.current === 'complete' || delta.filename?.current) {
    await enrichPendingDownload(delta.id, pendingKey);
  }
  if (delta.state?.current === 'complete') {
    autoMapPendingDownload(delta.id, pendingKey, {
      reason: 'download_completed',
    }).catch((error) => {
      chrome.runtime.sendMessage({
        type: 'MAPPING_AUTO_FAILED',
        downloadId: delta.id,
        pendingKey,
        error: error.message || String(error),
      }).catch(() => {});
    });
  }
});

async function saveMapping(downloadId, pendingKey, options = {}) {
  const result = await chrome.storage.session.get(pendingKey);
  let pending = result[pendingKey];
  if (!pending) return null;

  if (!pending.sourcePdf?.absolutePath) {
    const sourcePdf = await getCompletedDownloadMetadata(downloadId);
    pending = {
      ...pending,
      filename: pending.filename || sourcePdf.filename,
      sourcePdf,
    };
    await chrome.storage.session.set({ [pendingKey]: pending });
  }

  const stored = await chrome.storage.local.get('mappings');
  const mappings = stored.mappings || [];
  const duplicate = mappings.find((mapping) => isSameMapping(mapping, pending));
  if (duplicate) {
    await chrome.storage.session.remove(pendingKey);
    emitAutoMapTelemetry(AutohomEventNames.ACTAS_MAPPING_DUPLICATE_SKIPPED, {
      operation: 'save_mapping',
      status: 'skipped',
      downloadId,
      pendingKey,
      filename: pending.filename || '',
      zohoUrl: pending.zohoUrl || '',
      sourcePdfPathPresent: Boolean(pending.sourcePdf?.absolutePath),
      duplicateMappingId: duplicate.id,
      captureMode: options.mode || 'manual',
    });
    chrome.runtime.sendMessage({
      type: 'MAPPING_SAVED',
      mapping: duplicate,
      duplicate: true,
    }).catch(() => {});
    return duplicate;
  }

  const newMapping = {
    id: Date.now(),
    filename: pending.filename,
    zohoUrl: pending.zohoUrl,
    savedAt: Date.now(),
    sourcePdf: pending.sourcePdf || null,
    conversion: {
      lastStatus: 'idle',
      lastPdfId: null,
      lastExcelPath: null,
      lastError: null,
      updatedAt: null,
    },
    captureMode: options.mode || 'manual',
    schemaVersion: 2,
  };

  mappings.unshift(newMapping);

  await chrome.storage.local.set({ mappings });
  await chrome.storage.session.remove(pendingKey);

  chrome.runtime.sendMessage({
    type: 'MAPPING_SAVED',
    mapping: newMapping,
  }).catch(() => {});

  emitAutoMapTelemetry(AutohomEventNames.ACTAS_MAPPING_AUTO_SUCCEEDED, {
    operation: 'save_mapping',
    status: 'succeeded',
    downloadId,
    pendingKey,
    filename: newMapping.filename || '',
    zohoUrl: newMapping.zohoUrl || '',
    sourcePdfPathPresent: Boolean(newMapping.sourcePdf?.absolutePath),
    captureMode: newMapping.captureMode,
    mappingId: newMapping.id,
  });

  return newMapping;
}

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'CONFIRM_MAPPING') {
    try {
      await saveMapping(message.downloadId, message.pendingKey);
      return Promise.resolve({ ok: true });
    } catch (error) {
      return Promise.resolve({ ok: false, error: error.message || 'No se pudo guardar el mapeo.' });
    }
  }
  if (message.type === 'REJECT_MAPPING') {
    await chrome.storage.session.remove(message.pendingKey);
    return Promise.resolve({ ok: true });
  }
  if (message.type === 'DELETE_MAPPING') {
    const stored = await chrome.storage.local.get('mappings');
    const mappings = (stored.mappings || []).filter((m) => m.id !== message.id);
    await chrome.storage.local.set({ mappings });
    return Promise.resolve({ ok: true });
  }
  if (message.type === 'GET_MAPPINGS') {
    const stored = await chrome.storage.local.get('mappings');
    return Promise.resolve({ mappings: stored.mappings || [] });
  }
  return false;
});
