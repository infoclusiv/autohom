const AutohomTelemetry = (() => {
  let bridgeBase = 'http://localhost:7790/api/observability/events';
  let currentContext = {
    workflowId: '',
    traceId: '',
    runId: '',
  };

  function setContext(next) {
    currentContext = { ...currentContext, ...(next || {}) };
    chrome.runtime.sendMessage({
      type: 'AUTOHOM_OBSERVABILITY_CONTEXT',
      workflowId: currentContext.workflowId || '',
      traceId: currentContext.traceId || '',
      runId: currentContext.runId || '',
    }).catch(() => {});
  }

  function emit(event) {
    const normalized = AutohomEventSchema.normalize({
      extension: {
        extensionId: CONFIG_ILOVEPDF?.EXTENSION_ID || 'zoho-acta-mapper',
        extensionType: CONFIG_ILOVEPDF?.EXTENSION_TYPE || 'ilovepdf-converter',
        runtimeInstanceId: self.ILOVEPDF_RUNTIME_INSTANCE_ID || '',
      },
      ...currentContext,
      ...event,
      data: AutohomRedaction.redactObject(event.data || {}),
      expected: AutohomRedaction.redactObject(event.expected || {}),
      actual: AutohomRedaction.redactObject(event.actual || {}),
    });
    AutohomRingBuffer.add(normalized);
    fetch(bridgeBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    }).catch(() => {});
    return normalized;
  }

  function installFetchCapture() {
    const originalFetch = self.fetch.bind(self);
    self.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      emit({
        eventName: 'browser.network.fetch.started',
        component: 'extension.service_worker',
        operation: 'fetch',
        status: 'started',
        data: { url },
      });
      try {
        const response = await originalFetch(...args);
        emit({
          eventName: 'browser.network.fetch.succeeded',
          component: 'extension.service_worker',
          operation: 'fetch',
          data: { url, status: response.status },
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
          error: { type: error?.name || 'Error', message: error?.message || String(error) },
          data: { url },
        });
        throw error;
      }
    };
  }

  function __testEmitSampleEvents() {
    emit({ eventName: AutohomEventNames.EXTENSION_BRIDGE_CONNECT_ATTEMPTED, component: 'extension.bridge', operation: 'test' });
    emit({ eventName: AutohomEventNames.EXTENSION_QUEUE_ENQUEUED, component: 'extension.runtime', operation: 'test', data: { pdfId: 'sample' } });
    emit({ eventName: AutohomEventNames.BROWSER_SELECTOR_MISSING, component: 'content.ilovepdf', level: 'warn', status: 'failed', data: { selector: '.missing' } });
    emit({ eventName: AutohomEventNames.WORKFLOW_STEP_FAILED, component: 'extension.runtime', level: 'error', status: 'failed', message: 'Sample failure' });
  }

  return { emit, setContext, installFetchCapture, __testEmitSampleEvents };
})();
