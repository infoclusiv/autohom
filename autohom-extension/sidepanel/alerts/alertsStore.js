window.AutohomAlertsStore = (() => {
  const { SELECTOR_ALERTS_STORAGE_KEY } = window.AutohomSidepanelConstants;

  function getStorageKey() {
    return SELECTOR_ALERTS_STORAGE_KEY;
  }

  function getSelectorNames() {
    return {
      convertButton: 'Botón Convertir',
      downloadButton: 'Botón Descargar',
      uploadReadyIndicator: 'Indicador de carga',
      fileInput: 'Input de archivo',
    };
  }

  return {
    getStorageKey,
    getSelectorNames,
  };
})();
