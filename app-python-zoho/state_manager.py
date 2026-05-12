"""Compatibility wrapper for legacy imports.

New code should import from autohom_bridge.storage.state_manager.
"""

from autohom_bridge.storage.state_manager import StateManager

__all__ = ["StateManager"]
