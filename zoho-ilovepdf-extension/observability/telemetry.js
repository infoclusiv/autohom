const AutohomTelemetry = (() => {
  const bridgeBase = 'http://localhost:7790/api/observability/events';

  let rawFetch = null;
  let fetchCaptureInstalled = false;

  let currentContext = {
    workflowId: '',
    traceId: '',
    runId: '',
  };

  function getExtensionIdentity() {
    return {
      extensionId:
        typeof CONFIG_ILOVEPDF !== 'undefined' && CONFIG_ILOVEPDF?.EXTENSION_ID
          ? CONFIG_ILOVEPDF.EXTENSION_ID
          : 'zoho-acta-mapper',

      extensionType:
        typeof CONFIG_ILOVEPDF !== 'undefined' && CONFIG_ILOVEPDF?.EXTENSION_TYPE
          ? CONFIG_ILOVEPDF.EXTENSION_TYPE
          : 'ilovepdf-converter',

      runtimeInstanceId: self.ILOVEPDF_RUNTIME_INSTANCE_ID || '',
    };
  }

  function setContext(next) {
    currentContext = {
      ...currentContext,
      ...(next || {}),
    };

    chrome.runtime
      .sendMessage({
        type: 'AUTOHOM_OBSERVABILITY_CONTEXT',
        workflowId: currentContext.workflowId || '',
        traceId: currentContext.traceId || '',
        runId: currentContext.runId || '',
      })
      .catch(() => {});
  }

  function normalizeEvent(event) {
    return AutohomEventSchema.normalize({
      extension: getExtensionIdentity(),
      ...currentContext,
      ...event,
      data: AutohomRedaction.redactObject(event?.data || {}),
      expected: AutohomRedaction.redactObject(event?.expected || {}),
      actual: AutohomRedaction.redactObject(event?.actual || {}),
    });
  }

  function sendToBridge(normalizedEvent) {
    const safeFetch = rawFetch || self.fetch.bind(self);

    safeFetch(bridgeBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedEvent),
    }).catch(() => {
      // Python puede estar apagado. No debe romper la extensión ni el sidepanel.
    });
  }

  function emit(event = {}) {
    try {
      const normalized = normalizeEvent(event);

      AutohomRingBuffer.add(normalized);
      sendToBridge(normalized);

      return normalized;
    } catch (error) {
      try {
        console.warn('[AutohomTelemetry] emit failed:', error);
      } catch (_consoleError) {}

      return null;
    }
  }

  function shouldSkipFetchCapture(url) {
    if (!url) return false;

    const value = String(url);

    return (
      value.includes('/api/observability/events') ||
      value.includes('localhost:7790/api/observability/events') ||
      value.includes('127.0.0.1:7790/api/observability/events')
    );
  }

  function installFetchCapture() {
    if (fetchCaptureInstalled) {
      return;
    }

    rawFetch = self.fetch.bind(self);
    fetchCaptureInstalled = true;

    self.fetch = async (...args) => {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0]?.url || '';

      // Importante:
      // No capturar el propio envío de observabilidad.
      // Si se captura, emit() -> fetch() -> emit() puede crear recursión.
      if (shouldSkipFetchCapture(url)) {
        return rawFetch(...args);
      }

      emit({
        eventName: 'browser.network.fetch.started',
        component: 'extension.service_worker',
        operation: 'fetch',
        status: 'started',
        data: { url },
      });

      try {
        const response = await rawFetch(...args);

        emit({
          eventName: 'browser.network.fetch.succeeded',
          component: 'extension.service_worker',
          operation: 'fetch',
          status: 'succeeded',
          data: {
            url,
            status: response.status,
            ok: response.ok,
          },
        });

        return response;
      } catch (error) {
        emit({
          eventName: 'browser.network.fetch.failed',
          component: 'extension.service_worker',
          operation: 'fetch',
          level: 'error',
          status: 'failed',
          message: error?.message || String(error),
          error: {
            type: error?.name || 'Error',
            message: error?.message || String(error),
          },
          data: { url },
        });

        throw error;
      }
    };
  }

  function __testEmitSampleEvents() {
    emit({
      eventName: AutohomEventNames.EXTENSION_BRIDGE_CONNECT_ATTEMPTED,
      component: 'extension.bridge',
      operation: 'test',
    });

    emit({
      eventName: AutohomEventNames.EXTENSION_QUEUE_ENQUEUED,
      component: 'extension.runtime',
      operation: 'test',
      data: { pdfId: 'sample' },
    });

    emit({
      eventName: AutohomEventNames.BROWSER_SELECTOR_MISSING,
      component: 'content.ilovepdf',
      level: 'warn',
      status: 'failed',
      data: { selector: '.missing' },
    });

    emit({
      eventName: AutohomEventNames.WORKFLOW_STEP_FAILED,
      component: 'extension.runtime',
      level: 'error',
      status: 'failed',
      message: 'Sample failure',
    });
  }

  return {
    emit,
    setContext,
    installFetchCapture,
    __testEmitSampleEvents,
  };
})();