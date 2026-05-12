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

  chrome.runtime.sendMessage({
    type: 'DOWNLOAD_PENDING',
    downloadId: downloadItem.id,
    pendingKey,
  }).catch(() => {});

  chrome.notifications.create(`notif_${downloadItem.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Es un acta de homologacion?',
    message: `PDF detectado: ${filename}`,
    buttons: [
      { title: 'Si, mapear acta' },
      { title: 'No, ignorar' },
    ],
    requireInteraction: true,
    priority: 2,
  });

  chrome.notifications.onButtonClicked.addListener(async function handler(notifId, btnIndex) {
    if (notifId !== `notif_${downloadItem.id}`) return;
    chrome.notifications.onButtonClicked.removeListener(handler);
    chrome.notifications.clear(notifId);
    if (btnIndex === 0) {
      try {
        await saveMapping(downloadItem.id, pendingKey);
      } catch (error) {
        chrome.notifications.create(`notif_error_${downloadItem.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'No se pudo mapear el acta',
          message: error.message || 'Error desconocido',
          priority: 2,
        });
      }
    } else {
      await chrome.storage.session.remove(pendingKey);
    }
  });
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta?.id) {
    return;
  }
  if (delta.state?.current === 'complete' || delta.filename?.current) {
    await enrichPendingDownload(delta.id, getPendingKey(delta.id));
  }
});

async function saveMapping(downloadId, pendingKey) {
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
    schemaVersion: 2,
  };

  mappings.unshift(newMapping);

  await chrome.storage.local.set({ mappings });
  await chrome.storage.session.remove(pendingKey);

  chrome.runtime.sendMessage({
    type: 'MAPPING_SAVED',
    mapping: newMapping,
  }).catch(() => {});

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
