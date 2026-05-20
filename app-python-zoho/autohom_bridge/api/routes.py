"""HTTP route handlers."""

import asyncio
import os

from aiohttp import web

from autohom_bridge.api.folder_dialog import open_native_folder_dialog
from autohom_bridge.api.serializers import error_response, ok_response
from autohom_bridge.observability.exporter import DiagnosticExporter
from autohom_bridge.services.pdf_service import PdfService


async def handle_list_pdfs(request):
    state_manager = request.app["state_manager"]
    service = PdfService(state_manager)
    return ok_response(pdfs=service.sorted_pdf_list(), folder=state_manager.get_current_folder())


async def handle_serve_pdf(request):
    pdf_id = request.match_info["pdf_id"]
    pdf = request.app["state_manager"].get_pdf(pdf_id)

    if not pdf:
        return error_response("PDF not found", status=404)

    filepath = pdf.get("filepath", "")
    if not filepath or not os.path.isfile(filepath):
        return error_response("File not found on disk", status=404)

    disposition = request.query.get("disposition", "attachment").lower()
    if disposition not in {"attachment", "inline"}:
        disposition = "attachment"

    return web.FileResponse(
        filepath,
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'{disposition}; filename="{pdf.get("filename", "file.pdf")}"',
            "Access-Control-Allow-Origin": "*",
        },
    )


async def handle_update_status(request):
    pdf_id = request.match_info["pdf_id"]
    try:
        body = await request.json()
    except Exception:
        return error_response("Invalid JSON")

    ok = request.app["state_manager"].set_pdf_status(
        pdf_id,
        body.get("status", ""),
        body.get("message", ""),
    )
    if not ok:
        return error_response("PDF not found", status=404)
    return ok_response()


async def handle_clear_pdfs(request):
    service = PdfService(request.app["state_manager"])
    payload = await asyncio.to_thread(service.clear_pdfs)
    return ok_response(**payload)


async def handle_get_config(request):
    return ok_response(current_folder=request.app["state_manager"].get_current_folder())


async def handle_folder_dialog(request):
    state_manager = request.app["state_manager"]
    body = {}
    if request.can_read_body:
        try:
            body = await request.json()
        except Exception:
            body = {}

    initial_folder = str(body.get("initial_folder") or state_manager.get_current_folder() or "").strip()
    selected_folder = await asyncio.to_thread(open_native_folder_dialog, initial_folder)
    if not selected_folder:
        return ok_response(selected=False, folder=state_manager.get_current_folder())

    await asyncio.to_thread(state_manager.set_current_folder, selected_folder)
    return ok_response(selected=True, folder=selected_folder)


async def handle_set_config(request):
    try:
        body = await request.json()
    except Exception:
        return error_response("Invalid JSON")

    state_manager = request.app["state_manager"]
    service = PdfService(state_manager)
    folder = str(body.get("folder", "")).strip()
    pdfs = state_manager.get_all_pdfs()

    if folder:
        try:
            payload = await asyncio.to_thread(service.set_folder_and_scan, folder)
            return ok_response(**payload)
        except ValueError as ex:
            return error_response(str(ex))

    pdf_list = service.sorted_pdf_list(pdfs)
    return ok_response(
        current_folder=state_manager.get_current_folder(),
        pdfs=pdf_list,
        count=len(pdf_list),
    )


async def handle_scan(request):
    state_manager = request.app["state_manager"]
    service = PdfService(state_manager)
    folder = state_manager.get_current_folder()
    if not folder or not os.path.isdir(folder):
        return error_response("No valid folder configured")

    pdfs = await asyncio.to_thread(service.scan_and_merge, folder)
    pdf_list = service.sorted_pdf_list(pdfs)
    return ok_response(pdfs=pdf_list, count=len(pdf_list))


async def handle_bridge_state(request):
    bridge_state = request.app["bridge_session"].get_bridge_state()
    observability = request.app.get("observability")
    if observability:
        observability.snapshot_state(bridge_state)
    return ok_response(bridge=bridge_state)


async def handle_register_local_pdf(request):
    try:
        body = await request.json()
    except Exception:
        return error_response("Invalid JSON")

    service = PdfService(request.app["state_manager"])
    try:
        pdf = await asyncio.to_thread(
            service.register_local_pdf,
            body.get("path"),
            source=body.get("source", "acta-mapping"),
            mapping_id=body.get("mappingId"),
            zoho_url=body.get("zohoUrl"),
            requested_output_directory=body.get("requestedOutputDirectory"),
            trace_id=body.get("traceId"),
        )
    except FileNotFoundError as ex:
        return error_response(str(ex), status=404, code="PDF_PATH_NOT_FOUND")
    except PermissionError as ex:
        return error_response(str(ex), status=403, code="PDF_PATH_NOT_READABLE")
    except ValueError as ex:
        return error_response(str(ex), status=400, code="PDF_PATH_INVALID")

    return ok_response(pdf=pdf)


