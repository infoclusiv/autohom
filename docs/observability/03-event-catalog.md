# Event Catalog

## Python startup

- `python.startup.started`
- `python.startup.state_loaded`
- `python.startup.ws_starting`
- `python.startup.ws_started`
- `python.startup.ws_failed`
- `python.startup.http_starting`
- `python.startup.http_started`
- `python.shutdown.requested`
- `python.shutdown.completed`

## HTTP

- `http.request.received`
- `http.request.validated`
- `http.request.failed_validation`
- `http.response.sent`
- `http.handler.failed`
- `http.route.not_found`

## WebSocket

- `ws.server.starting`
- `ws.server.started`
- `ws.server.failed`
- `ws.connection.opened`
- `ws.handshake.ping_sent`
- `ws.handshake.pong_received`
- `ws.handshake.accepted`
- `ws.handshake.rejected`
- `ws.connection.duplicate_rejected`
- `ws.connection.replaced`
- `ws.connection.closed`
- `ws.keepalive.ping_sent`
- `ws.keepalive.failed`
- `ws.message.sent`
- `ws.message.received`
- `ws.request.wait_started`
- `ws.request.wait_succeeded`
- `ws.request.wait_timeout`
- `ws.request.unexpected_response`

## State

- `state.loaded`
- `state.load_failed`
- `state.saved`
- `state.save_failed`
- `state.pdf.upserted`
- `state.pdf.status_transition`
- `state.pdf.status_transition_invalid`
- `state.pdf.missing`
- `state.folder.changed`

## Extension bridge and runtime

- `extension.bootstrap.started`
- `extension.bootstrap.import_failed`
- `extension.bridge.connect_attempted`
- `extension.bridge.opened`
- `extension.bridge.identity_sent`
- `extension.bridge.ping_received`
- `extension.bridge.pong_sent`
- `extension.bridge.message_received`
- `extension.bridge.message_sent`
- `extension.bridge.send_failed`
- `extension.bridge.closed`
- `extension.bridge.error`
- `extension.bridge.reconnect_scheduled`
- `extension.bridge.reconnect_triggered`
- `extension.queue.enqueued`
- `extension.queue.bulk_enqueued`
- `extension.queue.processing_started`
- `extension.queue.processing_completed`
- `extension.queue.processing_failed`
- `extension.queue.delay_started`
- `extension.tab.find_or_create.started`
- `extension.tab.ready`
- `extension.content.ready_check.started`
- `extension.content.ready_check.failed`
- `ilovepdf.upload.started`
- `ilovepdf.upload.message_sent`
- `ilovepdf.upload.ack_received`
- `ilovepdf.conversion.started`
- `ilovepdf.download_page.wait_started`
- `ilovepdf.download_page.detected`
- `ilovepdf.download_page.timeout`
- `ilovepdf.download.started`
- `ilovepdf.download.completed`
- `ilovepdf.download.timeout`
- `ilovepdf.finalize.started`
- `ilovepdf.finalize.succeeded`
- `ilovepdf.finalize.failed`

## Browser capture

- `browser.console.log`
- `browser.console.warn`
- `browser.console.error`
- `browser.runtime.error`
- `browser.unhandled_exception`
- `browser.unhandled_rejection`
- `browser.tab.created`
- `browser.tab.updated`
- `browser.tab.removed`
- `browser.tab.activated`
- `browser.download.created`
- `browser.download.changed`
- `browser.network.fetch.started`
- `browser.network.fetch.succeeded`
- `browser.network.fetch.failed`
- `browser.selector.missing`
- `browser.dom.checkpoint`

## Workflow

- `workflow.created`
- `workflow.started`
- `workflow.step.started`
- `workflow.step.succeeded`
- `workflow.step.failed`
- `workflow.step.skipped`
- `workflow.extension.waiting`
- `workflow.extension.started`
- `workflow.extension.completed`
- `workflow.extension.failed`
- `workflow.completed`
- `workflow.failed`
- `workflow.export.requested`
- `workflow.export.completed`
