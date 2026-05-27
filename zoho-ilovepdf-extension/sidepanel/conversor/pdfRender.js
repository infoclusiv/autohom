window.AutohomConversorRender = (() => {
  function renderPdfList() {
    const list = window.AutohomSidepanelDom.byId('pdf-list');
    const pdfs = window.AutohomConversorStore.getPdfs();
    list.innerHTML = '';

    if (pdfs.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:11px;font-family:\'DM Mono\',monospace;">Sin PDFs. Pega una ruta y escanea.</div>';
      return;
    }

    const statusEmoji = {
      pending: '⏳',
      uploading: '📤',
      converting: '🔄',
      downloading: '⬇️',
      completed: '✅',
      error: '❌',
      missing: '⚠️',
    };
    const statusText = {
      pending: 'Pendiente',
      uploading: 'Subiendo...',
      converting: 'Convirtiendo...',
      downloading: 'Descargando...',
      completed: 'Convertido',
      error: 'Error',
      missing: 'No encontrado',
    };

    pdfs.forEach((pdf) => {
      const status = pdf.status || 'pending';
      const div = document.createElement('div');
      div.className = 'pdf-item';
      div.dataset.pdfId = pdf.id;
      const canRetry = status === 'pending' || status === 'error';
      div.innerHTML = `
        <div class="pdf-item-info">
          <div class="pdf-item-name"><span class="pdf-icon">PDF</span>${pdf.filename}</div>
          <div class="pdf-item-status ${status}">
            ${statusEmoji[status] || '❓'} ${statusText[status] || status}
            ${pdf.message ? '<br><span class="status-detail">' + pdf.message + '</span>' : ''}
          </div>
        </div>
        ${canRetry ? `<button class="btn-convert-one" data-pdf-id="${pdf.id}" data-filename="${pdf.filename}">Convertir</button>` : ''}
      `;
      const button = div.querySelector('.btn-convert-one');
      if (button) {
        button.addEventListener('click', () => {
          window.AutohomConversor.convertOne(pdf);
        });
      }
      list.appendChild(div);
    });
  }

  function updateStats() {
    const pdfs = window.AutohomConversorStore.getPdfs();
    const total = pdfs.length;
    const pending = window.AutohomConversorStore.getPendingPdfs().length;
    const done = pdfs.filter((pdf) => pdf.status === 'completed').length;

    window.AutohomSidepanelDom.byId('conv-total').textContent = total;
    window.AutohomSidepanelDom.byId('conv-pending').textContent = pending;
    window.AutohomSidepanelDom.byId('conv-done').textContent = done;

    const button = window.AutohomSidepanelDom.byId('btn-convert-all');
    button.disabled = pending === 0;
    button.textContent = pending > 0
      ? `⚡ Convertir ${pending} Pendiente${pending !== 1 ? 's' : ''}`
      : '⚡ Todo Convertido';
  }

  return {
    renderPdfList,
    updateStats,
  };
})();
