"""Compatibility wrapper.

New code should import create_app from autohom_bridge.api.app_factory.
"""

from autohom_bridge.api.app_factory import create_app

__all__ = ["create_app"]
