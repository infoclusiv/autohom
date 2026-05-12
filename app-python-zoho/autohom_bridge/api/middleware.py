"""aiohttp middleware helpers."""

from aiohttp import web


def _cors_response():
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    )


@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        return _cors_response()
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


async def handle_options(request):
    return _cors_response()
