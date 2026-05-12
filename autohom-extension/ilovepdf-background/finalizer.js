const ILovePDFFinalizer = (() => {
  async function finalizeDownload(pdfDescriptor, downloadResult) {
    if (!pdfDescriptor?.outputDirectory) {
      return {
        ok: true,
        skipped: true,
        reason: 'No outputDirectory provided; leaving file in Chrome default download location.',
        excelPath: downloadResult.filename || null,
      };
    }

    ILovePDFUtils.log('info', '[Finalizer] ilovepdf.finalize.request', {
      pdfId: pdfDescriptor.pdfId,
      filename: pdfDescriptor.filename,
      mappingId: pdfDescriptor.mappingId || null,
      outputDirectory: pdfDescriptor.outputDirectory,
      downloadedFilePath: downloadResult.filename || '',
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
        targetDirectory: pdfDescriptor.outputDirectory,
        sourcePdfPath: pdfDescriptor.sourcePdfPath || null,
        originalPdfFilename: pdfDescriptor.filename,
        traceId: pdfDescriptor.traceId || null,
      }),
    });

    return await response.json();
  }

  return { finalizeDownload };
})();
