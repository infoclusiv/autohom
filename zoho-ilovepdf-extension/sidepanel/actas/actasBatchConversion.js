window.AutohomActasBatchConversion = (() => {
  const ACTIVE_STATUSES = new Set([
    'preparing',
    'registering',
    'queued',
    'starting',
    'uploading',
    'converting',
    'downloading',
    'finalizing',
  ]);

  let isPreparingBatch = false;
  let lastStatusMessage = '';

  function buildBatchId() {
    return `actas-batch-${Date.now()}`;
  }

  function getEligibleMappings() {
    return window.AutohomActasStore.getMappings().filter((mapping) => {
      const status = mapping?.conversion?.lastStatus || 'idle';
      if (ACTIVE_STATUSES.has(status) || status === 'completed') {
        return false;
      }
      return Boolean(mapping?.id && mapping?.filename && mapping?.zohoUrl);
    });
  }

  function updateButtonState(options = {}) {
    const { preserveStatusMessage = false } = options;
    const button = window.AutohomSidepanelDom.byId('btn-actas-convert-all');
    const status = window.AutohomSidepanelDom.byId('actas-batch-status');
    if (!button) {
      return;
    }

    const eligible = getEligibleMappings();
    button.disabled = isPreparingBatch || eligible.length === 0;
    button.textContent = isPreparingBatch
      ? 'Preparando lote...'
      : 'Convertir todos los PDF mapeados';

    if (!status) {
      return;
    }

    if (isPreparingBatch) {
      status.textContent = `Preparando ${eligible.length} pendientes del lote actual`;
      return;
    }

    if (preserveStatusMessage && lastStatusMessage) {
      status.textContent = lastStatusMessage;
      return;
    }

    lastStatusMessage = '';
    status.textContent = eligible.length
      ? `${eligible.length} PDF${eligible.length !== 1 ? 's' : ''} listos para convertir`
      : 'No hay PDFs mapeados pendientes para convertir';
  }

  async function convertAllMapped() {
    const mappings = getEligibleMappings();
    const statusEl = window.AutohomSidepanelDom.byId('actas-batch-status');
    const batchId = buildBatchId();

    if (mappings.length === 0) {
      window.AutohomToast.show('No hay PDFs mapeados pendientes para convertir');
      updateButtonState();
      return;
    }

    isPreparingBatch = true;
    updateButtonState();
    window.AutohomLogs.append(`actas.batch.clicked batch=${batchId} count=${mappings.length}`);

    try {
      const bridge = await window.AutohomActasConversion.ensureBridgeReady();
      if (!bridge.ok) {
        throw new Error(bridge.error);
      }

      const descriptors = [];
      const failures = [];

      for (const mapping of mappings) {
        try {
          const descriptor = await window.AutohomActasConversion.prepareMappingConversion(mapping, {
            batchId,
          });
          descriptors.push(descriptor);
          await window.AutohomActasStore.updateMappingConversion(mapping.id, {
            lastStatus: 'queued',
            lastPdfId: descriptor.pdfId,
            lastExcelPath: '',
            lastError: null,
          });
          window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'queued');
        } catch (error) {
          failures.push({ mappingId: mapping.id, error: error.message });
          await window.AutohomActasStore.updateMappingConversion(mapping.id, {
            lastStatus: 'error',
            lastPdfId: null,
            lastExcelPath: '',
            lastError: error.message,
          });
          window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'error', `Error: ${error.message}`);
          window.AutohomLogs.append(
            `actas.batch.mapping_error batch=${batchId} mapping=${mapping.id} ${error.message}`,
            'error'
          );
        }
      }

      if (descriptors.length === 0) {
        throw new Error('No se pudo preparar ningun PDF mapeado para conversion.');
      }

      const response = await window.AutohomChromeMessages.sendRuntimeMessage({
        type: 'ILOVEPDF_CONVERT_ALL',
        pdfs: descriptors,
      });
      if (!response?.ok) {
        throw new Error(response?.error || 'No se pudo enviar el lote a iLovePDF.');
      }

      const summary = `${descriptors.length} enviados - ${failures.length} con error`;
      lastStatusMessage = summary;
      if (statusEl) {
        statusEl.textContent = summary;
      }
      window.AutohomLogs.append(`actas.batch.queued batch=${batchId} ${summary}`);
      window.AutohomToast.show(summary);
    } catch (error) {
      lastStatusMessage = `Error: ${error.message}`;
      if (statusEl) {
        statusEl.textContent = lastStatusMessage;
      }
      window.AutohomLogs.append(`actas.batch.error batch=${batchId} ${error.message}`, 'error');
      window.AutohomToast.show(`Error: ${error.message}`);
    } finally {
      isPreparingBatch = false;
      updateButtonState({ preserveStatusMessage: true });
    }
  }

  function init() {
    const button = window.AutohomSidepanelDom.byId('btn-actas-convert-all');
    if (!button) {
      return;
    }
    if (button.dataset.batchBound !== 'true') {
      button.dataset.batchBound = 'true';
      button.addEventListener('click', convertAllMapped);
    }
    updateButtonState();
  }

  return {
    init,
    updateButtonState,
    getEligibleMappings,
    convertAllMapped,
  };
})();
