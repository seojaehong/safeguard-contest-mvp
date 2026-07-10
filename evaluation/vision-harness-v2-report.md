# Vision Harness V2 Evaluation

## Scope

- Branch: `feature/vision-harness-v2`
- Photo endpoint: `POST /api/input-photos/hazard-analysis`
- No schema, migration, Supabase mutation, environment, secret, or deployment changes.
- `output/playwright/2026-07-10/module-shell-hardening/desktop-workers-night.png` is an external worktree change and is excluded from this work.

## Implemented Contract

- Accepts at most 10 photos and rejects larger batches without silent truncation.
- Accepts `image/jpeg`, `image/png`, `image/webp`, and `image/gif`, with a 20 MiB per-photo limit.
- Verifies JPEG, PNG, WebP, and GIF byte signatures before provider execution; MIME spoofing and signature read failures remain per-image rejections.
- Preserves empty, unsupported, oversized, signature-mismatched, and unreadable files as per-image validation results.
- Calls the vision provider independently for every valid image and returns `analyzed`, `rejected`, `failed`, or `unconfigured` per image.
- Returns aggregate `analyzed`, `partial`, `failed`, or `unconfigured` status without discarding successful image results.
- Uses an injectable `HazardPhotoVisionProvider`; contract tests require no external API key.
- Parses provider JSON through an exact candidate-only schema: at least one valid observation and candidate, separate candidate observation/inference, at most four candidates, bounded strings and arrays, and no unknown fields.
- Rejects `{}`, malformed items, model-supplied actions/evidence/controls/legal fields, and control or legal-authority claims hidden in summary, site signals, candidate labels, or candidate inferences.
- Moves byte-signature, model-schema, decision-transition, candidate-query, and positive-relevance rules into the pure `lib/photo-vision-analysis-policy.ts` module.
- Executes three `searchSafetyReferences` reads per candidate, creates a candidate-specific reference pool, applies positive lexical/catalog relevance against candidate-only signals, and builds a separate `buildDbHarnessPacket` for each candidate.
- Prevents generic or another candidate's references and controls from entering a candidate packet even when the search adapter returns a mixed pool.
- Marks a candidate `confirmed` only when its packet supplies positively relevant direct evidence and grounded controls; resolver failure or missing support becomes `insufficient` while the model candidate remains visible.
- Uses explicit `confirmedControls`; every `insufficient` DTO has empty `evidence` and `confirmedControls` arrays.
- Returns a user-decision DTO with `pending`, `accepted`, and `rejected` states. Pending or insufficient candidates allow rejection only, and the pure transition policy rejects acceptance until harness status is `confirmed`.

## TDD Evidence

1. Signature RED: `npm.cmd test -- tests/photo-vision-analysis.test.ts`
   - 1 failed, 17 passed. GIF was rejected while a PNG payload declared as JPEG reached the provider.
2. Strict-schema RED cycles with the same command:
   - Empty/incomplete output: 2 failed, 17 passed.
   - Authority fields: 4 failed, 19 passed.
   - Candidate limit, bounded strings, summary/site-signal claims, and hidden inference controls each failed before its policy rule was added.
3. Decision DTO RED with the same command:
   - 4 failed, 26 passed. `insufficient` retained evidence and pending candidates still allowed acceptance.
4. Default resolver isolation RED with the same command:
   - Candidate searches were shared: expected 6 calls, received 3.
   - After candidate searches were split, a generic `현장 위험 후보 확인` reference still contaminated both candidates until positive candidate-signal relevance was required.
5. Signature-read isolation RED with the same command:
   - One unreadable file rejected the whole batch before the read failure was converted to a per-image `invalid_signature` result.
6. Final GREEN: `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts`
   - 2 test files passed, 34 tests passed.

## Verification

- `npm.cmd test -- tests/photo-vision-analysis.test.ts tests/photo-vision-analysis-route.test.ts`
  - PASS: 2 files, 34 tests.
- `npm.cmd run typecheck`
  - PASS: `tsc --noEmit --incremental false`, exit code 0.
- `git diff --check`
  - Expected Windows LF-to-CRLF notices only; no whitespace errors.

## Concerns

- Byte signatures identify file families but do not fully decode image payloads; malformed images with a valid header may still fail at the provider and remain isolated to that image.
- Candidate relevance is conservative lexical/catalog matching. New terminology without a positive candidate-specific overlap returns `insufficient` instead of borrowing generic or neighboring-candidate evidence.
- DB/MCP grounding is read-only and may return `insufficient` when the safety reference catalog is unavailable or lacks positively relevant direct evidence.
- User decisions are represented by the DTO; persistence of accept/reject decisions belongs to the existing downstream workpack flow and is not added here.
- No live provider or Supabase credentials were used. Contract tests exercise the injectable provider and the real default resolver orchestration with a mocked read-only catalog adapter.
- Only the requested focused suites and TypeScript check are gates for this follow-up; the broad repository suite was not rerun.
