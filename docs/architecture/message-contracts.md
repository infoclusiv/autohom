# Message Contracts

## WebSocket Python <-> Extension

## `EXTENSION_CONNECTED`

### Source
Chrome extension bridge runtime.

### Destination
Python WebSocket bridge.

### Payload
```json
{
  "action": "EXTENSION_CONNECTED",
  "extensionId": "zoho-acta-mapper",
  "extensionType": "ilovepdf-converter",
  "runtimeInstanceId": "string",
  "clientId": "string",
  "version": "string"
}
```

### Expected response
The bridge marks the extension as connected and starts keepalive monitoring.

### Failure behavior
The connection is rejected if identity fields do not match the configured extension.

### Related modules
`autohom_bridge.bridge.session`, `autohom_bridge.bridge.identity`

## `PING`

### Source
Python bridge bootstrap or keepalive loop.

### Destination
Chrome extension bridge runtime.

### Payload
```json
{
  "action": "PING",
  "requestId": "string",
  "targetExtensionType": "ilovepdf-converter",
  "targetExtensionId": "zoho-acta-mapper"
}
```

### Expected response
`PONG` with the same request identity semantics.

### Failure behavior
If the timeout expires, the bridge remains disconnected or marks the active connection as unresponsive.

### Related modules
`autohom_bridge.bridge.session`

## `PONG`

### Source
Chrome extension bridge runtime.

### Destination
Python WebSocket bridge.

### Payload
```json
{
  "action": "PONG",
  "requestId": "string",
  "extensionId": "zoho-acta-mapper",
  "extensionType": "ilovepdf-converter"
}
```

### Expected response
The bridge resolves the waiting request and refreshes connection state.

### Failure behavior
If the runtime identity is invalid, the socket is rejected.

### Related modules
`autohom_bridge.bridge.session`, `autohom_bridge.bridge.waiters`

## `CONVERSION_STATUS`

### Source
Chrome extension conversion runtime.

### Destination
Python WebSocket bridge.

### Payload
```json
{
  "action": "CONVERSION_STATUS",
  "pdfId": "string",
  "status": "pending|processing|completed|error",
  "message": "string"
}
```

### Expected response
The bridge updates persisted PDF status and resolves any waiter tied to the request.

### Failure behavior
Unknown PDFs are ignored by the persistence update.

### Related modules
`autohom_bridge.bridge.session`, `autohom_bridge.storage.state_manager`

## Chrome runtime messages

## `ILOVEPDF_CONVERT`

### Source
Side panel conversor UI or acta-triggered conversion flow.

### Destination
Extension background router.

### Payload
```json
{
  "type": "ILOVEPDF_CONVERT",
  "pdfId": "string",
  "filename": "string"
}
```

### Expected response
The router queues one conversion through `ILovePDFRuntime`.

### Failure behavior
If the background is unavailable, the side panel does not receive a queued confirmation.

### Related modules
`sidepanel/conversor/conversorController.js`, `sidepanel/actas/actasConversion.js`, `ilovepdf-background/router.js`

## `ILOVEPDF_CONVERT_ALL`

### Source
Side panel conversor UI.

### Destination
Extension background router.

### Payload
```json
{
  "type": "ILOVEPDF_CONVERT_ALL",
  "pdfs": [
    {
      "pdfId": "string",
      "filename": "string"
    }
  ]
}
```

### Expected response
The router queues all pending PDFs in the sequential runtime queue.

### Failure behavior
If the payload is empty, nothing is queued.

### Related modules
`sidepanel/conversor/conversorController.js`, `ilovepdf-background/router.js`, `ilovepdf-background/runtime.js`

## `ILOVEPDF_STATUS`

### Source
Side panel conversor UI or acta conversion flow.

### Destination
Extension background router.

### Payload
```json
{
  "type": "ILOVEPDF_STATUS"
}
```

### Expected response
```json
{
  "ok": true,
  "runtime": {
    "running": true,
    "currentPdfId": "string|null",
    "queueLength": 0
  },
  "bridgeConnected": true
}
```

### Failure behavior
The caller treats a missing response as disconnected runtime state.

### Related modules
`sidepanel/conversor/bridgeStatus.js`, `sidepanel/actas/actasConversion.js`, `ilovepdf-background/router.js`

## `ILOVEPDF_PROGRESS`

### Source
Extension background runtime/router.

### Destination
Side panel bootstrap listener.

