"""Service layer for folder validation and PDF list operations."""

import os
import shutil
import time

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

    def register_local_pdf(
        self,
        path,
        *,
        source="acta-mapping",
        mapping_id=None,
        zoho_url=None,
        requested_output_directory=None,
        trace_id=None,
    ):
        normalized_path = self.validate_pdf_path(path)
        filename = os.path.basename(normalized_path)
        directory = os.path.dirname(normalized_path)
        stat_result = os.stat(normalized_path)
        pdf_id = self.state_manager.make_pdf_id(normalized_path)
        now = time.time()
        saved = self.state_manager.upsert_pdf(
            pdf_id,
            {
                "id": pdf_id,
                "filename": filename,
                "filepath": normalized_path,
                "status": "pending",
                "message": "",
                "created_at": now,
                "converted_at": None,
                "source": source or "acta-mapping",
                "mappingId": mapping_id,
                "zohoUrl": zoho_url or "",
                "requestedOutputDirectory": requested_output_directory or directory,
                "directory": directory,
                "sizeBytes": stat_result.st_size,
                "modifiedAt": int(stat_result.st_mtime),
                "traceId": trace_id or "",
            },
        )
        return saved

    def finalize_download(
        self,
        *,
        downloaded_file_path,
        target_directory,
        source_pdf_path=None,
        original_pdf_filename=None,
    ):
        downloaded_path = str(downloaded_file_path or "").strip()
        if not downloaded_path:
            raise ValueError("Downloaded file path is required.")

        downloaded_path = os.path.abspath(downloaded_path)
        if not os.path.isabs(downloaded_path):
            raise ValueError("Downloaded file path must be absolute.")
        if not os.path.isfile(downloaded_path):
            raise FileNotFoundError("Downloaded Excel file not found on disk.")

        normalized_target = self.validate_folder(target_directory)
        original_name = os.path.basename(str(original_pdf_filename or source_pdf_path or downloaded_path))
        stem, _ = os.path.splitext(original_name)
        if not stem:
            stem = os.path.splitext(os.path.basename(downloaded_path))[0]

        final_path = self._next_available_output_path(normalized_target, stem, ".xlsx")
        shutil.move(downloaded_path, final_path)
        return {
            "excelPath": final_path,
            "moved": True,
        }

    def validate_pdf_path(self, path):
        normalized = str(path or "").strip()
        if not normalized:
            raise ValueError("PDF path is required.")
        if not os.path.isabs(normalized):
            raise ValueError("PDF path must be absolute.")

        absolute = os.path.abspath(normalized)
        if not absolute.lower().endswith(".pdf"):
            raise ValueError("PDF path must point to a .pdf file.")
        if not os.path.isdir(os.path.dirname(absolute)):
            raise ValueError("PDF parent directory does not exist.")
        if not os.path.isfile(absolute):
            raise FileNotFoundError("PDF file does not exist at the mapped path.")
        if not os.access(absolute, os.R_OK):
            raise PermissionError("PDF file is not readable.")
        return absolute

    def _next_available_output_path(self, target_directory, stem, extension):
        candidate = os.path.join(target_directory, f"{stem}{extension}")
        if not os.path.exists(candidate):
            return candidate

        index = 1
        while True:
            candidate = os.path.join(target_directory, f"{stem} ({index}){extension}")
            if not os.path.exists(candidate):
                return candidate
            index += 1
