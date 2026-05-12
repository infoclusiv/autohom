"""Bridge connection event buffer."""

import time

from autohom_bridge.observability import event_names
from autohom_bridge.observability.logger import get_observability
from autohom_bridge.observability.ring_buffer import ObservabilityRingBuffer


class BridgeEventBuffer:
    def __init__(self, maxlen=100):
        self._events = ObservabilityRingBuffer(maxlen=maxlen)

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
        obs = get_observability()
        if obs:
            mapped_name = {
                "bootstrap_ping_sent": event_names.WS_HANDSHAKE_PING_SENT,
                "bootstrap_ok": event_names.WS_HANDSHAKE_ACCEPTED,
                "auth_duplicate": event_names.WS_CONNECTION_DUPLICATE_REJECTED,
                "keepalive_ping": event_names.WS_KEEPALIVE_PING_SENT,
                "keepalive_failed": event_names.WS_KEEPALIVE_FAILED,
            }.get(str(event), event_names.WS_MESSAGE_RECEIVED)
            obs.emit(
                mapped_name,
                component="python.ws",
                operation="bridge_event_buffer.record",
                data={"bridgeEvent": event, "connectionId": connection_id, **extra},
            )

    def recent(self, limit=20):
        return self._events.recent(limit)
