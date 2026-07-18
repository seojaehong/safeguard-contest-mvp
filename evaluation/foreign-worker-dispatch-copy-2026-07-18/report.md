# Foreign Worker Dispatch Copy Remediation

Date: 2026-07-18

## Scope

Tightened the worker-specific foreign language dispatch block so non-Korean recipient messages do not expose Korean UI labels such as `현장:`, `작업:`, or `핵심 위험:` inside the language-specific block.

## Product Change

- `buildForeignWorkerLanguageMessage` now renders a compact language-specific dispatch block:
  - `[SafeClaw]`
  - native language label
  - localized visual cue line
  - localized safety lines
  - localized supervisor confirmation line
- Korean manager-facing summary text remains in the broader Korean transmission surface, but the worker-specific block is language-only.

## Verification

- RED captured in `tests/foreign-worker-languages.test.ts`: the prior Vietnamese block contained Korean labels and failed `not.toMatch(/[가-힣]/u)`.
- GREEN:
  - `npm.cmd test -- tests/foreign-worker-languages.test.ts --maxWorkers=1 --fileParallelism=false`: 1 file / 7 tests PASS.
  - `npm.cmd test -- tests/foreign-parse.test.ts tests/foreign-worker-languages.test.ts tests/workflow-share-client.test.ts tests/workflow-share-panel-behavior.test.ts tests/workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false`: 5 files / 83 tests PASS.
  - `npm.cmd run typecheck`: PASS.
  - `npm.cmd run build`: PASS, 28/28 static pages generated.

## Notes

This is a narrow copy/output-quality patch for demo capture. It does not change recipient authorization, provider dispatch, worker roster ownership, DB schema, or share-session persistence.
