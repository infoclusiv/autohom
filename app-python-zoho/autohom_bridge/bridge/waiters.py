"""Thread-safe request waiter registry."""

import threading


class WsRequestWaiters:
    def __init__(self):
        self._waiters = {}
        self._lock = threading.Lock()

    def register(self, request_id):
        event = threading.Event()
        waiter = {"event": event, "payload": None}
        with self._lock:
            self._waiters[request_id] = waiter
        return waiter

    def resolve(self, data):
        request_id = data.get("requestId") or data.get("replyTo")
        if not request_id:
            return False
        with self._lock:
            waiter = self._waiters.get(request_id)
        if not waiter:
            return False
        waiter["payload"] = data
        waiter["event"].set()
        return True

    def pop(self, request_id):
        with self._lock:
            return self._waiters.pop(request_id, None)
