window.AutohomAutomatizarLotePresetsStorage = (() => {
  const contracts = window.AutohomAutomatizarLoteContracts;

  function getStorageArea() {
    if (!chrome?.storage?.local) {
      throw new Error('chrome.storage.local no esta disponible.');
    }

    return chrome.storage.local;
  }

  async function getStorageValue(key) {
    const storage = getStorageArea();

    return await new Promise((resolve, reject) => {
      storage.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(result?.[key]);
      });
    });
  }

  async function setStorageValue(key, value) {
    const storage = getStorageArea();

    await new Promise((resolve, reject) => {
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
  }

  function buildDuplicateNameError(name) {
    return new Error(`Ya existe una configuracion guardada con el nombre "${name}".`);
  }

  function assertValidPreset(preset) {
    const validation = contracts.validatePreset(preset);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }
  }

  async function replaceAllPresets(presets) {
    const payload = contracts.buildPresetStoragePayload(presets);
    await setStorageValue(contracts.PRESETS_STORAGE_KEY, payload);
    return payload.presets;
  }

  async function loadPresets() {
    const rawPayload = await getStorageValue(contracts.PRESETS_STORAGE_KEY);

    if (!rawPayload) {
      return [];
    }

    if (Array.isArray(rawPayload)) {
      return contracts.normalizePresetList(rawPayload);
    }

    if (typeof rawPayload !== 'object') {
      return [];
    }

    return contracts.normalizePresetList(rawPayload.presets);
  }

  async function savePresetFromConfig({ name, config, existingPresetId } = {}) {
    const normalizedName = contracts.normalizePresetName(name);
    const normalizedConfig = contracts.normalizeConfig(config || {});
    const presets = await loadPresets();
    const duplicate = presets.find(
      (preset) => preset.name.toLowerCase() === normalizedName.toLowerCase() && preset.id !== existingPresetId
    );

    if (duplicate) {
      throw buildDuplicateNameError(normalizedName);
    }

    const existingPreset = existingPresetId
      ? presets.find((preset) => preset.id === existingPresetId) || null
      : null;
    const nowIso = new Date().toISOString();
    const preset = contracts.normalizePreset({
      ...(existingPreset || {}),
      id: existingPreset?.id || contracts.buildPresetId(),
      name: normalizedName,
      config: normalizedConfig,
      createdAt: existingPreset?.createdAt || nowIso,
      updatedAt: nowIso,
      lastRunAt: existingPreset?.lastRunAt || '',
      runCount: existingPreset?.runCount || 0,
      isDefault: existingPreset?.isDefault || false,
    });

    assertValidPreset(preset);

    const nextPresets = existingPreset
      ? presets.map((item) => (item.id === existingPreset.id ? preset : item))
      : [...presets, preset];

    if (nextPresets.length > contracts.MAX_PRESETS) {
      throw new Error(`Solo puedes guardar hasta ${contracts.MAX_PRESETS} configuraciones.`);
    }

    await replaceAllPresets(nextPresets);
    return preset;
  }

  async function deletePreset(presetId) {
    const id = String(presetId || '').trim();
    if (!id) {
      throw new Error('Debes indicar la configuracion que deseas eliminar.');
    }

    const presets = await loadPresets();
    const nextPresets = presets.filter((preset) => preset.id !== id);
    await replaceAllPresets(nextPresets);
    return nextPresets;
  }

  async function markPresetRun(presetId) {
    const id = String(presetId || '').trim();
    if (!id) {
      return null;
    }

    const presets = await loadPresets();
    const preset = presets.find((item) => item.id === id);
    if (!preset) {
      return null;
    }

    const updatedPreset = contracts.normalizePreset({
      ...preset,
      updatedAt: new Date().toISOString(),
      lastRunAt: new Date().toISOString(),
      runCount: Number(preset.runCount || 0) + 1,
    });

    assertValidPreset(updatedPreset);

    const nextPresets = presets.map((item) => (item.id === id ? updatedPreset : item));
    await replaceAllPresets(nextPresets);
    return updatedPreset;
  }

  return {
    loadPresets,
    savePresetFromConfig,
    deletePreset,
    markPresetRun,
    replaceAllPresets,
  };
})();
