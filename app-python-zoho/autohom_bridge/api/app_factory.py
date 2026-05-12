"""Create the aiohttp application."""

from aiohttp import web

from autohom_bridge.api.middleware import cors_middleware, handle_options
from autohom_bridge.observability.middleware import observability_middleware
from autohom_bridge.api.routes import (
    handle_bridge_state,
    handle_clear_pdfs,
    handle_export_download,
    handle_export_observability,
    handle_finalize_download,
    handle_folder_dialog,
    handle_get_config,
    handle_list_pdfs,
    handle_observability_events,
    handle_observability_recent_events,
    handle_observability_state,
    handle_register_local_pdf,
    handle_scan,
    handle_serve_pdf,
    handle_set_config,
    handle_update_status,
)


def create_app(state_manager, bridge_session, observability=None):
    app = web.Application(middlewares=[cors_middleware, observability_middleware])
    app["state_manager"] = state_manager
    app["bridge_session"] = bridge_session
    app["observability"] = observability

    app.router.add_get("/api/pdfs", handle_list_pdfs)
    app.router.add_get("/api/pdfs/{pdf_id}/file", handle_serve_pdf)
    app.router.add_post("/api/pdfs/{pdf_id}/status", handle_update_status)
    app.router.add_post("/api/pdfs/clear", handle_clear_pdfs)
    app.router.add_post("/api/pdfs/register-local", handle_register_local_pdf)
    app.router.add_get("/api/config", handle_get_config)
    app.router.add_post("/api/config", handle_set_config)
    app.router.add_post("/api/folder-dialog", handle_folder_dialog)
    app.router.add_post("/api/scan", handle_scan)
    app.router.add_post("/api/conversions/finalize-download", handle_finalize_download)
    app.router.add_get("/api/bridge", handle_bridge_state)
    app.router.add_get("/api/observability/state", handle_observability_state)
    app.router.add_get("/api/observability/events/recent", handle_observability_recent_events)
    app.router.add_post("/api/observability/events", handle_observability_events)
    app.router.add_post("/api/observability/export", handle_export_observability)
    app.router.add_get("/api/observability/export/{package_id}", handle_export_download)
    app.router.add_route("OPTIONS", "/{path:.*}", handle_options)

    return app
