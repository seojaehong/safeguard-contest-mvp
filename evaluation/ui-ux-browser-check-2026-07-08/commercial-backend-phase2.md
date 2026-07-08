# SafeClaw Commercial Backend Phase 2 Draft

Date: 2026-07-08

## Scope

This pass prepares the commercial backend contract without applying a production database migration.

Implemented draft surfaces:

- `010_commercial_operations.sql`
  - `workpack_share_sessions`
  - `workpack_read_confirmations`
  - `workpack_improvements`
  - `workpack_improvement_photos`
  - `safety_reference_embeddings`
  - draft `workpacks.quality_contract` and `workpacks.ontology_qa` columns
- API draft routes:
  - `GET/POST /api/workpacks/[id]/share-sessions`
  - `GET/POST /api/workpacks/[id]/read-confirmations`
  - `GET/POST /api/workpacks/[id]/improvements`
- Typed helpers:
  - share session defaults to invited-only
  - anonymous read confirmation is rejected
  - Before/After photo attachments produce a reviewable improvement candidate
  - storage paths are scoped by organization, workpack, and improvement

## Product Contract

The commercial loop is:

1. A manager creates a workpack.
2. The workpack is shared through an invited-only session.
3. Workers confirm read/ack status with a known display name and snapshot.
4. A manager records improvement candidates, including Before/After photos.
5. Approved improvements can later feed the next risk assessment and TBM.

## Safety Notes

- The production DB migration was not applied.
- Existing workpack save paths remain schema-change-free. They do not send new `quality_contract` or `ontology_qa` columns until the migration is approved and deployed.
- Public anonymous links are not enabled in the draft schema.
- Vision analysis is represented as a queued/reviewable payload. A provider integration should be added behind a separate timeout and fallback policy before calling it production-ready.

## Verification

- `npm.cmd test -- tests/workpack-commercial.test.ts`
  - 1 file passed, 4 tests passed during the initial RED/GREEN helper contract.
- `npm.cmd test -- tests/workpack-commercial.test.ts tests/commercial-migration.test.ts tests/workpack-store.test.ts`
  - 3 files passed, 11 tests passed after review fixes.
- `npm.cmd test -- tests/workpack-commercial.test.ts tests/commercial-migration.test.ts tests/workpack-store.test.ts tests/workspace-pages.test.ts tests/operation-improvements.test.ts tests/workpack-ontology-qa.test.ts tests/quality-contract.test.ts tests/mcp-tools.test.ts`
  - 8 files passed, 45 tests passed after review fixes.
- `npm.cmd run typecheck`
  - passed after review fixes.
- `npm.cmd run build`
  - passed with new dynamic routes listed:
    - `/api/workpacks/[id]/improvements`
    - `/api/workpacks/[id]/read-confirmations`
    - `/api/workpacks/[id]/share-sessions`

## Review Fixes

- Read confirmations now reject empty worker snapshots.
- Share session confirmation fetch failures now return a clear 500 instead of silently returning an empty confirmation list.
- Improvement photo upload failures now clean up the created improvement candidate and uploaded objects where available.
- Cleanup failures are not reported as completed; the API tells the operator to inspect storage state when cleanup cannot be confirmed.
- The draft migration now creates a private `safeclaw-improvement-photos` storage bucket.
