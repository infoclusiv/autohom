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

  async function convertMapping(mapping, card) {
    const button = card.querySelector('.btn-convert-mapping');

    try {
      button.disabled = true;
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'searching');

      await window.AutohomConversor.refreshPdfs({ silent: false });

      const pdfs = window.AutohomConversorStore.getPdfs();
      if (!Array.isArray(pdfs) || pdfs.length === 0) {
        throw new Error('No hay PDFs escaneados en el Conversor. Escanea primero la carpeta desde Conversor PDF.');
      }

      const bridgeStatus = await window.AutohomChromeMessages.sendRuntimeMessage({ type: 'ILOVEPDF_STATUS' });
      if (!bridgeStatus?.ok || !bridgeStatus.bridgeConnected) {
        throw new Error('El bridge con iLovePDF no está conectado. Inicia la app Python y vuelve a intentarlo.');
      }

      const pdf = findPdfByFilename(mapping);
      if (!pdf) {
        throw new Error('PDF no encontrado en Conversor. Escanea primero la carpeta donde está este PDF.');
      }
      if (pdf.__ambiguous) {
        throw new Error('Hay más de un PDF con el mismo nombre en el Conversor. Revisa la lista antes de convertir.');
      }

      window.AutohomActasStore.setActaConversion(pdf.id, mapping.id);
      window.AutohomConversor.convertOne(pdf.id, pdf.filename);
      window.AutohomActasRender.updateMappingConversionStatus(mapping.id, 'queued');
    } catch (error) {
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
