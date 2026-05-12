window.AutohomActasStore = (() => {
  const state = window.AutohomSidepanelState;

  async function loadMappings() {
    const stored = await chrome.storage.local.get('mappings');
    state.allMappings = stored.mappings || [];
    updateStats();
    return state.allMappings;
  }

  function getMappings() {
    return state.allMappings;
  }

  function prependMapping(mapping) {
    state.allMappings.unshift(mapping);
    updateStats();
  }

  function removeMapping(mappingId) {
    state.allMappings = state.allMappings.filter((mapping) => mapping.id !== mappingId);
    Object.keys(state.actaConversionsByPdfId).forEach((pdfId) => {
      if (state.actaConversionsByPdfId[pdfId] === mappingId) {
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
      mapping.filename.toLowerCase().includes(query) ||
      mapping.zohoUrl.toLowerCase().includes(query)
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

  function setActaConversion(pdfId, mappingId) {
    state.actaConversionsByPdfId[pdfId] = mappingId;
  }

  function getActaConversion(pdfId) {
    return state.actaConversionsByPdfId[pdfId];
  }

  function clearActaConversion(pdfId) {
    delete state.actaConversionsByPdfId[pdfId];
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
    updateStats,
  };
})();
