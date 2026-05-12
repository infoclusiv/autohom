"""Observability HTTP middleware."""

import json
import time

from aiohttp import web

from autohom_bridge.observability import event_names


@web.middleware
async def observability_middleware(request, handler):
    obs = request.app.get("observability")
    started = time.perf_counter()
    request_id = f"http_{int(time.time() * 1000)}"
    body_summary = {}

    if request.can_read_body and request.content_type == "application/json":
        try:
            raw = await request.text()
            body_summary = json.loads(raw) if raw else {}
            request["json_body"] = body_summary
        except Exception:
            body_summary = {"invalidJson": True}

    if obs:
        obs.emit(
            event_names.HTTP_REQUEST_RECEIVED,
            component="python.http",
            operation=f"{request.method} {request.path}",
            requestId=request_id,
            data={"method": request.method, "path": request.path, "body": body_summary},
            status="started",
        )
    try:
        response = await handler(request)
    except web.HTTPException as ex:
        response = ex
        raise
    except Exception as ex:
        if obs:
            obs.emit(
                event_names.HTTP_HANDLER_FAILED,
                component="python.http",
                operation=f"{request.method} {request.path}",
                requestId=request_id,
                level="error",
                status="failed",
                error=ex,
                data={"method": request.method, "path": request.path},
            )
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        if obs:
            obs.emit(
                event_names.HTTP_RESPONSE_SENT,
                component="python.http",
                operation=f"{request.method} {request.path}",
                requestId=request_id,
                data={"method": request.method, "path": request.path, "durationMs": duration_ms},
            )

    trace_id = ""
    if obs:
        current = obs.context.current_context()
        trace_id = current.get("traceId", "")
    response.headers["X-Autohom-Run-Id"] = obs.run_id if obs else ""
    response.headers["X-Autohom-Trace-Id"] = trace_id
    response.headers["X-Autohom-Request-Id"] = request_id
    return response
