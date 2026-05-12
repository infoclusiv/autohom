# Modularization Regression Checklist

## Python
- [ ] `python app.py` starts successfully.
- [ ] `/api/config` returns `ok: true`.
- [ ] `/api/bridge` returns bridge state.
- [ ] `/api/pdfs` returns list without crashing.
- [ ] Folder dialog still works on Windows.
- [ ] Scan folder works.
- [ ] PDF file serving works.

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
