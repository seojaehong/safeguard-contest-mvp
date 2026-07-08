# Input Photo Hazard Vision Report

## Scope

- Workspace input photo upload was expanded from a single photo to up to 10 photos.
- Uploaded field photos can be sent to `/api/input-photos/hazard-analysis`.
- The route calls the existing OpenAI vision helper layer and returns reviewable hazard candidates for the risk assessment and TBM flow.
- No database schema change, migration, or bulk data mutation was performed.

## Implementation

- `components/SafeGuardCommandCenter.tsx`
  - Replaced the single input photo state with a 10-photo list.
  - Added preview cards, per-photo removal, vision analysis action, analysis summary, and candidate application.
  - When vision candidates exist, document generation appends a structured `[현장 사진 vision 위험요인 후보]` block to the workpack question.

- `app/api/input-photos/hazard-analysis/route.ts`
  - Added a multipart route for input-stage hazard photo analysis.
  - Enforces the 10-photo server limit before any external vision call.
  - Returns configured/unconfigured/failed state without blocking normal document generation.

- `lib/photo-vision-analysis.ts`
  - Added multi-photo hazard prompt, parser, severity normalization, and OpenAI Responses vision image helper reuse.
  - Kept improvement Before/After photo analysis on the same helper path.

- `tests/photo-vision-analysis.test.ts`
  - Added contracts for max photo count, multi-photo prompt, hazard JSON parsing, incomplete candidate fallback, and non-JSON failure.

## Verification

- `npm.cmd test -- tests\photo-vision-analysis.test.ts tests\operation-improvements.test.ts`
  - Test files: 2 passed
  - Tests: 14 passed

- `npm.cmd run typecheck`
  - Passed

- `npm.cmd run build`
  - Passed
  - New route included: `/api/input-photos/hazard-analysis`

- Browser UI check on `http://127.0.0.1:3028/workspace`
  - Desktop: 10 previews rendered, counter showed `10/10장 첨부`, analysis button enabled, no horizontal overflow.
  - Mobile: 10 previews rendered, counter showed `10/10장 첨부`, analysis button enabled, no horizontal overflow.
  - Raw check files:
    - `evaluation/backend-harness-gate-2026-07-08/browser-check/input-photo-ui-check.json`
    - `evaluation/backend-harness-gate-2026-07-08/browser-check/input-photo-ui-mobile-check.json`

- API limit check
  - Sending 11 photos returned HTTP 400 with `현장 사진은 최대 10장까지 분석할 수 있습니다.`

## Notes

- Real-world hazard extraction quality was not judged from synthetic test images. That requires a small set of actual field photos covering scaffold, workface, access route, vehicle path, PPE, and housekeeping cases.
- If `OPENAI_API_KEY` is missing in the runtime environment, the route returns an explicit unconfigured state and the workspace still allows text-based document generation.
