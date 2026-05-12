window.AutohomActasCsvExport = (() => {
  function exportMappings() {
    const mappings = window.AutohomActasStore.getMappings();
    if (mappings.length === 0) {
      window.AutohomToast.show('No hay registros para exportar');
      return;
    }

    const rows = [['Archivo PDF', 'URL Tarea Zoho', 'Fecha']];
    mappings.forEach((mapping) => {
      const date = new Date(mapping.savedAt).toLocaleString('es-CO');
      rows.push([`"${mapping.filename}"`, `"${mapping.zohoUrl}"`, `"${date}"`]);
    });

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `actas_mapeadas_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    window.AutohomToast.show('📊 CSV exportado');
  }

  return {
    exportMappings,
  };
})();
