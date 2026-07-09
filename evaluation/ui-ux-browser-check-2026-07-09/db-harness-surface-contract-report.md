# DB Harness Surface Contract Check

Date: 2026-07-09

## Scope

- Added a user-facing DB harness contract summary derived from the same `DbHarnessPacket` used by generation.
- Connected the document evidence panel to the contract summary so the UI reads as DB-first, LLM-naturalization-only.
- Verified the current workspace first-screen typography state without changing the font stack again.
- No DB schema change, migration, embedding upload, or published ontology promotion was performed.

## Contract Added

`buildDbHarnessSurfaceContract(packet)` now exposes:

- `label`: `DB 하네스 계약`
- `status`: `locked` or `review_required`
- `headline`: DB evidence lock and LLM naturalization role
- `detail`: fixed source count and required document coverage
- `meta`: retrieval path and vector readiness
- `missing`: review-required evidence gaps

The workspace document evidence panel now uses this contract instead of a loose "하네스 메모리" label.

## Verification

Commands:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- Vitest: 2 files passed, 15 tests passed.
- TypeScript: `tsc --noEmit --incremental false` passed.
- Next build: completed successfully.

Browser check:

- Local route: `http://localhost:3018/workspace`
- Desktop and mobile first-screen checks passed.
- Expected core text found.
- Horizontal overflow: none detected.
- Console errors: none detected.
- H1 computed font:
  - Desktop: `Noto Sans KR`, weight `900`, size `44px`, line-height `50.16px`
  - Mobile: `Noto Sans KR`, weight `900`, size `36px`, line-height `42.48px`
- Screenshots:
  - `evaluation/ui-ux-browser-check-2026-07-09/workspace-harness-contract-desktop.png`
  - `evaluation/ui-ux-browser-check-2026-07-09/workspace-harness-contract-mobile.png`

## Notes

This is not the SIF embedding upload step. It tightens the commercial product contract around the existing DB harness: fixed DB evidence first, LLM only for naturalized writing, missing evidence surfaced as review-required.
