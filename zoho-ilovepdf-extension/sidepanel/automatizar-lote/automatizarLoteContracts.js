window.AutohomAutomatizarLoteContracts = (() => {
  const DEFAULT_BATCH_SIZE = 15;
  const MIN_BATCH_SIZE = 1;
  const MAX_BATCH_SIZE = 50;
  const PRESETS_STORAGE_KEY = 'autohom.automatizarLote.presets.v1';
  const PRESETS_SCHEMA_VERSION = 1;
  const MAX_PRESETS = 20;
  const MAX_PRESET_NAME_LENGTH = 60;

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

  function buildPresetId() {
    return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizePresetName(name) {
    return String(name || '').trim().slice(0, MAX_PRESET_NAME_LENGTH);
  }

  function normalizePreset(raw = {}) {
    const nowIso = new Date().toISOString();
    const configSource = raw.config && typeof raw.config === 'object' ? raw.config : raw;
    const config = normalizeConfig(configSource);
    const parsedRunCount = Number(raw.runCount);
    const runCount = Number.isFinite(parsedRunCount) ? Math.max(0, parsedRunCount) : 0;
    const createdAt = String(raw.createdAt || nowIso).trim() || nowIso;
    const updatedAt = String(raw.updatedAt || nowIso).trim() || nowIso;
    const lastRunAt = String(raw.lastRunAt || '').trim();

    return {
      id: String(raw.id || buildPresetId()).trim(),
      name: normalizePresetName(raw.name),
      config,
      createdAt,
      updatedAt,
      lastRunAt,
      runCount,
      isDefault: Boolean(raw.isDefault),
    };
  }

  function validatePreset(preset) {
    const errors = [];

    if (!preset || typeof preset !== 'object') {
      return {
        ok: false,
        errors: ['La configuracion guardada no es valida.'],
      };
    }

    if (!String(preset.id || '').trim()) {
      errors.push('El identificador de la configuracion es obligatorio.');
    }

    if (!preset.name) {
      errors.push('El nombre de la configuracion es obligatorio.');
    }

    if (String(preset.name || '').length > MAX_PRESET_NAME_LENGTH) {
      errors.push(`El nombre no puede superar ${MAX_PRESET_NAME_LENGTH} caracteres.`);
    }

    const configValidation = validateConfig(normalizeConfig(preset.config || {}));
    if (!configValidation.ok) {
      errors.push(...configValidation.errors);
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  function normalizePresetList(rawPresets) {
    const list = Array.isArray(rawPresets) ? rawPresets : [];

    return list
      .map(normalizePreset)
      .filter((preset) => validatePreset(preset).ok)
      .slice(0, MAX_PRESETS);
  }

  function buildPresetStoragePayload(rawPresets) {
    return {
      schemaVersion: PRESETS_SCHEMA_VERSION,
      presets: normalizePresetList(rawPresets),
    };
  }

  return {
    DEFAULT_BATCH_SIZE,
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE,
    PRESETS_STORAGE_KEY,
    PRESETS_SCHEMA_VERSION,
    MAX_PRESETS,
    MAX_PRESET_NAME_LENGTH,
    normalizeConfig,
    validateConfig,
    buildRunId,
    buildPresetId,
    normalizePresetName,
    normalizePreset,
    validatePreset,
    normalizePresetList,
    buildPresetStoragePayload,
  };
})();
