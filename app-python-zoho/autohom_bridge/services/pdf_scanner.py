"""Scan folders and list PDF files."""

import os

from autohom_bridge.storage.state_manager import StateManager


def scan_folder(folder_path):
    if not folder_path or not os.path.isdir(folder_path):
        return []

    results = []
    try:
        for entry in sorted(os.listdir(folder_path)):
            if not entry.lower().endswith(".pdf"):
                continue
            filepath = os.path.join(folder_path, entry)
            if not os.path.isfile(filepath):
                continue
            results.append({
                "id": StateManager.make_pdf_id(filepath),
                "filename": entry,
                "filepath": os.path.abspath(filepath),
            })
    except OSError as ex:
        print(f"[PDFScanner] Error scanning {folder_path}: {ex}")

    return results
