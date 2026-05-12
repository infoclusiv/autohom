window.AutohomActasRender = (() => {
  function getStoredConversionMessage(mapping) {
    const conversion = mapping?.conversion || {};
    if (conversion.lastStatus === 'error' && conversion.lastError) {
      return { status: 'error', message: `Error: ${conversion.lastError}` };
    }
    if (conversion.lastStatus === 'completed') {
      return {
        status: 'completed',
        message: 'Convertido correctamente',
        finalExcelPath: conversion.lastExcelPath || '',
      };
    }
    return { status: 'idle', message: '' };
  }

  function renderMappings(mappings, newId = null) {
    const list = window.AutohomSidepanelDom.byId('mappings-list');
    const empty = window.AutohomSidepanelDom.byId('empty-state');
    list.innerHTML = '';

    if (mappings.length === 0) {
      empty.style.display = 'block';
      window.AutohomSidepanelDom.byId('count-label').textContent = '0 registros';
      return;
    }

    empty.style.display = 'none';
    window.AutohomSidepanelDom.byId('count-label').textContent =
      `${mappings.length} registro${mappings.length !== 1 ? 's' : ''}`;
    mappings.forEach((mapping) => list.appendChild(createCard(mapping, mapping.id === newId)));
  }

  function applyStatusToCard(card, status, message = '', options = {}) {
    const statusEl = card.querySelector('.mapping-convert-status');
    const metaEl = card.querySelector('.mapping-convert-meta');
    if (!statusEl) {
      return;
    }

    const textByStatus = {
      idle: 'Listo para convertir',
      preparing: 'Preparando PDF local...',
      registering: 'Registrando PDF en Python...',
      queued: 'Enviado a conversión',
      starting: 'Enviado a conversión',
      uploading: 'Subiendo PDF...',
      converting: 'Convirtiendo...',
      downloading: 'Descargando resultado...',
      finalizing: 'Guardando Excel junto al PDF...',
      completed: 'Convertido correctamente',
    };

    statusEl.textContent = message || textByStatus[status] || status || '';
    statusEl.classList.remove('is-error', 'is-success', 'is-active');

    if (metaEl) {
      metaEl.textContent = options.finalExcelPath ? `Excel: ${options.finalExcelPath}` : '';
    }

    if (status === 'error') {
      statusEl.classList.add('is-error');
    } else if (status === 'completed') {
      statusEl.classList.add('is-success');
    } else if (statusEl.textContent) {
      statusEl.classList.add('is-active');
    }
  }

  function createCard(mapping, isNew = false) {
    const card = document.createElement('div');
    card.className = `mapping-card${isNew ? ' new-entry' : ''}`;
    card.dataset.id = mapping.id;

    const date = new Date(mapping.savedAt);
    const dateStr = date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const shortUrl = mapping.zohoUrl
      .replace('https://crm.zoho.com/crm/', '')
      .substring(0, 48) + '…';

    card.innerHTML = `
      <button class="btn-delete" data-id="${mapping.id}" title="Eliminar">×</button>
      <div class="mapping-filename"><span class="pdf-icon">PDF</span>${mapping.filename}</div>
      <a class="mapping-url" href="${mapping.zohoUrl}" target="_blank" title="${mapping.zohoUrl}">🔗 ${shortUrl}</a>
      <div class="mapping-convert-status"></div>
      <div class="mapping-convert-meta"></div>
      <div class="mapping-footer">
        <span class="mapping-date">${dateStr}</span>
        <div class="card-actions">
          <button class="btn-convert-mapping" data-id="${mapping.id}">Convertir</button>
          <button class="btn-copy" data-url="${mapping.zohoUrl}">Copiar URL</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-delete').addEventListener('click', (event) => {
      event.stopPropagation();
      window.AutohomActas.deleteMapping(mapping.id, card);
    });

    card.querySelector('.btn-convert-mapping').addEventListener('click', async (event) => {
      event.stopPropagation();
      await window.AutohomActas.convertMapping(mapping, card);
    });

    card.querySelector('.btn-copy').addEventListener('click', async (event) => {
      event.stopPropagation();
      await navigator.clipboard.writeText(mapping.zohoUrl);
      const button = event.currentTarget;
      button.textContent = '✓ Copiado';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = 'Copiar URL';
        button.classList.remove('copied');
      }, 1500);
    });

    const stored = getStoredConversionMessage(mapping);
    if (stored.message || stored.finalExcelPath) {
      applyStatusToCard(card, stored.status, stored.message, {
        finalExcelPath: stored.finalExcelPath,
      });
    }

    if (isNew) {
      setTimeout(() => card.classList.remove('new-entry'), 3000);
    }
    return card;
  }

  function renderPendingSection() {
    const section = window.AutohomSidepanelDom.byId('pending-section');
    const pendingItems = window.AutohomActasStore.getPendingItems();
    const keys = Object.keys(pendingItems);

    if (keys.length === 0) {
      section.style.display = 'none';
      section.innerHTML = '';
      return;
    }

    section.style.display = 'block';
    section.innerHTML = '';
    keys.forEach((pendingKey) => {
      const item = pendingItems[pendingKey];
      const filename = (item.filename || '').split('/').pop().split('\\').pop() || 'archivo.pdf';
      const shortUrl = (item.zohoUrl || '').replace('https://crm.zoho.com/crm/', '');
      const card = document.createElement('div');
      card.className = 'pending-card';
      card.innerHTML = `
        <div class="pending-header"><div class="pending-dot"></div><span class="pending-label">Descarga detectada</span></div>
        <div class="pending-filename">📄 ${filename}</div>
        <div class="pending-question">¿Este PDF es un <strong>acta de homologación</strong>?<br/>
          <small style="opacity:0.7;font-family:'DM Mono',monospace;font-size:9px;">${shortUrl}</small></div>
        <div class="pending-actions">
          <button class="btn-confirm" data-key="${pendingKey}" data-id="${item.downloadId}">✅ Sí, mapear</button>
          <button class="btn-reject" data-key="${pendingKey}">❌ No, ignorar</button>
        </div>
      `;

      card.querySelector('.btn-confirm').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const key = button.dataset.key;
        const downloadId = parseInt(button.dataset.id, 10);
        const response = await window.AutohomChromeMessages.sendRuntimeMessage({
          type: 'CONFIRM_MAPPING',
          downloadId,
          pendingKey: key,
        });
        if (response?.ok) {
          window.AutohomActasStore.removePendingItem(key);
          renderPendingSection();
          return;
        }
        button.disabled = false;
        window.AutohomToast.show(`❌ ${response?.error || 'No se pudo guardar el mapeo'}`);
      });

      card.querySelector('.btn-reject').addEventListener('click', async (event) => {
        const key = event.currentTarget.dataset.key;
        await window.AutohomChromeMessages.sendRuntimeMessage({
          type: 'REJECT_MAPPING',
          pendingKey: key,
        });
        window.AutohomActasStore.removePendingItem(key);
        renderPendingSection();
      });

      section.appendChild(card);
    });
  }

  function updateMappingConversionStatus(mappingId, status, message = '', options = {}) {
    const card = document.querySelector(`.mapping-card[data-id="${mappingId}"]`);
    if (!card) {
      return;
    }
    applyStatusToCard(card, status, message, options);
  }

  return {
    renderMappings,
    renderPendingSection,
    updateMappingConversionStatus,
  };
})();
