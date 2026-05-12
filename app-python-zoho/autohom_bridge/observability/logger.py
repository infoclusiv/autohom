"""Global observability accessors."""

_OBSERVABILITY = None


def set_observability(service):
    global _OBSERVABILITY
    _OBSERVABILITY = service


def get_observability():
    return _OBSERVABILITY


def emit(event_name, *, component, level="info", operation="", status="succeeded", **attrs):
    if _OBSERVABILITY is None:
        return None
    return _OBSERVABILITY.emit(
        event_name,
        component=component,
        level=level,
        operation=operation,
        status=status,
        **attrs,
    )