### Payload
```json
{
  "type": "ILOVEPDF_PROGRESS",
  "pdfId": "string",
  "status": "starting|uploading|converting|downloading|completed|error",
  "message": "string"
}
```

### Expected response
The side panel updates the PDF list, logs, counters, and any acta-linked conversion status.

### Failure behavior
If the side panel is closed, the message is dropped.

### Related modules
`sidepanel/bootstrap.js`, `sidepanel/conversor/conversorController.js`, `ilovepdf-background/runtime.js`, `ilovepdf-background/router.js`

## `ILOVEPDF_BRIDGE_STATUS`

### Source
Extension bridge client.

### Destination
Side panel bootstrap listener.

### Payload
```json
{
  "type": "ILOVEPDF_BRIDGE_STATUS",
  "connected": true
}
```

### Expected response
The side panel updates the bridge indicator and may refresh the PDF list.

### Failure behavior
If the side panel is closed, the message is dropped.

### Related modules
`sidepanel/bootstrap.js`, `sidepanel/conversor/bridgeStatus.js`, `ilovepdf-background/bridge.js`

## `ILOVEPDF_SELECTOR_ALERT`

### Source
Extension background router.

### Destination
Side panel bootstrap listener.

### Payload
```json
{
  "type": "ILOVEPDF_SELECTOR_ALERT",
  "level": "warning|error",
  "selectorName": "string",
  "configuredSelector": "string",
  "usedStrategy": "string|null",
  "url": "string",
  "timestamp": 0
}
```

### Expected response
The side panel renders or updates the selector alert and persists the alert history in local storage.

### Failure behavior
If the side panel is closed, the alert is still persisted and will render on next open.

### Related modules
`sidepanel/bootstrap.js`, `sidepanel/alerts/*`, `ilovepdf-background/router.js`

## `DOWNLOAD_PENDING`

### Source
Zoho background download interception flow.

### Destination
Side panel bootstrap listener.

### Payload
```json
{
  "type": "DOWNLOAD_PENDING",
  "downloadId": 0,
  "pendingKey": "pending_123"
}
```

### Expected response
The side panel restores pending metadata from session storage and renders the confirmation card.

### Failure behavior
If the side panel is closed, the pending payload remains in `chrome.storage.session`.

### Related modules
`background-zoho.js`, `sidepanel/bootstrap.js`, `sidepanel/actas/actasController.js`

## `MAPPING_SAVED`

### Source
Zoho background mapping save flow.

### Destination
Side panel bootstrap listener.

### Payload
```json
{
  "type": "MAPPING_SAVED",
  "mapping": {
    "id": 0,
    "filename": "string",
    "zohoUrl": "string",
    "savedAt": 0
  }
}
```

### Expected response
The side panel prepends the new mapping and refreshes Actas stats/UI.

### Failure behavior
If the side panel is closed, the mapping remains persisted in `chrome.storage.local`.

### Related modules
`background-zoho.js`, `sidepanel/bootstrap.js`, `sidepanel/actas/actasController.js`

## `CONFIRM_MAPPING`

### Source
Actas pending-download UI.

### Destination
Zoho background handler.

### Payload
```json
{
  "type": "CONFIRM_MAPPING",
  "downloadId": 0,
  "pendingKey": "pending_123"
}
```

### Expected response
The background stores the mapping, removes the pending session entry, and emits `MAPPING_SAVED`.

### Failure behavior
If the message fails, the pending session entry remains visible on next restore.

### Related modules
`sidepanel/actas/actasRender.js`, `background-zoho.js`

## `REJECT_MAPPING`

### Source
Actas pending-download UI.

### Destination
Zoho background handler.

### Payload
```json
{
  "type": "REJECT_MAPPING",
  "pendingKey": "pending_123"
}
```

### Expected response
The background removes the pending session entry.

### Failure behavior
If the message fails, the pending session entry remains visible on next restore.

### Related modules
`sidepanel/actas/actasRender.js`, `background-zoho.js`

## `DELETE_MAPPING`

### Source
Actas UI.

### Destination
Zoho background handler.

### Payload
```json
{
  "type": "DELETE_MAPPING",
  "id": 0
}
```

### Expected response
The background deletes the mapping from local storage.

### Failure behavior
If the message fails, the UI and persisted state may diverge until the next reload.

### Related modules
`sidepanel/actas/actasController.js`, `background-zoho.js`
