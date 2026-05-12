"""High-level observability service."""

import json
import os
import time

from autohom_bridge.observability.context import ContextStore
from autohom_bridge.observability.contracts import COMPONENT_CONTRACTS, MESSAGE_CONTRACTS
from autohom_bridge.observability.event_schema import make_event
from autohom_bridge.observability.redaction import redact_dict
from autohom_bridge.observability.sink import EventSink
from autohom_bridge.observability.state_snapshot import (
    build_environment_snapshot,
    build_state_snapshot,
)


class ObservabilityService:
    def __init__(self, base_dir, state_manager=None):
        self.context = ContextStore()
        self.base_dir = base_dir
        self.state_manager = state_manager
        self.sink = EventSink(base_dir, self.context.run_id)
        self.active_connections = {}
        self.generated_packages = {}

    @property
    def run_id(self):
        return self.context.run_id

    def emit(self, event_name, *, component, level="info", operation="", status="succeeded", error=None, **attrs):
        context = self.context.current_context()
        payload = {
            "eventName": event_name,
            "component": component,
            "operation": operation,
            "level": level,
            "status": status,
            "runId": context.get("runId", self.run_id),
            "workflowId": attrs.pop("workflowId", context.get("workflowId")),
            "traceId": attrs.pop("traceId", context.get("traceId")),
            "spanId": attrs.pop("spanId", context.get("spanId")),
            "parentSpanId": attrs.pop("parentSpanId", context.get("parentSpanId")),
            **attrs,
        }
        if error is not None:
            payload["error"] = {
                "type": type(error).__name__,
                "message": str(error),
                "code": getattr(error, "code", ""),
                "recoverable": True,
                "contractViolation": False,
            }
        event = make_event(**payload)
        self.sink.write_event(event)
        return event

    def ingest_external_event(self, event):
        event = dict(event or {})
        event.setdefault("runId", self.run_id)
        event["data"] = redact_dict(event.get("data"))
        event = make_event(**event)
        self.sink.write_event(event)
        return event

    def snapshot_state(self, bridge_state=None):
        latest_dir = self.sink.latest_dir
        run_dir = self.sink.run_dir
        payloads = {
            "state-snapshot.json": build_state_snapshot(self.state_manager),
            "bridge-state.json": redact_dict(bridge_state or {}),
            "workflow-state.json": {
                "runId": self.run_id,
                "activeWorkflows": self.context.active_workflows,
            },
            "contracts.json": {
                "components": COMPONENT_CONTRACTS,
                "messages": MESSAGE_CONTRACTS,
            },
            "environment.json": build_environment_snapshot(),
        }
        for filename, payload in payloads.items():
            for directory in (latest_dir, run_dir):
                os.makedirs(directory, exist_ok=True)
                with open(os.path.join(directory, filename), "w", encoding="utf-8") as fh:
                    json.dump(payload, fh, ensure_ascii=False, indent=2)
        return payloads

    def get_state(self):
        return {
            "runId": self.run_id,
            "activeWorkflows": list(self.context.active_workflows.values()),
            "activeExtensionConnections": self.active_connections,
            "ringBufferCounts": {
                "recentEvents": len(self.sink.recent_events),
                "recentErrors": len(self.sink.recent_errors),
                "recentBrowserEvents": len(self.sink.recent_browser_events),
            },
        }

    def recent_events(self, limit=100):
        return self.sink.recent_events.recent(limit)

    def recent_errors(self, limit=20):
        return self.sink.recent_errors.recent(limit)

    def start_workflow(self, name, component="workflow.orchestrator", **attrs):
        ctx = self.context.new_workflow(name, component=component, **attrs)
        self.emit("workflow.created", component=component, operation=name, status="started", workflowId=ctx["workflowId"], traceId=ctx["traceId"])
        self.emit("workflow.started", component=component, operation=name, status="started", workflowId=ctx["workflowId"], traceId=ctx["traceId"])
        return ctx

    def mark_workflow_result(self, workflow_id, status, component="workflow.orchestrator", message=""):
        workflow = self.context.active_workflows.get(workflow_id)
        if workflow:
            workflow["status"] = status
            workflow["message"] = message
            workflow["completedAt"] = time.time()
        self.emit(
            "workflow.completed" if status == "completed" else "workflow.failed",
            component=component,
            operation="workflow_result",
            status=status,
            workflowId=workflow_id,
            message=message,
        )
