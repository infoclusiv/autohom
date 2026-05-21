# Phase 3 — Implement opening one configured site tab per mapped PDF and add observability/docs

## Objective

Complete the feature by opening the configured website once per currently mapped PDF when the user clicks the new button.

This phase also adds AI-ready observable signals and updates architecture documentation so future agents understand the new flow.

## Repository alignment

Existing closest implementation:
- `sidepanel/actas/actasOpenPdfs.js`

That module:
- Computes eligible mappings.
- Disables its button while running.
- Logs request/completion/failure events with `AutohomLogs.append`.
- Uses `chrome.tabs.create({ url, active: false })`.
- Applies a short delay between tab openings.

The new feature should follow the same side-panel pattern but must remain independent from:
- Python bridge.
- Local PDF registration.
- iLovePDF conversion.
- `sourcePdf.absolutePath`.

## Expected behavior

After this phase:
- Clicking `Abrir sitio por cada PDF mapeado` opens exactly one browser tab for each current mapped PDF.
- The URL opened is the current valid configured URL.
- The number of tabs opened equals `AutohomActasStore.getMappings().length`.
- The feature does not require PDFs to exist locally.
- The feature does not require `zohoUrl`, `sourcePdf`, or conversion metadata.
- The button is disabled while opening.
- The status updates during and after opening.
- Failures are logged with enough detail for an AI agent to diagnose them.

Example:
- If `AutohomActasStore.getMappings().length === 10`, open 10 tabs.
- If `AutohomActasStore.getMappings().length === 19`, open 19 tabs.
- If the user changes the target URL to `https://chat.deepseek.com`, every opened tab uses that exact URL.

## Implementation details

### 1. Replace Phase 2 placeholder click behavior

In:

`zoho-ilovepdf-extension/sidepanel/actas/actasOpenSite.js`

Implement:

`openSiteForMappedPdfs()`

Suggested algorithm:
```js
async function openSiteForMappedPdfs() {
  const mappings = window.AutohomActasStore.getMappings();
  const count = mappings.length;
  const validation = window.AutohomActasOpenSiteContracts.validateTargetUrl(currentTargetUrl);
  const batchId = `actas-open-site-${Date.now()}`;

  if (count === 0) {
    window.AutohomToast.show('No hay PDFs mapeados para abrir el sitio.');
    updateButtonState();
    return;
  }

  if (!validation.ok) {
    const message = `URL invalida: ${validation.errors.join(' ')}`;
    updateStatus(message, 'error');
    window.AutohomToast.show(message);
    updateButtonState();
    return;
  }

  isOpening = true;
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
        updateStatus(`Abriendo ${opened}/${count} pestañas...`);

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
    updateStatus(message);

    window.AutohomLogs.append(
      `actas.open_site.completed opened=${opened} failed=${failures.length} batch=${batchId}`
    );

    window.AutohomToast.show(message);
  } finally {
    isOpening = false;
    updateButtonState();
  }
}
```

Notes:
- Use all mappings, not filtered mappings.
- Do not require mapping fields.
- Use `active: false` to avoid stealing focus repeatedly.
- Keep a short delay between openings to reduce browser/API stress.
- If the product owner wants each opened tab active, stop and report before changing this behavior.

### 2. Add defensive handling for large counts

The user gave examples of 10 and 19 PDFs. Opening many tabs can be disruptive.

Recommended behavior:
- No confirmation for counts up to 20.
- For counts above 20, show `confirm(...)` before opening:
  - `Vas a abrir {count} pestañas. ¿Quieres continuar?`

Do not block the required examples of 10 and 19 with confirmation unless the implementation agent decides a lower threshold is required for browser safety and reports it.

### 3. Ensure button state refreshes during lifecycle

`updateButtonState()` should reflect:
- `isOpening`.
- Total mapped PDF count.
- URL validity.

While opening:
- Button text: `Abriendo sitio...`
- Status: `Abriendo N pestañas...`

When idle:
- Button text: `Abrir sitio por cada PDF mapeado`

### 4. Update architecture and observability docs

Update:

`docs/architecture/runtime-flows.md`

Add a short new runtime flow, for example:

```md
## 12. Open configured website for mapped Actas

The Actas tab exposes an open-site action that reads all current mappings from `AutohomActasStore.getMappings()`, validates a persisted target URL from `chrome.storage.local`, and opens one inactive Chrome tab per mapped PDF with `chrome.tabs.create`. This flow is independent from the Python bridge and iLovePDF conversion runtime.
```

