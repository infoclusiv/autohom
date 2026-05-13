window.AutohomAutomatizarLoteContracts = (() => {
  const DEFAULT_BATCH_SIZE = 15;
  const MIN_BATCH_SIZE = 1;
  const MAX_BATCH_SIZE = 50;

  function normalizeConfig(raw = {}) {
    const text = String(raw.text || '').trim();
    const selector = String(raw.selector || '').trim();
    const parsedBatchSize = Number.parseInt(raw.batchSize, 10);

    const batchSize = Number.isFinite(parsedBatchSize)
      ? Math.min(Math.max(parsedBatchSize, MIN_BATCH_SIZE), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    return {
      text,
      selector,
      batchSize,
    };
  }

  function validateConfig(config) {
    const errors = [];

    if (!config.text) {
      errors.push('El texto a buscar es obligatorio.');
    }

    if (!config.selector) {
      errors.push('El selector es obligatorio.');
    } else {
      try {
        document.createDocumentFragment().querySelector(config.selector);
      } catch (_error) {
        errors.push('El selector CSS no es valido.');
      }
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  function buildRunId() {
    return `auto-batch-${Date.now()}`;
  }

  return {
    DEFAULT_BATCH_SIZE,
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE,
    normalizeConfig,
    validateConfig,
    buildRunId,
  };
})();
