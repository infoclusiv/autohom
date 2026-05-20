"""State manager for persisted PDF conversion state."""

import hashlib
import json
import os
import threading
import time

from autohom_bridge.config import STATE_FILE
from autohom_bridge.observability import event_names
from autohom_bridge.observability.logger import get_observability


class StateManager:
    """Manages persisted PDFs and current folder state."""

    def __init__(self, state_file=STATE_FILE):
        self._state_file = state_file
        self._lock = threading.Lock()
        self._state = self._load()

    def _load(self):
        if not os.path.exists(self._state_file):
            self._emit(event_names.STATE_LOADED, data={"stateFile": self._state_file, "exists": False})
            return {"current_folder": "", "pdfs": {}}
        try:
            with open(self._state_file, "r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict):
                self._emit(event_names.STATE_LOAD_FAILED, level="warn", status="failed", message="State file did not contain a dict.")
                return {"current_folder": "", "pdfs": {}}
            data.setdefault("current_folder", "")
            data.setdefault("pdfs", {})
            self._emit(event_names.STATE_LOADED, data={"stateFile": self._state_file, "pdfCount": len(data.get("pdfs", {}))})
            return data
        except (json.JSONDecodeError, OSError) as ex:
            self._emit(event_names.STATE_LOAD_FAILED, level="error", status="failed", message=str(ex), error=ex)
            return {"current_folder": "", "pdfs": {}}

    def _save(self):
        try:
            with open(self._state_file, "w", encoding="utf-8") as file:
                json.dump(self._state, file, ensure_ascii=False, indent=2)
            self._emit(event_names.STATE_SAVED, data={"stateFile": self._state_file, "pdfCount": len(self._state.get("pdfs", {}))})
        except OSError as ex:
            print(f"[StateManager] Error saving state: {ex}")
            self._emit(event_names.STATE_SAVE_FAILED, level="error", status="failed", message=str(ex), error=ex)

    def _emit(self, event_name, *, level="info", status="succeeded", message="", error=None, data=None, actual=None):
        obs = get_observability()
        if not obs:
            return
        obs.emit(
            event_name,
            component="python.state",
            operation="state_manager",
            level=level,
            status=status,
            message=message,
            error=error,
            data=data or {},
            actual=actual or {},
        )

    @staticmethod
    def make_pdf_id(filepath):
        normalized = os.path.abspath(str(filepath or ""))
        try:
            stat_result = os.stat(normalized)
            fingerprint = f"{normalized}|{stat_result.st_size}|{int(stat_result.st_mtime)}"
        except OSError:
            fingerprint = normalized
        return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:16]

    def get_current_folder(self):
        with self._lock:
            return self._state.get("current_folder", "")

    def set_current_folder(self, folder_path):
        with self._lock:
            previous = self._state.get("current_folder", "")
            self._state["current_folder"] = str(folder_path or "").strip()
            self._save()
            self._emit(
                event_names.STATE_FOLDER_CHANGED,
                data={"previousFolder": previous, "currentFolder": self._state["current_folder"]},
            )

    def get_all_pdfs(self):
        with self._lock:
            return dict(self._state.get("pdfs", {}))

    def get_pdf(self, pdf_id):
        with self._lock:
            return self._state.get("pdfs", {}).get(pdf_id)

    def upsert_pdf(self, pdf_id, pdf_data):
        with self._lock:
            existing = self._state["pdfs"].get(pdf_id, {})
            existing.update(pdf_data)
            self._state["pdfs"][pdf_id] = existing
            self._save()
            self._emit(
                event_names.STATE_PDF_UPSERTED,
                data={"pdfId": pdf_id, "filename": existing.get("filename"), "status": existing.get("status")},
            )
            return dict(existing)

    def update_pdf_path_by_filepath(self, old_path, new_path, extra_patch=None):
        normalized_old = os.path.abspath(str(old_path or ""))
        normalized_new = os.path.abspath(str(new_path or ""))
        if not normalized_old or not normalized_new:
            return None

        with self._lock:
            for pdf_id, pdf in self._state.get("pdfs", {}).items():
                current_path = os.path.abspath(str(pdf.get("filepath", "") or ""))
                if current_path != normalized_old:
                    continue

                try:
                    stat_result = os.stat(normalized_new)
                    size_bytes = stat_result.st_size
                    modified_at = int(stat_result.st_mtime)
                except OSError:
                    size_bytes = pdf.get("sizeBytes")
                    modified_at = pdf.get("modifiedAt")

                patch = {
                    "filepath": normalized_new,
                    "filename": os.path.basename(normalized_new),
                    "directory": os.path.dirname(normalized_new),
                    "requestedOutputDirectory": os.path.dirname(normalized_new),
                    "sizeBytes": size_bytes,
                    "modifiedAt": modified_at,
                    "message": "PDF path updated.",
                }
                if extra_patch:
                    patch.update(extra_patch)

                pdf.update(patch)
                self._save()
                self._emit(
                    event_names.STATE_PDF_UPSERTED,
                    data={"pdfId": pdf_id, "filename": pdf.get("filename"), "status": pdf.get("status")},
                )
                return dict(pdf)

        return None

    def set_pdf_status(self, pdf_id, status, message=""):
        with self._lock:
            pdf = self._state["pdfs"].get(pdf_id)
            if pdf is None:
                self._emit(
                    event_names.STATE_PDF_MISSING,
                    level="warn",
                    status="failed",
                    data={"pdfId": pdf_id, "requestedStatus": status},
                )
                return False
            previous_status = pdf.get("status", "")
            pdf["status"] = status
            pdf["message"] = message or ""
            if status == "completed":
                pdf["converted_at"] = time.time()
            self._save()
            self._emit(
                event_names.STATE_PDF_STATUS_TRANSITION,
                data={"pdfId": pdf_id, "from": previous_status, "to": status, "message": message or ""},
            )
            return True

    def merge_scanned_pdfs(self, scanned_pdfs):
        with self._lock:
            existing = self._state.get("pdfs", {})
            scanned_ids = set()

            for pdf_info in scanned_pdfs:
                pdf_id = pdf_info["id"]
                scanned_ids.add(pdf_id)
                if pdf_id not in existing:
                    existing[pdf_id] = {
                        "id": pdf_id,
                        "filename": pdf_info["filename"],
                        "filepath": pdf_info["filepath"],
                        "source": "conversor-scan",
                        "status": "pending",
                        "message": "",
                        "created_at": time.time(),
                        "converted_at": None,
                    }
                else:
                    existing[pdf_id]["filepath"] = pdf_info["filepath"]
                    existing[pdf_id]["filename"] = pdf_info["filename"]
                    existing[pdf_id]["source"] = "conversor-scan"
                    existing[pdf_id]["status"] = "pending"
                    existing[pdf_id]["message"] = ""
                    existing[pdf_id]["converted_at"] = None

            for pdf_id in list(existing.keys()):
                if existing[pdf_id].get("source") == "acta-mapping":
                    continue
                if pdf_id not in scanned_ids:
                    existing[pdf_id]["status"] = "missing"
                    existing[pdf_id]["message"] = ""
                    existing[pdf_id]["converted_at"] = None
                    self._emit(
                        event_names.STATE_PDF_MISSING,
                        level="warn",
                        status="failed",
                        data={"pdfId": pdf_id, "filename": existing[pdf_id].get("filename")},
                    )

            self._state["pdfs"] = existing
            self._save()
            return existing

    def clear_pdfs(self):
        with self._lock:
            self._state["pdfs"] = {}
            self._save()
