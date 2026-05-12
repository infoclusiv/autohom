"""Structured component and message contracts."""

COMPONENT_CONTRACTS = {
    "python.bootstrap": {
        "ownerFiles": ["autohom_bridge/bootstrap.py"],
        "events": ["python.startup.started", "python.shutdown.completed"],
    },
    "python.http": {
        "ownerFiles": ["autohom_bridge/api/app_factory.py", "autohom_bridge/api/routes.py"],
        "events": ["http.request.received", "http.response.sent"],
    },
    "python.ws": {
        "ownerFiles": ["autohom_bridge/bridge/session.py"],
        "events": ["ws.connection.opened", "ws.message.sent", "ws.message.received"],
    },
    "future_extension.placeholder": {
        "ownerFiles": [],
        "events": ["workflow.step.started", "workflow.step.failed"],
    },
}

MESSAGE_CONTRACTS = {
    "PING": {
        "required": ["action", "requestId"],
        "source": "python.ws",
        "target": "extension.bridge",
        "expectedResponse": "PONG",
        "timeoutMs": 10000,
        "failureEvent": "ws.request.wait_timeout",
    },
    "EXTENSION_CONNECTED": {
        "required": ["action", "extensionId", "extensionType", "runtimeInstanceId"],
        "source": "extension.bridge",
        "target": "python.ws",
    },
    "CONVERT_PDF": {
        "required": ["action", "requestId", "pdfId", "filename"],
        "source": "python.ws",
        "target": "extension.bridge",
        "expectedResponse": "CONVERT_PDF_ACK",
        "timeoutMs": 10000,
        "failureEvent": "ws.request.wait_timeout",
    },
    "CONVERT_PDF_ACK": {
        "required": ["action", "requestId", "replyTo", "pdfId"],
        "source": "extension.bridge",
        "target": "python.ws",
    },
    "CONVERSION_STATUS": {
        "required": ["action", "pdfId", "status"],
        "source": "extension.bridge",
        "target": "python.ws",
    },
}
