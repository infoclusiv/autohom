"""Shared response serializers."""

from aiohttp import web


def ok_response(status=200, **payload):
    body = {"ok": True}
    body.update(payload)
    return web.json_response(body, status=status)


def error_response(message, status=400, code=None, **payload):
    body = {"ok": False, "error": str(message)}
    if code:
        body["code"] = code
    body.update(payload)
    return web.json_response(body, status=status)
