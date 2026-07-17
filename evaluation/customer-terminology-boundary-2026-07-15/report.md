# Customer terminology boundary

- Base commit: `8686e93ae012c850b918e4aea56fa9075e152c73`
- Date: 2026-07-15 KST
- Scope: presentation labels in AI connection settings, workspace evidence cards, and answer status notes.

## Contract

- Machine identifiers such as `run_safeclaw_harness_agent`, MCP payload fields, JSONL enums, and export file formats remain unchanged.
- Default customer copy uses `근거 고정` and `검증 근거` instead of implementation-oriented harness names.
- Existing tokens with the legacy label are mapped only when rendered.
- No database or schema change was made.

## Verification

- TDD red: customer terminology and answer-panel expectations failed before the presentation changes.
- Focused product tests: 39 passed, 3 skipped across customer terminology, answer display, AI connect, and workspace layout suites.
- Focused final tests: 22 passed, 2 skipped across customer terminology, answer display, AI connect, and general visible-copy contracts.
- Authenticated AI connection production matrix: 2/2 passed after an environment-matched production build. The matrix verifies the legacy persisted token label in the POST body and its Korean render label separately.
- Strict typecheck: passed.
- Production build: 28/28 static pages generated.
- Diff check: passed.

## Remaining gate

The local authenticated browser matrix is complete. A deployed authenticated check remains necessary after the next preview deployment.
