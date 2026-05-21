# Phase 1 — Add Actas UI and URL configuration contract

## Objective

Add the UI skeleton and configuration contract for a new Actas-tab action that will open a configurable target website once per mapped PDF.

This phase must not open any browser tabs yet. It only adds:
- The target URL input.
- The launch button.
- The status area.
- A small contract module for URL normalization and validation.
- Script loading order for the new contract module.

## Repository alignment

Current relevant files:
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
- Existing pattern: `zoho-ilovepdf-extension/sidepanel/actas/actasOpenPdfs.js`
- Existing state source: `window.AutohomActasStore.getMappings()`

The Actas tab currently has an `.actas-batch-bar` containing:
- `btn-actas-open-pdfs`
- `actas-open-pdfs-status`
- `btn-actas-convert-all`
- `actas-batch-status`

The new UI should be placed in the same Actas tab, close to the mapped-PDF batch actions, without disrupting the existing buttons.

## Expected behavior

After this phase:
- The Actas tab shows a new section for opening a configurable website.
- The default visible URL is `https://chat.deepseek.com`.
- The launch button is visible but does not yet perform tab opening.
- The status text clearly says that the action will open one tab per mapped PDF once the feature is fully wired.
- Existing Actas UI remains unchanged and usable.

Recommended Spanish UI copy:
- Label: `Sitio web a abrir`
- Input default: `https://chat.deepseek.com`
- Button: `Abrir sitio por cada PDF mapeado`
- Initial status: `Configura el sitio web. Se abrirá una pestaña por cada PDF mapeado.`

## Implementation details

### 1. Update `sidepanel.html`

Add CSS classes near the existing Actas batch styles. Keep styling consistent with the current small-card style.

Suggested class names:
- `.actas-open-site-card`
- `.actas-open-site-field`
- `.actas-open-site-input`
- `.btn-actas-open-site`
- `.actas-open-site-status`

Add markup inside the Actas tab, preferably inside or adjacent to `.actas-batch-bar`, below `Abrir PDFs descargados` and above `Convertir todos los PDF mapeados`.

Suggested DOM IDs:
- `actas-open-site-url`
- `btn-actas-open-site`
- `actas-open-site-status`

Do not reuse existing IDs.

### 2. Add a new contract module

Create:

`zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteContracts.js`

The module should expose:

`window.AutohomActasOpenSiteContracts`

Suggested API:
```js
window.AutohomActasOpenSiteContracts = (() => {
  const DEFAULT_TARGET_URL = 'https://chat.deepseek.com';
  const STORAGE_KEY = 'autohom.actas.openSite.targetUrl.v1';

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
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('La URL debe comenzar con http:// o https://.');
      }
    } catch (_error) {
      errors.push('La URL del sitio web no es valida.');
    }

    return { ok: errors.length === 0, url, errors };
  }

  return {
    DEFAULT_TARGET_URL,
    STORAGE_KEY,
    normalizeTargetUrl,
    validateTargetUrl,
  };
})();
```

Important:
- Reject `javascript:`, `file:`, `chrome:`, and other non-http protocols.
- Keep this contract independent from the DOM.
- Keep this contract independent from `chrome.storage`.

### 3. Register the script in `sidepanel.html`

Load `actasOpenSiteContracts.js` before any module that will use it.

Recommended order inside the existing Actas scripts:
```html
<script src="sidepanel/actas/actasStore.js"></script>
<script src="sidepanel/actas/actasRender.js"></script>
<script src="sidepanel/actas/csvExport.js"></script>
<script src="sidepanel/actas/actasConversion.js"></script>
<script src="sidepanel/actas/actasBatchConversion.js"></script>
<script src="sidepanel/actas/actasOpenSiteContracts.js"></script>
...
<script src="sidepanel/actas/actasController.js"></script>
```

Do not remove or reorder existing scripts unless required by dependencies.

## Success criteria

- `sidepanel.html` renders without console errors.
- The Actas tab still loads as the active tab.
- Existing buttons remain visible:
  - `Abrir PDFs descargados`
  - `Convertir todos los PDF mapeados`
  - `Exportar CSV`
  - `Limpiar registros`
- The new input is visible and shows `https://chat.deepseek.com`.
- The new button is visible.
- The new status area is visible.
- `window.AutohomActasOpenSiteContracts.validateTargetUrl('https://chat.deepseek.com')` returns `{ ok: true, ... }`.
- Invalid protocols such as `javascript:alert(1)` return `{ ok: false, ... }`.

## How to verify

Manual browser verification:
1. Load/reload the unpacked extension.
2. Open the side panel.
3. Go to the Actas tab.
4. Confirm the new field, button, and status appear.
5. Confirm existing Actas actions still appear.
6. Open DevTools for the side panel and run:
   ```js
   window.AutohomActasOpenSiteContracts.validateTargetUrl('https://chat.deepseek.com')
   window.AutohomActasOpenSiteContracts.validateTargetUrl('javascript:alert(1)')
   ```

Static verification:
- Search for duplicate IDs:
  - `actas-open-site-url`
  - `btn-actas-open-site`
  - `actas-open-site-status`
- Confirm `actasOpenSiteContracts.js` is loaded before future modules that will consume it.

## Observable failure signals

- Side panel is blank.
- Console error: `AutohomActasOpenSiteContracts is undefined`.
- New input does not render.
- Existing Actas buttons disappear.
- Contract accepts `javascript:` or `file:` URLs.
- The new script is loaded after `actasController.js`.

## Files/components involved

Expected files:
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteContracts.js`

Do not modify:
- Python backend.
- iLovePDF runtime modules.
- `background-main.js`.
- `background-zoho.js`.
- Existing Actas conversion logic.

## Preconditions before implementation

Before coding, confirm:
- `sidepanel.html` still contains the Actas tab and `.actas-batch-bar`.
- The extension still uses plain script tags.
- `sidepanel/actas/actasController.js` is still loaded after the Actas modules.
- No existing file already defines `window.AutohomActasOpenSiteContracts`.
- No existing storage key uses `autohom.actas.openSite.targetUrl.v1`.

## Stop conditions if the plan does not match the real codebase

Stop and report if:
- The Actas tab markup no longer exists.
- The batch bar no longer exists or has been replaced by a framework component.
- The side panel is now bundled and direct script insertion is invalid.
- There is already an equivalent open-site module.
- The product owner requires separate windows rather than tabs before Phase 1 is complete.