Update:

`docs/observability/00-current-architecture.md`

Add a new flow, for example:

```md
### FLOW-017: Open configured website per mapped PDF

- Trigger: user presses `Abrir sitio por cada PDF mapeado` in Actas.
- Components: `sidepanel.ui`, `sidepanel.actas.open_site`, `chrome.tabs`.
- Inputs: mapped PDF count from `AutohomActasStore.getMappings()`, target URL from `chrome.storage.local`.
- Outputs: one inactive browser tab per mapped PDF.
- Failure modes: invalid URL, zero mappings, tab creation failure, excessive tab count cancelled by user.
- Required observability events: `actas.open_site.requested`, `actas.open_site.tab_opened`, `actas.open_site.failed`, `actas.open_site.completed`.
```

## Success criteria

- With 0 mappings:
  - Button is disabled.
  - No tabs are opened.
  - Status says there are no mapped PDFs.
- With 1 mapping:
  - Clicking opens exactly 1 tab.
- With 10 mappings:
  - Clicking opens exactly 10 tabs.
- With 19 mappings:
  - Clicking opens exactly 19 tabs.
- With a changed URL:
  - Every opened tab uses the changed URL.
- With an invalid URL:
  - No tabs are opened.
  - Button is disabled.
  - Status explains the URL issue.
- While opening:
  - Button is disabled.
  - Status shows progress.
- After opening:
  - Status shows opened count and error count.
- Existing features still work:
  - Zoho PDF mapping.
  - Search.
  - CSV export.
  - `Abrir PDFs descargados`.
  - `Convertir todos los PDF mapeados`.

## How to verify

Manual verification in Chrome:
1. Reload the unpacked extension.
2. Open the side panel.
3. Confirm the Actas tab has mapped PDFs.
4. Set URL to `https://chat.deepseek.com`.
5. Note the mapped PDF count shown in the Actas stats.
6. Click `Abrir sitio por cada PDF mapeado`.
7. Count opened tabs and confirm it equals the mapped count.
8. Repeat with a different valid URL such as `https://example.com`.
9. Enter an invalid URL and confirm no tabs open.
10. Test with search filtering enabled and confirm the opened tab count still equals total mappings, not filtered results.

Console verification:
```js
const expected = window.AutohomActasStore.getMappings().length;
console.log({ expected });
```

Log verification:
- The side panel log should include:
  - `actas.open_site.requested`
  - one or more `actas.open_site.tab_opened`
  - `actas.open_site.completed`
- On failure, it should include:
  - `actas.open_site.failed`

Documentation verification:
- `docs/architecture/runtime-flows.md` includes the new open-site flow.
- `docs/observability/00-current-architecture.md` includes the new FLOW-017.

## Observable failure signals

- Fewer tabs open than mapped PDFs without logged failures.
- More tabs open than mapped PDFs.
- Tabs open to the wrong URL.
- Button remains enabled while opening.
- Feature counts only filtered/search-visible mappings.
- Existing `Abrir PDFs descargados` breaks.
- Existing `Convertir todos los PDF mapeados` breaks.
- Browser console shows `Unchecked runtime.lastError` or permission-related errors.
- Logs do not include request/completed/failure events.
- Docs are not updated and future agents cannot discover the flow.

## Files/components involved

Expected files:
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSite.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasController.js`
- `docs/architecture/runtime-flows.md`
- `docs/observability/00-current-architecture.md`

Possibly touched if missing from earlier phases:
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteContracts.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenSiteSettings.js`

Do not modify:
- Python backend.
- iLovePDF conversion runtime.
- Zoho download mapper.
- Existing PDF local file opening logic.

## Preconditions before implementation

Before coding, confirm:
- Phase 1 and Phase 2 are implemented and verified.
- The new button exists and is wired to `AutohomActasOpenSite`.
- URL persistence works.
- URL validation works.
- `manifest.json` still includes `tabs` permission.
- `chrome.tabs.create` is available in the side panel context.

## Stop conditions if the plan does not match the real codebase

Stop and report if:
- `chrome.tabs.create` fails because the side panel context cannot call it.
- The extension now requires all tab operations to go through the background service worker.
- The product owner requires separate windows instead of tabs.
- The browser blocks large tab creation in a way that requires a different UX.
- The repository has an existing centralized observability event writer that should replace `AutohomLogs.append`.
- The docs files were moved or renamed.
