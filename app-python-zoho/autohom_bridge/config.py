"""Central configuration for the local iLovePDF bridge app."""

import os

EXTENSION_ID = "zoho-acta-mapper"
EXTENSION_TYPE = "ilovepdf-converter"
DISPLAY_NAME = "Zoho Acta Mapper · iLovePDF"

WS_HOST = "localhost"
WS_PORT = 8769

HTTP_HOST = "localhost"
HTTP_PORT = 7790

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_FILE = os.path.join(BASE_DIR, "state.json")

HEARTBEAT_PROBE_INTERVAL_S = 15.0
HEARTBEAT_STALE_AFTER_S = 30.0
HEARTBEAT_PING_TIMEOUT_S = 6.0
BOOTSTRAP_PING_TIMEOUT_S = 6.0

CONVERSION_DELAY_BETWEEN_S = 20
