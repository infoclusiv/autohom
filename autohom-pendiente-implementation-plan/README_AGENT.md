# README_AGENT.md

# Autohom Actas “Pendiente” Implementation Package

## Purpose

Implement a new per-mapped-PDF action in the Autohom web extension Actas tab.

Each mapped PDF card must show a button named **`Pendiente`**. When clicked, the mapped local PDF must be moved into a folder named **`pendientes`** located in the same directory where the mapped PDF currently exists on the PC. If that folder does not exist, the local Python app must create it automatically before moving the file.

## Mandatory execution order

Read this file first, then execute the phase files in this exact order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`

Do not skip phases.

## Implementation rules for the agent

For each phase:

1. Read the phase document completely before coding.
2. Analyze the repository and fully understand the affected components before editing.
3. Validate that the proposed implementation still matches the real codebase.
4. Implement only one phase at a time.
5. Stay strictly inside the phase scope.
6. Avoid unrelated refactors, renames, formatting churn, or architecture changes.
7. Preserve existing behavior:
   - Actas mapping creation must continue working.
   - Actas single conversion must continue working.
   - Actas batch conversion must continue working.
   - “Abrir PDFs descargados” must continue working.
   - Conversor PDF must continue working.
   - Existing mappings without `sourcePdf.absolutePath` must continue to use the existing legacy recovery behavior where applicable.
8. After coding each phase, verify every success criterion from that phase.
9. Confirm expected observable signals.
10. Report any mismatch, missing file, architecture conflict, or suspected wrong assumption before continuing.
11. Do not move to the next phase until the current phase is implemented and verified.

## Repository alignment summary

The current architecture is split between:

- Chrome extension UI and browser automation under `zoho-ilovepdf-extension/`.
- Actas side panel modules under `zoho-ilovepdf-extension/sidepanel/actas/`.
- Local Python app/API under `app-python-zoho/autohom_bridge/`.
- PDF service logic under `app-python-zoho/autohom_bridge/services/pdf_service.py`.
- API routing under:
  - `app-python-zoho/autohom_bridge/api/routes.py`
  - `app-python-zoho/autohom_bridge/api/app_factory.py`
- Python tests under `app-python-zoho/tests/test_pdf_service.py`.
- Architecture/contract docs under `docs/architecture/`.

The browser extension cannot safely move arbitrary local files by absolute path on its own. The feature must be implemented through the existing local Python API pattern already used by Actas conversion and local PDF registration.

## Target causal contract

When a user clicks **Pendiente** on a mapped Actas PDF:

1. The extension resolves the mapped PDF source path.
2. The extension sends that absolute path to the local Python API.
3. Python validates the path points to an existing readable `.pdf`.
4. Python creates `<current-pdf-directory>/pendientes` if missing.
5. Python moves the PDF into that folder using a collision-safe filename.
6. Python returns the destination path and related metadata.
7. The extension updates `chrome.storage.local.mappings` so the mapping now points to the moved PDF location.
8. The card shows a clear success state.
9. Future actions that rely on the mapping path use the new path, not the old path.

If any step fails, the PDF must not be silently marked as moved.

## Global stop conditions

Stop implementation and report before continuing if any of these are true:

- The repository no longer contains `zoho-ilovepdf-extension/sidepanel/actas/`.
- The Actas card rendering is no longer controlled by `actasRender.js`.
- The local Python API is no longer based on `aiohttp` routes in `app_factory.py` and `routes.py`.
- `PdfService` is no longer the central place for local PDF filesystem operations.
- `chrome.storage.local.mappings` no longer stores Actas mappings.
- There is already an equivalent “move to pending/pendientes” implementation that only needs bug fixing.
- Moving files directly from the extension is already implemented through a different trusted local-file mechanism.
- Any current behavior proves that moving the PDF should instead move an Excel file or a scanned Conversor PDF unrelated to the mapped Actas source PDF.

## Suggested final verification after all phases

Use a real or temporary mapped PDF and verify:

1. A mapped PDF card shows **Pendiente**.
2. Click **Pendiente**.
3. If the original directory has no `pendientes` folder, the folder is created.
4. The PDF appears in `pendientes`.
5. The PDF disappears from the original location.
6. If a file with the same name already exists in `pendientes`, the moved file gets a safe suffix instead of overwriting.
7. The mapping in `chrome.storage.local.mappings` now points to the moved path.
8. The same mapping can still be opened or converted using the updated path.
9. The UI shows a clear success or error signal.
10. Existing Actas and Conversor workflows still work.
