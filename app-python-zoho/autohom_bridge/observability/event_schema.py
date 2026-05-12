"""Event schema helpers."""

from datetime import datetime, timezone
import time
import uuid

from autohom_bridge.observability.redaction import redact_dict

REQUIRED_FIELDS = ["schemaVersion", "eventId", "timestamp", "level", "eventName", "component", "runId"]


def normalize_event(event):
    normalized = dict(event or {})
    normalized.setdefault("schemaVersion", "1.0")
    normalized.setdefault("eventId", f"evt_{uuid.uuid4().hex[:16]}")
    normalized.setdefault("timestamp", datetime.now(timezone.utc).astimezone().isoformat(timespec="milliseconds"))
    normalized.setdefault("monotonicMs", int(time.monotonic() * 1000))
    normalized.setdefault("level", "info")
    normalized.setdefault("status", normalized.get("status") or "succeeded")
    normalized.setdefault("message", "")
    normalized.setdefault("data", {})
    normalized.setdefault("expected", {})
    normalized.setdefault("actual", {})
    normalized.setdefault("decision", {})
    normalized.setdefault("tags", [])
    normalized["data"] = redact_dict(normalized.get("data"))
    normalized["expected"] = redact_dict(normalized.get("expected"))
    normalized["actual"] = redact_dict(normalized.get("actual"))
    if normalized.get("error") and not isinstance(normalized["error"], dict):
        normalized["error"] = {"type": type(normalized["error"]).__name__, "message": str(normalized["error"])}
    return normalized


def validate_event(event):
    errors = []
    for field in REQUIRED_FIELDS:
        if not event.get(field):
            errors.append(f"Missing required field: {field}")
    return (not errors, errors)


def make_event(**kwargs):
    event = normalize_event(kwargs)
    return event
