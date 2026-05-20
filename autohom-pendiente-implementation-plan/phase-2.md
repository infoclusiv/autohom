# Phase 2 — Add extension API, Actas storage update, and pending-action module

## Objective

Add the browser-side action layer that calls the new Python endpoint and updates the mapped Actas record after the PDF is moved.

This phase must not yet require final UI styling polish, but it must create a clean action module that the UI can call.

## Current architecture evidence

Relevant current files:

- `zoho-ilovepdf-extension/sidepanel/conversor/apiClient.js`
  - Centralizes HTTP calls to the local Python API.
- `zoho-ilovepdf-extension/sidepanel/actas/actasConversion.js`
  - Already resolves mapped source PDFs using `getSourcePdfForMapping(mapping)`.
- `zoho-ilovepdf-extension/sidepanel/actas/actasStore.js`
  - Owns `chrome.storage.local.mappings`.
  - Already updates `sourcePdf` through `updateMappingSourcePdf`.
  - Already updates conversion metadata through `updateMappingConversion`.
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
  - Exposes Actas actions to rendered cards.
- `zoho-ilovepdf-extension/sidepanel.html`
  - Controls script load order.

## Required implementation

### 1. Extend the Python API client

In `zoho-ilovepdf-extension/sidepanel/conversor/apiClient.js`, add:

```js
async function movePdfToPending(payload) {
  return await readJson(`${API_BASE}/pdfs/move-to-pending`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

Export it from `AutohomConversorApi`.

### 2. Add a dedicated Actas pending module

Create a new file:

```text
zoho-ilovepdf-extension/sidepanel/actas/actasPending.js
```

Suggested public API:

```js
window.AutohomActasPending = (() => {
  async function moveMappingToPending(mapping, card) {
    ...
  }

  function isMappingAlreadyPending(mapping) {
    ...
  }

  return {
    moveMappingToPending,
    isMappingAlreadyPending,
  };
})();
```

Expected `moveMappingToPending` behavior:

1. Build a trace id such as `acta-pending-${mapping.id}-${Date.now()}`.
2. Resolve the source PDF using the existing:

```js
window.AutohomActasConversion.getSourcePdfForMapping(mapping)
```

3. Validate `sourcePdf.absolutePath` exists.
4. Call:

```js
window.AutohomConversorApi.movePdfToPending({
  path: sourcePdf.absolutePath,
  mappingId: mapping.id,
  zohoUrl: mapping.zohoUrl,
  traceId,
})
```

5. On success, build an updated `sourcePdf`:

```js
{
  ...sourcePdf,
  absolutePath: response.destinationPath,
  directory: response.pendingDirectory,
  filename: response.filename || sourcePdf.filename,
  captureMethod: sourcePdf.captureMethod || 'chrome.downloads.search',
  movedToPendingAt: Date.now(),
}
```

6. Persist the update through `AutohomActasStore`.
7. Add optional mapping metadata:

```js
pendingMove: {
  status: "moved",
  movedAt: Date.now(),
  originalPath: response.originalPath,
  destinationPath: response.destinationPath,
  pendingDirectory: response.pendingDirectory,
  traceId,
}
```

8. Show a toast on success.
9. On failure, do not update the mapping as moved.
10. Re-enable the clicked button in `finally`.

### 3. Extend Actas storage safely

In `zoho-ilovepdf-extension/sidepanel/actas/actasStore.js`, add a method such as:

```js
async function updateMappingPendingMove(mappingId, payload) {
  ...
}
```

It should:

- Use the existing private `updateMapping` helper.
- Preserve existing fields.
- Update `sourcePdf`.
- Add/update `pendingMove`.
- Increase `schemaVersion` to at least `3`.
- Not reset conversion metadata unless the implementation explicitly has a reason and documents it.

Also update `normalizeMapping(mapping)` so `pendingMove` is normalized safely:

```js
pendingMove: mapping?.pendingMove || null
```

Compatibility rules:

- Old mappings without `pendingMove` must still load.
- Old mappings without `sourcePdf` must still load.
- Active conversion statuses must still normalize as before.

### 4. Wire the controller

In `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`, expose a method:

```js
async function moveMappingToPending(mapping, card) {
  await window.AutohomActasPending.moveMappingToPending(mapping, card);
}
```

Return it from the module so `actasRender.js` can call:

```js
window.AutohomActas.moveMappingToPending(mapping, card)
```

After a successful move:

- Re-render filtered mappings or update the card status.
- Update Actas button state if needed.
- Ensure `AutohomActasOpenPdfs.updateButtonState()` still reflects available mappings.
- Ensure `AutohomActasBatchConversion.updateButtonState()` still reflects eligible mappings.

### 5. Add the new script to load order

In `zoho-ilovepdf-extension/sidepanel.html`, add:

```html
<script src="sidepanel/actas/actasPending.js"></script>
```

Load it after:

```html
<script src="sidepanel/conversor/apiClient.js"></script>
```

and before:

```html
<script src="sidepanel/actas/actasController.js"></script>
```

If moving the script relative to `actasOpenPdfs.js` is necessary, keep dependencies explicit and avoid breaking existing modules.

## Expected behavior

After this phase, browser-side code can move a mapping to `pendientes` through a callable Actas action, and mapping storage can persist the moved path.

## Success criteria

- `AutohomConversorApi.movePdfToPending` exists.
- `AutohomActasPending.moveMappingToPending` exists.
- The pending action uses `getSourcePdfForMapping`.
- The mapping is updated with the new `sourcePdf.absolutePath`.
- The mapping gets optional persistent `pendingMove` metadata.
- Existing mapping load behavior still works for schema v1 and v2.
- Existing Actas conversion/open-PDF methods still compile and initialize.

## How to verify

Manual browser-console verification after loading the unpacked extension:

1. Confirm `window.AutohomConversorApi.movePdfToPending` is a function.
2. Confirm `window.AutohomActasPending.moveMappingToPending` is a function.
3. Confirm `window.AutohomActas.moveMappingToPending` is a function.
4. Use a test mapping and call the action manually.
5. Inspect `chrome.storage.local.get('mappings')`.
6. Confirm the mapping path is now inside `pendientes`.

## Observable failure signals

- `TypeError: window.AutohomConversorApi.movePdfToPending is not a function`.
- `TypeError: window.AutohomActasPending is undefined`.
- Failed HTTP response from `/api/pdfs/move-to-pending`.
- Toast showing the backend error.
- Mapping still points to the original path after a reported success.
- Existing Actas actions stop initializing after script load order changes.

## Files/components involved

Expected files:

- `zoho-ilovepdf-extension/sidepanel/conversor/apiClient.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasPending.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasStore.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/observability/eventNames.js` if adding browser event names

## Preconditions before implementation

- Phase 1 is implemented and verified.
- `/api/pdfs/move-to-pending` exists and returns `destinationPath`.
- `AutohomActasConversion.getSourcePdfForMapping` still exists.
- `AutohomActasStore` still owns persisted mappings.
- `AutohomConversorApi` remains the shared HTTP client.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- `apiClient.js` is no longer the correct place for local Python API calls.
- The Actas controller no longer exposes card actions.
- `actasStore.js` no longer writes to `chrome.storage.local.mappings`.
- The new endpoint response shape differs materially from Phase 1.
- Script load order cannot be changed safely without a larger module refactor.
