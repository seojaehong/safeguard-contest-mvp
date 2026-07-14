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

## Verification

- RED baseline: missing product materialization boundary, exit 1.
- RED handler: reviewed and plain handlers made zero ontology calls.
- RED integrity: post-processing invalidated generation evidence.
- GREEN focused suite: 10 test files, 136 tests, exit 0.
- GREEN TypeScript strict typecheck: exit 0.
- Remaining RED tests: 0.

Evidence logs:

- `red-product-materialization.log`
- `green-focused-tests.log`
- `green-typecheck.log`
