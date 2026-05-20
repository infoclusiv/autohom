window.AutohomActasStore = (() => {
  const state = window.AutohomSidepanelState;
  const ACTIVE_CONVERSION_STATUSES = new Set([
    'preparing',
    'registering',
    'queued',
    'starting',
    'uploading',
    'converting',
    'downloading',
    'finalizing',
  ]);

  function normalizeMapping(mapping) {
    const sourcePdf = mapping?.sourcePdf || null;
    const conversion = mapping?.conversion || {};
    const lastStatus = ACTIVE_CONVERSION_STATUSES.has(conversion.lastStatus)
      ? 'idle'
      : (conversion.lastStatus || 'idle');
    return {
      ...mapping,
      sourcePdf,
      pendingMove: mapping?.pendingMove || null,
      conversion: {
        lastStatus,
        lastPdfId: conversion.lastPdfId || null,
        lastExcelPath: conversion.lastExcelPath || null,
        lastError: conversion.lastError || null,
        updatedAt: conversion.updatedAt || null,
      },
      schemaVersion: mapping?.schemaVersion || 1,
    };
  }

  async function loadMappings() {
    const stored = await chrome.storage.local.get('mappings');
    state.allMappings = (stored.mappings || []).map(normalizeMapping);
    updateStats();
    return state.allMappings;
  }

  function getMappings() {
    return state.allMappings;
  }

  function prependMapping(mapping) {
    const normalized = normalizeMapping(mapping);
    const existingIndex = state.allMappings.findIndex((item) => item.id === normalized.id);
    if (existingIndex >= 0) {
      state.allMappings.splice(existingIndex, 1);
    }
    state.allMappings.unshift(normalized);
    updateStats();
  }

  function removeMapping(mappingId) {
    state.allMappings = state.allMappings.filter((mapping) => mapping.id !== mappingId);
    Object.keys(state.actaConversionsByPdfId).forEach((pdfId) => {
      if (state.actaConversionsByPdfId[pdfId]?.mappingId === mappingId) {
        delete state.actaConversionsByPdfId[pdfId];
      }
    });
    updateStats();
  }

  function clearMappings() {
    state.allMappings = [];
    state.actaConversionsByPdfId = {};
    updateStats();
  }

  function filterMappings() {
    const query = window.AutohomSidepanelDom.byId('search').value.toLowerCase().trim();
    if (!query) {
      return state.allMappings;
    }
    return state.allMappings.filter((mapping) =>
      String(mapping.filename || '').toLowerCase().includes(query) ||
      String(mapping.zohoUrl || '').toLowerCase().includes(query)
    );
  }

  function setPendingItem(key, item) {
    state.pendingItems[key] = item;
    updateStats();
  }

  function removePendingItem(key) {
    delete state.pendingItems[key];
    updateStats();
  }

  function getPendingItems() {
    return state.pendingItems;
  }

  function setActaConversion(pdfId, mappingOrDescriptor, metadata = {}) {
    const descriptor = typeof mappingOrDescriptor === 'object'
      ? mappingOrDescriptor
      : { mappingId: mappingOrDescriptor, ...metadata };
    state.actaConversionsByPdfId[pdfId] = descriptor;
  }

  function getActaConversion(pdfId) {
    return state.actaConversionsByPdfId[pdfId] || null;
  }

  function clearActaConversion(pdfId) {
    delete state.actaConversionsByPdfId[pdfId];
  }

  async function updateMapping(mappingId, patch) {
    const index = state.allMappings.findIndex((item) => item.id === mappingId);
    if (index < 0) {
      return null;
    }

    const nextMapping = normalizeMapping({
      ...state.allMappings[index],
      ...patch,
    });
    state.allMappings[index] = nextMapping;
    await chrome.storage.local.set({ mappings: state.allMappings });
    return nextMapping;
  }

  async function updateMappingSourcePdf(mappingId, sourcePdf) {
    const mapping = state.allMappings.find((item) => item.id === mappingId);
    return await updateMapping(mappingId, {
      sourcePdf,
      schemaVersion: Math.max(mapping?.schemaVersion || 1, 2),
    });
  }

  async function updateMappingConversion(mappingId, patch) {
    const mapping = state.allMappings.find((item) => item.id === mappingId);
    if (!mapping) {
      return null;
    }
    return await updateMapping(mappingId, {
      conversion: {
        ...(mapping.conversion || {}),
        ...patch,
        updatedAt: Date.now(),
      },
      schemaVersion: Math.max(mapping.schemaVersion || 1, 2),
    });
  }

  async function updateMappingPendingMove(mappingId, payload) {
    const mapping = state.allMappings.find((item) => item.id === mappingId);
    if (!mapping) {
      return null;
    }

    return await updateMapping(mappingId, {
      sourcePdf: payload?.sourcePdf || mapping.sourcePdf || null,
      pendingMove: payload?.pendingMove || mapping.pendingMove || null,
      schemaVersion: Math.max(mapping.schemaVersion || 1, 3),
    });
  }

  function updateStats() {
    window.AutohomSidepanelDom.byId('stat-total').textContent = state.allMappings.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    window.AutohomSidepanelDom.byId('stat-today').textContent =
      state.allMappings.filter((mapping) => mapping.savedAt >= today.getTime()).length;
    window.AutohomSidepanelDom.byId('stat-pending').textContent =
      Object.keys(state.pendingItems).length;
  }

  return {
    loadMappings,
    getMappings,
    prependMapping,
    removeMapping,
    clearMappings,
    filterMappings,
    setPendingItem,
    removePendingItem,
    getPendingItems,
    setActaConversion,
    getActaConversion,
    clearActaConversion,
    updateMappingSourcePdf,
    updateMappingConversion,
    updateMappingPendingMove,
    updateStats,
  };
})();
