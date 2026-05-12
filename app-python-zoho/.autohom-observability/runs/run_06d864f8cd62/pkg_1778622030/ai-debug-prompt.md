# AI Debug Prompt

You are debugging the `autohom` project.

Use the diagnostic package as the source of truth.

Start by reading:
1. summary.md
2. diagnostic-index.json
3. timeline.json
4. errors.json
5. component-contracts.json

Do not guess. For every conclusion, reference the eventId, component, and timestamp.

Tasks:
1. Identify the most likely root cause.
2. Identify the exact component and file to inspect.
3. Explain expected vs actual behavior.
4. Propose the smallest safe code change.
5. Propose observability improvements if evidence is insufficient.
