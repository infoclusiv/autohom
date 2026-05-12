"""HTTP API server — aiohttp con CORS para la extensión Chrome."""

import asyncio
import contextlib
import os

from aiohttp import web

from pdf_scanner import scan_folder


def create_app(state_manager, bridge_session):
    """Crea la app aiohttp con todos los endpoints."""
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


def _choose_initial_dir(initial_folder):
    if initial_folder and os.path.isdir(initial_folder):
        return os.path.abspath(initial_folder)
    return os.path.expanduser("~")


def _open_native_folder_dialog(initial_folder=""):
    root = None
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as ex:
        print(f"[HTTP] Native folder dialog unavailable: {ex}")
        return ""

    try:
        root = tk.Tk()
        root.withdraw()
        with contextlib.suppress(Exception):
            root.attributes("-topmost", True)
        with contextlib.suppress(Exception):
            root.update()
        selected = filedialog.askdirectory(
            title="Selecciona la carpeta con PDFs",
            initialdir=_choose_initial_dir(initial_folder),
            mustexist=True,
            parent=root,
        )
        if not selected:
            return ""
        return os.path.abspath(selected)
    except Exception as ex:
        print(f"[HTTP] Native folder dialog failed: {ex}")
        return ""
    finally:
        if root is not None:
            with contextlib.suppress(Exception):
                root.destroy()


def _scan_and_merge(state_manager, folder):
    scanned = scan_folder(folder)
    return state_manager.merge_scanned_pdfs(scanned)


def _sorted_pdf_list(pdfs):
    return sorted(pdfs.values(), key=lambda p: p.get("filename", ""))


# ─── CORS Middleware ──────────────────────────────────────────────────────────

@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        return _cors_response()
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


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


async def handle_options(request):
    return _cors_response()


# ─── Endpoints ────────────────────────────────────────────────────────────────

async def handle_list_pdfs(request):
    sm = request.app["state_manager"]
    pdfs = sm.get_all_pdfs()
    pdf_list = _sorted_pdf_list(pdfs)
    return web.json_response({"ok": True, "pdfs": pdf_list, "folder": sm.get_current_folder()})


async def handle_serve_pdf(request):
    pdf_id = request.match_info["pdf_id"]
    sm = request.app["state_manager"]
    pdf = sm.get_pdf(pdf_id)

    if not pdf:
        return web.json_response({"ok": False, "error": "PDF not found"}, status=404)

    filepath = pdf.get("filepath", "")
    if not filepath or not os.path.isfile(filepath):
        return web.json_response({"ok": False, "error": "File not found on disk"}, status=404)

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
    sm = request.app["state_manager"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    status = body.get("status", "")
    message = body.get("message", "")
    ok = sm.set_pdf_status(pdf_id, status, message)
    if not ok:
        return web.json_response({"ok": False, "error": "PDF not found"}, status=404)
    return web.json_response({"ok": True})


async def handle_clear_pdfs(request):
    sm = request.app["state_manager"]
    await asyncio.to_thread(sm.clear_pdfs)
    return web.json_response({
        "ok": True,
        "current_folder": sm.get_current_folder(),
        "pdfs": [],
        "count": 0,
    })


async def handle_get_config(request):
    sm = request.app["state_manager"]
    return web.json_response({
        "ok": True,
        "current_folder": sm.get_current_folder(),
    })


async def handle_folder_dialog(request):
    sm = request.app["state_manager"]
    body = {}
    if request.can_read_body:
        try:
            body = await request.json()
        except Exception:
            body = {}

    initial_folder = str(body.get("initial_folder") or sm.get_current_folder() or "").strip()
    selected_folder = await asyncio.to_thread(_open_native_folder_dialog, initial_folder)
    if not selected_folder:
        return web.json_response({
            "ok": True,
            "selected": False,
            "folder": sm.get_current_folder(),
        })

    await asyncio.to_thread(sm.set_current_folder, selected_folder)
    return web.json_response({
        "ok": True,
        "selected": True,
        "folder": selected_folder,
    })


async def handle_set_config(request):
    sm = request.app["state_manager"]
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)

    folder = body.get("folder", "").strip()
    pdfs = sm.get_all_pdfs()
    if folder:
        if not os.path.isdir(folder):
            return web.json_response({"ok": False, "error": f"Folder not found: {folder}"}, status=400)
        folder = os.path.abspath(folder)
        await asyncio.to_thread(sm.set_current_folder, folder)
        pdfs = await asyncio.to_thread(_scan_and_merge, sm, folder)

    pdf_list = _sorted_pdf_list(pdfs)
    return web.json_response({
        "ok": True,
        "current_folder": sm.get_current_folder(),
        "pdfs": pdf_list,
        "count": len(pdf_list),
    })


async def handle_scan(request):
    sm = request.app["state_manager"]
    folder = sm.get_current_folder()
    if not folder or not os.path.isdir(folder):
        return web.json_response({"ok": False, "error": "No valid folder configured"}, status=400)

    pdfs = await asyncio.to_thread(_scan_and_merge, sm, folder)
    pdf_list = _sorted_pdf_list(pdfs)
    return web.json_response({"ok": True, "pdfs": pdf_list, "count": len(pdf_list)})


async def handle_bridge_state(request):
    bridge = request.app["bridge_session"]
    return web.json_response({"ok": True, "bridge": bridge.get_bridge_state()})
