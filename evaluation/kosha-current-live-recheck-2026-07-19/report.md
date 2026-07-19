# KOSHA Current Live Recheck

- Date: 2026-07-19
- Local HEAD: `9e77e53671498d91284c71b9cb58a69401ed9e4e`
- Production build commit: `9e77e53671498d91284c71b9cb58a69401ed9e4e`
- Live status endpoint: `https://www.safeclaw.kr/api/safety-reference/status`

## Verdict

PASS. The current production build reports the KOSHA evidence harness as ready, with the exact trusted KOSHA registry loaded and the local reviewed corpus available.

## Live Runtime Evidence

- Status: `ready`
- Search ready: `true`
- Total safety reference items: `9,920`
- KOSHA technical total: `1,040`
- Technical guidelines: `803`
- Technical support regulations: `237`
- Exact trust registry: `ready`
- Exact trust loaded items: `3/3`
- Exact stable keys: `D-C-13`, `D-C-7`, `B-E-10`
- Exact versions: `D-C-13-2026`, `D-C-7-2026`, `B-E-10-2026`
- Local corpus: `ready`
- Local corpus inventory/items/chunks: `234 / 234 / 7,127`
- Local corpus failure count: `0`

## Verification

```powershell
npm.cmd test -- tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-grounding.test.ts tests\kosha-grounding-fail-closed.test.ts tests\safety-reference-status-route.test.ts tests\safety-reference-status-bundled-corpus.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: `6 files / 72 tests PASS`.

```powershell
python -m unittest scripts.tests.test_acquire_exact_kosha_body
```

Result: `19 tests PASS`.

## Boundary

- No database schema change was performed.
- No Supabase data mutation was performed.
- General KOSHA rows remain supporting or review-required unless separately exact-pinned.
- The current direct-production KOSHA set is limited to immutable pinned references `D-C-13`, `D-C-7`, and `B-E-10`.
- The evidence hierarchy remains `SIF -> KOSHA Guide -> law`, with law as mandate/validation layer rather than the first retrieval layer.

## Artifact

- Machine-readable summary: `evaluation/kosha-current-live-recheck-2026-07-19/status-summary.json`
