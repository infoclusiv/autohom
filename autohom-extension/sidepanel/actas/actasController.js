window.AutohomActas = (() => {
  async function init() {
    await window.AutohomActasStore.loadMappings();
    window.AutohomActasRender.renderMappings(window.AutohomActasStore.getMappings());

    window.AutohomSidepanelDom.byId('search').addEventListener('input', () => {
      window.AutohomActasRender.renderMappings(window.AutohomActasStore.filterMappings());
    });
    window.AutohomSidepanelDom.byId('btn-export').addEventListener('click', () => {
      window.AutohomActasCsvExport.exportMappings();
    });
    window.AutohomSidepanelDom.byId('btn-clear-mappings').addEventListener('click', clearAllMappings);
  }

  async function restorePendingDownloads() {
    const sessionData = await chrome.storage.session.get(null);
    for (const [key, value] of Object.entries(sessionData)) {
      if (key.startsWith('pending_')) {
        await handlePendingDownload({
          downloadId: value.downloadId,
          pendingKey: key,
          _data: value,
        });
      }
    }
  }

  async function handlePendingDownload(message) {
    let data = message._data;
    if (!data) {
      const result = await chrome.storage.session.get(message.pendingKey);
      data = result[message.pendingKey];
    }
    if (!data) {
      return;
    }
    window.AutohomActasStore.setPendingItem(message.pendingKey, data);
    window.AutohomActasRender.renderPendingSection();
  }

  function handleMappingSaved(mapping) {
    window.AutohomActasStore.prependMapping(mapping);
    window.AutohomActasRender.renderMappings(window.AutohomActasStore.filterMappings(), mapping.id);
    window.AutohomToast.show('✅ Acta mapeada correctamente');
  }

  async function deleteMapping(id, card) {
    card.style.opacity = '0.4';
    card.style.transform = 'translateX(-10px)';
    await window.AutohomChromeMessages.sendRuntimeMessage({ type: 'DELETE_MAPPING', id });
    window.AutohomActasStore.removeMapping(id);
    setTimeout(() => {
      card.remove();
      const filtered = window.AutohomActasStore.filterMappings();
      window.AutohomSidepanelDom.byId('count-label').textContent =
        `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`;
      if (filtered.length === 0) {
        window.AutohomSidepanelDom.byId('empty-state').style.display = 'block';
      }
    }, 300);
  }

  async function clearAllMappings() {
    if (window.AutohomActasStore.getMappings().length === 0) {
      window.AutohomToast.show('No hay registros para limpiar');
      return;
    }

    const ok = confirm(
      '¿Seguro que quieres limpiar todos los registros de Actas? Esto no eliminará archivos PDF del PC ni la lista del Conversor PDF.'
    );
    if (!ok) {
      return;
    }

    await chrome.storage.local.set({ mappings: [] });
    window.AutohomActasStore.clearMappings();
    window.AutohomActasRender.renderMappings([]);
    window.AutohomToast.show('🗑️ Registros de Actas limpiados');
  }

  function updateMappingConversionStatus(mappingId, status, message = '', options = {}) {
    window.AutohomActasRender.updateMappingConversionStatus(mappingId, status, message, options);
  }

  async function convertMapping(mapping, card) {
    await window.AutohomActasConversion.convertMapping(mapping, card);
  }

  return {
    init,
    restorePendingDownloads,
    handlePendingDownload,
    handleMappingSaved,
    deleteMapping,
    clearAllMappings,
    updateMappingConversionStatus,
    convertMapping,
  };
})();
