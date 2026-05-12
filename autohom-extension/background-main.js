// background-main.js — Service Worker entry point (importScripts)
// Carga módulos Zoho CRM (intactos) + módulos iLovePDF automation.

try {
  importScripts(
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
}

// ─── Initialize iLovePDF Bridge ──────────────────────────────────────────────

try {
  ILovePDFBridge.connect();
  ILovePDFBridge.setupAlarmReconnect();
  console.log("[iLovePDF] Bridge initialized and alarm reconnect set up.");
} catch (e) {
  console.error("[iLovePDF] Bridge init error:", e);
}
