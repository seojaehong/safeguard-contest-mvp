# Phase A ontology product materialization audit

## Scope

- Baseline: `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`
- Branch: `fix/phase-a-product-materialization`
- Chains: fall, entrapment, and electrocution
- Excluded: Share authority, database schema/migrations, packages, and lockfiles

## Baseline finding

The published graph resolver already assembled canonical Task, SIF/Accident, Hazard, Control, `mandatedBy` Article, and document targets. `query_safety_knowledge` returned the active evidence pack, but neither reviewed nor plain document generation queried that pack. Generated risk-assessment and TBM documents therefore had no stable row-level ontology provenance.

The active SIF records and mapped KOSHA guidance remain draft or unresolved. The existing KOSHA corpus gate is also not launch-ready. Product output must therefore stay review-required even though the published Task, Hazard, Control, and Article graph edges exist.

## Product connection

`phaseAProduct` now projects the exact path into both knowledge results and docpack results. Every Control has one risk-assessment target and one TBM target with a stable key. The deterministic renderer prepends the same path to document text and adds one structured risk row per Control.

The path is emitted in this order:

`Task -> SIF/Accident -> Hazard -> KOSHA Control -> mandatedBy Article -> document row`

Review-required candidates never populate `currentControls`; they use `현장 확인 필요`, place the candidate Control in `additionalControls`, and use `needsReview`. Reapplying the same product projection is idempotent by stable key.

Plain MCP and Claw generation now pass the original task text to the evidence-chain registry matcher. The three canonical tasks and the registry aliases `높은 곳 작업`, `차량계·기계 인접작업`, and `전기작업` therefore use the same materialization path. Reviewed generation uses the canonical task returned by the matched product only for the downstream diagnostic QA label.

## Chain audit

| Chain | SIF/Accident | Mapped KOSHA | Articles | Controls | Document rows | Verified rows |
|---|---:|---:|---:|---:|---:|---:|
| Fall | 2 | 3 | 3 | 3 | 6 | 0 |
| Entrapment | 2 | 0 | 1 | 1 | 2 | 0 |
| Electrocution | 3 | 5 | 5 | 5 | 10 | 0 |
| Total | 7 | 8 | 9 | 9 | 18 | 0 |

The obligation classifier still supports `statutory_mandate`, `technical_guidance_only`, `statutory_mandate_with_guidance`, and `review_required`. At the current corpus state, every effective product row is downgraded to `review_required`; verified rows remain exactly zero.

## Integrity

Materialized output is resealed with the existing generation-evidence timestamp and current HMAC secret. The JSON evidence summary stores and restores `phaseAProduct`, so reopen verification uses the same payload. A passing diagnostic QA result cannot override Phase A status: reviewed output exposes `phaseAReviewStatus.verdict=검토 필요`, `qaAuthority=diagnostic_only`, and pending human confirmation.

The plain MCP route now invokes an injectable handler with a tenant-aware workpack repository. The behavior test uses an in-memory implementation, not a live database or a static source scan, and verifies exact insert count and fields, exact organization/site read scope, HMAC reopen, zero foreign-tenant inserts, and blocked foreign-tenant reads.

## Verification

- RED baseline: missing product materialization boundary, exit 1.
- RED handler: reviewed and plain handlers made zero ontology calls.
- RED integrity: post-processing invalidated generation evidence.
- RED registry aliases: `높은 곳 작업` and `차량계·기계 인접작업` made zero matcher calls, 2 failed tests, exit 1.
- RED MCP persistence boundary: no injectable MCP docpack handler/repository module existed, exit 1.
- GREEN focused suite: 11 test files, 147 tests, exit 0.
- GREEN TypeScript strict typecheck: exit 0.

The repository-wide suite is not green and is reported separately from the focused product status. `npm.cmd test` exited 1: 143 test files total, 134 passed, 4 failed, and 5 skipped; 1435 tests total, 1420 passed, 1 failed, and 14 skipped. The non-green causes were two Next dev startup failures caused by a corrupt webpack cache and missing `.next/prerender-manifest.json`, one browser cleanup hook timeout, and one stale frontend browser-evidence `sourceIdentity` mismatch. No claim is made that the overall suite has zero remaining failures.

Evidence logs:

- `red-product-materialization.log`
- `red-product-handler.log`
- `red-generation-evidence.log`
- `red-alias-materialization.log`
- `red-mcp-persistence.log`
- `green-focused-tests.log`
- `green-typecheck.log`
- `full-suite.log`
