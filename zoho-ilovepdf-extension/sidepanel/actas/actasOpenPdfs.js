window.AutohomActasOpenPdfs = (() => {
  let isOpening = false;
  let lastStatusMessage = '';

  function getEligibleMappings() {
    return window.AutohomActasStore.getMappings().filter((mapping) =>
      Boolean(mapping?.id && mapping?.filename && mapping?.zohoUrl)
    );
  }

  function updateStatus(message) {
    lastStatusMessage = message || '';
    const statusEl = window.AutohomSidepanelDom.byId('actas-open-pdfs-status');
    if (statusEl) {
      statusEl.textContent = lastStatusMessage;
    }
  }

  function updateButtonState() {
    const button = window.AutohomSidepanelDom.byId('btn-actas-open-pdfs');
    if (!button) {
      return;
    }

    const eligible = getEligibleMappings();
    button.disabled = isOpening || eligible.length === 0;
    button.textContent = isOpening
      ? 'Abriendo PDFs...'
      : 'Abrir PDFs descargados';

    if (isOpening) {
      updateStatus(`Abriendo ${eligible.length} PDF${eligible.length !== 1 ? 's' : ''}...`);
      return;
    }

    if (lastStatusMessage) {
      updateStatus(lastStatusMessage);
      return;
    }

    updateStatus(
      eligible.length
        ? `${eligible.length} PDF${eligible.length !== 1 ? 's' : ''} disponibles para abrir`
        : 'No hay PDFs descargados para abrir'
    );
  }

  async function openAllDownloadedPdfs() {
    const mappings = getEligibleMappings();
    const batchId = `actas-open-pdfs-${Date.now()}`;

    if (mappings.length === 0) {
      window.AutohomToast.show('No hay PDFs descargados para abrir');
      updateButtonState();
      return;
    }

    isOpening = true;
    lastStatusMessage = '';
    updateButtonState();
    window.AutohomLogs.append(`actas.open_pdfs.requested count=${mappings.length} batch=${batchId}`);

    let opened = 0;
    const failures = [];

    try {
      for (const mapping of mappings) {
        try {
          const sourcePdf = await window.AutohomActasConversion.getSourcePdfForMapping(mapping);
          if (!sourcePdf?.absolutePath) {
            throw new Error('PDF local no encontrado para este mapeo.');
          }

          const response = await window.AutohomConversorApi.registerLocalPdf({
            path: sourcePdf.absolutePath,
            source: 'acta-mapping',
            mappingId: mapping.id,
            zohoUrl: mapping.zohoUrl,
            requestedOutputDirectory: sourcePdf.directory,
            traceId: `${batchId}-${mapping.id}`,
          });

          if (!response?.ok || !response.pdf?.id) {
            throw new Error(response?.error || 'No se pudo registrar el PDF local.');
          }

          window.AutohomLogs.append(
            `actas.open_pdfs.pdf_registered mapping=${mapping.id} pdfId=${response.pdf.id}`
          );

          const url = window.AutohomConversorApi.buildPdfFileUrl(response.pdf.id, {
            disposition: 'inline',
          });

          await chrome.tabs.create({
            url,
            active: false,
          });

          opened += 1;
          window.AutohomLogs.append(
            `actas.open_pdfs.tab_opened mapping=${mapping.id} pdfId=${response.pdf.id}`
          );
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (error) {
          failures.push({
            mappingId: mapping.id,
            filename: mapping.filename,
            error: error.message || String(error),
          });
          window.AutohomLogs.append(
            `actas.open_pdfs.failed mapping=${mapping.id} filename=${mapping.filename} error=${error.message || String(error)}`,
            'error'
          );
        }
      }

      const message = `PDFs abiertos: ${opened}. Errores: ${failures.length}.`;
      lastStatusMessage = message;
      updateStatus(message);
      window.AutohomLogs.append(
        `actas.open_pdfs.completed opened=${opened} failed=${failures.length}`
      );
      window.AutohomToast.show(message);
    } finally {
      isOpening = false;
      updateButtonState();
    }
  }

  function init() {
    const button = window.AutohomSidepanelDom.byId('btn-actas-open-pdfs');
    if (!button) {
      return;
    }
    if (button.dataset.openPdfsBound !== 'true') {
      button.dataset.openPdfsBound = 'true';
      button.addEventListener('click', openAllDownloadedPdfs);
    }
    updateButtonState();
  }

  return {
    init,
    updateButtonState,
    openAllDownloadedPdfs,
  };
})();
