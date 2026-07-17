# KOSHA Current-Head Refresh

Generated: 2026-07-18T01:06:54.0798498+09:00

HEAD: `32f5fd9732ca18d5981be82ae5532b4f5ba78aff`

Status: PASS

## Scope

This refresh verifies the current master HEAD after the latest live release integrity audit. It covers:

- KOSHA exact trust registry and applicability policy
- KOSHA corpus audit
- SIF/KOSHA/ontology integration tests
- Exact KOSHA acquisition Python tests
- Strict TypeScript typecheck
- Production build
- Next output-file-tracing inclusion for exact KOSHA assets

No database migration or production data mutation was performed.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts` | PASS, 6 files / 114 tests |
| `python -m unittest scripts.tests.test_acquire_exact_kosha_body` | PASS, 19 tests |
| `npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts` | PASS, 1 file / 110 tests |
| `npm.cmd run typecheck` | PASS |
| SIF/KOSHA/ontology broad suite | PASS, 31 files passed / 3 skipped, 395 tests passed / 4 skipped |
| `npm.cmd run build` | PASS, 28/28 static pages |

## Next Trace

Exact KOSHA assets:

- `data/safety-knowledge/exact-kosha/d-c-13-2026.json` - 48,689 bytes
- `data/safety-knowledge/exact-kosha/d-c-7-2026.json` - 99,062 bytes
- `data/safety-knowledge/exact-kosha/b-e-10-2026.json` - 39,258 bytes

Trace result:

- NFT manifests: 81
- Exact assets: 3
- Manifests with all exact assets: 17
- Partial asset manifests: 0
- Total exact asset bytes: 187,009

Consumer manifests include the safety-reference/search, ask, MCP, photo hazard analysis, operation graph, workpack remediation, interpretation/law/precedent, ops API, and search server routes.

## Notes

- This is a current-head evidence refresh, not a new product feature.
- The pre-existing `output/playwright/2026-07-10/module-shell-hardening/*.png` working-tree changes were preserved and not staged.
