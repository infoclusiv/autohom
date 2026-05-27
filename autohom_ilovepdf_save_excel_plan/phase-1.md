# Phase 1 — Normalize source PDF path metadata in Python state

## Objective

Ensure every PDF returned by the Python API has enough local path metadata for the extension to derive the target Excel folder: `filepath`, `directory`, and `requestedOutputDirectory`.

This phase must not change iLovePDF browser automation or Chrome download behavior.

## Expected behavior

After scanning a folder from the `Conversor pdf` tab, `GET /api/pdfs` should return each scanned PDF with:

```json
{
  "id": "...",
  "filename": "Acta.pdf",
  "filepath": "C:\\Folder\\Acta.pdf",
  "directory": "C:\\Folder",
  "requestedOutputDirectory": "C:\\Folder",
  "source": "conversor-scan"
}
```

Existing scanned entries that only have `filepath` should be enriched on the next scan/list cycle without breaking current statuses more than the current scan behavior already does.

## Success criteria

- `scan_folder()` continues to find PDFs exactly as before.
- `StateManager.merge_scanned_pdfs()` persists `directory` and `requestedOutputDirectory` for new scanned PDFs.
- Existing scanned PDFs refreshed by a scan also receive/refresh `directory` and `requestedOutputDirectory`.
- `PdfService.sorted_pdf_list()` or an equivalent narrow normalization point ensures the API response has these fields even for older state entries where possible.
- Acta-mapping entries are not overwritten or downgraded during a normal folder scan.
- No change is made to finalizer behavior in this phase.

## How to verify

1. Start the Python app.
2. In the `Conversor pdf` tab, choose a local folder containing at least one PDF and scan it.
3. Open or request `GET http://127.0.0.1:7790/api/pdfs`.
4. Confirm every scanned `source: "conversor-scan"` item has:
   - `filepath` as the full PDF path.
   - `directory` equal to `dirname(filepath)`.
   - `requestedOutputDirectory` equal to `dirname(filepath)`.
5. Inspect the persisted state file, if available, and confirm the same metadata is saved.
6. Verify that Actas mappings previously saved in `chrome.storage.local` still render normally in the side panel.

## Observable failure signals

- `/api/pdfs` returns scanned PDFs with `filepath` but missing `directory` or `requestedOutputDirectory`.
- Scanned PDFs appear as `missing` even though they exist in the selected folder.
- Acta-mapping PDFs are converted into `conversor-scan` entries or lose mapping metadata.
- Python logs show state save errors, folder scan errors, or unexpected exceptions in `StateManager.merge_scanned_pdfs()`.
- Side panel shows zero PDFs after scanning a valid folder.

## Files/components involved

Primary:

- `app-python-zoho/autohom_bridge/services/pdf_scanner.py`
- `app-python-zoho/autohom_bridge/storage/state_manager.py`
- `app-python-zoho/autohom_bridge/services/pdf_service.py`
- `app-python-zoho/autohom_bridge/api/routes.py`

Likely changes:

- Add `directory` to scanner output or derive it inside state merge.
- Add/refresh `requestedOutputDirectory` for `conversor-scan` entries.
- Add a small defensive normalization helper if older entries can still be returned without directory fields.

## Preconditions before implementation

- Confirm `scan_folder(folder_path)` still returns dictionaries with at least `id`, `filename`, and `filepath`.
- Confirm `StateManager.merge_scanned_pdfs()` is still the persistence path for scanned PDFs.
- Confirm `PdfService.sorted_pdf_list()` is still used by `GET /api/pdfs`.
- Confirm `requestedOutputDirectory` is not used for a different meaning elsewhere.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- Scanned PDFs are no longer stored through `StateManager.merge_scanned_pdfs()`.
- The API no longer exposes `filepath` for scanned PDFs.
- The state model has already been replaced by another metadata schema.
- A different component already computes and sends the output directory reliably for all Conversor flows.
