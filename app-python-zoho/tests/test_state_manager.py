import json

from autohom_bridge.storage.state_manager import StateManager


def test_loads_empty_state_when_file_missing(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    assert manager.get_current_folder() == ""
    assert manager.get_all_pdfs() == {}


def test_set_and_get_current_folder(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    manager.set_current_folder("C:/docs")
    assert manager.get_current_folder() == "C:/docs"


def test_upsert_pdf_and_set_status(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    manager.upsert_pdf("abc", {"id": "abc", "filename": "file.pdf"})
    assert manager.get_pdf("abc")["filename"] == "file.pdf"
    assert manager.set_pdf_status("abc", "completed", "done") is True
    saved = manager.get_pdf("abc")
    assert saved["status"] == "completed"
    assert saved["message"] == "done"
    assert saved["converted_at"] is not None


def test_clear_pdfs(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    manager.upsert_pdf("abc", {"id": "abc"})
    manager.clear_pdfs()
    assert manager.get_all_pdfs() == {}


def test_merge_scanned_pdfs_keeps_expected_structure(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    filepath = str((tmp_path / "one.pdf").resolve())
    scanned = [{"id": "one", "filename": "one.pdf", "filepath": filepath}]
    merged = manager.merge_scanned_pdfs(scanned)
    assert merged["one"]["status"] == "pending"
    assert merged["one"]["filename"] == "one.pdf"
    assert merged["one"]["filepath"] == filepath
    assert merged["one"]["directory"] == str(tmp_path.resolve())
    assert merged["one"]["requestedOutputDirectory"] == str(tmp_path.resolve())

    manager.upsert_pdf("missing", {"id": "missing", "filename": "old.pdf", "filepath": str((tmp_path / "old.pdf").resolve())})
    merged = manager.merge_scanned_pdfs(scanned)
    assert merged["missing"]["status"] == "missing"


def test_merge_scanned_pdfs_preserves_acta_mapping_source(tmp_path):
    manager = StateManager(state_file=tmp_path / "state.json")
    filepath = str((tmp_path / "mapped.pdf").resolve())
    manager.upsert_pdf(
        "mapped",
        {
            "id": "mapped",
            "filename": "mapped.pdf",
            "filepath": filepath,
            "source": "acta-mapping",
            "mappingId": 7,
            "requestedOutputDirectory": "C:/custom-output",
            "status": "pending",
        },
    )

    merged = manager.merge_scanned_pdfs([{"id": "mapped", "filename": "mapped.pdf", "filepath": filepath}])

    assert merged["mapped"]["source"] == "acta-mapping"
    assert merged["mapped"]["mappingId"] == 7
    assert merged["mapped"]["directory"] == str(tmp_path.resolve())
    assert merged["mapped"]["requestedOutputDirectory"] == "C:/custom-output"


def test_persists_to_disk(tmp_path):
    state_file = tmp_path / "state.json"
    manager = StateManager(state_file=state_file)
    manager.set_current_folder("C:/persist")
    data = json.loads(state_file.read_text(encoding="utf-8"))
    assert data["current_folder"] == "C:/persist"


def test_make_pdf_id_uses_path_metadata_when_available(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    pdf_path.write_text("data", encoding="utf-8")
    first = StateManager.make_pdf_id(pdf_path)
    second = StateManager.make_pdf_id(pdf_path)
    assert first == second
    assert len(first) == 16
