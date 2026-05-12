"""Native folder dialog helpers."""

import contextlib
import os


def choose_initial_dir(initial_folder):
    if initial_folder and os.path.isdir(initial_folder):
        return os.path.abspath(initial_folder)
    return os.path.expanduser("~")


def open_native_folder_dialog(initial_folder=""):
    root = None
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as ex:
        print(f"[HTTP] Native folder dialog unavailable: {ex}")
        return ""

    try:
        root = tk.Tk()
        root.withdraw()
        with contextlib.suppress(Exception):
            root.attributes("-topmost", True)
        with contextlib.suppress(Exception):
            root.update()
        selected = filedialog.askdirectory(
            title="Selecciona la carpeta con PDFs",
            initialdir=choose_initial_dir(initial_folder),
            mustexist=True,
            parent=root,
        )
        if not selected:
            return ""
        return os.path.abspath(selected)
    except Exception as ex:
        print(f"[HTTP] Native folder dialog failed: {ex}")
        return ""
    finally:
        if root is not None:
            with contextlib.suppress(Exception):
                root.destroy()