async def handle_move_pdf_to_pending(request):
    try:
        body = await request.json()
    except Exception:
        return error_response("Invalid JSON")

    service = PdfService(request.app["state_manager"])
    try:
        result = await asyncio.to_thread(
            service.move_pdf_to_pending,
            body.get("path"),
            mapping_id=body.get("mappingId"),
            zoho_url=body.get("zohoUrl"),
            trace_id=body.get("traceId"),
        )
    except FileNotFoundError as ex:
        return error_response(str(ex), status=404, code="PDF_PENDING_MOVE_NOT_FOUND")
    except PermissionError as ex:
        return error_response(str(ex), status=403, code="PDF_PENDING_MOVE_NOT_ALLOWED")
    except ValueError as ex:
        return error_response(str(ex), status=400, code="PDF_PENDING_MOVE_INVALID")
    except OSError as ex:
        return error_response(str(ex), status=500, code="PDF_PENDING_MOVE_FAILED")

    return ok_response(**result)


async def handle_finalize_download(request):
    try:
        body = await request.json()
    except Exception:
        return error_response("Invalid JSON")

    service = PdfService(request.app["state_manager"])
    try:
        result = await asyncio.to_thread(
            service.finalize_download,
            downloaded_file_path=body.get("downloadedFilePath"),
            target_directory=body.get("targetDirectory"),
            source_pdf_path=body.get("sourcePdfPath"),
            original_pdf_filename=body.get("originalPdfFilename"),
        )
    except FileNotFoundError as ex:
        return error_response(str(ex), status=404, code="DOWNLOADED_FILE_NOT_FOUND")
    except PermissionError as ex:
        return error_response(str(ex), status=403, code="DOWNLOAD_MOVE_NOT_ALLOWED")
    except ValueError as ex:
        return error_response(str(ex), status=400, code="DOWNLOAD_FINALIZE_INVALID")
    except OSError as ex:
        return error_response(str(ex), status=500, code="DOWNLOAD_FINALIZE_FAILED")

    return ok_response(**result)


async def handle_observability_state(request):
    observability = request.app.get("observability")
    bridge_state = request.app["bridge_session"].get_bridge_state()
    if not observability:
        return ok_response(runId="", activeWorkflows=[], activeExtensionConnections={}, ringBufferCounts={})
    observability.snapshot_state(bridge_state)
    return ok_response(**observability.get_state(), bridgeState=bridge_state)


async def handle_observability_recent_events(request):
    observability = request.app.get("observability")
    if not observability:
        return ok_response(events=[])
    try:
        limit = int(request.query.get("limit", "100"))
    except ValueError:
        limit = 100
    return ok_response(events=observability.recent_events(limit), errors=observability.recent_errors(min(limit, 20)))


async def handle_observability_events(request):
    observability = request.app.get("observability")
    if not observability:
        return error_response("Observability service not available", status=503)
    try:
        body = request.get("json_body")
        if body is None:
            body = await request.json()
    except Exception:
        return error_response("Invalid JSON")
    event = observability.ingest_external_event(body)
    return ok_response(event=event)


async def handle_export_observability(request):
    observability = request.app.get("observability")
    if not observability:
        return error_response("Observability service not available", status=503)
    try:
        body = request.get("json_body")
        if body is None and request.can_read_body:
            body = await request.json()
        if body is None:
            body = {}
    except Exception:
        body = {}
    exporter = DiagnosticExporter(observability, request.app["bridge_session"])
    result = exporter.export(
        scope=body.get("scope", "latest"),
        workflow_id=body.get("workflowId"),
        max_events=int(body.get("maxEvents", 500)),
        include_browser_events=bool(body.get("includeBrowserEvents", True)),
        include_debug_prompt=bool(body.get("includeDebugPrompt", True)),
        redaction_level=body.get("redactionLevel", "standard"),
    )
    return ok_response(**result)


async def handle_export_download(request):
    observability = request.app.get("observability")
    if not observability:
        return error_response("Observability service not available", status=503)
    package_id = request.match_info["package_id"]
    exporter = DiagnosticExporter(observability, request.app["bridge_session"])
    package = exporter.get_package(package_id)
    if not package or not os.path.isfile(package["zipPath"]):
        return error_response("Diagnostic package not found", status=404)
    return web.FileResponse(
        package["zipPath"],
        headers={
            "Content-Type": "application/zip",
            "Content-Disposition": f'attachment; filename="{package["zipName"]}"',
            "Access-Control-Allow-Origin": "*",
        },
    )
