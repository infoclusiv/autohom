"""Create the aiohttp application."""

from aiohttp import web

from autohom_bridge.api.middleware import cors_middleware, handle_options
from autohom_bridge.api.routes import (
    handle_bridge_state,
    handle_clear_pdfs,
    handle_folder_dialog,
    handle_get_config,
    handle_list_pdfs,
    handle_scan,
    handle_serve_pdf,
    handle_set_config,
    handle_update_status,
)


def create_app(state_manager, bridge_session):
    app = web.Application(middlewares=[cors_middleware])
    app["state_manager"] = state_manager
    app["bridge_session"] = bridge_session

    app.router.add_get("/api/pdfs", handle_list_pdfs)
    app.router.add_get("/api/pdfs/{pdf_id}/file", handle_serve_pdf)
    app.router.add_post("/api/pdfs/{pdf_id}/status", handle_update_status)
    app.router.add_post("/api/pdfs/clear", handle_clear_pdfs)
    app.router.add_get("/api/config", handle_get_config)
    app.router.add_post("/api/config", handle_set_config)
    app.router.add_post("/api/folder-dialog", handle_folder_dialog)
    app.router.add_post("/api/scan", handle_scan)
    app.router.add_get("/api/bridge", handle_bridge_state)
    app.router.add_route("OPTIONS", "/{path:.*}", handle_options)

    return app
