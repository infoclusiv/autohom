"""Service layer for folder validation and PDF list operations."""

import os

from autohom_bridge.services.pdf_scanner import scan_folder


class PdfService:
    def __init__(self, state_manager):
        self.state_manager = state_manager

    def validate_folder(self, folder):
        normalized = str(folder or "").strip()
        if not normalized:
            return ""
        if not os.path.isdir(normalized):
            raise ValueError(f"Folder not found: {normalized}")
        return os.path.abspath(normalized)

    def scan_and_merge(self, folder):
        scanned = scan_folder(folder)
        return self.state_manager.merge_scanned_pdfs(scanned)

    def sorted_pdf_list(self, pdfs=None):
        source = pdfs if pdfs is not None else self.state_manager.get_all_pdfs()
        return sorted(source.values(), key=lambda pdf: pdf.get("filename", ""))

    def set_folder_and_scan(self, folder):
        normalized = self.validate_folder(folder)
        self.state_manager.set_current_folder(normalized)
        merged = self.scan_and_merge(normalized)
        pdf_list = self.sorted_pdf_list(merged)
        return {
            "current_folder": normalized,
            "pdfs": pdf_list,
            "count": len(pdf_list),
        }

    def clear_pdfs(self):
        self.state_manager.clear_pdfs()
        return {
            "current_folder": self.state_manager.get_current_folder(),
            "pdfs": [],
            "count": 0,
        }
