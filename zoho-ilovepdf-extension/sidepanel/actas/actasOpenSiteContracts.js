window.AutohomActasOpenSiteContracts = (() => {
  const DEFAULT_TARGET_URL = 'https://chat.deepseek.com';
  const STORAGE_KEY = 'autohom.actas.openSite.targetUrl.v1';
  const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  function normalizeTargetUrl(rawUrl) {
    return String(rawUrl || '').trim();
  }

  function validateTargetUrl(rawUrl) {
    const url = normalizeTargetUrl(rawUrl);
    const errors = [];

    if (!url) {
      errors.push('La URL del sitio web es obligatoria.');
      return { ok: false, url, errors };
    }

    try {
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
        errors.push('La URL debe comenzar con http:// o https://.');
      }
    } catch (_error) {
      errors.push('La URL del sitio web no es valida.');
    }

    return {
      ok: errors.length === 0,
      url,
      errors,
    };
  }

  return {
    DEFAULT_TARGET_URL,
    STORAGE_KEY,
    normalizeTargetUrl,
    validateTargetUrl,
  };
})();
