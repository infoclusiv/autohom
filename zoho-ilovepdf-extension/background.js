// LEGACY ONLY.
// Do not use as a Manifest V3 service worker.
// Active automatic mapping implementation lives in background-main.js -> background-zoho.js.

console.warn(
  '[Autohom] Legacy background.js loaded unexpectedly. Automatic mapper should use background-main.js -> background-zoho.js.'
);

try {
  AutohomTelemetry?.emit?.({
    eventName: AutohomEventNames.ACTAS_LEGACY_BACKGROUND_LOADED,
    component: 'extension.service_worker',
    level: 'error',
    status: 'failed',
    message: 'Legacy background.js loaded unexpectedly.',
    expected: { serviceWorker: 'background-main.js' },
    actual: { serviceWorker: 'background.js' },
  });
} catch (_error) {}
