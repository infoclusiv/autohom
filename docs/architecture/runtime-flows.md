# Runtime Flows

## 1. Python app startup
`python app.py` calls `autohom_bridge.bootstrap.run`, which loads `StateManager`, starts the WebSocket bridge, and then serves the aiohttp API.

## 2. WebSocket connection
The extension opens a socket to `ws://localhost:8769`, answers the bootstrap `PING`, and gets promoted to the active bridge connection after identity validation.

## 3. PDF scanning
The HTTP API delegates folder validation and scanning to `PdfService`, which uses `scan_folder` and merges results into persisted state.

## 4. Single conversion
The extension processes one PDF and sends `CONVERSION_STATUS` updates back to Python, where status is persisted in `state.json`.

## 5. Batch conversion
The extension keeps the sequential conversion queue and reports progress through the same bridge channel.

## 6. Zoho mapping
`background-zoho.js` detects PDF downloads from Zoho, resolves the Cases URL, stores a pending item in `chrome.storage.session`, and emits `DOWNLOAD_PENDING` for the side panel.

## 7. Conversion from acta mapping
The modularized Actas module refreshes the Conversor PDF list, checks bridge status, resolves the matching PDF by filename, and delegates conversion through the Conversor module.

## 8. Selector alert
The background router emits `ILOVEPDF_SELECTOR_ALERT`; the modularized Alerts module renders the warning or error banner and persists dismissal state through local storage.

## 9. Real download confirmation
`ILovePDFDownloadTracker` still confirms the real Chrome download before the runtime marks a conversion as completed.

## 10. Side panel bootstrap
`sidepanel/bootstrap.js` initializes tabs, Actas, Conversor, and Alerts, then registers the runtime message listener and restores pending download confirmations from session storage.
