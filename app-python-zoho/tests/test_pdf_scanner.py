from autohom_bridge.services.pdf_scanner import scan_folder


def test_scan_folder_returns_empty_for_missing_directory(tmp_path):
    assert scan_folder(tmp_path / "missing") == []


def test_scan_folder_returns_only_pdfs(tmp_path):
    (tmp_path / "a.pdf").write_text("a", encoding="utf-8")
    (tmp_path / "b.PDF").write_text("b", encoding="utf-8")
    (tmp_path / "note.txt").write_text("x", encoding="utf-8")

    results = scan_folder(tmp_path)
    assert [item["filename"] for item in results] == ["a.pdf", "b.PDF"]


def test_scan_folder_generates_stable_ids(tmp_path):
    (tmp_path / "same.pdf").write_text("data", encoding="utf-8")
    first = scan_folder(tmp_path)
    second = scan_folder(tmp_path)
    assert first[0]["id"] == second[0]["id"]
