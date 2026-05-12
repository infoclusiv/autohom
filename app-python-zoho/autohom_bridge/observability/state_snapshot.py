"""Snapshot helpers for state and runtime metadata."""

import os
import platform
import time

from autohom_bridge.observability.redaction import redact_dict


def build_state_snapshot(state_manager):
    if not state_manager:
        return {}
    return redact_dict(
        {
            "currentFolder": state_manager.get_current_folder(),
            "pdfs": state_manager.get_all_pdfs(),
        }
    )


def build_environment_snapshot():
    return {
        "platform": platform.platform(),
        "pythonVersion": platform.python_version(),
        "generatedAt": time.time(),
        "cwd": os.getcwd(),
    }
