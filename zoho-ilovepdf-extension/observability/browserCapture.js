const AutohomBrowserCapture = (() => {
  function install() {
    self.addEventListener('unhandledrejection', (event) => {
      AutohomTelemetry.emit({
        eventName: AutohomEventNames.BROWSER_UNHANDLED_REJECTION,
        component: 'extension.service_worker',
        level: 'error',
        status: 'failed',
        message: event.reason?.message || String(event.reason || 'Unhandled rejection'),
        error: { message: event.reason?.message || String(event.reason || ''), type: event.reason?.name || 'UnhandledRejection' },
      });
    });
  }

  return { install };
})();
