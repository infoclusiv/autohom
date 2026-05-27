# Message Contracts

## WebSocket Python <-> Extension

## `CONVERSION_STATUS`

### Payload
```json
{
  "action": "CONVERSION_STATUS",
  "pdfId": "string",
  "status": "pending|processing|completed|error",
  "message": "string"
}
```

## Chrome runtime messages

## `ILOVEPDF_CONVERT`

### Payload
```json
{
  "type": "ILOVEPDF_CONVERT",
  "pdfId": "string",
  "filename": "string",
  "source": "conversor-scan|acta-mapping",
  "mappingId": 0,
  "outputDirectory": "C:\\folder",
  "sourcePdfPath": "C:\\folder\\Acta.pdf",
  "traceId": "acta-0-0"
}
```

## `ILOVEPDF_PROGRESS`

### Payload
```json
{
  "type": "ILOVEPDF_PROGRESS",
  "pdfId": "string",
  "status": "starting|uploading|converting|downloading|finalizing|completed|error",
  "message": "string",
  "filename": "string",
  "source": "conversor-scan|acta-mapping",
  "mappingId": 0,
  "outputDirectory": "C:\\folder",
  "sourcePdfPath": "C:\\folder\\Acta.pdf",
  "finalExcelPath": "C:\\folder\\Acta.xlsx",
  "downloadedFilename": "C:\\Downloads\\converted.xlsx",
  "traceId": "acta-0-0"
}
```

## `DOWNLOAD_PENDING`

Legacy compatibility only. The normal Zoho PDF flow now auto-confirms mappings and should not emit this message on successful downloads.

### Payload
```json
{
  "type": "DOWNLOAD_PENDING",
  "downloadId": 0,
  "pendingKey": "pending_123"
}
```

## `MAPPING_SAVED`

### Payload
```json
{
  "type": "MAPPING_SAVED",
  "mapping": {
    "id": 0,
    "filename": "Acta.pdf",
    "zohoUrl": "https://crm.zoho.com/crm/org/tab/Cases/1",
    "savedAt": 0,
    "sourcePdf": {
      "downloadId": 123,
      "filename": "Acta.pdf",
      "absolutePath": "C:\\Downloads\\Acta.pdf",
      "directory": "C:\\Downloads",
      "sizeBytes": 123,
      "mime": "application/pdf",
      "downloadedAt": 0,
      "captureMethod": "chrome.downloads.search"
    },
    "conversion": {
      "lastStatus": "idle",
      "lastPdfId": null,
      "lastExcelPath": null,
      "lastError": null,
      "updatedAt": null
    },
    "pendingMove": null,
    "captureMode": "automatic|manual",
    "schemaVersion": 3
  }
}
```

## `MAPPING_AUTO_FAILED`

### Payload
```json
{
  "type": "MAPPING_AUTO_FAILED",
  "downloadId": 123,
  "pendingKey": "pending_123",
  "error": "No se pudo obtener la ruta local del PDF"
}
```

## Python HTTP contracts

## `POST /api/pdfs/register-local`

### Request
```json
{
  "path": "C:\\Downloads\\Acta.pdf",
  "source": "acta-mapping",
  "mappingId": 0,
  "zohoUrl": "https://crm.zoho.com/crm/org/tab/Cases/1",
  "requestedOutputDirectory": "C:\\Downloads",
  "traceId": "acta-0-0"
}
```

Behavior:
- `outputDirectory` is preferred when present.
- If `outputDirectory` is missing, the extension finalizer derives the target folder from `sourcePdfPath`.
- If neither `outputDirectory` nor `sourcePdfPath` is available, finalization fails explicitly instead of leaving the Excel in Chrome Downloads as a silent success.

## `ILOVEPDF_CONVERT_ALL`

### Payload
```json
{
  "type": "ILOVEPDF_CONVERT_ALL",
  "pdfs": [
    {
      "pdfId": "string",
      "filename": "string",
      "source": "conversor-scan|acta-mapping",
      "mappingId": 0,
      "outputDirectory": "C:\\folder",
      "sourcePdfPath": "C:\\folder\\Acta.pdf",
      "traceId": "acta-0-0",
      "batchId": "actas-batch-0"
    }
  ]
}
```

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

## `GET /api/pdfs/{pdf_id}/file`

Query param:
- `disposition=attachment|inline`

Behavior:
- `attachment` keeps the previous download behavior.
- `inline` serves the local PDF for in-browser viewing.

### Response
```json
{
  "ok": true,
  "pdf": {
    "id": "stable-pdf-id",
    "filename": "Acta.pdf",
    "filepath": "C:\\Downloads\\Acta.pdf",
    "directory": "C:\\Downloads",
    "status": "pending",
    "source": "acta-mapping",
    "mappingId": 0,
    "requestedOutputDirectory": "C:\\Downloads",
    "traceId": "acta-0-0"
  }
}
```

## `POST /api/conversions/finalize-download`

### Request
```json
{
  "pdfId": "stable-pdf-id",
  "mappingId": 0,
  "source": "acta-mapping",
  "downloadedFilePath": "C:\\Downloads\\converted.xlsx",
  "targetDirectory": "C:\\Actas",
  "sourcePdfPath": "C:\\Actas\\Acta.pdf",
  "originalPdfFilename": "Acta.pdf",
  "traceId": "acta-0-0"
}
```

### Response
```json
{
  "ok": true,
  "excelPath": "C:\\Actas\\Acta.xlsx",
  "moved": true
}
```

Behavior:
- `targetDirectory` is used as the primary destination when provided.
- If `targetDirectory` is empty, the backend derives the destination from `dirname(sourcePdfPath)` after validating that the source PDF still exists.
- Filename conflicts still use the existing suffix behavior such as `Acta (1).xlsx`.
