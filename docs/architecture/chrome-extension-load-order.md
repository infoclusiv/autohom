# Chrome Extension Load Order

## Service Worker

Entrypoint:
- `autohom-extension/background-main.js`

Import order:
1. `background-zoho.js`
2. `ilovepdf/config.js`
3. `ilovepdf/utils.js`
4. `ilovepdf-background/bridge.js`
5. `ilovepdf-background/tabManager.js`
6. `ilovepdf-background/downloadTracker.js`
7. `ilovepdf-background/runtime.js`
8. `ilovepdf-background/router.js`

## Reasoning

- `background-zoho.js` keeps the Zoho side panel integration and mapping flow available from the start.
- `ilovepdf/config.js` must load before modules that read `CONFIG_ILOVEPDF`.
- `ilovepdf/utils.js` must load before modules that call `ILovePDFUtils`.
- `bridge.js` must load before runtime and router modules that depend on `ILovePDFBridge`.
- `downloadTracker.js` must load before the runtime starts waiting for real download confirmation.
- `runtime.js` must load before `router.js` delegates conversion messages.

## Side Panel

Entrypoint:
- `autohom-extension/sidepanel.html`

Classic script order:
1. `sidepanel/constants.js`
2. `sidepanel/state.js`
3. `sidepanel/shared/dom.js`
4. `sidepanel/shared/toast.js`
5. `sidepanel/shared/logs.js`
6. `sidepanel/shared/chromeMessages.js`
7. `sidepanel/tabs/tabsController.js`
8. `sidepanel/actas/*`
9. `sidepanel/conversor/*`
10. `sidepanel/alerts/*`
11. `sidepanel/bootstrap.js`

## Side Panel Reasoning

- `constants.js` and `state.js` establish the shared globals used by the rest of the modules.
- Shared helpers load before feature modules to avoid function duplication.
- `actas` loads before `bootstrap.js` so restore and mapping events are available immediately.
- `conversor` loads before `bootstrap.js` so tab activation, bridge status, and progress handling can be wired on startup.
- `alerts` loads before `bootstrap.js` so selector alert events can be rendered as soon as messages arrive.
