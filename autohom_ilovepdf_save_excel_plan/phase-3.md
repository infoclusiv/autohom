# Phase 3 — Add defensive finalization fallback so downloads are not silently left in Downloads

## Objective

Prevent successful-looking conversions from silently leaving the Excel in Chrome's default Downloads folder when `outputDirectory` is missing but the source PDF path is known.

This phase is a safety net. It must not replace the descriptor fixes from Phase 1 and Phase 2.

## Expected behavior

`ILovePDFFinalizer.finalizeDownload(pdfDescriptor, downloadResult)` should:

1. Prefer `pdfDescriptor.outputDirectory` as the target directory.
2. If `outputDirectory` is missing but `pdfDescriptor.sourcePdfPath` is present, derive the target directory from `sourcePdfPath`.
3. Call Python `/api/conversions/finalize-download` with that target directory.
4. Only skip or fail when neither `outputDirectory` nor a derivable `sourcePdfPath` exists.

`PdfService.finalize_download()` should also defensively derive `target_directory` from `source_pdf_path` if `target_directory` is empty, so the backend contract is robust even if a future caller omits the target directory.

## Success criteria

- `finalizer.js` no longer returns `ok: true, skipped: true` for a descriptor that has `sourcePdfPath`.
- `finalizer.js` emits/logs enough metadata to identify the target derivation strategy.
- `PdfService.finalize_download()` accepts an empty `target_directory` only when `source_pdf_path` is valid and absolute, then uses `dirname(source_pdf_path)`.
- If both `target_directory` and valid `source_pdf_path` are missing, finalization fails clearly instead of reporting success.
- Existing behavior for path conflicts remains unchanged: `_next_available_output_path()` is still used.
- The final Excel path returned by Python is propagated as `finalExcelPath` in the completed progress message.

## How to verify

1. Unit/manual backend check:
   - Call `PdfService.finalize_download()` or `POST /api/conversions/finalize-download` with:
     - a real downloaded `.xlsx` path,
     - empty/null `targetDirectory`,
     - valid `sourcePdfPath`.
   - Confirm the Excel moves to `dirname(sourcePdfPath)`.
2. Frontend safety check:
   - Temporarily queue a descriptor that has `sourcePdfPath` but no `outputDirectory`.
   - Confirm `finalizer.js` still calls the backend and the Excel is moved beside the PDF.
3. Negative check:
   - Queue or simulate a descriptor with neither `outputDirectory` nor `sourcePdfPath`.
   - Confirm the conversion ends with an explicit finalization error, not a silent success.

## Observable failure signals

- Finalizer logs still show `skipped: true` when `sourcePdfPath` exists.
- Runtime marks a conversion as `completed` while `finalExcelPath` points to the Chrome Downloads folder.
- Python returns `DOWNLOAD_FINALIZE_INVALID` even though `sourcePdfPath` is valid.
- A missing path produces a generic or misleading success message.
- Existing conflict naming behavior stops working and overwrites a previous Excel.

## Files/components involved

Primary:

- `zoho-ilovepdf-extension/ilovepdf-background/finalizer.js`
- `app-python-zoho/autohom_bridge/services/pdf_service.py`
- `app-python-zoho/autohom_bridge/api/routes.py`

Secondary verification:

- `zoho-ilovepdf-extension/ilovepdf-background/runtime.js`
- `docs/architecture/message-contracts.md`

Suggested implementation shape:

- In `finalizer.js`, add a small local helper to derive a parent directory from a Windows or POSIX path string:
  - split on both `\\` and `/`, but preserve Windows drive roots.
  - keep implementation narrow; do not import path libraries into the extension.
- Compute `targetDirectory = pdfDescriptor.outputDirectory || deriveParentDirectory(pdfDescriptor.sourcePdfPath)`.
- If `targetDirectory` is still empty, return `{ ok: false, error: 'Target directory missing...' }` instead of `{ ok: true, skipped: true }`.
- In `PdfService.finalize_download()`, if `target_directory` is empty and `source_pdf_path` is present, validate `source_pdf_path` with `validate_pdf_path()` and use `os.path.dirname(validated_source_pdf_path)`.
- Keep using `_next_available_output_path(normalized_target, stem, ".xlsx")`.

## Preconditions before implementation

- Phase 1 is verified.
- Phase 2 is verified.
- Confirm `downloadResult.filename` is a real absolute local path from `chrome.downloads`.
- Confirm Python has permission to move the downloaded Excel from Chrome Downloads into the target PDF folder.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- `chrome.downloads` no longer exposes a usable local `filename` path.
- Browser settings prevent the extension/Python flow from knowing the downloaded file path.
- `PdfService.finalize_download()` has already been redesigned and no longer performs file movement.
- There is an intentional requirement to leave downloads in Chrome Downloads for some source type.
