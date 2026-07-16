# SIF Accident Ontology Overlay Evaluation

- Generated: `2026-07-16T12:09:33.5309708+09:00`
- Branch: `feat/sif-accident-overlay-20260716`
- Base: `origin/feat/northstar-24h-integration-20260715@b93aab7f4c18b7563c7b9342e08956c0c8fd8d1a`
- Status: pass

## Scope

- Added three draft `Accident` nodes and three draft `Hazard-evidencedBy-Accident` edges as a separate overlay.
- Preserved the seven node kinds and seven edge relations without schema or migration changes.
- Kept the source-generated JSON at 171 nodes and 182 edges; the composed full seed is 174 nodes and 185 edges.
- Performed no database access, schema change, migration, upload, or data mutation.

## Provenance

| Source item | Hazard | Content hash |
| --- | --- | --- |
| `sif-아카이브-건설업-00323` | `Hazard_추락` | `e6035abf293df3d2b5d4a59083c1276955f8f47ee7c37743bc0646d185dea770` |
| `sif-아카이브-건설업-00024` | `Hazard_충돌_협착_끼임` | `4ae1315616343d8dcc50385276c2d6d847a6f5be613c2825fabdf2525cfc288f` |
| `sif-아카이브-건설업-01798` | `Hazard_감전_직접_간접_접촉` | `ba16f6e2587914f70b8a37d1f7b95e0b3ab8b29e8debea6570141cf1b8c3374a` |

- Corpus hash: `2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e`
- Citation form: `ref:safety_reference_items:<source_item_id>`
- Evidence role: `hazard_priority_only`
- LLM role: `naturalize_only`
- Node text contains only the source accident-overview excerpt. No source controls or `mitigatedBy` relation were copied.

## Visibility

- Full graph queries return the matching draft accident for `고소작업`, `지게차`, and `전기 작업`.
- Published graph queries return no accident for the same tasks.
- All overlay nodes and edges remain `review_state: "draft"`.

## TDD Evidence

| Phase | Command | Result |
| --- | --- | --- |
| Baseline | `npm.cmd test -- tests/ontology-seed.test.ts tests/ontology-query.test.ts` | 21 passed |
| RED | same focused command after tests | 5 expected failures, 24 passed |
| GREEN | same focused command after implementation | 29 passed |

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Generator syntax | `node --check scripts/ontology/gen-seed-from-md.mjs` | pass |
| TypeScript | `npm.cmd run typecheck` | pass |
| Ontology regression | `npm.cmd test -- <all tests/ontology*.test.ts>` | 134 passed, 4 skipped |
| Patch whitespace | `git diff --check` | pass |
