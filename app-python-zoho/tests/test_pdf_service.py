from autohom_bridge.services.pdf_service import PdfService
from autohom_bridge.storage.state_manager import StateManager


def make_service(tmp_path):
    state_file = tmp_path / "state.json"
    return PdfService(StateManager(state_file=state_file))


def test_scan_and_merge(tmp_path):
    (tmp_path / "doc.pdf").write_text("x", encoding="utf-8")
    service = make_service(tmp_path)
    merged = service.scan_and_merge(tmp_path)
    assert len(merged) == 1
    only_pdf = next(iter(merged.values()))
    assert only_pdf["filename"] == "doc.pdf"


def test_sorted_pdf_list(tmp_path):
    service = make_service(tmp_path)
    service.state_manager.upsert_pdf("b", {"id": "b", "filename": "b.pdf"})
    service.state_manager.upsert_pdf("a", {"id": "a", "filename": "a.pdf"})
    assert [pdf["filename"] for pdf in service.sorted_pdf_list()] == ["a.pdf", "b.pdf"]


def test_clear_pdfs(tmp_path):
    service = make_service(tmp_path)
    service.state_manager.upsert_pdf("a", {"id": "a", "filename": "a.pdf"})
    payload = service.clear_pdfs()
    assert payload["pdfs"] == []
    assert payload["count"] == 0
