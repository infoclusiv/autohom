window.AutohomActasOpenSite = (() => {
  const contracts = window.AutohomActasOpenSiteContracts;
  const settings = window.AutohomActasOpenSiteSettings;
  const STATUS_MESSAGE_TIMEOUT_MS = 1800;

  let isOpening = false;
  let currentTargetUrl = contracts.DEFAULT_TARGET_URL;
  let lastStatusMessage = '';
  let lastStatusTimeoutId = null;

  function getElements() {
    return {
      input: window.AutohomSidepanelDom.byId('actas-open-site-url'),
      button: window.AutohomSidepanelDom.byId('btn-actas-open-site'),
      status: window.AutohomSidepanelDom.byId('actas-open-site-status'),
    };
  }

  function getMappedCount() {
    return window.AutohomActasStore.getMappings().length;
  }

  function getTargetUrlValidation() {
    return contracts.validateTargetUrl(currentTargetUrl);
  }

  function renderStatus(message) {
    const { status } = getElements();
    if (status) {
      status.textContent = message || '';
    }
  }

  function clearTransientStatusTimer() {
    if (lastStatusTimeoutId) {
      clearTimeout(lastStatusTimeoutId);
      lastStatusTimeoutId = null;
    }
  }

  function showTransientStatus(message) {
    clearTransientStatusTimer();
    lastStatusMessage = message || '';
    renderStatus(lastStatusMessage);
    lastStatusTimeoutId = setTimeout(() => {
      lastStatusTimeoutId = null;
      lastStatusMessage = '';
      updateButtonState();
    }, STATUS_MESSAGE_TIMEOUT_MS);
  }

  function updateButtonState() {
    const { button } = getElements();
    if (!button) {
      return;
    }

    const mappedCount = getMappedCount();
    const validation = getTargetUrlValidation();
    const hasValidUrl = validation.ok;
    const disabled = isOpening || mappedCount === 0 || !hasValidUrl;

    button.disabled = disabled;
    button.textContent = isOpening
      ? 'Preparando apertura...'
      : 'Abrir sitio por cada PDF mapeado';

    if (isOpening) {
      renderStatus(`Preparando ${mappedCount} pestana${mappedCount !== 1 ? 's' : ''}...`);
      return;
    }

    if (!hasValidUrl) {
      renderStatus(`URL invalida: ${validation.errors.join(' ')}`);
      return;
    }

    if (lastStatusMessage) {
      renderStatus(lastStatusMessage);
      return;
    }

    if (mappedCount === 0) {
      renderStatus('No hay PDFs mapeados para abrir el sitio.');
      return;
    }

    renderStatus(`Se abriran ${mappedCount} pestana${mappedCount !== 1 ? 's' : ''} a ${validation.url}.`);
  }

  function syncCurrentTargetUrlFromInput() {
    const { input } = getElements();
    currentTargetUrl = contracts.normalizeTargetUrl(input?.value);
    return currentTargetUrl;
  }

  async function persistCurrentTargetUrl() {
    const nextUrl = syncCurrentTargetUrlFromInput();
    const validation = contracts.validateTargetUrl(nextUrl);

    if (!validation.ok) {
      updateButtonState();
      return false;
    }

    const savedUrl = await settings.saveTargetUrl(validation.url);
    currentTargetUrl = savedUrl;
    showTransientStatus('URL guardada.');
    window.AutohomLogs.append(`actas.open_site.url_saved url=${savedUrl}`);
    return true;
  }

  function handleInput() {
    syncCurrentTargetUrlFromInput();
    clearTransientStatusTimer();
    lastStatusMessage = '';
    updateButtonState();
  }

  async function openSiteForMappedPdfs() {
    const mappings = window.AutohomActasStore.getMappings();
    const count = mappings.length;
    const validation = contracts.validateTargetUrl(currentTargetUrl);
    const batchId = `actas-open-site-${Date.now()}`;

    if (count === 0) {
      window.AutohomToast.show('No hay PDFs mapeados para abrir el sitio.');
      updateButtonState();
      return;
    }

    if (!validation.ok) {
      const message = `URL invalida: ${validation.errors.join(' ')}`;
      clearTransientStatusTimer();
      lastStatusMessage = '';
      renderStatus(message);
      window.AutohomToast.show(message);
      updateButtonState();
      return;
    }

    if (count > 20) {
      const confirmed = confirm(`Vas a abrir ${count} pestanas. Quieres continuar?`);
      if (!confirmed) {
        lastStatusMessage = 'Apertura cancelada por el usuario.';
        updateButtonState();
        window.AutohomLogs.append(
          `actas.open_site.cancelled count=${count} url=${validation.url} batch=${batchId}`,
          'warn'
        );
        return;
      }
    }

    isOpening = true;
    clearTransientStatusTimer();
    lastStatusMessage = '';
    updateButtonState();

    window.AutohomLogs.append(
      `actas.open_site.requested count=${count} url=${validation.url} batch=${batchId}`
    );

    let opened = 0;
    const failures = [];

    try {
      for (let index = 0; index < count; index += 1) {
        try {
          await chrome.tabs.create({
            url: validation.url,
            active: false,
          });

          opened += 1;
          renderStatus(`Abriendo ${opened}/${count} pestanas...`);

          window.AutohomLogs.append(
            `actas.open_site.tab_opened index=${index + 1} count=${count} batch=${batchId}`
          );

          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (error) {
          failures.push({
            index: index + 1,
            error: error.message || String(error),
          });

          window.AutohomLogs.append(
            `actas.open_site.failed index=${index + 1} batch=${batchId} error=${error.message || String(error)}`,
            'error'
          );
        }
      }

      const message = `Sitio abierto: ${opened}. Errores: ${failures.length}.`;
      lastStatusMessage = message;
      renderStatus(message);

      window.AutohomLogs.append(
        `actas.open_site.completed opened=${opened} failed=${failures.length} batch=${batchId}`
      );
      window.AutohomToast.show(message);
    } finally {
      isOpening = false;
      updateButtonState();
    }
  }

  async function handlePersistRequest() {
    try {
      await persistCurrentTargetUrl();
      updateButtonState();
    } catch (error) {
      clearTransientStatusTimer();
      lastStatusMessage = '';
      renderStatus(`No se pudo guardar la URL: ${error.message || String(error)}`);
      window.AutohomLogs.append(
        `actas.open_site.url_save_failed error=${error.message || String(error)}`,
        'error'
      );
    }
  }

  async function handleClick() {
    await openSiteForMappedPdfs();
  }

  async function init() {
    const { input, button } = getElements();
    if (!input || !button) {
      return;
    }

    currentTargetUrl = await settings.loadTargetUrl();
    input.value = currentTargetUrl;

    if (input.dataset.actasOpenSiteBound !== 'true') {
      input.dataset.actasOpenSiteBound = 'true';
      input.addEventListener('input', handleInput);
      input.addEventListener('change', handlePersistRequest);
      input.addEventListener('blur', handlePersistRequest);
    }

    if (button.dataset.actasOpenSiteBound !== 'true') {
      button.dataset.actasOpenSiteBound = 'true';
      button.addEventListener('click', handleClick);
    }

    updateButtonState();
  }

  return {
    init,
    updateButtonState,
    getMappedCount,
    getTargetUrlValidation,
    openSiteForMappedPdfs,
  };
})();
