# Phase 2 — Send complete conversion descriptors from the Conversor pdf tab

## Objective

Make the `Conversor pdf` tab send full descriptors to the background runtime for both single-file and batch conversion, including `outputDirectory` and `sourcePdfPath`.

This phase fixes the main descriptor loss in the `Conversor pdf` UI.

## Expected behavior

When the user clicks `Convertir` for a single PDF in `Conversor pdf`, the runtime receives:

```json
{
  "type": "ILOVEPDF_CONVERT",
  "pdfId": "...",
  "filename": "Acta.pdf",
  "source": "conversor-scan",
  "outputDirectory": "C:\\Folder",
  "sourcePdfPath": "C:\\Folder\\Acta.pdf"
}
```

When the user clicks `Convertir todos`, `ILOVEPDF_CONVERT_ALL` receives an array where each item has the same complete metadata.

## Success criteria

- Single conversion in `Conversor pdf` no longer calls `convertOne(pdf.id, pdf.filename)` in a way that loses metadata.
- Batch conversion in `Conversor pdf` no longer maps pending PDFs to only `{ pdfId, filename }`.
- A small helper builds a normalized descriptor from a stored PDF object.
- The helper derives `outputDirectory` from the best available field in this order:
  1. `pdf.requestedOutputDirectory`
  2. `pdf.directory`
  3. parent directory of `pdf.filepath`
- The helper sets `sourcePdfPath` from `pdf.filepath` when available.
- Existing Actas calls to `AutohomConversor.convertOne(descriptor)` remain compatible.
- `convertOne(pdfOrId, maybeFilename)` either remains backward compatible or all call sites are updated safely.
- No iLovePDF DOM selectors or content script logic are changed in this phase.

## How to verify

1. Load/reload the extension.
2. Start the Python app and scan a folder in `Conversor pdf`.
3. Use DevTools/service worker logs or temporary local logging to inspect messages sent to the runtime.
4. Click `Convertir` on one scanned PDF.
5. Confirm the sent `ILOVEPDF_CONVERT` payload includes `outputDirectory` and `sourcePdfPath`.
6. Reset one or more PDFs to pending/error and click `Convertir todos`.
7. Confirm every item in `ILOVEPDF_CONVERT_ALL.pdfs` includes `outputDirectory` and `sourcePdfPath`.
8. Confirm Actas single conversion still sends a descriptor and does not regress.

## Observable failure signals

- Service worker logs show `outputDirectory: null` or `sourcePdfPath: null` for `source: "conversor-scan"`.
- Runtime logs show `[Runtime] queue.enqueued` without local path metadata.
- Finalizer logs later show `No outputDirectory provided; leaving file in Chrome default download location.`
- Clicking `Convertir` from `Conversor pdf` stops working due to a changed function signature.
- Actas conversion stops queuing because `convertOne(descriptor)` is no longer accepted.

## Files/components involved

Primary:

- `zoho-ilovepdf-extension/sidepanel/conversor/conversorController.js`
- `zoho-ilovepdf-extension/sidepanel/conversor/pdfRender.js`
- `zoho-ilovepdf-extension/sidepanel/conversor/pdfStore.js`

Secondary verification:

- `zoho-ilovepdf-extension/ilovepdf-background/router.js`
- `zoho-ilovepdf-extension/ilovepdf-background/runtime.js`

Suggested implementation shape:

- Add a helper such as `buildConversionDescriptor(pdf)` in `conversorController.js`.
- In `pdfRender.js`, pass the whole `pdf` object to `window.AutohomConversor.convertOne(pdf)` instead of passing only ID and filename.
- In `convertAll()`, map pending PDFs through `buildConversionDescriptor(pdf)` instead of mapping only `{ pdfId, filename }`.
- Keep `convertOne(pdfOrId, maybeFilename)` backward compatible by resolving an ID back to `AutohomConversorStore.getPdfs()` when needed.

## Preconditions before implementation

- Confirm `AutohomConversorStore.getPdfs()` returns the objects loaded from `GET /api/pdfs`.
- Confirm each scanned PDF object includes `filepath` after Phase 1.
- Confirm Actas still calls `window.AutohomConversor.convertOne(descriptor)` with a full descriptor.
- Confirm `ILOVEPDF_CONVERT_ALL` can accept full descriptor objects through `router.js` and `runtime.js` without filtering them out.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- `pdfRender.js` has already been changed to pass complete descriptors.
- `convertAll()` already sends `outputDirectory` and `sourcePdfPath` for all pending PDFs.
- The side panel no longer owns conversion dispatch.
- Runtime rejects descriptor objects with fields beyond `pdfId` and `filename`.
