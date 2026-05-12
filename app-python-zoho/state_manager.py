"""State manager — persiste el estado de conversiones en state.json.

Thread-safe: usa threading.Lock para todas las operaciones de lectura/escritura.
"""

import hashlib
import json
import os
import threading
import time

from config import STATE_FILE


class StateManager:
    """Gestiona el estado persistente de PDFs y la carpeta actual."""

    def __init__(self, state_file=STATE_FILE):
        self._state_file = state_file
        self._lock = threading.Lock()
        self._state = self._load()

    # ─── Persistence ──────────────────────────────────────────────────────

    def _load(self):
        if not os.path.exists(self._state_file):
            return {"current_folder": "", "pdfs": {}}
        try:
            with open(self._state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {"current_folder": "", "pdfs": {}}
            data.setdefault("current_folder", "")
            data.setdefault("pdfs", {})
            return data
        except (json.JSONDecodeError, OSError):
            return {"current_folder": "", "pdfs": {}}

    def _save(self):
        try:
            with open(self._state_file, "w", encoding="utf-8") as f:
                json.dump(self._state, f, ensure_ascii=False, indent=2)
        except OSError as ex:
            print(f"[StateManager] Error saving state: {ex}")

    # ─── Folder ───────────────────────────────────────────────────────────

    def get_current_folder(self):
        with self._lock:
            return self._state.get("current_folder", "")

    def set_current_folder(self, folder_path):
        with self._lock:
            self._state["current_folder"] = str(folder_path or "").strip()
            self._save()

    # ─── PDFs ─────────────────────────────────────────────────────────────

    @staticmethod
    def make_pdf_id(filepath):
        """Genera un ID estable basado en el nombre del archivo."""
        basename = os.path.basename(filepath)
        return hashlib.md5(basename.encode("utf-8")).hexdigest()[:12]

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

    def set_pdf_status(self, pdf_id, status, message=""):
        with self._lock:
            pdf = self._state["pdfs"].get(pdf_id)
            if pdf is None:
                return False
            pdf["status"] = status
            pdf["message"] = message or ""
            if status == "completed":
                pdf["converted_at"] = time.time()
            self._save()
            return True

    def merge_scanned_pdfs(self, scanned_pdfs):
        """Merge una lista de PDFs escaneados con el estado existente.

        Los PDFs nuevos se agregan como 'pending'. Los existentes conservan su estado.
        Los que ya no están en la carpeta se marcan como 'missing'.
        """
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
                        "status": "pending",
                        "message": "",
                        "created_at": time.time(),
                        "converted_at": None,
                    }
                else:
                    # Actualizar filepath (puede haber cambiado la carpeta base)
                    existing[pdf_id]["filepath"] = pdf_info["filepath"]
                    existing[pdf_id]["filename"] = pdf_info["filename"]
                    existing[pdf_id]["status"] = "pending"
                    existing[pdf_id]["message"] = ""
                    existing[pdf_id]["converted_at"] = None

            # Marcar como missing los que ya no están en la carpeta
            for pdf_id in list(existing.keys()):
                if pdf_id not in scanned_ids:
                    existing[pdf_id]["status"] = "missing"
                    existing[pdf_id]["message"] = ""
                    existing[pdf_id]["converted_at"] = None

            self._state["pdfs"] = existing
            self._save()
            return existing

    def clear_pdfs(self):
        with self._lock:
            self._state["pdfs"] = {}
            self._save()
