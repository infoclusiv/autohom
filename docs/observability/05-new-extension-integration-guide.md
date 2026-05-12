# New Extension Integration Guide

## Required Identity Fields

Every extension must identify itself with:

- `extensionId`
- `extensionType`
- `runtimeInstanceId`
- `version`

## Required Observability Modules

The extension must expose:

- `observability/eventSchema.js`
- `observability/eventNames.js`
- `observability/ringBuffer.js`
- `observability/redaction.js`
- `observability/telemetry.js`
- `observability/contracts.js`

## Required Handshake Behavior

1. Connect to the Python bridge.
2. Send `EXTENSION_CONNECTED`.
3. Respond to `PING` with `PONG`.
4. Preserve `traceId`, `workflowId`, and `requestId` in replies.

## Required Events

- `extension.bootstrap.*`
- `extension.bridge.*`
- `workflow.step.*`
- feature-specific runtime events

## Registry Integration

1. Add the extension capability to `autohom_bridge/orchestration/extension_registry.py`.
2. Define workflow steps in `workflow_models.py`.
3. Emit step-level workflow events.
4. Export one correlated diagnostic package when any step fails.
