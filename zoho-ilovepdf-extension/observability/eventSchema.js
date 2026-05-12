const AutohomEventSchema = (() => {
  function normalize(event) {
    return {
      schemaVersion: '1.0',
      eventId: event.eventId || `evt_${Math.random().toString(16).slice(2, 14)}`,
      timestamp: new Date().toISOString(),
      monotonicMs: Math.round(performance.now()),
      level: event.level || 'info',
      status: event.status || 'succeeded',
      eventName: event.eventName || 'browser.console.log',
      component: event.component || 'extension.service_worker',
      operation: event.operation || '',
      runId: event.runId || '',
      workflowId: event.workflowId || '',
      traceId: event.traceId || '',
      spanId: event.spanId || '',
      parentSpanId: event.parentSpanId || '',
      requestId: event.requestId || '',
      message: event.message || '',
      expected: event.expected || {},
      actual: event.actual || {},
      decision: event.decision || {},
      error: event.error || null,
      data: event.data || {},
      tags: Array.isArray(event.tags) ? event.tags : [],
    };
  }

  return { normalize };
})();
