# Phase A Canonical Product Materialization

## Scope

- Base commit: `530efbfafb30c6145c1536172b260ff644845846`
- Branch: `feat/phase-a-canonical-workpack-materialization-20260716`
- Database and migrations: unchanged
- Ontology publication: not performed
- Runtime search path: unchanged

## Implemented Contract

- Runtime evidence packs are validated against the canonical Phase A registry before product projection.
- Chain, task, hazard, control, SIF, mapped KOSHA chunk provenance, and law provenance are preserved.
- Each canonical control produces one deterministic risk-assessment review row and one deterministic TBM review row.
- Every projected row remains `review_required`; `verifiedDocumentRows` stays empty and human confirmation stays pending.
- Product projection does not create likelihood, severity, or risk-level values and does not modify existing structured risk rows.
- Forged task, SIF, control, KOSHA, law, review-state, and stable-key values fail closed.
- MCP response, persisted evidence summary, and tenant-scoped reopen payload preserve the same Phase A product.

## Verification

| Check | Result |
| --- | --- |
| Focused materialization/runtime/MCP/Claw tests | PASS, 4 files / 52 tests |
| Ontology/MCP/generation/workpack regression tests | PASS, 4 files / 99 tests |
| TypeScript strict typecheck | PASS |
| `git diff --check` | PASS |
| Ownership diff check | PASS, 7 files including this report |

## Materialization Counts

| Canonical chain | Controls | Risk-assessment review rows | TBM review rows | Verified rows |
| --- | ---: | ---: | ---: | ---: |
| `work-at-height-fall` | 3 | 3 | 3 | 0 |
| `vehicle-machinery-entrapment` | 1 | 1 | 1 | 0 |
| `electrical-work-electrocution` | 5 | 5 | 5 | 0 |

Total deterministic review rows across the canonical registry: 18.
