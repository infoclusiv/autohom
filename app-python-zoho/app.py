"""Entry point — inicia WebSocket server + HTTP API server."""

import signal
import sys

from aiohttp import web

from config import HTTP_HOST, HTTP_PORT
from http_server import create_app
from state_manager import StateManager
from websocket_server import ILovePDFBridgeSession


def main():
    print("=" * 50)
    print("  iLovePDF Automator Bridge")
    print("=" * 50)
    print()

    # 1. State manager
    state_manager = StateManager()
    print(f"[OK] State manager loaded (folder: {state_manager.get_current_folder() or '(none)'})")

    # 2. WebSocket server (runs in background thread)
    bridge = ILovePDFBridgeSession(state_manager=state_manager)
    ok, msg = bridge.start_ws_server()
    if not ok:
        print(f"[ERROR] WebSocket server failed: {msg}")
        sys.exit(1)
    print(f"[OK] {msg}")

    # 3. HTTP API server (runs in main thread)
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


if __name__ == "__main__":
    main()
