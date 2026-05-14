// background-main.js — Service Worker entry point (importScripts)
// Carga módulos Zoho CRM (intactos) + módulos iLovePDF automation.

try {
  importScripts(
    "observability/eventNames.js",
    "observability/eventSchema.js",
    "observability/ringBuffer.js",
    "observability/redaction.js",
    "observability/contracts.js",
    "observability/telemetry.js",
    "observability/browserCapture.js",
    "automation/batchAutomationRouter.js",
    "background-zoho.js",
    "ilovepdf/config.js",
    "ilovepdf/utils.js",
    "ilovepdf-background/bridge.js",
    "ilovepdf-background/tabManager.js",
    "ilovepdf-background/downloadTracker.js",
    "ilovepdf-background/finalizer.js",
    "ilovepdf-background/runtime.js",
    "ilovepdf-background/router.js"
  );
} catch (e) {
  console.error("[iLovePDF] Bootstrap importScripts error:", e);
  try {
    AutohomTelemetry.emit({
      eventName: AutohomEventNames.EXTENSION_BOOTSTRAP_IMPORT_FAILED,
      component: 'extension.service_worker',
      level: 'error',
      status: 'failed',
      message: e?.message || String(e),
      error: { type: e?.name || 'Error', message: e?.message || String(e) },
    });
  } catch (_error) {}
}

// ─── Initialize iLovePDF Bridge ──────────────────────────────────────────────

try {
  AutohomTelemetry.installFetchCapture();
  AutohomBrowserCapture.install();
  AutohomTelemetry.emit({
    eventName: AutohomEventNames.EXTENSION_BOOTSTRAP_STARTED,
    component: 'extension.service_worker',
    operation: 'background_main_bootstrap',
    status: 'started',
  });
  AutohomTelemetry.emit({
    eventName: AutohomEventNames.ACTAS_MAPPER_IMPLEMENTATION_SELECTED,
    component: 'extension.service_worker',
    operation: 'background_main_bootstrap',
    status: 'succeeded',
    decision: {
      mapperImplementation: 'background-zoho.js',
      mappingMode: 'automatic',
      legacyPromptEnabled: false,
    },
  });
  ILovePDFBridge.connect();
  ILovePDFBridge.setupAlarmReconnect();
  console.log("[iLovePDF] Bridge initialized and alarm reconnect set up.");
} catch (e) {
  console.error("[iLovePDF] Bridge init error:", e);
  AutohomTelemetry.emit({
    eventName: AutohomEventNames.BROWSER_RUNTIME_ERROR,
    component: 'extension.service_worker',
    level: 'error',
    status: 'failed',
    message: e?.message || String(e),
    error: { type: e?.name || 'Error', message: e?.message || String(e) },
  });
}
