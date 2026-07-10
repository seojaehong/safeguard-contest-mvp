# Vision Harness V2 Evaluation

## Scope

- Branch: `feature/vision-harness-v2`
- Photo endpoint: `POST /api/input-photos/hazard-analysis`
- No schema, migration, Supabase mutation, environment, secret, or deployment changes.
- `output/playwright/2026-07-10/module-shell-hardening/desktop-workers-night.png` is an external worktree change and is excluded from this work.

## Implemented Contract

- Accepts at most 10 photos and rejects larger batches without silent truncation.
- Accepts `image/jpeg`, `image/png`, and `image/webp`, with a 20 MiB per-photo limit.
- Preserves empty, unsupported, and oversized files as per-image validation results.
- Calls the vision provider independently for every valid image and returns `analyzed`, `rejected`, `failed`, or `unconfigured` per image.
- Returns aggregate `analyzed`, `partial`, `failed`, or `unconfigured` status without discarding successful image results.
- Uses an injectable `HazardPhotoVisionProvider`; contract tests require no external API key.
- Requires model candidates to contain separate `observation` and `inference` fields.
- Discards model-supplied severity, evidence, actions, reflected documents, and acceptance decisions.
- Reuses the read-only SafeClaw DB/MCP harness path: three `searchSafetyReferences` reads followed by `buildDbHarnessPacket` and operational-control derivation.
- Marks a candidate `confirmed` only when the harness supplies direct evidence and grounded controls; resolver failure or missing support becomes `insufficient` while the model candidate remains visible.
- Returns a user-decision DTO with `pending`, `accepted`, and `rejected` states and requires harness confirmation before acceptance.

## TDD Evidence

1. Initial RED: `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts`
   - 9 failed, 8 passed. Failures covered validation metadata, observation/inference parsing, independent provider calls, partial failure, unconfigured mode, maximum count, and route partial handling.
2. Harness RED with the same command:
   - 2 failed, 16 passed. The resolver was not called and resolver failure remained `pending`.
3. Readiness-flow RED with the same command:
   - 1 failed, 17 passed. The old flow skipped DB/MCP grounding.
4. Final GREEN: `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts`
   - 2 test files passed, 18 tests passed.

## Verification

- `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts`
  - PASS: 2 files, 18 tests.
- `npm.cmd run typecheck`
  - PASS: `tsc --noEmit --incremental false`, exit code 0.
- `git diff --check`
  - Expected Windows LF-to-CRLF notices only; no whitespace errors.

## Concerns

- MIME validation uses the declared `File.type`; byte-signature sniffing is not included.
- DB/MCP grounding is read-only and may return `insufficient` when the safety reference catalog is unavailable or lacks direct evidence.
- User decisions are represented by the DTO; persistence of accept/reject decisions belongs to the existing downstream workpack flow and is not added here.
- A broad repository test attempt was not a clean gate because unrelated live-probe and concurrent Next development-server suites fail in the existing worktree. The focused contract tests and TypeScript check above are the final gates for this change.
