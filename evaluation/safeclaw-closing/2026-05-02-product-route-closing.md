# SafeClaw product-route closing report

Generated at: 2026-05-02 15:48 KST

## Scope

This closing pass kept the existing `/workspace` document-generation engine intact and focused on making the SafeClaw product routes read as connected product screens instead of empty prototype shells.

## Implemented

- Replaced the public product menu with operational labels: 홈, 작업 입력, 문서팩, 근거, 작업자·교육, 현장 전파, 이력, 지식 DB, API 상태, 설정.
- Moved prototype terminology out of the visible product map copy: A/B variants, conservative/bold variants, and screen-count language are no longer presented as operating UI.
- Connected `/documents` edits back into the current workpack snapshot so edited deliverables can flow into save/dispatch paths instead of remaining isolated editor state.
- Prevented `/dispatch` from showing sample data as if it could be sent. Mail/SMS dispatch now opens only after a current workpack exists; sample state points users back to `/workspace`.
- Reworked `/knowledge` into the same SafeClaw module shell used by the product routes, with consistent Supabase/KOSHA knowledge DB counts.
- Added `source_url` to safety reference search selections so knowledge DB evidence cards can use real source links when present.

## Current DB status surfaced in UI

- `safety_reference_items`: displayed through `/knowledge`, `/evidence`, `/ops/api`, and `/api/safety-reference/status`.
- KOSHA technical support source: displayed as 1,040 expected-folder reference and current Supabase source count.
- Knowledge smoke still treats persistent writes as migration-gated; this pass did not apply schema changes or mutate existing DB records.

## Verification

- `npm.cmd run typecheck`: pass.
- `npm.cmd run build`: pass. Build output includes `/documents`, `/evidence`, `/workers`, `/dispatch`, `/archive`, `/knowledge`, `/ops/api`, `/settings`, `/prototype`, and `/workspace`.
- `npm.cmd run knowledge:smoke`: pass.
  - Seed hazards: 8
  - Official sources: 18
  - Legal mappings: 3
  - Templates: 4
- `npm.cmd run smoke:orchestration-download`: pass.
  - Weather mode: live
  - Ask mode: live
  - Document count: 11
  - Download count: 12
  - Failure count: 0
- `npm.cmd run audit:launch`: pass for API ask; dispatch was configuration-check only.

## Remaining notices

- `/archive`, `/workers`, and `/settings` are still partial/planned by design. They now show honest current-state copy instead of pretending to be complete.
- Full designer pixel alignment remains a separate pass. This pass removed prototype leakage and connected function state, but did not rebuild every screen from the final visual handoff.
- True server-side archive listing and worker management require the approved Supabase auth/storage flow, not just local current-workpack state.
