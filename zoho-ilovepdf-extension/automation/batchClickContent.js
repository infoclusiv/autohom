(function registerAutohomBatchClickContent() {
  if (window.AutohomBatchClickContent?.__registered) {
    return;
  }

  const DEFAULT_BATCH_SIZE = 15;
  const MIN_BATCH_SIZE = 1;
  const MAX_BATCH_SIZE = 50;
  const CLICKABLE_SELECTOR = 'a, button, [role="button"], input[type="button"], input[type="submit"]';

  let batchElements = [];
  let batchIndex = 0;
  let lastBatchParams = '';

  function emitBatchEvent({
    eventName,
    level = 'info',
    status = 'succeeded',
    runId = '',
    message = '',
    details = '',
    data = {},
  }) {
    try {
      chrome.runtime.sendMessage({
        type: 'AUTO_BATCH_EVENT',
        eventName,
        component: 'automation.batch_content',
        level,
        status,
        runId,
        message,
        details,
        data,
      });
    } catch (_error) {}
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.hidden
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isValidSelector(selector) {
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getElementText(element) {
    return normalizeText(
      element?.innerText ||
      element?.textContent ||
      element?.getAttribute?.('aria-label') ||
      element?.getAttribute?.('title') ||
      ''
    );
  }

  function isBackgroundOpenableHref(href) {
    if (!href) {
      return false;
    }

    const trimmed = String(href).trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('javascript:')) {
      return false;
    }

    try {
      const parsed = new URL(trimmed, window.location.href);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_error) {
      return false;
    }
  }

  function findMatchingElements(text, selector) {
    const normalizedText = normalizeText(text);
    if (!normalizedText || !isValidSelector(selector)) {
      return [];
    }

    const seen = new Set();
    const matches = [];
    const candidates = Array.from(document.querySelectorAll(selector));

    for (const candidate of candidates) {
      const clickable = candidate.matches(CLICKABLE_SELECTOR)
        ? candidate
        : candidate.closest(CLICKABLE_SELECTOR);

      if (!clickable || seen.has(clickable) || !isVisible(clickable)) {
        continue;
      }

      const textValue = getElementText(clickable) || getElementText(candidate);
      if (!textValue.includes(normalizedText)) {
        continue;
      }

      seen.add(clickable);
      matches.push(clickable);
    }

    return matches;
  }

  function sendProgress(runId, total, processed, status) {
    emitBatchEvent({
      eventName: 'automation.batch.progress',
      runId,
      status,
      details: `run=${runId} total=${total} processed=${processed} status=${status}`,
      data: { total, processed, status },
    });

    chrome.runtime.sendMessage({
      type: 'AUTO_BATCH_PROGRESS',
      runId,
      total,
      processed,
      status,
    });
  }

  function openBackgroundTab(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'AUTO_BATCH_OPEN_BACKGROUND_TAB',
          url,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response?.ok) {
            reject(new Error(response?.error || 'No se pudo abrir la pestana en segundo plano.'));
            return;
          }

          resolve(response);
        }
      );
    });
  }

  async function processElement(element) {
    if (!element || !isVisible(element)) {
      return;
    }

    const anchor = element.closest('a[href]');
    const href = anchor?.href || element.getAttribute?.('href') || '';

    if (isBackgroundOpenableHref(href)) {
      await openBackgroundTab(href);
      return;
    }

    ['mousedown', 'mouseup', 'click'].forEach((eventName) => {
      element.dispatchEvent(new MouseEvent(eventName, {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    });
  }

  async function processBatch({ runId, elements, startIndex, endIndex, total }) {
    for (let index = startIndex; index < endIndex; index += 1) {
      const element = elements[index];

      try {
        await processElement(element);
      } catch (_error) {
        // Continue with the rest of the batch even if one element fails.
      }

      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }

    const processed = endIndex;
    const status = processed >= total ? 'completed' : 'partial';
    sendProgress(runId, total, processed, status);
  }

  function resetState() {
    batchElements = [];
    batchIndex = 0;
    lastBatchParams = '';
    emitBatchEvent({
      eventName: 'automation.batch.reset',
      details: 'state_cleared',
    });
  }

  function runBatch({ runId, text, selector, batchSize }) {
    emitBatchEvent({
      eventName: 'automation.batch.content_started',
      runId,
      status: 'started',
      details: `run=${runId} selector="${String(selector || '').trim()}"`,
      data: {
        selector: String(selector || '').trim(),
        requestedBatchSize: batchSize,
      },
    });

    if (!normalizeText(text)) {
      sendProgress(runId, 0, 0, 'empty');
      return;
    }

    if (!selector || !isValidSelector(selector)) {
      sendProgress(runId, 0, 0, 'empty');
      return;
    }

    const currentParams = JSON.stringify({
      text: normalizeText(text),
      selector: String(selector).trim(),
    });

    if (lastBatchParams !== currentParams || batchElements.length === 0) {
      batchElements = findMatchingElements(text, selector);
      batchIndex = 0;
      lastBatchParams = currentParams;
      emitBatchEvent({
        eventName: 'automation.batch.scan_completed',
        runId,
        details: `run=${runId} total=${batchElements.length}`,
        data: {
          selector: String(selector).trim(),
          text: normalizeText(text),
          total: batchElements.length,
        },
      });
    }

    if (batchElements.length === 0) {
      sendProgress(runId, 0, 0, 'empty');
      return;
    }

    const safeBatchSize = Math.max(
      MIN_BATCH_SIZE,
      Math.min(Number.parseInt(batchSize, 10) || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE)
    );
    const endIndex = Math.min(batchIndex + safeBatchSize, batchElements.length);
    const startIndex = batchIndex;

    batchIndex = endIndex;
    processBatch({
      runId,
      elements: batchElements,
      startIndex,
      endIndex,
      total: batchElements.length,
    });
  }

  window.AutohomBatchClickContent = {
    __registered: true,
    runBatch,
    resetState,
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'AUTO_BATCH_PING') {
      sendResponse({ ok: true, status: 'ready' });
      return true;
    }

    if (message.type === 'AUTO_BATCH_RUN') {
      runBatch({
        runId: message.runId,
        text: message.text,
        selector: message.selector,
        batchSize: message.batchSize,
      });

      sendResponse({ ok: true, status: 'batch_started' });
      return true;
    }

    if (message.type === 'AUTO_BATCH_RESET') {
      resetState();
      sendResponse({ ok: true, status: 'batch_reset' });
      return true;
    }

    return false;
  });
})();
