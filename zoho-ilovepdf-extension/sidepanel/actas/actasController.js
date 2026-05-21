window.AutohomActas = (() => {
  async function init() {
    await window.AutohomActasStore.loadMappings();
    window.AutohomActasRender.renderMappings(window.AutohomActasStore.getMappings());
    window.AutohomActasBatchConversion?.init();
    window.AutohomActasOpenPdfs?.init();
    await window.AutohomActasOpenSite?.init();
    window.AutohomActasOpenPdfs?.updateButtonState();
    window.AutohomActasOpenSite?.updateButtonState();

    window.AutohomSidepanelDom.byId('search').addEventListener('input', () => {
      window.AutohomActasRender.renderMappings(window.AutohomActasStore.filterMappings());
      window.AutohomActasOpenPdfs?.updateButtonState();
      window.AutohomActasOpenSite?.updateButtonState();
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
        if (!value?.downloadId) {
          await chrome.storage.session.remove(key);
          window.AutohomLogs.append(
            `actas.mapping.pending_restore_removed_stale key=${key}`,
            'warn'
          );
          continue;
        }

        window.AutohomLogs.append(
          `actas.mapping.pending_restore_auto_started key=${key} download=${value.downloadId}`,
          'info'
        );
        const response = await window.AutohomChromeMessages.sendRuntimeMessage({
          type: 'CONFIRM_MAPPING',
          downloadId: value.downloadId,
          pendingKey: key,
          auto: true,
        });

        if (!response?.ok) {
          window.AutohomLogs.append(
            `actas.mapping.pending_restore_failed key=${key} error=${response?.error || 'unknown'}`,
            'error'
          );
          continue;
        }

        window.AutohomLogs.append(
          `actas.mapping.pending_restore_auto_succeeded key=${key} download=${value.downloadId}`,
          'info'
        );
      }
    }
  }

  async function handlePendingDownload(message) {
    if (message.mode !== 'manual' && message.requiresUserConfirmation !== true) {
      window.AutohomLogs.append(
        `actas.mapping.prompt_suppressed key=${message.pendingKey || 'unknown'}`,
        'warn'
      );

      if (message.downloadId && message.pendingKey) {
        await window.AutohomChromeMessages.sendRuntimeMessage({
          type: 'CONFIRM_MAPPING',
          downloadId: message.downloadId,
          pendingKey: message.pendingKey,
          auto: true,
        });
      }
      return;
    }

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
    window.AutohomActasBatchConversion?.updateButtonState();
    window.AutohomActasOpenPdfs?.updateButtonState();
    window.AutohomActasOpenSite?.updateButtonState();
    window.AutohomToast.show('Acta mapeada correctamente');
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
      window.AutohomActasBatchConversion?.updateButtonState();
      window.AutohomActasOpenPdfs?.updateButtonState();
      window.AutohomActasOpenSite?.updateButtonState();
    }, 300);
  }

  async function clearAllMappings() {
    if (window.AutohomActasStore.getMappings().length === 0) {
      window.AutohomToast.show('No hay registros para limpiar');
      return;
    }

    const ok = confirm(
      'Seguro que quieres limpiar todos los registros de Actas? Esto no eliminara archivos PDF del PC ni la lista del Conversor PDF.'
    );
    if (!ok) {
      return;
    }

    await chrome.storage.local.set({ mappings: [] });
    window.AutohomActasStore.clearMappings();
    window.AutohomActasRender.renderMappings([]);
    window.AutohomActasBatchConversion?.updateButtonState();
    window.AutohomActasOpenPdfs?.updateButtonState();
    window.AutohomActasOpenSite?.updateButtonState();
    window.AutohomToast.show('Registros de Actas limpiados');
  }

  function updateMappingConversionStatus(mappingId, status, message = '', options = {}) {
    window.AutohomActasRender.updateMappingConversionStatus(mappingId, status, message, options);
    window.AutohomActasBatchConversion?.updateButtonState();
  }

  async function moveMappingToPending(mapping, card) {
    const updated = await window.AutohomActasPending.moveMappingToPending(mapping, card);
    window.AutohomActasRender.renderMappings(window.AutohomActasStore.filterMappings(), updated?.id || mapping.id);
    window.AutohomActasBatchConversion?.updateButtonState();
    window.AutohomActasOpenPdfs?.updateButtonState();
    window.AutohomActasOpenSite?.updateButtonState();
    return updated;
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
    moveMappingToPending,
    convertMapping,
    convertAllMapped: () => window.AutohomActasBatchConversion?.convertAllMapped(),
  };
})();
