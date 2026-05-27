# Phase 4 — Verify Actas parity, update contracts, and perform end-to-end regression checks

## Objective

Confirm that both conversion entry points — `Conversor pdf` and `Actas` — now save the final Excel beside each source PDF, and update local contract documentation only where it improves future agent accuracy.

This phase should be mostly verification plus minimal docs/diagnostic alignment. Do not introduce broad refactors.

## Expected behavior

For both tabs:

- Single-file conversion saves the Excel beside the original PDF.
- Batch conversion saves every successful Excel beside its corresponding original PDF.
- Conversion progress shows `finalizing` before completion.
- Completion payload includes `finalExcelPath`.
- If finalization fails, the UI reports an error and does not mark the item as successfully completed.

Actas-specific expectation:

- `prepareMappingConversion()` continues to build descriptors from `sourcePdf.absolutePath` and `sourcePdf.directory`.
- Legacy mappings that can be recovered through `chrome.downloads.search()` still resolve a local PDF path and directory.
- Batch Actas conversion still skips/prepares individual mappings as before and sends full descriptors.

## Success criteria

- `docs/architecture/message-contracts.md` accurately describes the final descriptor fields and fallback behavior.
- If any docs mention that missing `outputDirectory` leaves the file in Downloads, update that statement to match the new explicit fail/fallback behavior.
- Manual E2E test succeeds for:
  1. `Conversor pdf` single conversion.
  2. `Conversor pdf` batch conversion.
  3. `Actas` single mapped conversion.
  4. `Actas` batch mapped conversion.
- In all success cases, the Excel exists in the same directory as the source PDF.
- In all success cases, the Chrome Downloads temporary file has been moved away or no longer remains at the original downloaded path.
- Existing status updates still work: pending/error/completed counts render correctly.

## How to verify

### Conversor pdf — single

1. Create or choose a test folder such as `C:\AutohomTest\ConversorSingle`.
2. Place `Acta Single.pdf` there.
3. Scan the folder in `Conversor pdf`.
4. Click `Convertir` for that PDF.
5. Confirm final file: `C:\AutohomTest\ConversorSingle\Acta Single.xlsx` or conflict-safe variant.
6. Confirm the UI marks it as completed.

### Conversor pdf — batch

1. Create or choose a test folder with at least two PDFs.
2. Scan the folder in `Conversor pdf`.
3. Click `Convertir todos`.
4. Confirm each successful PDF has its own Excel in the same folder.
5. Confirm no successful conversion remains only in Chrome Downloads.

### Actas — single

1. Use an existing mapped acta with a valid `sourcePdf.absolutePath`, or create one through the current Actas mapping workflow.
2. Click the per-mapping conversion button.
3. Confirm the Excel is saved beside that mapped PDF.
4. Confirm the mapping conversion status stores `lastExcelPath`.

### Actas — batch

1. Use at least two mapped PDFs with valid local source paths.
2. Click `Convertir todos los PDF mapeados`.
3. Confirm each successful mapping stores an Excel beside the corresponding source PDF.
4. Confirm failures, if any, remain per-mapping and do not hide as successful completions.

## Observable failure signals

- `Conversor pdf` works for single conversion but batch still leaves Excel in Downloads.
- `Actas` batch sends descriptors without `outputDirectory` or `sourcePdfPath`.
- Completed UI status appears while Python finalization failed.
- `lastExcelPath` for Actas is empty after a successful conversion.
- Runtime logs show `ilovepdf.finalize.success` but `finalExcelPath` is not beside the source PDF.
- Message contracts contradict runtime behavior.

## Files/components involved

Primary verification:

- `zoho-ilovepdf-extension/sidepanel/conversor/conversorController.js`
- `zoho-ilovepdf-extension/sidepanel/conversor/pdfRender.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasConversion.js`
- `zoho-ilovepdf-extension/sidepanel/actas/actasBatchConversion.js`
- `zoho-ilovepdf-extension/ilovepdf-background/runtime.js`
- `zoho-ilovepdf-extension/ilovepdf-background/finalizer.js`
- `app-python-zoho/autohom_bridge/services/pdf_service.py`

Documentation:

- `docs/architecture/message-contracts.md`
- `docs/observability/00-current-architecture.md` only if the current architecture description becomes inaccurate.

## Preconditions before implementation

- Phase 1, Phase 2, and Phase 3 are implemented and verified.
- Python app starts cleanly.
- Chrome extension is reloaded after code changes.
- iLovePDF automation is still able to reach upload and download pages.
- Test PDFs are safe disposable copies.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- Actas mappings no longer contain or recover `sourcePdf.absolutePath`.
- iLovePDF changes its download behavior such that Chrome download tracking no longer resolves the file.
- The target folders are blocked by OS permissions.
- A broader workflow requirement appears, such as moving converted files into a separate per-acta folder instead of beside the source PDF.
