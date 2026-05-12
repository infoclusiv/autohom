"""HTTP route handlers."""

import asyncio
import os

from aiohttp import web

from autohom_bridge.api.folder_dialog import open_native_folder_dialog
from autohom_bridge.api.serializers import error_response, ok_response
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

    return web.FileResponse(
        filepath,
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'attachment; filename="{pdf.get("filename", "file.pdf")}"',
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
    return ok_response(bridge=request.app["bridge_session"].get_bridge_state())
