window.AutohomActasConversion = (() => {
  function normalizeFilename(filename) {
    return String(filename || '')
      .split('/')
      .pop()
      .split('\\')
      .pop()
      .trim()
      .toLowerCase();
  }

  function findPdfByFilename(mapping) {
    const target = normalizeFilename(mapping?.filename);
    if (!target) {
      return null;
    }

    const exact = window.AutohomConversorStore.getPdfs().filter(
      (pdf) => normalizeFilename(pdf.filename) === target
    );
    if (exact.length === 1) {
      return exact[0];
    }
    if (exact.length > 1) {
      return { __ambiguous: true, matches: exact };
    }
    return null;
  }

  function buildTraceId(mapping) {
    return `acta-${mapping.id}-${Date.now()}`;
  }

  async function resolveLegacySourcePdf(mapping) {
    const filename = normalizeFilename(mapping?.filename);
    if (!filename) {
      return null;
    }

    const matches = await chrome.downloads.search({
      query: [filename],
      state: 'complete',
    });
    const exact = (matches || []).filter((item) => normalizeFilename(item.filename) === filename);
    if (exact.length !== 1 || !exact[0]?.filename) {
      return null;
    }

    const absolutePath = exact[0].filename;
    const parts = absolutePath.split(/[\\/]/);
    return {
      downloadId: exact[0].id,
      filename: normalizeFilename(absolutePath),
      absolutePath,
      directory: parts.length > 1 ? parts.slice(0, -1).join('\\') : '',
      sizeBytes: Number(exact[0].fileSize || 0),
      mime: exact[0].mime || 'application/pdf',
      downloadedAt: exact[0].endTime ? Date.parse(exact[0].endTime) : Date.now(),
      captureMethod: 'chrome.downloads.search',
    };
  }

  async function getSourcePdfForMapping(mapping) {
    if (mapping?.sourcePdf?.absolutePath) {
      return mapping.sourcePdf;
    }

    const recovered = await resolveLegacySourcePdf(mapping);
    if (recovered) {
      await window.AutohomActasStore.updateMappingSourcePdf(mapping.id, recovered);
      return recovered;
    }

    throw new Error(
      'Este mapeo no tiene ruta local del PDF. Fue creado antes de esta versión o no se pudo capturar la ruta.'
    );
  }

  async function resolveMappedPdf(mapping, sourcePdf, traceId) {
    const response = await window.AutohomConversorApi.registerLocalPdf({
      path: sourcePdf.absolutePath,
      source: 'acta-mapping',
      mappingId: mapping.id,
      zohoUrl: mapping.zohoUrl,
      requestedOutputDirectory: sourcePdf.directory,
      traceId,
    });

    if (!response?.ok || !response.pdf) {
      throw new Error(response?.error || 'No se pudo registrar el PDF local en la app Python.');
    }

    return response.pdf;
  }

  async function convertMapping(mapping, card) {
    const button = card.querySelector('.btn-convert-mapping');
    const traceId = buildTraceId(mapping);

    try {
      button.disabled = true;
      window.AutohomLogs.append(`🧭 acta.convert.clicked trace=${traceId} mapping=${mapping.id}`);
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'preparing');

      const bridgeStatus = await window.AutohomChromeMessages.sendRuntimeMessage({ type: 'ILOVEPDF_STATUS' });
      if (!bridgeStatus?.ok || !bridgeStatus.bridgeConnected) {
        throw new Error('El bridge con iLovePDF no está conectado. Inicia la app Python y vuelve a intentarlo.');
      }

      const sourcePdf = await getSourcePdfForMapping(mapping);
      window.AutohomLogs.append(
        `📍 acta.convert.mapping_path.checked trace=${traceId} path=${sourcePdf.absolutePath}`
      );
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'registering');

      const pdf = await resolveMappedPdf(mapping, sourcePdf, traceId);
      window.AutohomLogs.append(`🧩 acta.convert.local_pdf.register.success trace=${traceId} pdfId=${pdf.id}`);

      window.AutohomActasStore.setActaConversion(pdf.id, {
        mappingId: mapping.id,
        source: 'acta-mapping',
        traceId,
      });
      window.AutohomConversor.convertOne({
        pdfId: pdf.id,
        filename: pdf.filename,
        source: 'acta-mapping',
        mappingId: mapping.id,
        outputDirectory: sourcePdf.directory,
        sourcePdfPath: sourcePdf.absolutePath,
        traceId,
      });
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'queued');
    } catch (error) {
      window.AutohomLogs.append(`❌ acta.convert.error trace=${traceId} ${error.message}`, 'error');
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'error', `Error: ${error.message}`);
      window.AutohomToast.show(`❌ ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  return {
    normalizeFilename,
    findPdfByFilename,
    convertMapping,
  };
})();
