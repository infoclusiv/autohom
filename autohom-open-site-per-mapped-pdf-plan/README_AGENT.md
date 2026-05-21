# README_AGENT — Autohom Open Website Per Mapped PDF Plan

## Purpose

This archive contains an incremental implementation plan for adding a new Actas-tab action in the `autohom` Chrome extension:

> Let the user configure a target website URL, defaulting to `https://chat.deepseek.com`, and open that same website once for each currently mapped PDF in the Actas tab.

Example behavior:
- If there are 10 mapped PDFs, clicking the new button opens 10 browser tabs to the configured website.
- If there are 19 mapped PDFs, clicking the new button opens 19 browser tabs to the configured website.

## Important product assumption

The user used the word “ventanas,” but the existing extension feature `Abrir PDFs descargados` opens Chrome tabs through `chrome.tabs.create`. This plan therefore implements the new behavior as browser tabs by default for repository consistency and lower disruption.

Stop and report before coding if the product owner confirms they literally need separate browser windows instead of tabs. In that case, the implementation should be adjusted to use `chrome.windows.create` and the UI/status copy should say “ventanas” explicitly.

## Repository context already verified

The current repository is `infoclusiv/autohom`.

Relevant architecture observed before creating this plan:
- The Chrome extension is under `zoho-ilovepdf-extension/`.
- The extension is MV3 and uses `background-main.js` as service worker.
- `manifest.json` already includes `tabs`, `storage`, `sidePanel`, `activeTab`, and `scripting` permissions.
- The side panel entry is `zoho-ilovepdf-extension/sidepanel.html`.
- The Actas tab already contains:
  - PDF mapping stats.
  - Search.
  - Mapping list.
  - `Abrir PDFs descargados`.
  - `Convertir todos los PDF mapeados`.
- Mapped PDFs are loaded from `chrome.storage.local.mappings` through `sidepanel/actas/actasStore.js`.
- `AutohomActasStore.getMappings()` returns the current in-memory list of all mapped PDFs.
- `sidepanel/actas/actasOpenPdfs.js` is the closest existing pattern for:
  - Actas-tab batch actions.
  - Button state handling.
  - Status text handling.
  - `chrome.tabs.create`.
  - Structured `AutohomLogs.append(...)` events.
- `sidepanel/actas/actasController.js` initializes Actas modules and refreshes button state when mappings are saved, deleted, cleared, or moved.
- `sidepanel.html` loads side panel modules through plain `<script src="..."></script>` tags, so new modules must be added in the correct order before `actasController.js`.

## Execution order

Read this file first. Then execute the phase files in this exact order:

1. `phase-1.md`
2. `phase-2.md`
3. `phase-3.md`

Do not skip phases. Do not merge phases. Do not implement multiple phases at once.

## Before coding each phase

For each phase, the implementation agent must:

1. Read the phase document completely.
2. Re-open and inspect the affected files in the real repository.
3. Validate that the proposed implementation still matches the current codebase.
4. Confirm that the expected file paths, globals, DOM IDs, and existing module patterns still exist.
5. Confirm that the current root implementation strategy remains correct:
   - Actas state comes from `AutohomActasStore.getMappings()`.
   - The new action should count all mapped PDFs, not only the search-filtered list.
   - The target website URL should be editable and persisted.
   - The action should not depend on the Python bridge or iLovePDF runtime.

## During implementation

The agent must:

- Implement only the current phase.
- Follow the phase scope strictly.
- Avoid unrelated refactors.
- Avoid renaming existing globals, DOM IDs, or storage keys.
- Preserve existing functionality:
  - Zoho PDF mapping.
  - Open downloaded PDFs.
  - Convert all mapped PDFs.
  - Search/filter.
  - CSV export.
  - Pending move.
  - Conversor tab.
  - Automatizar Lote tab.
- Keep the implementation modular.
- Use explicit component contracts where introduced.
- Add diagnostic/observable signals for user actions and failures.
- Avoid adding new external dependencies.

## After implementation of each phase

Before moving to the next phase, the agent must:

1. Verify every success criterion in that phase.
2. Verify the expected behavior manually in the extension where possible.
3. Check the browser console for JavaScript errors.
4. Check the side panel UI still renders.
5. Check existing Actas actions still work.
6. Confirm observable signals are emitted where the phase requires them.
7. Report any inconsistencies, architectural conflicts, missing information, or signs that the plan may be incorrect before continuing.

## Global stop conditions

Stop and report instead of coding if any of the following is true:

- The repository structure does not match the paths in the phase files.
- `sidepanel.html` no longer loads modules via plain script tags.
- `AutohomActasStore.getMappings()` no longer exists or no longer returns the current mapped PDF list.
- `chrome.tabs.create` is unavailable in the side panel context.
- The product requirement is confirmed to mean separate Chrome windows, not tabs.
- The extension has moved to a bundler/build system and direct script insertion is no longer valid.
- The Actas tab was renamed, removed, or substantially redesigned.
- The proposed storage key conflicts with an existing key.
- Any phase requires changes outside its listed files to pass basic verification.

## Final acceptance criteria

After all phases are complete:

- A new control appears in the Actas tab where PDFs are mapped.
- The control includes an editable target URL field.
- The default target URL is `https://chat.deepseek.com`.
- The edited URL persists across side panel reloads.
- The launch button is disabled when there are zero mapped PDFs.
- The launch button is disabled when the URL is invalid.
- Clicking the launch button opens exactly one browser tab per mapped PDF.
- The count is based on all mapped PDFs currently in `AutohomActasStore.getMappings()`, not only visible/search-filtered cards.
- The user receives clear status feedback before, during, and after launching.
- Existing Actas buttons and mapping behavior continue to work.
- Diagnostic log messages make success and failure observable for AI debugging.
