# KOSHA Offline Harness Remediation Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-harness`
- Remediation start: `bffb05fca441ce0ca355d0b1813ffe24666a16c4`
- Scope: bounded local KOSHA evidence policy, final-result retrieval mode, pre-limit item-type filtering
- External v3 corpus: read-only and unchanged
- Verification log: `evaluation/kosha-offline-harness-2026-07-12/remediation-verification.log`

## Remediation

- Every local `kosha_guide` item remains `evidence_role=supporting`. Corpus integrity may still set `kosha_guide.directEligible`, but that value is metadata only and does not promote the item to direct evidence.
- A local KOSHA item cannot independently create a risk row merely because it has an `evidenceRef`. A matching page reference may be attached as a supporting source only after a non-KOSHA reference grounds the row.
- Local `evidenceRole=direct` searches do not return KOSHA items, including corpus records whose `directEligible` metadata is true.
- Local/remote retrieval mode is calculated from the final returned items. If local candidates are deduplicated or truncated out, the actual remote mode remains `rest-ilike`, `ranked-rpc`, or `hybrid-vector-rpc`.
- Local corpus `itemType` filtering now runs before scoring and limit application, so a `technical-support-regulation` result is not starved by a higher-ranked guideline at `limit=1`.

## TDD Evidence

Tests were changed before production code. The first bounded RED run executed 26 tests and failed 5 for the intended semantics:

- remote retrieval mode was hard-coded or marked hybrid from pre-limit candidates;
- local KOSHA remained risk-row eligible and created an independent row;
- regulation lookup returned zero items at `limit=1` because guideline scoring consumed the slot.

The `directEligible=true` fixture then failed with `evidence_role=direct`, confirming that metadata was incorrectly promoting local evidence. After the minimal fixes, the two bounded harness files passed 26/26. A first expanded attempt exposed an over-broad filter that blocked five established non-KOSHA SIF risk-row tests; that attempt is invalidated. The filter was narrowed to `kosha_guide` only and the complete expanded gate was rerun from the beginning.

## Final Verification

All Vitest runs used `--maxWorkers=1 --no-file-parallelism`.

| Gate | Final result | Exit |
| --- | ---: | ---: |
| original | 8/8 passed | 0 |
| expanded | 113/113 passed | 0 |
| corpus audit | 34/34 passed | 0 |
| additional impacted risk/search | 41/41 passed | 0 |
| strict typecheck | passed | 0 |
| sequential production build | passed, attempt 1/1 | 0 |

The final expanded composition is `7 + 1 + 19 + 43 + 5 + 31 + 3 + 3 + 1 = 113`. The additional impacted tests are `generation-trace-privacy` 2 and `photo-vision-analysis` 39. Before the build, the number of build processes scoped to this worktree was 0. The sole build compiled successfully, generated 27/27 static pages, and returned exit 0.
