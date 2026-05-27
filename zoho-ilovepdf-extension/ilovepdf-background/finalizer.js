const ILovePDFFinalizer = (() => {
  async function finalizeDownload(pdfDescriptor, downloadResult) {
    const targetDirectory = resolveTargetDirectory(pdfDescriptor);
    if (!targetDirectory) {
      return {
        ok: false,
        error: 'Target directory missing for finalize-download request.',
        excelPath: downloadResult.filename || null,
      };
    }

    ILovePDFUtils.log('info', '[Finalizer] ilovepdf.finalize.request', {
      pdfId: pdfDescriptor.pdfId,
      filename: pdfDescriptor.filename,
      mappingId: pdfDescriptor.mappingId || null,
      outputDirectory: targetDirectory,
      downloadedFilePath: downloadResult.filename || '',
      sourcePdfPath: pdfDescriptor.sourcePdfPath || null,
      targetDirectoryStrategy: pdfDescriptor.outputDirectory ? 'descriptor.outputDirectory' : 'sourcePdfPath.parent',
      traceId: pdfDescriptor.traceId || null,
    });

    const response = await fetch(`${CONFIG_ILOVEPDF.API_BASE_URL}/conversions/finalize-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfId: pdfDescriptor.pdfId,
        mappingId: pdfDescriptor.mappingId || null,
        source: pdfDescriptor.source || 'conversor-scan',
        downloadedFilePath: downloadResult.filename,
        targetDirectory,
        sourcePdfPath: pdfDescriptor.sourcePdfPath || null,
        originalPdfFilename: pdfDescriptor.filename,
        traceId: pdfDescriptor.traceId || null,
      }),
    });

    return await response.json();
  }

  function resolveTargetDirectory(pdfDescriptor) {
    const explicitOutputDirectory = String(pdfDescriptor?.outputDirectory || '').trim();
    if (explicitOutputDirectory) {
      return explicitOutputDirectory;
    }

    return deriveParentDirectory(pdfDescriptor?.sourcePdfPath);
  }

  function deriveParentDirectory(rawPath) {
    const normalizedPath = String(rawPath || '').trim().replace(/[\\/]+$/, '');
    if (!normalizedPath) {
      return null;
    }

    const lastSeparatorIndex = Math.max(normalizedPath.lastIndexOf('\\'), normalizedPath.lastIndexOf('/'));
    if (lastSeparatorIndex < 0) {
      return null;
    }

    const parent = normalizedPath.slice(0, lastSeparatorIndex);
    if (!parent) {
      return normalizedPath.startsWith('/') ? '/' : null;
    }

    return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent;
  }

  return { finalizeDownload };
})();
