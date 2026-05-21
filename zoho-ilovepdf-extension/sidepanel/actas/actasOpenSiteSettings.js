window.AutohomActasOpenSiteSettings = (() => {
  const contracts = window.AutohomActasOpenSiteContracts;

  async function loadTargetUrl() {
    const stored = await chrome.storage.local.get(contracts.STORAGE_KEY);
    const value = stored?.[contracts.STORAGE_KEY];
    const normalized = contracts.normalizeTargetUrl(value);
    return normalized || contracts.DEFAULT_TARGET_URL;
  }

  async function saveTargetUrl(rawUrl) {
    const validation = contracts.validateTargetUrl(rawUrl);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }

    await chrome.storage.local.set({
      [contracts.STORAGE_KEY]: validation.url,
    });

    return validation.url;
  }

  return {
    loadTargetUrl,
    saveTargetUrl,
  };
})();
