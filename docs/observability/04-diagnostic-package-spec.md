# Diagnostic Package Spec

## Package Contents

The exporter produces a compact ZIP package containing:

- `summary.md`
- `ai-debug-prompt.md`
- `diagnostic-index.json`
- `timeline.json`
- `events.jsonl`
- `errors.json`
- `warnings.json`
- `state-snapshot.json`
- `bridge-state.json`
- `workflow-state.json`
- `browser-snapshot.json`
- `component-contracts.json`
- `message-contracts.json`
- `http-routes.json`
- `websocket-messages.json`
- `environment.json`
- `repo-context.json`

## Compaction Rules

- Default to the last 500 events.
- Include focused error and warning subsets.
- Redact sensitive paths and URLs.
- Exclude raw binaries and full PDF/Excel content.
- Prefer summaries over large payloads.

## Navigation Priority

1. `summary.md`
2. `diagnostic-index.json`
3. `timeline.json`
4. `errors.json`
5. `component-contracts.json`
