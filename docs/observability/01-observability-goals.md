# Observability Goals

## Purpose

Provide an AI-readable local diagnostic layer that preserves current automation behavior while answering:

1. Which workflow ran.
2. Which component acted at each step.
3. What was expected.
4. What actually happened.
5. Which contract or invariant likely failed.
6. Which files should be inspected first.

## Levels

1. Structured events in JSONL.
2. Correlated workflow and trace identifiers across Python and extension.
3. Compact diagnostic export packages suitable for AI review.

## Constraints

- No cloud dependency.
- No full document content capture.
- Redact sensitive local paths, tokens, cookies, and URLs.
- Preserve current automation behavior.
