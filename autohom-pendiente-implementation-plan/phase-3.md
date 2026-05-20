# Phase 3 — Add the per-card “Pendiente” button and visible card states

## Objective

Add a **`Pendiente`** button to each mapped PDF card in the Actas tab and connect it to the pending-action module from Phase 2.

## Current architecture evidence

Relevant current files:

- `zoho-ilovepdf-extension/sidepanel/actas/actasRender.js`
  - Creates each mapping card.
  - Currently renders `Convertir` and `Copiar URL` buttons.
  - Uses `.mapping-convert-status` for conversion state.
- `zoho-ilovepdf-extension/sidepanel.html`
  - Defines CSS for mapping cards, card actions, buttons, and status labels.
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
  - Provides controller methods used by rendered buttons.

## Required implementation

### 1. Update card markup

In `actasRender.js`, update `createCard(mapping, isNew = false)` so each card has a button named exactly:

```text
Pendiente
```

Suggested markup inside `.card-actions`:

```html
<button class="btn-pending-mapping" data-id="${mapping.id}">Pendiente</button>
<button class="btn-convert-mapping" data-id="${mapping.id}">Convertir</button>
<button class="btn-copy" data-url="${mapping.zohoUrl}">Copiar URL</button>
```

### 2. Add a dedicated pending status line

Do not overload `.mapping-convert-status` for this feature.

Add a separate line such as:

```html
<div class="mapping-pending-status"></div>
```

Suggested placement:

- After `.mapping-convert-meta`, or
- Before `.mapping-footer`.

### 3. Render existing pending state

Add helper logic in `actasRender.js`, for example:

```js
function getStoredPendingMoveMessage(mapping) {
  const pendingMove = mapping?.pendingMove || null;
  if (pendingMove?.status === 'moved' && pendingMove.destinationPath) {
    return {
      status: 'moved',
      message: `En pendientes: ${pendingMove.destinationPath}`,
    };
  }
  if (pendingMove?.status === 'error' && pendingMove.lastError) {
    return {
      status: 'error',
      message: `Pendiente error: ${pendingMove.lastError}`,
    };
  }
  return { status: 'idle', message: '' };
}
```

Expected UI behavior:

- If already moved, show a clear success line.
- Disable the **Pendiente** button or change its label to `En pendientes`.
- Do not hide the card.
- Do not delete the mapping.
- Do not automatically remove the PDF from the Actas list.

### 4. Bind the button

Add a click listener:

```js
card.querySelector('.btn-pending-mapping').addEventListener('click', async (event) => {
  event.stopPropagation();
  await window.AutohomActas.moveMappingToPending(mapping, card);
});
```

Button behavior during operation:

- Disable the button.
- Temporarily show a state like `Moviendo a pendientes...`.
- On success:
  - Show success status.
  - Toast success.
  - Button becomes disabled or text changes to `En pendientes`.
- On failure:
  - Re-enable button.
  - Show error status.
  - Toast error.

### 5. Add styling

In `sidepanel.html`, add CSS for:

- `.btn-pending-mapping`
- `.mapping-pending-status`
- `.mapping-pending-status.is-success`
- `.mapping-pending-status.is-error`
- `.mapping-pending-status.is-active`

Keep the style consistent with existing small card buttons:

- Similar size to `btn-convert-mapping`.
- Use the existing CSS variables.
- Avoid layout overflow in `.card-actions`.
- If the card becomes too cramped, allow `.card-actions` to wrap instead of widening the card.

### 6. Keep conversion behavior intact

After moving to `pendientes`, the stored `sourcePdf.absolutePath` should point to the new location. Therefore:

- `Convertir` should use the new path.
- `Abrir PDFs descargados` should use the new path.
- Batch conversion should use the new path.

Do not make `Pendiente` remove the mapping from conversion eligibility unless the user explicitly requested that behavior. The user only requested moving the PDF into a `pendientes` folder.

## Expected behavior

Each mapped PDF card in Actas shows a **Pendiente** button. Clicking it moves the local mapped PDF into a sibling `pendientes` folder and updates the card state.

## Success criteria

- Every mapped card renders a **Pendiente** button.
- Clicking the button calls `window.AutohomActas.moveMappingToPending`.
- The button is disabled while moving.
- Success state is visible on the card.
- Error state is visible on the card.
- Already moved mappings show an “En pendientes” or equivalent state after reload.
- Existing `Convertir` and `Copiar URL` buttons still work.
- The card layout remains readable.

## How to verify

Manual UI verification:

1. Load the extension side panel.
2. Go to the Actas tab.
3. Confirm each mapping card has:
   - `Pendiente`
   - `Convertir`
   - `Copiar URL`
4. Click **Pendiente** on a test mapping.
5. Confirm:
   - Button disables while moving.
   - PDF moves on disk.
   - Card shows success.
   - `chrome.storage.local.mappings` points to the new path.
6. Reload the extension side panel.
7. Confirm the moved card still shows its pending state.
8. Click `Copiar URL` and confirm unchanged behavior.
9. For a moved mapping, test `Abrir PDFs descargados` or `Convertir` to confirm they use the updated path.

## Observable failure signals

- Button is missing from one or more cards.
- `Cannot read properties of null` from `.btn-pending-mapping`.
- The UI says success but the file did not move.
- The UI says success but storage still points to the old path.
- Conversion/open-PDF fails because storage was not updated.
- Card action buttons overflow or become unusable.

## Files/components involved

Expected files:

- `zoho-ilovepdf-extension/sidepanel/actas/actasRender.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasPending.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
- `zoho-ilovepdf-extension/sidepanel.html`

## Preconditions before implementation

- Phase 2 is implemented and verified.
- `window.AutohomActas.moveMappingToPending` exists.
- `window.AutohomActasPending.moveMappingToPending` works from console/manual invocation.
- The backend endpoint moves files correctly.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- Mapping cards are no longer created in `actasRender.js`.
- The card action area is no longer `.card-actions`.
- Existing card buttons are generated by another renderer or framework.
- The current UI already has an equivalent pending button with different behavior.
- The user actually needs the action on the Conversor PDF tab, not Actas mapped PDF cards.
