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


def test_sorted_pdf_list_normalizes_scanned_pdf_directory_fields(tmp_path):
    service = make_service(tmp_path)
    pdf_path = tmp_path / "doc.pdf"
    pdf_path.write_text("x", encoding="utf-8")
    service.state_manager.upsert_pdf(
        "scan-1",
        {
            "id": "scan-1",
            "filename": "doc.pdf",
            "filepath": str(pdf_path),
            "source": "conversor-scan",
        },
    )

    pdf = service.sorted_pdf_list()[0]
    assert pdf["filepath"] == str(pdf_path.resolve())
    assert pdf["directory"] == str(tmp_path.resolve())
    assert pdf["requestedOutputDirectory"] == str(tmp_path.resolve())


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


def test_finalize_download_derives_target_directory_from_source_pdf_path(tmp_path):
    service = make_service(tmp_path)
    source_pdf = tmp_path / "Acta.pdf"
    source_pdf.write_text("pdf", encoding="utf-8")
    downloaded_dir = tmp_path / "downloads"
    downloaded_dir.mkdir()
    downloaded = downloaded_dir / "downloaded.xlsx"
    downloaded.write_text("sheet", encoding="utf-8")

    result = service.finalize_download(
        downloaded_file_path=str(downloaded),
        target_directory="",
        source_pdf_path=str(source_pdf),
    )

    assert result["moved"] is True
    assert result["excelPath"] == str((tmp_path / "Acta.xlsx").resolve())


def test_finalize_download_requires_target_or_source_pdf_path(tmp_path):
    service = make_service(tmp_path)
    downloaded = tmp_path / "downloaded.xlsx"
    downloaded.write_text("sheet", encoding="utf-8")

    try:
        service.finalize_download(
            downloaded_file_path=str(downloaded),
            target_directory="",
            source_pdf_path="",
        )
        assert False, "Expected ValueError"
    except ValueError as ex:
        assert "Target directory" in str(ex)


def test_move_pdf_to_pending_creates_folder_and_moves_pdf(tmp_path):
    service = make_service(tmp_path)
    pdf_path = tmp_path / "Acta.pdf"
    pdf_path.write_text("pdf", encoding="utf-8")

    result = service.move_pdf_to_pending(
        str(pdf_path),
        mapping_id=123,
        zoho_url="https://crm.zoho.com/crm/org/tab/Cases/1",
        trace_id="trace-pending-1",
    )

    destination = tmp_path / "pendientes" / "Acta.pdf"
    assert result["moved"] is True
    assert result["originalPath"] == str(pdf_path.resolve())
    assert result["destinationPath"] == str(destination.resolve())
    assert result["pendingDirectory"] == str((tmp_path / "pendientes").resolve())
    assert result["mappingId"] == 123
    assert result["traceId"] == "trace-pending-1"
    assert destination.exists()
    assert not pdf_path.exists()


def test_move_pdf_to_pending_avoids_overwriting_existing_file(tmp_path):
    service = make_service(tmp_path)
    pdf_path = tmp_path / "Acta.pdf"
    pdf_path.write_text("new", encoding="utf-8")
    pending_dir = tmp_path / "pendientes"
    pending_dir.mkdir()
    (pending_dir / "Acta.pdf").write_text("old", encoding="utf-8")

    result = service.move_pdf_to_pending(str(pdf_path))

    assert result["destinationPath"].endswith("Acta (1).pdf")
    assert (pending_dir / "Acta.pdf").read_text(encoding="utf-8") == "old"
    assert (pending_dir / "Acta (1).pdf").exists()


def test_move_pdf_to_pending_raises_when_pdf_missing(tmp_path):
    service = make_service(tmp_path)

    missing_path = tmp_path / "missing.pdf"

    try:
        service.move_pdf_to_pending(str(missing_path))
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError:
        pass


def test_move_pdf_to_pending_rejects_non_pdf_path(tmp_path):
    service = make_service(tmp_path)
    txt_path = tmp_path / "note.txt"
    txt_path.write_text("x", encoding="utf-8")

    try:
        service.move_pdf_to_pending(str(txt_path))
        assert False, "Expected ValueError"
    except ValueError as ex:
        assert ".pdf" in str(ex)


def test_move_pdf_to_pending_updates_existing_registered_state(tmp_path):
    service = make_service(tmp_path)
    pdf_path = tmp_path / "Acta.pdf"
    pdf_path.write_text("pdf", encoding="utf-8")
    saved = service.register_local_pdf(
        str(pdf_path),
        mapping_id=123,
        zoho_url="https://crm.zoho.com/crm/org/tab/Cases/1",
        requested_output_directory=str(tmp_path),
        trace_id="trace-register-1",
    )

    result = service.move_pdf_to_pending(
        str(pdf_path),
        mapping_id=123,
        zoho_url="https://crm.zoho.com/crm/org/tab/Cases/1",
        trace_id="trace-pending-2",
    )

    updated = service.state_manager.get_pdf(saved["id"])
    assert updated is not None
    assert updated["filepath"] == result["destinationPath"]
    assert updated["filename"] == "Acta.pdf"
    assert updated["directory"] == str((tmp_path / "pendientes").resolve())
    assert updated["requestedOutputDirectory"] == str((tmp_path / "pendientes").resolve())
    assert updated["mappingId"] == 123
    assert updated["traceId"] == "trace-pending-2"
