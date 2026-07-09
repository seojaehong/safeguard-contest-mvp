# DB Harness Risk Label Follow-up

Date: 2026-07-10 KST
Branch: `feature/backend-harness-gate`
Deploy commit: `a310e4b`
Production URL: `https://www.safeclaw.kr`

## Issue

The DB harness was technically connected, but some risk rows still read like source catalog titles instead of field hazards.

Examples from the previous live probe:

- `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정`
- `산업안전일반분야·기술지침 관련 위험: 유해·위험요인 미확인`

This made the product feel like it was dumping database/API content into the document, rather than using the database as a fixed evidence harness and then turning it into usable field language.

## Change

- Kept official KOSHA/SIF titles in `evidenceRefs`.
- Converted `hazard` labels into field-facing risk language.
- Suppressed generic catalog prefixes such as `산업안전일반분야·기술지침`.
- Prevented redundant wording like `위험 ... 관련 위험`.
- Added regression coverage in `tests/commercial-harness.test.ts`.

## Local Verification

Passed:

- `npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\workspace-generation-progress.test.ts`
- `npm.cmd run build`
- `npm.cmd run typecheck`
- `npm.cmd test -- tests\workspace-layout-regression.test.ts`

Note: `typecheck` and `build` should not be run in parallel because `.next/types` can be regenerated during build. A parallel run produced missing `.next/types` files, then a standalone typecheck passed.

## Production Verification

Source: `postdeploy-stream-summary.json`

Endpoint:

`https://www.safeclaw.kr/api/ask/stream?verify=a310e4b-risk-labels-final`

Checks:

- HTTP response: `200`
- Final stream payload found: `true`
- Risk rows found: `true`
- Risk row validation issues: none
- Quality contract: `ready`
- DB harness mode: `db_harness_first`
- LLM role: `naturalize_only`
- Official source code/title removed from hazard labels: `true`
- Official source titles preserved in evidence references: `true`
- TBM questions avoid duplicated `위험 위험`: `true`

Live row sample:

```text
추락 위험: 작업발판·난간·개구부 미확인
화재 위험: 가동부 방호덮개와 비상정지장치 미확인
전도 위험: 가동부 방호덮개와 비상정지장치 미확인
유해·위험요인 미확인
강풍 상황에서 이동식 비계가 흔들리며 작업자가 추락하거나 비계가 전도될 위험
```

Evidence references still preserve the official source titles:

```text
D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정
B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정
G-67-2011 건물 외벽 청소 작업에 관한 기술지침
```

## UI Overlap Guard

The latest local Playwright regression pass also covered workspace layout:

- `tests/workspace-layout-regression.test.ts`: 14 tests passed
- Existing postdeploy overlap evidence remains in `evaluation/northstar-72h-2026-07-10/workspace-overlap-redetail-2/postdeploy-summary.json`
- The short/zoom-like postdeploy checks in that file are all passing for desktop and mobile probes.

## Current Read

This does not solve every product-quality concern yet, but it closes one visible gap: the backend harness now shows up in the document as field-ready risk language, while the official database titles stay where they belong, in evidence references.
