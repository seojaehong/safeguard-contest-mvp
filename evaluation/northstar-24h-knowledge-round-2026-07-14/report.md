# Northstar 24h LLM Wiki / Knowledge Verification

Date: 2026-07-14

Base: `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`

Branch: `feat/northstar-24h-knowledge-round`

## Result

The minimum governed knowledge connection is implemented without a schema,
migration, or data change. Raw events, generated candidates, mandatory human
review, and published ontology are separate code and UI states. Hermes/LLM output
is returned as an unpublished in-memory candidate and cannot write or publish.

## Contract Counts

| Item | Count |
| --- | ---: |
| Changed files | 14 |
| Promotion stages | 4 |
| Authority/provenance lanes | 6 |
| New API routes | 1 |
| API routes changed to stateless candidate generation | 1 |
| Database schema changes | 0 |
| Migration files | 0 |
| Database mutations executed | 0 |
| Publish controls/endpoints added | 0 |

## TDD Evidence

RED was observed before implementation:

- missing `lib/knowledge-governance.ts`
- missing `GET /api/knowledge/governance`
- `POST /api/knowledge/regenerate` imported Supabase and contained an INSERT
- `/knowledge` did not render the four stages or six authority lanes
- generic `kosha-accident` events were initially over-classified as SIF until an
  explicit `item_type: "sif-case"` gate was added

GREEN verification:

- Focused Vitest/Playwright: 4 files, 15 tests passed, 0 failed
- TypeScript strict check: passed
- Browser viewports: 1440x900 and 390x844
- Browser assertions: 4 ordered stages, 6 ordered authority lanes, no horizontal
  overflow, and 0 mutation/publish controls

## Boundaries

- Existing authenticated `/api/knowledge/ingest` remains the product-owned raw
  event storage path.
- `/api/knowledge/regenerate` no longer imports Supabase or writes
  `knowledge_regeneration_runs`.
- Human approval and ontology publication are read-only states in this round.
- Future review audit fields are proposed only in ADR 0002.

## Evidence Files

- `focused-tests.log`
- `typecheck.log`
- `docs/adr/0002-knowledge-promotion-provenance-boundary.md`
