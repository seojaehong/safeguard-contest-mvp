# Ontology Evidence Invariant Gate

- Generated: `2026-07-13T11:04:28.9866816+09:00`
- Branch: `fix/ontology-evidence-invariant-gate`
- Status: pass
- Scope: application and test code only; no DB, schema, migration, or data mutation

## Findings Remediated

1. `sif-아카이브-건설업-01985` remains draft, unresolved, `autoConfirm=false`, and review-only. It is excluded from active citations, the `naturalize_only` fixed pack, and the MCP `evidenceContract`. It remains available only under explicit review diagnostics.
2. A failed quality result now invalidates any prior human confirmation by returning `humanConfirmation` to `pending`. A failed result therefore cannot coexist with `humanConfirmation.status=confirmed`.

## Preserved Contracts

- Active evidence retains the existing authority roles: SIF is `hazard_priority_only`, KOSHA is `technical_guidance_only`, and law is the current `mandatedBy` authority.
- `naturalize_only`, immutable fixed packs, the current provider fallback, quality gate, and human confirmation gate remain unchanged.
- The existing chains remain registered and covered: `work-at-height-fall`, `vehicle-machinery-entrapment`, and `electrical-work-electrocution`.
- Internal assembled packs retain review-only material for operator diagnostics; only active projections omit it.

## TDD Evidence

- RED: `npm.cmd test -- tests/ontology-evidence-chains.test.ts` produced 4 expected failures and 41 passes. The failures covered active citations, naturalizer fixed packs, MCP active evidence, and confirmed-to-failed quality transition.
- GREEN: the same focused file passed 45 of 45 tests after the minimal implementation.
- Focused regression: ontology plus MCP transformation tests passed 71 of 71 tests.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Focused tests | `npm.cmd test -- tests/ontology-evidence-chains.test.ts tests/mcp-tools.test.ts` | pass, 71/71 |
| TypeScript | `npm.cmd run typecheck` | pass |
| Patch whitespace | `git diff --check` | pass |

The first typecheck attempt exposed missing local installs for declared `pdf-lib` and `@pdf-lib/fontkit` dependencies. `npm.cmd install --ignore-scripts --no-audit --no-fund` restored the worktree dependencies without changing `package-lock.json`; the repeated typecheck passed.

## Changed Surfaces

- `lib/ontology/evidence-chain.ts`
- `lib/mcp-tools.ts`
- `tests/ontology-evidence-chains.test.ts`
- `evaluation/ontology-evidence-invariant-gate-2026-07-13/report.md`
- `evaluation/ontology-evidence-invariant-gate-2026-07-13/report.json`
