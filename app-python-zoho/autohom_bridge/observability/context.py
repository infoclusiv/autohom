"""Trace context helpers."""

import contextvars
import time
import uuid
from contextlib import contextmanager

_current_context = contextvars.ContextVar("autohom_observability_context", default={})


def _make_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class ContextStore:
    def __init__(self):
        self.run_id = _make_id("run")
        self.active_workflows = {}

    def current_context(self):
        return dict(_current_context.get() or {"runId": self.run_id})

    def new_workflow(self, name="workflow", **attrs):
        workflow_id = _make_id("wf")
        trace_id = _make_id("tr")
        span_id = _make_id("sp")
        ctx = {
            "runId": self.run_id,
            "workflowId": workflow_id,
            "traceId": trace_id,
            "spanId": span_id,
            "parentSpanId": None,
            "operation": name,
            **attrs,
        }
        self.active_workflows[workflow_id] = {
            "workflowId": workflow_id,
            "traceId": trace_id,
            "status": "running",
            "name": name,
            "startedAt": time.time(),
            "steps": [],
        }
        _current_context.set(ctx)
        return dict(ctx)

    def child_span(self, operation, **attrs):
        parent = self.current_context()
        ctx = dict(parent)
        ctx["parentSpanId"] = parent.get("spanId")
        ctx["spanId"] = _make_id("sp")
        ctx["operation"] = operation
        ctx.update(attrs)
        return ctx

    @contextmanager
    def with_context(self, **attrs):
        merged = dict(self.current_context())
        merged.update(attrs)
        token = _current_context.set(merged)
        try:
            yield merged
        finally:
            _current_context.reset(token)

    @contextmanager
    def observed_span(self, event_base, component, operation, **attrs):
        child = self.child_span(operation, component=component, **attrs)
        token = _current_context.set(child)
        try:
            yield child
        finally:
            _current_context.reset(token)
