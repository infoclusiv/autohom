# README_AGENT — Autohom iLovePDF Excel output folder plan

## Mandatory execution protocol

Read this file first.

Execute the phase `.md` files in order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`
4. `phase-4.md`

Implement only one phase at a time.

Before coding each phase:

- Read the phase document completely.
- Analyze the repository and fully understand the related architecture and affected components.
- Validate that the proposed implementation matches the real root cause and current codebase behavior.
- Confirm that the listed files still exist and that function names, message contracts, and data shapes still match the current repo.

During implementation:

- Follow the phase scope strictly.
- Avoid unrelated refactors or unnecessary changes.
- Preserve existing functionality and minimize regression risk.
- Prefer small, explicit helpers over broad rewrites.
- Preserve the existing Chrome extension MV3/service-worker flow, the Python `aiohttp` API flow, and existing Actas behavior.
- Do not modify unrelated Zoho automation, mapping export, browser capture, or observability infrastructure unless the phase explicitly requires it.

After implementation:

- Verify all success criteria defined in the phase document.
- Confirm observable signals and expected behavior.
- Report any inconsistencies, architectural conflicts, missing information, or signs that the proposed plan may be incorrect before continuing.
- Do not move to the next phase until the current phase is implemented and verified.

## Repository architecture snapshot from analysis

The current repository is a hybrid system:

- Local Python bridge under `app-python-zoho/`.
- `aiohttp` HTTP API created by `app-python-zoho/autohom_bridge/api/app_factory.py`.
- PDF state managed by `app-python-zoho/autohom_bridge/storage/state_manager.py`.
- PDF folder scanning and finalization handled by `app-python-zoho/autohom_bridge/services/pdf_service.py`.
- Chrome MV3 extension under `zoho-ilovepdf-extension/`.
- Service worker entry: `zoho-ilovepdf-extension/background-main.js`.
- iLovePDF background modules: `zoho-ilovepdf-extension/ilovepdf-background/`.
- iLovePDF content scripts: `zoho-ilovepdf-extension/ilovepdf/`.
- Side panel tab logic:
  - `zoho-ilovepdf-extension/sidepanel/conversor/` for the `Conversor pdf` tab.
  - `zoho-ilovepdf-extension/sidepanel/actas/` for the `Actas` tab.

## Current relevant workflow

1. Python scans or registers local PDFs.
2. Side panel sends `ILOVEPDF_CONVERT` or `ILOVEPDF_CONVERT_ALL` to the extension service worker.
3. `ilovepdf-background/router.js` passes descriptors into `ILovePDFRuntime.queueConversion()` or `queueAll()`.
4. `ilovepdf-background/runtime.js` uploads the source PDF, waits for iLovePDF `/descarga/`, starts the download, waits for Chrome to confirm the real downloaded Excel, then calls `ILovePDFFinalizer.finalizeDownload()`.
5. `ilovepdf-background/finalizer.js` posts to Python `POST /api/conversions/finalize-download`.
6. `PdfService.finalize_download()` moves the downloaded Excel to the requested target directory and names it from the original PDF stem.

## Root cause hypothesis to validate before coding

The backend already supports moving the downloaded Excel into a target directory. The current risk is that one or more frontend descriptors do not consistently carry `outputDirectory` and `sourcePdfPath`.

Important observed behavior:

- `PdfService.finalize_download()` already accepts `downloaded_file_path`, `target_directory`, `source_pdf_path`, and `original_pdf_filename`, then moves the Excel to `target_directory` using the source PDF stem.
- `ILovePDFFinalizer.finalizeDownload()` currently skips finalization when `pdfDescriptor.outputDirectory` is missing, leaving the file in Chrome's default download location.
- `Actas` single and batch conversion already build descriptors containing `outputDirectory: sourcePdf.directory` and `sourcePdfPath: sourcePdf.absolutePath`.
- `Conversor pdf` single conversion currently passes only `pdf.id` and `pdf.filename` from `pdfRender.js` to `convertOne()`.
- `Conversor pdf` batch conversion currently maps each pending PDF to only `{ pdfId: pdf.id, filename: pdf.filename }`.
- Scanned PDFs currently have `filepath`, but scanned state entries do not consistently persist explicit `directory` or `requestedOutputDirectory` metadata.

The implementation should therefore preserve the existing finalization architecture and fix descriptor completeness at the source, with defensive finalization fallback only as a safety net.

## Stop immediately if any of these assumptions are false

Stop and report before coding if:

- `PdfService.finalize_download()` no longer exists or no longer moves downloaded files.
- `ILovePDFFinalizer.finalizeDownload()` no longer posts to `/api/conversions/finalize-download`.
- `Conversor pdf` no longer uses `AutohomConversor.convertOne()` and `ILOVEPDF_CONVERT_ALL`.
- `Actas` no longer uses `AutohomActasConversion.prepareMappingConversion()`.
- The repository has already implemented equivalent descriptor propagation for both tabs and the remaining bug has a different cause.
- The downloaded path returned by `chrome.downloads` is not an absolute local path on the target platform.
- Chrome extension permissions or browser behavior prevent access to the downloaded file path in the current environment.

## Global desired behavior

When any PDF is converted through iLovePDF from either:

- the `Conversor pdf` tab, or
- the `Actas` tab, including per-file and batch flows,

the final Excel must be moved out of Chrome's default Downloads folder and saved beside the original source PDF on the PC.

Examples:

- Source PDF: `C:\Actas\2026\Acta 001.pdf`
- Chrome temporary download: `C:\Users\User\Downloads\Acta 001.xlsx`
- Final Excel after finalization: `C:\Actas\2026\Acta 001.xlsx`

If a file with the target Excel name already exists, preserve the existing `_next_available_output_path()` behavior and save as `Acta 001 (1).xlsx`, `Acta 001 (2).xlsx`, etc.
