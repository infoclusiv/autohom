"""In-memory ring buffer helpers."""

from collections import deque
from threading import Lock


class ObservabilityRingBuffer:
    def __init__(self, maxlen=500):
        self._items = deque(maxlen=maxlen)
        self._lock = Lock()

    def append(self, item):
        with self._lock:
            self._items.append(item)

    def extend(self, items):
        with self._lock:
            self._items.extend(items)

    def recent(self, limit=None):
        with self._lock:
            data = list(self._items)
        return data if limit is None else data[-limit:]

    def clear(self):
        with self._lock:
            self._items.clear()

    def __len__(self):
        with self._lock:
            return len(self._items)
