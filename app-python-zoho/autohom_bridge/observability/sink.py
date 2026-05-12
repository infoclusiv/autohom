"""File-backed event sink."""

import json
import os
from threading import Lock

from autohom_bridge.observability.ring_buffer import ObservabilityRingBuffer


class EventSink:
    def __init__(self, base_dir, run_id):
        self.base_dir = base_dir
        self.run_id = run_id
        self.latest_dir = os.path.join(base_dir, "latest")
        self.run_dir = os.path.join(base_dir, "runs", run_id)
        self._lock = Lock()
        self.recent_events = ObservabilityRingBuffer(maxlen=1000)
        self.recent_errors = ObservabilityRingBuffer(maxlen=100)
        self.recent_browser_events = ObservabilityRingBuffer(maxlen=500)
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.latest_dir, exist_ok=True)
        os.makedirs(self.run_dir, exist_ok=True)

    def _append_jsonl(self, path, event):
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")

    def write_event(self, event):
        with self._lock:
            try:
                self._append_jsonl(os.path.join(self.latest_dir, "events.jsonl"), event)
                self._append_jsonl(os.path.join(self.run_dir, "events.jsonl"), event)
            except OSError:
                return False
        self.recent_events.append(event)
        if event.get("level") in {"error", "critical"}:
            self.recent_errors.append(event)
        if str(event.get("eventName", "")).startswith("browser."):
            self.recent_browser_events.append(event)
        return True
