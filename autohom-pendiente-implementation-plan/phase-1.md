# Phase 1 — Add the local Python move-to-pending backend contract

## Objective

Add a local Python API capability that can move one mapped PDF into a sibling folder named `pendientes`, creating the folder if it does not already exist.

This phase must not change the Chrome extension UI yet.

## Current architecture evidence

Relevant current files:

- `app-python-zoho/autohom_bridge/services/pdf_service.py`
  - Already validates local PDF paths through `validate_pdf_path`.
  - Already performs filesystem moves for converted Excel files through `finalize_download`.
- `app-python-zoho/autohom_bridge/api/routes.py`
  - Already exposes local PDF-related HTTP handlers, including `handle_register_local_pdf`.
- `app-python-zoho/autohom_bridge/api/app_factory.py`
  - Registers HTTP routes for the aiohttp app.
- `app-python-zoho/autohom_bridge/storage/state_manager.py`
  - Persists local PDF state and emits state observability events.
- `app-python-zoho/tests/test_pdf_service.py`
  - Existing pytest coverage for `PdfService`.

## Required implementation

### 1. Add a service method

In `app-python-zoho/autohom_bridge/services/pdf_service.py`, add a method such as:

```python
def move_pdf_to_pending(
    self,
    path,
    *,
    folder_name="pendientes",
    mapping_id=None,
    zoho_url=None,
    trace_id=None,
):
    ...
```

Expected behavior:

1. Validate `path` using the existing PDF validation rules.
2. Derive the source directory from the validated path.
3. Create `<source_directory>/pendientes` if it does not exist.
4. Move the PDF into that folder.
5. Never overwrite an existing file.
6. Use the existing `_next_available_output_path` helper or a similar collision-safe helper to produce:
   - `Acta.pdf`
   - `Acta (1).pdf`
   - `Acta (2).pdf`
7. Return a payload like:

```json
{
  "moved": true,
  "originalPath": "C:\\Actas\\Acta.pdf",
  "destinationPath": "C:\\Actas\\pendientes\\Acta.pdf",
  "pendingDirectory": "C:\\Actas\\pendientes",
  "filename": "Acta.pdf",
  "mappingId": 123,
  "zohoUrl": "https://crm.zoho.com/...",
  "traceId": "acta-pending-..."
}
```

### 2. Preserve or update Python state when possible

If the moved file already exists in the Python `state_manager` PDF list, update that record so future API file-serving and conversion flows do not point to the old path.

Preferred low-risk approach:

- Add a small `StateManager` method such as `update_pdf_path_by_filepath(old_path, new_path, extra_patch=None)`.
- Match by normalized absolute `filepath`.
- Preserve the existing PDF id to avoid breaking references.
- Update at least:
  - `filepath`
  - `filename`
  - `directory`
  - `requestedOutputDirectory`
  - `sizeBytes`
  - `modifiedAt`
  - `message`
- Return the updated PDF record or `None`.

Stop and report if the current state model has changed and this would create duplicate or stale PDF records.

### 3. Add an HTTP route handler

In `app-python-zoho/autohom_bridge/api/routes.py`, add a handler such as:

```python
async def handle_move_pdf_to_pending(request):
    ...
```

Expected request body:

```json
{
  "path": "C:\\Actas\\Acta.pdf",
  "mappingId": 123,
  "zohoUrl": "https://crm.zoho.com/...",
  "traceId": "acta-pending-123"
}
```

Expected success response:

```json
{
  "ok": true,
  "moved": true,
  "originalPath": "C:\\Actas\\Acta.pdf",
  "destinationPath": "C:\\Actas\\pendientes\\Acta.pdf",
  "pendingDirectory": "C:\\Actas\\pendientes",
  "filename": "Acta.pdf",
  "mappingId": 123,
  "traceId": "acta-pending-123"
}
```

Expected error mapping:

- Missing/invalid JSON: normal existing invalid JSON response.
- Empty path: 400 with code like `PDF_PENDING_MOVE_INVALID`.
- Non-absolute path: 400 with code like `PDF_PENDING_MOVE_INVALID`.
- Non-PDF path: 400 with code like `PDF_PENDING_MOVE_INVALID`.
- Missing PDF: 404 with code like `PDF_PENDING_MOVE_NOT_FOUND`.
- Permission problem: 403 with code like `PDF_PENDING_MOVE_NOT_ALLOWED`.
- Filesystem move problem: 500 with code like `PDF_PENDING_MOVE_FAILED`.

Use the repository’s existing `ok_response` and `error_response` helpers.

### 4. Register the route

In `app-python-zoho/autohom_bridge/api/app_factory.py`:

1. Import the new route handler.
2. Add a route such as:

```python
app.router.add_post("/api/pdfs/move-to-pending", handle_move_pdf_to_pending)
```

### 5. Add backend tests

In `app-python-zoho/tests/test_pdf_service.py`, add tests for:

1. Creates `pendientes` and moves the PDF.
2. Does not overwrite an existing file in `pendientes`.
3. Raises `FileNotFoundError` when the source PDF does not exist.
4. Rejects a non-PDF path.
5. Updates state if the PDF was previously registered.

Use `tmp_path` and the existing `make_service(tmp_path)` helper.

## Expected behavior

After this phase, a direct HTTP caller can move a local PDF to a sibling `pendientes` folder through the Python app.

## Success criteria

- `POST /api/pdfs/move-to-pending` exists.
- The endpoint moves a real `.pdf` file into `pendientes`.
- The endpoint creates `pendientes` automatically when missing.
- The endpoint never overwrites an existing file.
- The endpoint returns the final destination path.
- Existing PDF service tests still pass.
- New tests for the move behavior pass.

## How to verify

From `app-python-zoho`:

```bash
python -m pytest
```

Manual API verification:

1. Start the local Python app.
2. Create a temporary folder with `Acta.pdf`.
3. Send a POST request to `/api/pdfs/move-to-pending`.
4. Confirm:
   - `pendientes` exists.
   - `Acta.pdf` is inside `pendientes`.
   - The original path no longer exists.
   - Response includes `moved: true`.

## Observable failure signals

- HTTP 400/403/404/500 responses with explicit codes.
- Python logs or observability events showing validation or filesystem failure.
- Existing `state.save_failed` event if state persistence fails.
- Pytest failures in `test_pdf_service.py`.

## Files/components involved

Expected files:

- `app-python-zoho/autohom_bridge/services/pdf_service.py`
- `app-python-zoho/autohom_bridge/storage/state_manager.py`
- `app-python-zoho/autohom_bridge/api/routes.py`
- `app-python-zoho/autohom_bridge/api/app_factory.py`
- `app-python-zoho/autohom_bridge/observability/event_names.py` if adding explicit canonical events
- `app-python-zoho/tests/test_pdf_service.py`

## Preconditions before implementation

- `PdfService.validate_pdf_path` still exists.
- `PdfService.finalize_download` still uses `shutil.move` or equivalent local move logic.
- `app_factory.py` still registers aiohttp routes.
- `routes.py` still uses `ok_response` and `error_response`.
- `pytest` is available from `app-python-zoho/requirements.txt`.

## Stop conditions if the plan does not match the real codebase

Stop and report if:

- The Python app cannot access the target PDF path by design.
- `PdfService` is no longer the right place for filesystem operations.
- `StateManager` no longer stores PDFs by id with a `filepath` field.
- There is an existing endpoint that already moves PDFs to a pending folder.
- The repository already has a different convention for pending folder names or localization.
