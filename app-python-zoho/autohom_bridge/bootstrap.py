"""Startup orchestration for the local bridge app."""

import os
import signal
import sys

from aiohttp import web

from autohom_bridge.api.app_factory import create_app
from autohom_bridge.bridge.session import ILovePDFBridgeSession
from autohom_bridge.config import HTTP_HOST, HTTP_PORT
from autohom_bridge.observability import event_names
from autohom_bridge.observability.diagnostics import ObservabilityService
from autohom_bridge.observability.logger import set_observability
from autohom_bridge.storage.state_manager import StateManager


def run():
    print("=" * 50)
    print("  iLovePDF Automator Bridge")
    print("=" * 50)
    print()

    observability_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".autohom-observability")
    observability = ObservabilityService(base_dir=observability_dir, state_manager=None)
    set_observability(observability)
    state_manager = StateManager()
    observability.state_manager = state_manager
    observability.emit(
        event_names.PYTHON_STARTUP_STARTED,
        component="python.bootstrap",
        operation="run",
        status="started",
        message="Python bridge startup requested.",
    )
    print(f"[OK] State manager loaded (folder: {state_manager.get_current_folder() or '(none)'})")
    observability.emit(
        event_names.PYTHON_STARTUP_STATE_LOADED,
        component="python.bootstrap",
        operation="load_state",
        data={"currentFolder": state_manager.get_current_folder()},
    )

    bridge = ILovePDFBridgeSession(state_manager=state_manager, observability=observability)
    observability.emit(
        event_names.PYTHON_STARTUP_WS_STARTING,
        component="python.bootstrap",
        operation="start_ws_server",
        status="started",
    )
    ok, msg = bridge.start_ws_server()
    if not ok:
        print(f"[ERROR] WebSocket server failed: {msg}")
        observability.emit(
            event_names.PYTHON_STARTUP_WS_FAILED,
            component="python.bootstrap",
            operation="start_ws_server",
            level="error",
            status="failed",
            message=msg,
        )
        sys.exit(1)
    print(f"[OK] {msg}")
    observability.emit(
        event_names.PYTHON_STARTUP_WS_STARTED,
        component="python.bootstrap",
        operation="start_ws_server",
        message=msg,
    )

    app = create_app(state_manager, bridge, observability)

    def shutdown_handler(sig, frame):
        print("\n[SHUTDOWN] Stopping...")
        observability.emit(
            event_names.PYTHON_SHUTDOWN_REQUESTED,
            component="python.bootstrap",
            operation="shutdown_handler",
            status="started",
            data={"signal": int(sig)},
        )
        bridge.stop_ws_server()
        observability.snapshot_state(bridge.get_bridge_state())
        observability.emit(
            event_names.PYTHON_SHUTDOWN_COMPLETED,
            component="python.bootstrap",
            operation="shutdown_handler",
            message="Python bridge shutdown completed.",
        )
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    print(f"[OK] HTTP API starting on http://{HTTP_HOST}:{HTTP_PORT}")
    observability.emit(
        event_names.PYTHON_STARTUP_HTTP_STARTING,
        component="python.bootstrap",
        operation="run_http",
        status="started",
        data={"host": HTTP_HOST, "port": HTTP_PORT},
    )
    print()
    print("Ready. Press Ctrl+C to stop.")
    print()
    observability.emit(
        event_names.PYTHON_STARTUP_HTTP_STARTED,
        component="python.bootstrap",
        operation="run_http",
        message="HTTP API ready.",
        data={"host": HTTP_HOST, "port": HTTP_PORT, "runId": observability.run_id},
    )

    web.run_app(app, host=HTTP_HOST, port=HTTP_PORT, print=None)
