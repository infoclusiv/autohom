# Modularization Regression Checklist

## Python
- [ ] `python app.py` starts successfully.
- [ ] `/api/config` returns `ok: true`.
- [ ] `/api/bridge` returns bridge state.
- [ ] `/api/pdfs` returns list without crashing.
- [ ] Folder dialog still works on Windows.
- [ ] Scan folder works.
- [ ] PDF file serving works.
- [ ] `GET /api/pdfs/{pdf_id}/file?disposition=inline` opens PDFs inline.

## Chrome extension
- [x] Extension loads without manifest errors.
- [x] Service worker starts without import errors.
- [x] Side panel opens.
- [x] Actas tab renders.
- [x] Conversor tab renders.
- [x] Bridge status renders.
- [ ] Selector alerts render.
- [ ] CSV export still works.

## Integration
- [ ] Extension connects to Python WebSocket.
- [ ] `PING` / `PONG` works.
- [ ] Convert one PDF works.
- [ ] Convert all pending PDFs works.
- [ ] Download tracker confirms completion.
- [ ] Zoho mapping flow still works.

## Actas
- [ ] Zoho PDF download is automatically mapped without confirmation notification.
- [ ] No pending confirmation card appears for successful automatic mappings.
- [ ] Duplicate download events do not create duplicate mappings.
- [ ] Mappings still include `sourcePdf.absolutePath`.
- [ ] Button `Abrir PDFs descargados` appears in Actas tab.
- [ ] Button opens local PDF files through `localhost:7790`, not CRM URLs.
- [ ] PDFs open inline in browser instead of being re-downloaded.
- [ ] Legacy mappings with recoverable Chrome download metadata still open.
- [ ] Missing local PDFs show a clear error and do not open CRM links.
