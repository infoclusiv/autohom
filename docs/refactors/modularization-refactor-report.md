# Modularization Refactor Report

## Summary
Implemented the baseline, regression checklist, Python modularization foundation, and the side panel modularization phase. The local Python app now has an internal `autohom_bridge` package, compatibility wrappers for legacy imports, extracted HTTP API modules, extracted bridge support modules, a `PdfService`, characterization tests, and the Chrome side panel split into dedicated modules for Actas, Conversor, Alerts, shared utilities, tabs, and bootstrap.

## Files moved
- `config.py` logic moved to `app-python-zoho/autohom_bridge/config.py`
- `StateManager` moved to `app-python-zoho/autohom_bridge/storage/state_manager.py`
- `scan_folder` moved to `app-python-zoho/autohom_bridge/services/pdf_scanner.py`
- HTTP app construction and handlers moved under `app-python-zoho/autohom_bridge/api/`
- WebSocket bridge session moved to `app-python-zoho/autohom_bridge/bridge/session.py`
- App startup orchestration moved to `app-python-zoho/autohom_bridge/bootstrap.py`

## Files created
- `docs/refactors/modularization-baseline.md`
- `docs/refactors/modularization-regression-checklist.md`
- `docs/refactors/modularization-refactor-report.md`
- `docs/architecture/module-map.md`
- `docs/architecture/message-contracts.md`
- `docs/architecture/runtime-flows.md`
- `docs/architecture/chrome-extension-load-order.md`
- `app-python-zoho/autohom_bridge/...`
- `app-python-zoho/tests/test_state_manager.py`
- `app-python-zoho/tests/test_pdf_scanner.py`
- `app-python-zoho/tests/test_pdf_service.py`
- `autohom-extension/sidepanel/...`

## Compatibility wrappers kept
- `app-python-zoho/config.py`
- `app-python-zoho/state_manager.py`
- `app-python-zoho/pdf_scanner.py`
- `app-python-zoho/http_server.py`
- `app-python-zoho/websocket_server.py`

## Behavior intentionally unchanged
- `python app.py` remains the supported entrypoint.
- HTTP API routes and port `7790` remain unchanged.
- WebSocket host/port remain unchanged.
- PDF scanning and persisted state semantics remain unchanged.
- Extension behavior, Chrome runtime message names, side panel flows, and service worker entrypoints remain unchanged from the user perspective.

## Manual verification performed
- `python -m py_compile` passed for wrappers and new package modules.
- `python -m pytest -q` passed with 12 tests.
- Existing local ports `7790` and `8769` were confirmed to be in use by a pre-existing Python process during runtime verification.
- The extension was reloaded and the modularized side panel was manually tested by the user.
- The user confirmed that the side panel works correctly after the modularization split.

## Known risks
- Runtime endpoint verification against a fresh instance was blocked by an already-running local Python process bound to ports `7790` and `8769`.
- Selector alerts and CSV export still need explicit regression confirmation after the side panel split.
- Full end-to-end integration verification remains pending for a clean fresh Python start and complete conversion/mapping walkthrough.

## Recommended next refactors
1. Run a full clean runtime verification with the previous Python process stopped and a fresh app startup.
2. Complete the remaining integration checklist items for selector alerts, CSV export, conversion queue, and Zoho mapping.
3. Consider a separate follow-up refactor for `background-zoho.js` only if future maintenance pressure justifies it.
