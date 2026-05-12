# Module Map

## Python

### `autohom_bridge.bootstrap`
Starts the local app and preserves compatibility with `python app.py`.

### `autohom_bridge.api`
HTTP API layer for config, scan, bridge state, PDF listing, status updates, and file serving.

### `autohom_bridge.bridge`
WebSocket bridge layer, including session lifecycle, identity helpers, event buffer, and request waiters.

### `autohom_bridge.storage`
Persistence layer for local state in `state.json`.

### `autohom_bridge.services`
Business services for scanning folders and centralizing PDF-related operations.

## Chrome Extension

### `background-main.js`
Service worker bootstrap.

### `background-zoho.js`
Zoho download mapping orchestration.

### `ilovepdf-background`
Background automation orchestration for conversions and download tracking.

### `ilovepdf`
Content-side automation and site profile helpers.

### `sidepanel/bootstrap.js`
Side panel bootstrap that wires tabs, modules, runtime messages, and pending-download restoration.

### `sidepanel/actas`
Actas UI module split into store, rendering, CSV export, conversion helpers, and controller.

### `sidepanel/conversor`
PDF converter UI module split into API client, store, rendering, bridge status, and controller.

### `sidepanel/alerts`
Selector alerts UI module split into store, rendering, and controller.

### `sidepanel/shared`
Shared helpers for DOM access, toast notifications, log rendering, and Chrome runtime messaging.
