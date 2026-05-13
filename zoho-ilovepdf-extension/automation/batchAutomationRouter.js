(function registerBatchAutomationRouter() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'AUTO_BATCH_OPEN_BACKGROUND_TAB') {
      return false;
    }

    const url = String(message.url || '').trim();
    if (!url) {
      sendResponse({ ok: false, error: 'Missing URL.' });
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        sendResponse({ ok: false, error: 'Unsupported URL protocol.' });
        return false;
      }

      chrome.tabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          try {
            AutohomTelemetry.emit({
              eventName: AutohomEventNames.AUTOMATION_BATCH_BACKGROUND_TAB_FAILED,
              component: 'automation.batch_router',
              level: 'error',
              status: 'failed',
              message: chrome.runtime.lastError.message,
            });
          } catch (_error) {}

          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        try {
          AutohomTelemetry.emit({
            eventName: AutohomEventNames.AUTOMATION_BATCH_BACKGROUND_TAB_OPENED,
            component: 'automation.batch_router',
            status: 'completed',
            data: {
              tabId: tab?.id || null,
              url,
            },
          });
        } catch (_error) {}

        sendResponse({
          ok: true,
          status: 'tab_opened',
          tabId: tab?.id || null,
        });
      });

      return true;
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message,
      });
      return false;
    }
  });
})();
