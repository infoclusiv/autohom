window.AutohomActasPending = (() => {
  function buildTraceId(mapping) {
    return `acta-pending-${mapping.id}-${Date.now()}`;
  }

  function isMappingAlreadyPending(mapping) {
    const sourcePath = String(mapping?.sourcePdf?.absolutePath || '').toLowerCase();
    if (sourcePath.includes('\\pendientes\\') || sourcePath.endsWith('\\pendientes')) {
      return true;
    }

    const pendingMove = mapping?.pendingMove || null;
    return pendingMove?.status === 'moved' && Boolean(pendingMove.destinationPath);
  }

  async function moveMappingToPending(mapping, card) {
    const button = card?.querySelector?.('.btn-pending-mapping') || null;
    const traceId = buildTraceId(mapping);

    try {
      if (button) {
        button.disabled = true;
        button.textContent = 'Moviendo...';
      }

      window.AutohomActasRender?.updateMappingPendingStatus(
        mapping.id,
        'active',
        'Moviendo a pendientes...'
      );

      if (isMappingAlreadyPending(mapping)) {
        throw new Error('Este PDF ya fue movido a la carpeta pendientes.');
      }

      const sourcePdf = await window.AutohomActasConversion.getSourcePdfForMapping(mapping);
      if (!sourcePdf?.absolutePath) {
        throw new Error('No se pudo resolver la ruta local del PDF mapeado.');
      }

      const response = await window.AutohomConversorApi.movePdfToPending({
        path: sourcePdf.absolutePath,
        mappingId: mapping.id,
        zohoUrl: mapping.zohoUrl,
        traceId,
      });

      if (!response?.ok || !response.destinationPath || !response.pendingDirectory) {
        throw new Error(response?.error || 'No se pudo mover el PDF a pendientes.');
      }

      const movedAt = Date.now();
      const nextSourcePdf = {
        ...sourcePdf,
        absolutePath: response.destinationPath,
        directory: response.pendingDirectory,
        filename: response.filename || sourcePdf.filename,
        captureMethod: sourcePdf.captureMethod || 'chrome.downloads.search',
        movedToPendingAt: movedAt,
      };
      const pendingMove = {
        status: 'moved',
        movedAt,
        originalPath: response.originalPath || sourcePdf.absolutePath,
        destinationPath: response.destinationPath,
        pendingDirectory: response.pendingDirectory,
        traceId,
      };

      const updated = await window.AutohomActasStore.updateMappingPendingMove(mapping.id, {
        sourcePdf: nextSourcePdf,
        pendingMove,
      });
      if (!updated) {
        throw new Error('No se pudo persistir el mapeo actualizado.');
      }

      window.AutohomLogs.append(
        `actas.pending_move.succeeded trace=${traceId} mapping=${mapping.id} originalPath=${sourcePdf.absolutePath} destinationPath=${response.destinationPath}`,
        'success'
      );
      window.AutohomToast.show('PDF movido a pendientes');
      return updated;
    } catch (error) {
      window.AutohomLogs.append(
        `actas.pending_move.failed trace=${traceId} mapping=${mapping?.id || 'unknown'} originalPath=${mapping?.sourcePdf?.absolutePath || 'unknown'} destinationPath=unknown error=${error.message}`,
        'error'
      );
      window.AutohomActasRender?.updateMappingPendingStatus(
        mapping.id,
        'error',
        `Pendiente error: ${error.message}`
      );
      window.AutohomToast.show(`Error: ${error.message}`);
      throw error;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Pendiente';
      }
    }
  }

  return {
    moveMappingToPending,
    isMappingAlreadyPending,
  };
})();
