# KOSHA Current Master Recheck

검증 일시: 2026-07-20 KST

## Verdict

`CURRENT MASTER ALREADY SUPERSEDES WAVE2`

`feat/kosha-trust-registry-wave2`를 현재 `master` 위에 그대로 cherry-pick하면 안 된다. 현재 `master`는 이미 wave2의 `D-C-7`에 더해 `B-E-10` exact KOSHA registry와 KOSHA guide corpus tracing까지 포함한다. wave2 브랜치의 첫 커밋을 그대로 적용하면 `B-E-10`과 corpus trace 설정을 되돌릴 위험이 있어 cherry-pick을 중단했다.

## Current Head

- Authoritative base: `0835874c788797c0fa00b650e3ea31574b2868ac`
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\kosha-wave2-current-integration-20260720`
- Branch: `integrate/kosha-wave2-current-20260720`

## Exact KOSHA Assets Present

| Asset | Bytes |
|---|---:|
| `data/safety-knowledge/exact-kosha/d-c-13-2026.json` | 48,689 |
| `data/safety-knowledge/exact-kosha/d-c-7-2026.json` | 99,062 |
| `data/safety-knowledge/exact-kosha/b-e-10-2026.json` | 39,258 |

## Verification

- Focused Vitest: 5 files / 80 tests PASS
  - `tests/exact-trusted-kosha-grounding.test.ts`
  - `tests/exact-trusted-kosha-registry-wave2.test.ts`
  - `tests/kosha-grounding-fail-closed.test.ts`
  - `tests/kosha-current-review-run-ask.test.ts`
  - `tests/exact-kosha-applicability-policy.test.ts`
- Python acquisition tests: 19/19 PASS
  - `python -m unittest scripts.tests.test_acquire_exact_kosha_body`
- Strict TypeScript: PASS
  - `npm.cmd run typecheck`
- Production build: PASS, 28/28 static pages
  - `npm.cmd run build`

## Integration Decision

- Do not merge `feat/kosha-trust-registry-wave2` into current `master`; it is stale relative to current KOSHA registry lineage.
- Treat current `master` as carrying wave2-or-better KOSHA exact trust behavior.
- If further KOSHA work continues, start from `origin/master` and preserve the three exact pins: `D-C-13`, `D-C-7`, `B-E-10`.
- The older wave2 broad-suite RED remains historical evidence only. Current focused KOSHA product gates are green, but any full launch gate should still record broad-suite scope explicitly rather than reclassify older failures.

