# Modularization Baseline

## Date
2026-05-12

## Current entry points

### Python
- `app-python-zoho/app.py`

### Chrome extension
- `zoho-ilovepdf-extension/manifest.json`
- `zoho-ilovepdf-extension/background-main.js`
- `zoho-ilovepdf-extension/sidepanel.html`
- `zoho-ilovepdf-extension/sidepanel.js`

## Current local ports
- HTTP: `localhost:7790`
- WebSocket: `localhost:8769`

## Current critical flows
1. Start Python app
2. Extension connects to WebSocket
3. Side panel checks bridge
4. Scan folder
5. Convert one PDF
6. Convert all PDFs
7. Detect Zoho PDF download
8. Auto-map Zoho PDF download without confirmation
9. Open all downloaded mapped PDFs in browser
10. Convert mapping-associated PDF
11. Export mappings CSV

## Known high-risk files
- `zoho-ilovepdf-extension/sidepanel.js`
- `app-python-zoho/http_server.py`
- `app-python-zoho/websocket_server.py`
- `zoho-ilovepdf-extension/sidepanel/actas/actasOpenPdfs.js`
