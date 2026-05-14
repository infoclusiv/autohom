# Storage Contracts

## `chrome.storage.local.mappings`

## Version 1

```json
{
  "id": 0,
  "filename": "Acta.pdf",
  "zohoUrl": "https://crm.zoho.com/crm/org/tab/Cases/1",
  "savedAt": 0
}
```

## Version 2

```json
{
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
    "lastStatus": "idle|completed|error",
    "lastPdfId": "string|null",
    "lastExcelPath": "C:\\Downloads\\Acta.xlsx",
    "lastError": "string|null",
    "updatedAt": 0
  },
  "captureMode": "automatic|manual",
  "schemaVersion": 2
}
```

## Compatibility rules

- Los mapeos viejos pueden no tener `sourcePdf.absolutePath`.
- `captureMode` es opcional para compatibilidad. Si no existe, asumir `manual` o `legacy`.
- Si hay coincidencia unica en `chrome.downloads.search`, el sidepanel recupera y persiste `sourcePdf`.
- Si no se puede recuperar la ruta, Actas muestra error claro y no depende del escaneo de Conversor.
- `conversion.lastExcelPath` guarda la ubicacion final del Excel movido junto al PDF original.
