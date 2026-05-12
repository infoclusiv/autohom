"""Startup orchestration for the local bridge app."""

import signal
import sys

from aiohttp import web

from autohom_bridge.api.app_factory import create_app
from autohom_bridge.bridge.session import ILovePDFBridgeSession
from autohom_bridge.config import HTTP_HOST, HTTP_PORT
from autohom_bridge.storage.state_manager import StateManager


def run():
    print("=" * 50)
    print("  iLovePDF Automator Bridge")
    print("=" * 50)
    print()

    state_manager = StateManager()
    print(f"[OK] State manager loaded (folder: {state_manager.get_current_folder() or '(none)'})")

    bridge = ILovePDFBridgeSession(state_manager=state_manager)
    ok, msg = bridge.start_ws_server()
    if not ok:
        print(f"[ERROR] WebSocket server failed: {msg}")
        sys.exit(1)
    print(f"[OK] {msg}")

    app = create_app(state_manager, bridge)

    def shutdown_handler(sig, frame):
        print("\n[SHUTDOWN] Stopping...")
        bridge.stop_ws_server()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    print(f"[OK] HTTP API starting on http://{HTTP_HOST}:{HTTP_PORT}")
    print()
    print("Ready. Press Ctrl+C to stop.")
    print()

    web.run_app(app, host=HTTP_HOST, port=HTTP_PORT, print=None)
