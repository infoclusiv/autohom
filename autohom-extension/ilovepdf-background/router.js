/**
 * ilovepdf-background/router.js — Message router for iLovePDF messages.
 *
 * Extends the Chrome runtime message listener for ILOVEPDF_* message types.
 */

function persistSelectorAlert(alert) {
  chrome.storage.local.get("ilovepdf_selector_alerts", (result) => {
    const existing = Array.isArray(result.ilovepdf_selector_alerts)
      ? result.ilovepdf_selector_alerts
      : [];
    const next = existing.filter((entry) => entry.selectorName !== alert.selectorName);
    next.unshift(alert);
    chrome.storage.local.set({ ilovepdf_selector_alerts: next.slice(0, 20) });
  });
}

(function registerILovePDFRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "ILOVEPDF_CONVERT": {
        ILovePDFRuntime.queueConversion({
          pdfId: message.pdfId,
          filename: message.filename,
        });
        sendResponse({ ok: true, queued: true });
        return false;
      }

      case "ILOVEPDF_CONVERT_ALL": {
        const pdfList = Array.isArray(message.pdfs) ? message.pdfs : [];
        ILovePDFRuntime.queueAll(pdfList);
        sendResponse({ ok: true, queued: pdfList.length });
        return false;
      }

      case "ILOVEPDF_STATUS": {
        sendResponse({
          ok: true,
          runtime: ILovePDFRuntime.getState(),
          bridgeConnected: ILovePDFBridge.isConnected(),
        });
        return false;
      }

      case "ILOVEPDF_CONVERSION_RESULT": {
        // Forward from content script to bridge + side panel
        const { pdfId, status, message: msg } = message;

        if (status === "completed") {
          ILovePDFUtils.log("info", "[Router] content.completed_ignored", {
            pdfId,
            message: msg,
          });
          return false;
        }

        if (status === "error") {
          ILovePDFDownloadTracker.failIfTracking(pdfId, msg || "Content script reported a phase 2 error.");
        }

        ILovePDFBridge.sendStatus(pdfId, status, msg);
        // Forward to side panel
        chrome.runtime.sendMessage({
          type: "ILOVEPDF_PROGRESS",
          pdfId, status, message: msg,
        }).catch(() => {});
        return false;
      }

      case "ILOVEPDF_ENSURE_BRIDGE": {
        if (!ILovePDFBridge.isConnected()) {
          ILovePDFBridge.connect();
        }
        sendResponse({ ok: true, connected: ILovePDFBridge.isConnected() });
        return false;
      }

      case "ILOVEPDF_SELECTOR_FALLBACK": {
        const alert = {
          level: "warning",
          selectorName: message.selectorName,
          configuredSelector: message.configuredSelector,
          usedStrategy: message.usedStrategy,
          url: message.url,
          timestamp: Date.now(),
        };

        ILovePDFUtils.log("warn", "[Router] selector.fallback", {
          selectorName: message.selectorName,
          configured: message.configuredSelector,
          usedStrategy: message.usedStrategy,
          url: message.url,
        });

        chrome.runtime.sendMessage({
          type: "ILOVEPDF_SELECTOR_ALERT",
          ...alert,
        }).catch(() => {});

        persistSelectorAlert(alert);
        sendResponse({ ok: true });
        return false;
      }

      case "ILOVEPDF_SELECTOR_BROKEN": {
        const alert = {
          level: "error",
          selectorName: message.selectorName,
          configuredSelector: message.configuredSelector,
          usedStrategy: null,
          url: message.url,
          timestamp: Date.now(),
        };

        ILovePDFUtils.log("error", "[Router] selector.broken", {
          selectorName: message.selectorName,
          configured: message.configuredSelector,
          url: message.url,
        });

        chrome.runtime.sendMessage({
          type: "ILOVEPDF_SELECTOR_ALERT",
          ...alert,
        }).catch(() => {});

        persistSelectorAlert(alert);
        sendResponse({ ok: true });
        return false;
      }

      default:
        return false;
    }
  });
})();
