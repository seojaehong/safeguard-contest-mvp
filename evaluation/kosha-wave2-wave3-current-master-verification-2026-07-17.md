# KOSHA Wave2/Wave3 Current Master Verification

Date: 2026-07-17
Verified code HEAD: `f23ae8077d5f182aa6a5a223d3717618fea6e5af`
Report commit: `e054731cbaa0d30beb8b581c294fe642461c837b`

## Verdict

Current `master` already contains the exact trusted KOSHA registry work for:

- `D-C-13-2026` exterior wall painting repair safety work
- `D-C-7-2026` scaffold structure and safety work
- `B-E-10-2026` de-energized electrical work near outage circuits

Do not range-merge old `feat/kosha-trust-registry-wave2` or other historical KOSHA worktrees into current `master`. Current `master` has later North Star, recipient share, UI, Hermes planning, and knowledge work that those old branches do not contain.

## Fresh Verification

Commands were executed on `master` at `f23ae8077d5f182aa6a5a223d3717618fea6e5af`.
The report commit only adds this evidence file and does not change production code.

```powershell
npm.cmd test -- --run tests/exact-trusted-kosha-registry-wave3.test.ts tests/exact-trusted-kosha-registry-wave2.test.ts tests/exact-trusted-kosha-grounding.test.ts tests/exact-kosha-applicability-policy.test.ts tests/grounded-generation-contract.test.ts tests/photo-vision-analysis.test.ts --maxWorkers=1 --no-file-parallelism
```

Result:

- Test files: 6 passed / 6
- Tests: 151 passed / 151

```powershell
python -m unittest scripts.tests.test_acquire_exact_kosha_body
```

Result:

- Tests: 19 passed / 19

Recent launch gates already executed on the same HEAD:

- `npm.cmd run build`: passed, 28/28 static pages
- `npm.cmd run typecheck`: passed
- `git diff --check`: passed

## NFT Trace Reality

The current build trace is different from the earlier wave reports because later work added another API surface that imports the exact KOSHA assets.

Current `.next` trace check:

- NFT manifests: 81
- Complete exact KOSHA consumers: 17
- Partial exact KOSHA consumers: 0
- Exact asset bytes: 187,009

Current complete consumer routes:

```text
api/agent/chat
api/ask
api/ask/stream
api/briefing/run
api/input-photos/hazard-analysis
api/mcp/[transport]
api/safety-reference/search
api/search
api/workpack/remediate
api/workpacks/[id]/improvements
api/workpacks/[id]/operation-graph
ask
interpretation/[id]
law/[id]
ops/api
precedent/[id]
search
```

The additional `ops/api` trace is not a regression by itself. It is a later operator/API surface and should be treated as current reality. Future NFT durability tests should lock either this 17-route set or an explicitly narrower route-scoped contract after reviewing the `ops/api` import path.

## Integration Boundary

- Keep the current three-item exact registry as the production direct-evidence boundary.
- Keep unverified KOSHA corpus rows out of direct evidence until exact body, PDF, URL/file, publication date, provenance digest, and human-reviewed receipt all pass.
- Preserve the SafeClaw evidence hierarchy: SIF and KOSHA establish practical hazard/control grounding first; law articles validate mandatory duties where applicable.
- Do not present KOSHA guidance-only controls as legal obligations.
- Do not use stale wave2 worktree evidence as current integration proof.
