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


def test_register_local_pdf(tmp_path):
    pdf_path = tmp_path / "doc.pdf"
    pdf_path.write_text("x", encoding="utf-8")
    service = make_service(tmp_path)

    saved = service.register_local_pdf(
        str(pdf_path),
        mapping_id=123,
        zoho_url="https://crm.zoho.com/crm/org/tab/Cases/1",
        requested_output_directory=str(tmp_path),
        trace_id="trace-1",
    )

    assert saved["filepath"] == str(pdf_path.resolve())
    assert saved["mappingId"] == 123
    assert saved["requestedOutputDirectory"] == str(tmp_path.resolve())
    assert saved["traceId"] == "trace-1"


def test_finalize_download_moves_and_suffixes_excel(tmp_path):
    service = make_service(tmp_path)
    downloaded = tmp_path / "downloaded.xlsx"
    downloaded.write_text("sheet", encoding="utf-8")
    existing = tmp_path / "Acta.xlsx"
    existing.write_text("old", encoding="utf-8")

    result = service.finalize_download(
        downloaded_file_path=str(downloaded),
        target_directory=str(tmp_path),
        original_pdf_filename="Acta.pdf",
    )

    assert result["moved"] is True
    assert result["excelPath"].endswith("Acta (1).xlsx")
