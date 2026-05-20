# Phase 4 — Update contracts, observability, and run regression verification

## Objective

Finalize the feature by documenting the new contracts, confirming observable diagnostics, and running targeted regression checks.

## Current architecture evidence

Relevant current files:

- `docs/architecture/message-contracts.md`
  - Documents Chrome runtime messages and Python HTTP contracts.
- `docs/architecture/storage-contracts.md`
  - Documents `chrome.storage.local.mappings` schema v1/v2.
- `docs/architecture/runtime-flows.md`
  - Documents high-level runtime flows.
- `docs/architecture/module-map.md`
  - Documents the split between Python services/API and Chrome extension modules.
- `zoho-ilovepdf-extension/observability/eventNames.js`
  - Contains canonical extension event names.
- `app-python-zoho/autohom_bridge/observability/event_names.py`
  - Contains canonical Python event names.

## Required implementation

### 1. Update HTTP contract docs

In `docs/architecture/message-contracts.md`, add:

```md
## `POST /api/pdfs/move-to-pending`

### Request
```json
{
  "path": "C:\\Actas\\Acta.pdf",
  "mappingId": 123,
  "zohoUrl": "https://crm.zoho.com/crm/org/tab/Cases/1",
  "traceId": "acta-pending-123"
}
```

### Response
```json
{
  "ok": true,
  "moved": true,
  "originalPath": "C:\\Actas\\Acta.pdf",
  "destinationPath": "C:\\Actas\\pendientes\\Acta.pdf",
  "pendingDirectory": "C:\\Actas\\pendientes",
  "filename": "Acta.pdf",
  "mappingId": 123,
  "traceId": "acta-pending-123"
}
```

### Behavior
- Creates `pendientes` beside the source PDF if missing.
- Moves the PDF into that folder.
- Does not overwrite existing files.
- Returns explicit error codes for validation, missing file, permission, and move failures.
```

Fix Markdown fencing if needed.

### 2. Update storage contract docs

In `docs/architecture/storage-contracts.md`, add schema version 3 for mappings.

Version 3 should include the Version 2 fields plus:

```json
{
  "pendingMove": {
    "status": "moved|error|null",
    "movedAt": 0,
    "originalPath": "C:\\Actas\\Acta.pdf",
    "destinationPath": "C:\\Actas\\pendientes\\Acta.pdf",
    "pendingDirectory": "C:\\Actas\\pendientes",
    "traceId": "acta-pending-123",
    "lastError": null
  },
  "schemaVersion": 3
}
```

Compatibility rules:

- Version 1 and 2 mappings must still load.
- `pendingMove` is optional.
- `sourcePdf.absolutePath` is the source of truth for future open/convert operations.
- After a successful pending move, `sourcePdf.absolutePath` must be updated to `pendingMove.destinationPath`.

### 3. Add or confirm observability events

Prefer canonical events rather than only ad-hoc log strings.

Suggested Python event names in `app-python-zoho/autohom_bridge/observability/event_names.py`:

```python
PDF_PENDING_MOVE_STARTED = "pdf.pending_move.started"
PDF_PENDING_MOVE_SUCCEEDED = "pdf.pending_move.succeeded"
PDF_PENDING_MOVE_FAILED = "pdf.pending_move.failed"
```

Suggested extension event names in `zoho-ilovepdf-extension/observability/eventNames.js`:

```js
ACTAS_PENDING_MOVE_REQUESTED: 'actas.pending_move.requested',
ACTAS_PENDING_MOVE_SUCCEEDED: 'actas.pending_move.succeeded',
ACTAS_PENDING_MOVE_FAILED: 'actas.pending_move.failed',
```

If the repository’s existing extension modules mostly use `AutohomLogs.append` instead of canonical event emitters, keep the implementation consistent but still add log strings that include:

- `trace`
- `mapping`
- `originalPath`
- `destinationPath`
- failure `error`

### 4. Update runtime/module docs only if needed

Update `docs/architecture/module-map.md` if a new module `sidepanel/actas/actasPending.js` was added.

Suggested addition:

```md
### `sidepanel/actas/actasPending.js`
Coordinates the Actas per-card “Pendiente” action by resolving the mapped source PDF, calling the local Python move-to-pending API, and updating mapping storage with the moved path.
```

Update `docs/architecture/runtime-flows.md` if it has a section where Actas mapped PDF flows are described.

### 5. Run regression checks

Run backend tests:

```bash
cd app-python-zoho
python -m pytest
```

Manual extension checks:

1. Reload the unpacked extension.
2. Open side panel.
3. Confirm no console errors during startup.
4. Confirm existing Actas mappings render.
5. Confirm each card has `Pendiente`, `Convertir`, and `Copiar URL`.
6. Confirm clicking `Pendiente` moves a test PDF.
7. Confirm storage updates.
8. Confirm a missing/deleted PDF shows an error and does not mark the mapping as moved.
9. Confirm `Abrir PDFs descargados` still works.
10. Confirm single Actas conversion still works.
11. Confirm batch Actas conversion still works.
12. Confirm Conversor PDF tab scan/list/convert still works.

## Expected behavior

The feature is fully documented, observable, and verified against core regressions.

## Success criteria

- New HTTP contract is documented.
- New mapping storage schema version is documented.
- New module is documented if created.
- Backend tests pass.
- No side panel startup errors.
- Success and failure paths are observable through logs/events.
- Existing Actas and Conversor behaviors are not regressed.

## How to verify

Backend:

```bash
cd app-python-zoho
python -m pytest
```

Extension:

- Reload unpacked extension.
- Use Chrome/Vivaldi extension console.
- Exercise the Actas tab flows manually.
- Inspect `chrome.storage.local.mappings`.
- Inspect local filesystem for the created `pendientes` folder and moved PDF.

Observability:

- Trigger a successful move and check for a success log/event.
- Trigger a failed move by deleting the source PDF before clicking `Pendiente`.
- Confirm the failure log/event includes expected vs actual enough for an AI agent to diagnose:
  - expected: file exists and can be moved
  - actual: file missing, permission denied, invalid path, or move failed

## Observable failure signals

- Missing or stale contract docs.
- `pytest` failures.
- Console startup errors after adding script files.
- No diagnostic signal when a move fails.
- Mapping storage says moved but filesystem contradicts it.
- Filesystem moved but mapping storage was not updated.
- Old path remains in `sourcePdf.absolutePath`.
- `pendientes` folder is created in the wrong location.

## Files/components involved

Expected files:

- `docs/architecture/message-contracts.md`
- `docs/architecture/storage-contracts.md`
- `docs/architecture/module-map.md`
- `docs/architecture/runtime-flows.md` if applicable
- `zoho-ilovepdf-extension/observability/eventNames.js`
- `app-python-zoho/autohom_bridge/observability/event_names.py`
- Any files changed in Phases 1–3

## Preconditions before implementation

- Phase 1, Phase 2, and Phase 3 are implemented and verified.
- The feature works in at least one manual happy path.
- The backend tests added in Phase 1 exist.
- The UI button exists and is connected to the backend.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- Architecture docs have been removed or replaced by a different documentation system.
- Observability event names are generated rather than manually maintained.
- Extension code does not have a reliable event/logging mechanism.
- Manual verification reveals that moving a mapped PDF should also remove the mapping, contrary to this plan.
