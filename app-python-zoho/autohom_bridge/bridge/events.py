"""Bridge connection event buffer."""

import collections
import time


class BridgeEventBuffer:
    def __init__(self, maxlen=100):
        self._events = collections.deque(maxlen=maxlen)

    def record(self, event, connection_id="", **extra):
        entry = {
            "t": round(time.time(), 3),
            "ts": time.strftime("%H:%M:%S"),
            "ev": str(event),
            "cid": str(connection_id or ""),
        }
        if extra:
            entry["d"] = {key: str(value) for key, value in extra.items()}
        self._events.append(entry)

    def recent(self, limit=20):
        return list(self._events)[-limit:]
