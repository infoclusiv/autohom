# Current Architecture

## Overview

The current `autohom` runtime is composed of:

1. A local Python bridge started from `app-python-zoho/app.py`.
2. An `aiohttp` HTTP API created in `autohom_bridge/api/app_factory.py`.
3. A WebSocket bridge managed by `autohom_bridge/bridge/session.py`.
4. A Chrome extension with a service worker entry in `zoho-ilovepdf-extension/background-main.js`.
5. A side panel UI in `zoho-ilovepdf-extension/sidepanel.html`.
6. iLovePDF runtime modules under `zoho-ilovepdf-extension/ilovepdf-background/`.

## Runtime Sequence

### FLOW-001: Python app startup

- Trigger: `python app.py`
- Components: `python.bootstrap`, `python.state`, `python.ws`, `python.http`
- Inputs: local config, persisted `state.json`
- Outputs: running HTTP API on `localhost:7790`, WebSocket server on `localhost:8769`
- Expected state transitions: `startup -> listening -> ready`
- Failure modes: state load failure, WebSocket bind failure, HTTP startup failure
- Required observability events: `python.startup.*`, `state.*`, `ws.server.*`

### FLOW-002: Chrome extension bootstrap

- Trigger: Chrome loads the MV3 service worker
- Components: `extension.service_worker`, `extension.bridge`, `extension.runtime`
- Inputs: `manifest.json`, background scripts, local bridge URL
- Outputs: WebSocket connect attempt, alarm-based reconnect registration
- Failure modes: `importScripts` failure, bridge init failure
- Required observability events: `extension.bootstrap.*`, `extension.bridge.*`

### FLOW-003: WebSocket handshake

- Trigger: extension opens socket to Python
- Components: `python.ws`, `extension.bridge`
- Inputs: `EXTENSION_CONNECTED`, `PING`, `PONG`
- Outputs: authenticated active connection, runtime identity tracking
- Expected messages: `EXTENSION_CONNECTED`, `PING`, `PONG`
- Timeout expectations: bootstrap ping timeout uses `BOOTSTRAP_PING_TIMEOUT_S`
- Failure modes: invalid identity, duplicate runtime, timeout
- Required observability events: `ws.handshake.*`, `extension.bridge.*`

### FLOW-004: Side panel checks bridge state

- Trigger: side panel boot or periodic user interaction
- Components: `sidepanel.ui`, `python.http`, `python.ws`
- Inputs: `GET /api/bridge`
- Outputs: bridge status badge and recent bridge events
- Failure modes: API unavailable, stale bridge state
- Required observability events: `http.request.*`, `ws.connection.*`

### FLOW-005: Folder scan

- Trigger: user configures folder or presses scan
- Components: `sidepanel.ui`, `python.http`, `python.pdf_service`, `python.state`
- Inputs: folder path
- Outputs: scanned PDF list persisted in state
- Failure modes: invalid folder, scan mismatch, state save failure
- Required observability events: `state.folder.changed`, `state.pdf.upserted`

### FLOW-006 / FLOW-007: Convert one PDF / Convert all PDFs

- Trigger: side panel action or mapped PDF batch flow
- Components: `sidepanel.ui`, `python.ws`, `extension.bridge`, `extension.runtime`
- Inputs: PDF metadata, bridge availability
- Outputs: queued conversion, progress, final completion or failure
- Expected state transitions: `pending -> starting -> uploading -> converting -> downloading -> finalizing -> completed|error`
- Failure modes: disconnected bridge, missing content script, tab closure, timeout
- Required observability events: `workflow.*`, `ws.message.*`, `extension.queue.*`, `ilovepdf.*`

### FLOW-008 / FLOW-009 / FLOW-010 / FLOW-011

- Trigger: Zoho download and mapping workflow
- Components: `content.zoho`, `sidepanel.ui`, `python.http`, `python.state`, `extension.runtime`
- Inputs: local PDF path, Zoho URL, mapping metadata
- Outputs: saved mapping, local PDF registration, optional CSV export, mapping-based conversion
- Failure modes: invalid file path, serialization mismatch, missing registered PDF
- Required observability events: `state.pdf.upserted`, `http.request.*`, `workflow.step.*`

### FLOW-015: Auto-map Zoho PDF download

- Trigger: `chrome.downloads.onCreated` or `chrome.downloads.onChanged` completes a PDF download from Zoho CRM
- Components: `extension.zoho_download_mapper`, `chrome.storage.session`, `chrome.storage.local`
- Inputs: download id, resolved Zoho case URL, local download metadata
- Outputs: schema v2 mapping with `sourcePdf.absolutePath`, duplicate skip when repeated events point to the same download
- Failure modes: missing active Zoho tab, incomplete download metadata, duplicate events, storage failure
- Required observability events: `actas.mapping.auto_*`, `actas.mapping.duplicate_skipped`

### FLOW-016: Open mapped local PDFs in browser

- Trigger: user presses `Abrir PDFs descargados` in Actas
- Components: `sidepanel.ui`, `python.http`, `python.pdf_service`
- Inputs: mapping id, recovered `sourcePdf.absolutePath`, `POST /api/pdfs/register-local`
- Outputs: browser tabs opened with `GET /api/pdfs/{pdf_id}/file?disposition=inline`
- Failure modes: missing local file, failed local registration, invalid inline URL, tab creation failure
- Required observability events: `actas.open_pdfs.*`, `http.request.*`

### FLOW-012: Finalize iLovePDF Excel download

- Trigger: extension runtime confirms download
- Components: `extension.download_tracker`, `extension.finalizer`, `python.http`, `python.pdf_service`
- Inputs: downloaded XLSX path, target directory, source PDF metadata
- Outputs: moved Excel file next to source PDF
- Failure modes: download not found, permission error, path conflict
- Required observability events: `ilovepdf.download.*`, `ilovepdf.finalize.*`

### FLOW-013: Recovery after extension reconnect

- Trigger: socket closes or service worker restarts
- Components: `python.ws`, `extension.bridge`, `sidepanel.ui`
- Inputs: reconnect timer, alarm wakeup
- Outputs: new active connection, refreshed bridge badge
- Failure modes: repeated reconnect loop, stale runtime identity
- Required observability events: `ws.connection.closed`, `extension.bridge.reconnect_*`

### FLOW-014: Future chained workflow

- Trigger: orchestrated multi-step workflow from Python
- Components: `workflow.orchestrator`, `extension.ilovepdf`, `future_extension.placeholder`
- Inputs: workflow definition and trace context
- Outputs: correlated workflow with step-level status
- Failure modes: missing extension capability, bad handoff, contract mismatch
- Required observability events: `workflow.*`

## Known Failure Surfaces

- `autohom_bridge/bridge/session.py`
- `autohom_bridge/api/routes.py`
- `autohom_bridge/storage/state_manager.py`
- `zoho-ilovepdf-extension/ilovepdf-background/bridge.js`
- `zoho-ilovepdf-extension/ilovepdf-background/runtime.js`
- `zoho-ilovepdf-extension/sidepanel/*`
