const AutohomRedaction = (() => {
  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return { host: parsed.host, path: parsed.pathname };
    } catch (_error) {
      return url;
    }
  }

  function redactValue(value) {
    if (Array.isArray(value)) {
      return value.slice(0, 25).map(redactValue);
    }
    if (value && typeof value === 'object') {
      return redactObject(value);
    }
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value)) {
        return safeUrl(value);
      }
      if (value.length > 500) {
        return `${value.slice(0, 250)}...[truncated:${value.length}]`;
      }
    }
    return value;
  }

  function redactObject(data) {
    const safe = {};
    for (const [key, value] of Object.entries(data || {})) {
      if (/token|authorization|cookie/i.test(key)) {
        safe[key] = '[redacted]';
        continue;
      }
      safe[key] = redactValue(value);
    }
    return safe;
  }

  return { redactObject, redactValue };
})();
