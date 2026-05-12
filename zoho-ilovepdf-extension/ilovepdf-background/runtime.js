/**
 * ilovepdf-background/runtime.js - Cola secuencial de conversion.
 */

const ILovePDFRuntime = (() => {
  let _queue = [];
  let _running = false;
  let _currentPdfId = null;

  function queueConversion(pdfDescriptor) {
    _queue.push(pdfDescriptor);
    _logPdf('info', pdfDescriptor, 'ilovepdf.queue.enqueued', { queueLength: _queue.length });
    _processNext();
  }

  function queueAll(pdfList) {
    for (const pdf of pdfList) {
      _queue.push(pdf);
    }
    ILovePDFUtils.log('info', '[Runtime] queue.bulk_enqueued', {
      count: pdfList.length,
      queueLength: _queue.length,
    });
    _processNext();
  }

  async function _processNext() {
    if (_running || _queue.length === 0) return;
    _running = true;

    const pdf = _queue.shift();
    const startedAt = Date.now();
    _currentPdfId = pdf.pdfId;

    _logPdf('info', pdf, 'queue.start', { queueRemaining: _queue.length });
    _broadcastStatus(pdf, 'starting', `Iniciando conversión de ${pdf.filename}...`, {
      elapsedMs: _elapsedMs(startedAt),
    });

    try {
      const tab = await ILovePDFTabManager.findOrCreateILovePDFTab();
      _logPdf('info', pdf, 'tab.ready', {
        tabId: tab.id,
        url: tab.url || '',
        elapsedMs: _elapsedMs(startedAt),
      });

      let ready = await ILovePDFTabManager.waitForContentScript(tab.id);
      if (!ready) {
        _logPdf('warn', pdf, 'content.not_ready.upload', {
          tabId: tab.id,
          elapsedMs: _elapsedMs(startedAt),
        });
        await chrome.tabs.reload(tab.id);
        await ILovePDFUtils.sleep(CONFIG_ILOVEPDF.TIMING.SSE_READY_WAIT_MS);
        ready = await ILovePDFTabManager.waitForContentScript(tab.id);
      }
      if (!ready) {
        throw new Error('Content script not ready on upload page.');
      }

      _broadcastStatus(pdf, 'uploading', `Subiendo ${pdf.filename}...`, {
        elapsedMs: _elapsedMs(startedAt),
      });

      _logPdf('info', pdf, 'phase1.send', {
        tabId: tab.id,
        url: tab.url || '',
        elapsedMs: _elapsedMs(startedAt),
      });
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_CONVERSION',
        pdfId: pdf.pdfId,
        filename: pdf.filename,
        downloadUrl: `${CONFIG_ILOVEPDF.API_BASE_URL}/pdfs/${pdf.pdfId}/file`,
      }).then((response) => {
        _logPdf('info', pdf, 'phase1.response', {
          tabId: tab.id,
          elapsedMs: _elapsedMs(startedAt),
          response,
        });
      }).catch((error) => {
        _logPdf('warn', pdf, 'phase1.channel_closed', {
          tabId: tab.id,
          elapsedMs: _elapsedMs(startedAt),
          error: error?.message || String(error),
        });
      });

      _broadcastStatus(pdf, 'converting', `Convirtiendo ${pdf.filename}...`, {
        elapsedMs: _elapsedMs(startedAt),
      });

      const downloadPage = await _waitForDownloadPage(tab.id, pdf, startedAt);

      let ready2 = await ILovePDFTabManager.waitForContentScript(downloadPage.tabId);
      if (!ready2) {
        _logPdf('warn', pdf, 'content.not_ready.download', {
          tabId: downloadPage.tabId,
          url: downloadPage.url,
          elapsedMs: _elapsedMs(startedAt),
        });
        await chrome.tabs.reload(downloadPage.tabId);
        await ILovePDFUtils.sleep(CONFIG_ILOVEPDF.TIMING.SSE_READY_WAIT_MS);
        ready2 = await ILovePDFTabManager.waitForContentScript(downloadPage.tabId);
      }
      if (!ready2) {
        throw new Error('Content script not ready on download page.');
      }

      _logPdf('info', pdf, 'phase2.send', {
        tabId: downloadPage.tabId,
        url: downloadPage.url,
        elapsedMs: _elapsedMs(startedAt),
      });
      const downloadWait = ILovePDFDownloadTracker.waitForExpectedDownload(pdf, {
        tabId: downloadPage.tabId,
        timeoutMs: CONFIG_ILOVEPDF.TIMING.DOWNLOAD_CONFIRM_TIMEOUT_MS,
      });

      let phase2 = null;
      try {
        phase2 = await chrome.tabs.sendMessage(downloadPage.tabId, {
          type: 'START_DOWNLOAD',
          pdfId: pdf.pdfId,
          filename: pdf.filename,
        });
        _logPdf('info', pdf, 'phase2.ack', {
          tabId: downloadPage.tabId,
          elapsedMs: _elapsedMs(startedAt),
          response: phase2,
        });
      } catch (error) {
        const ackError = error?.message || String(error);
        if (!_isIgnorablePhase2AckError(ackError)) {
          ILovePDFDownloadTracker.cancelIfTracking(
            pdf.pdfId,
            ackError || 'Phase 2 message failed before download tracking could continue.'
          );
          throw error;
        }

        _logPdf('warn', pdf, 'phase2.ack_lost', {
          tabId: downloadPage.tabId,
          elapsedMs: _elapsedMs(startedAt),
          error: ackError,
        });
      }

      if (phase2?.accepted === false || phase2?.success === false) {
        ILovePDFDownloadTracker.cancelIfTracking(
          pdf.pdfId,
          phase2?.error || 'Phase 2 (download) failed before Chrome confirmed the download.'
        );
        throw new Error(phase2?.error || 'Phase 2 (download) failed.');
      }

      _broadcastStatus(pdf, 'downloading', `Esperando descarga real de ${pdf.filename}...`, {
        elapsedMs: _elapsedMs(startedAt),
      });

      const downloadResult = await downloadWait;
      _logPdf('info', pdf, 'ilovepdf.download.completed', {
        downloadId: downloadResult.downloadId,
        downloadedFilename: downloadResult.filename,
        elapsedMs: _elapsedMs(startedAt),
      });

      _broadcastStatus(pdf, 'finalizing', `Guardando Excel junto al PDF...`, {
        downloadedFilename: downloadResult.filename,
        downloadId: downloadResult.downloadId,
        elapsedMs: _elapsedMs(startedAt),
      });

      const finalizeResult = await ILovePDFFinalizer.finalizeDownload(pdf, downloadResult);
      if (!finalizeResult?.ok) {
        throw new Error(
          finalizeResult?.error ||
          'La conversión terminó, pero no se pudo guardar el Excel junto al PDF.'
        );
      }

      _logPdf('info', pdf, 'ilovepdf.finalize.success', {
        finalExcelPath: finalizeResult.excelPath || downloadResult.filename,
        elapsedMs: _elapsedMs(startedAt),
      });
      ILovePDFBridge.sendStatus(pdf.pdfId, 'completed', `${pdf.filename} convertido.`);
      _broadcastStatus(pdf, 'completed', `${pdf.filename} convertido exitosamente.`, {
        downloadedFilename: downloadResult.filename,
        finalExcelPath: finalizeResult.excelPath || downloadResult.filename,
        downloadId: downloadResult.downloadId,
        elapsedMs: _elapsedMs(startedAt),
      });
    } catch (err) {
      _logPdf('error', pdf, 'acta.convert.error', {
        elapsedMs: _elapsedMs(startedAt),
        error: err.message,
      });
      ILovePDFBridge.sendStatus(pdf.pdfId, 'error', err.message);
      _broadcastStatus(pdf, 'error', err.message, {
        elapsedMs: _elapsedMs(startedAt),
      });
    }

    _currentPdfId = null;

    if (_queue.length > 0) {
      ILovePDFUtils.log('info', '[Runtime] queue.delay', {
        delayMs: CONFIG_ILOVEPDF.TIMING.RATE_LIMIT_DELAY_MS,
        queueLength: _queue.length,
      });
      await ILovePDFUtils.sleep(CONFIG_ILOVEPDF.TIMING.RATE_LIMIT_DELAY_MS);
    }

    _running = false;
    _processNext();
  }

  function _waitForDownloadPage(originalTabId, pdf, startedAt) {
    return new Promise((resolve, reject) => {
      const timeoutMs = CONFIG_ILOVEPDF.TIMING.DOWNLOAD_PAGE_WAIT_MS || 60000;

      function onUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status !== 'complete') return;
        if (tabId !== originalTabId) return;

        const currentUrl = tab?.url || '';
        if (!currentUrl.includes('/descarga/')) return;

        cleanup();
        _logPdf('info', pdf, 'download.page.detected', {
          tabId,
          url: currentUrl,
          elapsedMs: _elapsedMs(startedAt),
        });
        setTimeout(() => resolve({ tabId, url: currentUrl }), CONFIG_ILOVEPDF.TIMING.PAGE_LOAD_WAIT_MS);
      }

      function onRemoved(tabId) {
        if (tabId !== originalTabId) return;
        cleanup();
        reject(new Error('iLovePDF tab was closed before download page loaded.'));
      }

      function cleanup() {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
        clearTimeout(timer);
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for /descarga/ page after ${timeoutMs}ms`));
      }, timeoutMs);

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
  }

  function _broadcastStatus(pdf, status, message, extra = {}) {
    const payload = {
      type: 'ILOVEPDF_PROGRESS',
      pdfId: pdf.pdfId,
      status,
      message,
      filename: pdf.filename,
      source: pdf.source || 'conversor-scan',
      mappingId: pdf.mappingId || null,
      outputDirectory: pdf.outputDirectory || null,
      sourcePdfPath: pdf.sourcePdfPath || null,
      traceId: pdf.traceId || null,
      batchId: pdf.batchId || null,
      ...extra,
    };
    chrome.runtime.sendMessage(payload).catch(() => {});
    _updatePythonStatus(pdf.pdfId, status, message, payload);
  }

  async function _updatePythonStatus(pdfId, status, message = '', extra = {}) {
    try {
      ILovePDFUtils.log('info', '[Runtime] python.status.send', {
        pdfId,
        status,
        message,
        ...extra,
      });
      await fetch(`${CONFIG_ILOVEPDF.API_BASE_URL}/pdfs/${pdfId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, message, ...extra }),
      });
    } catch (e) {
      ILovePDFUtils.log('warn', `[Runtime] Failed to update Python status: ${e.message}`);
    }
  }

  function _elapsedMs(startedAt) {
    return Date.now() - startedAt;
  }

  function _isIgnorablePhase2AckError(message) {
    return /listener indicated an asynchronous response|message (channel|port) closed before a response was received/i.test(
      String(message || '')
    );
  }

  function _logPdf(level, pdf, step, extra = {}) {
    ILovePDFUtils.log(level, `[Runtime] ${step}`, {
      pdfId: pdf?.pdfId || '',
      filename: pdf?.filename || '',
      mappingId: pdf?.mappingId || null,
      source: pdf?.source || 'conversor-scan',
      outputDirectory: pdf?.outputDirectory || null,
      sourcePdfPath: pdf?.sourcePdfPath || null,
      traceId: pdf?.traceId || null,
      batchId: pdf?.batchId || null,
      ...extra,
    });
  }

  function getState() {
    return {
      running: _running,
      currentPdfId: _currentPdfId,
      queueLength: _queue.length,
    };
  }

  function isRunning() {
    return _running;
  }

  return { queueConversion, queueAll, getState, isRunning };
})();
