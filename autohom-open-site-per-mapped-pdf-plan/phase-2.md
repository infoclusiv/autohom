# Phase 2 — Add persisted target URL settings and button state behavior

## Objective

Implement the non-opening behavior for the new Actas open-site action:

- Load the saved target URL from `chrome.storage.local`.
- Default to `https://chat.deepseek.com` when no saved value exists.
- Persist user edits.
- Validate the URL.
- Enable/disable the launch button based on mapped PDF count and URL validity.
- Keep status text synchronized with the current mapped PDF count.

This phase still must not open browser tabs. Browser opening is added in Phase 3.

## Repository alignment

Current state source:
- `window.AutohomActasStore.getMappings()`

Current controller update pattern:
- `window.AutohomActasOpenPdfs?.updateButtonState()` is called when mappings are loaded, saved, deleted, cleared, or moved.

The new module should follow the same pattern:
- `window.AutohomActasOpenSite?.init()`
- `window.AutohomActasOpenSite?.updateButtonState()`

## Expected behavior

After this phase:
- The target URL input is initialized from storage or the default.
- Editing the URL updates storage after the user changes the value.
- Invalid URLs show a clear error status and disable the launch button.
- If there are zero mapped PDFs, the launch button is disabled.
- If there is at least one mapped PDF and the URL is valid, the launch button is enabled.
- Status reflects the total number of mapped PDFs, not the filtered/search-visible count.

Example statuses:
- `No hay PDFs mapeados para abrir el sitio.`
- `Se abrirán 10 pestañas a https://chat.deepseek.com.`
- `URL inválida: La URL debe comenzar con http:// o https://.`
- `URL guardada.`

## Implementation details

### 1. Create a settings/storage module

Create:

`zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteSettings.js`

Expose:

`window.AutohomActasOpenSiteSettings`

Suggested API:
```js
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
```

Requirements:
- Use `chrome.storage.local`.
- Do not store invalid URLs.
- Keep storage logic separate from DOM logic.
- Do not change `chrome.storage.local.mappings`.

### 2. Create the main UI controller module without tab opening

Create:

`zoho-ilovepdf-extension/sidepanel/actas/actasOpenSite.js`

Expose:

`window.AutohomActasOpenSite`

Suggested internal state:
```js
let isOpening = false;
let currentTargetUrl = window.AutohomActasOpenSiteContracts.DEFAULT_TARGET_URL;
let lastStatusMessage = '';
```

Suggested API:
- `init()`
- `updateButtonState()`
- `getMappedCount()`
- `getTargetUrlValidation()`

Behavior:
- On `init()`:
  - Find `actas-open-site-url`, `btn-actas-open-site`, and `actas-open-site-status`.
  - Load URL via `AutohomActasOpenSiteSettings.loadTargetUrl()`.
  - Set input value.
  - Add input/change listener.
  - Add blur listener or change listener to save only valid URLs.
  - Add click listener that currently only shows a toast/log such as `Función preparada. La apertura de pestañas se implementa en Phase 3.`
  - Call `updateButtonState()`.
- `getMappedCount()` must return `window.AutohomActasStore.getMappings().length`.
- Do not use `AutohomActasStore.filterMappings()` for the count.
- `updateButtonState()` must:
  - Disable button if `isOpening` is true.
  - Disable button if mapped count is `0`.
  - Disable button if URL validation fails.
  - Show clear status text.

### 3. Register scripts in `sidepanel.html`

Add scripts after `actasOpenSiteContracts.js` and before `actasController.js`:
```html
<script src="sidepanel/actas/actasOpenSiteContracts.js"></script>
<script src="sidepanel/actas/actasOpenSiteSettings.js"></script>
<script src="sidepanel/actas/actasOpenSite.js"></script>
```

### 4. Integrate with `actasController.js`

In `init()`:
```js
window.AutohomActasOpenSite?.init();
window.AutohomActasOpenSite?.updateButtonState();
```

When mappings change, add:
```js
window.AutohomActasOpenSite?.updateButtonState();
```

Add this in the same places where `AutohomActasOpenPdfs?.updateButtonState()` is already called:
- After initial load.
- After search input changes if helpful, although count must remain all mappings.
- After `handleMappingSaved`.
- After `deleteMapping`.
- After `clearAllMappings`.
- After `moveMappingToPending`.

Important:
- Search changes should not change the launch count, but updating the button state is harmless and keeps UI fresh.
- Do not alter existing `AutohomActasOpenPdfs` behavior.

## Success criteria

- The side panel loads with no console errors.
- The default URL is `https://chat.deepseek.com` when no saved URL exists.
- Editing to a valid URL and blurring/changing the input persists it.
- Reloading the side panel restores the edited URL.
- Invalid URL input disables the launch button.
- Zero mapped PDFs disables the launch button.
- One or more mapped PDFs with a valid URL enables the launch button.
- The status message uses the count from `AutohomActasStore.getMappings().length`.
- Existing `Abrir PDFs descargados` behavior remains unchanged.

## How to verify

Manual verification:
1. Open the Actas tab with zero mappings.
2. Confirm the button is disabled.
3. Add or use existing mapped PDFs.
4. Confirm the button status says how many tabs would be opened.
5. Change the URL to `https://example.com`.
6. Reload the side panel.
7. Confirm the input still shows `https://example.com`.
8. Enter `javascript:alert(1)`.
9. Confirm the button becomes disabled and status shows an error.
10. Restore `https://chat.deepseek.com`.

Console verification:
```js
window.AutohomActasOpenSite.getMappedCount()
window.AutohomActasStore.getMappings().length
```
These values must match.

Storage verification:
```js
chrome.storage.local.get('autohom.actas.openSite.targetUrl.v1')
```

## Observable failure signals

- `AutohomActasOpenSiteSettings is undefined`.
- `AutohomActasOpenSite is undefined`.
- Button stays disabled despite valid URL and mapped PDFs.
- Button becomes enabled with zero mappings.
- Status count changes when using the Actas search filter.
- Invalid URL is persisted to `chrome.storage.local`.
- Existing mapping storage is overwritten or corrupted.
- `Abrir PDFs descargados` no longer updates correctly.

## Files/components involved

Expected files:
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteContracts.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteSettings.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSite.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`

Do not modify:
- Python backend.
- iLovePDF runtime.
- Existing PDF opening implementation.
- Existing conversion implementation.

## Preconditions before implementation

Before coding, confirm:
- Phase 1 was implemented and verified.
- The new DOM IDs exist:
  - `actas-open-site-url`
  - `btn-actas-open-site`
  - `actas-open-site-status`
- `chrome.storage.local` is available in the side panel context.
- `AutohomActasStore.getMappings()` returns the current mapped PDFs.
- No existing code uses the same storage key.

## Stop conditions if the plan does not match the real codebase

Stop and report if:
- `chrome.storage.local` is wrapped by a repository-specific helper that must be used instead.
- `AutohomActasStore.getMappings()` no longer returns all mappings.
- Actas state is now asynchronous and cannot be read synchronously after load.
- The existing controller no longer owns mapping-change lifecycle updates.
- A new framework or bundler prevents direct global modules.
