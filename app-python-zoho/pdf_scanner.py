"""Compatibility wrapper for legacy imports.

New code should import from autohom_bridge.services.pdf_scanner.
"""

from autohom_bridge.services.pdf_scanner import scan_folder

__all__ = ["scan_folder"]
