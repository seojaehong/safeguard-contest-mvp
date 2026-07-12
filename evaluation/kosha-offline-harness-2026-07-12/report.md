# KOSHA Offline Harness Remediation Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-harness`
- Remediation start: `bffb05fca441ce0ca355d0b1813ffe24666a16c4`
- P1 remediation start: `690bfcb56385dd1fb563103a1a38cde77f6e82c6`
- Scope: bounded local KOSHA evidence policy, final-result retrieval mode, pre-limit item-type filtering
- External v3 corpus: read-only and unchanged
- External v3 JSONL bytes: `79,424,591` (unchanged)
- Verification log: `evaluation/kosha-offline-harness-2026-07-12/remediation-verification.log`

## Remediation

- Every local `kosha_guide` item remains `evidence_role=supporting`. Corpus integrity may still set `kosha_guide.directEligible`, but that value is metadata only and does not promote the item to direct evidence.
- A local KOSHA item cannot independently create a risk row merely because it has an `evidenceRef`. A matching page reference may be attached as a supporting source only after a non-KOSHA reference grounds the row.
- Local `evidenceRole=direct` searches do not return KOSHA items, including corpus records whose `directEligible` metadata is true.
- Local/remote retrieval mode is calculated from the final returned items. If local candidates are deduplicated or truncated out, the actual remote mode remains `rest-ilike`, `ranked-rpc`, or `hybrid-vector-rpc`.
- Local corpus `itemType` filtering now runs before scoring and limit application, so a `technical-support-regulation` result is not starved by a higher-ranked guideline at `limit=1`.
- Supporting KOSHA now needs row-specific relevance: the recognized risk domain must match the direct row, or at least two non-generic identity terms from title/category/subcategory/keywords/risk tags must overlap. Generic terms such as `작업`, `안전`, and `관리` do not establish relevance.
- Supporting `evidenceRef` values are deduplicated and capped at 2 per direct row. Two preserves a primary guide plus one complementary source without turning one risk row into a broad bibliography.
- The existing ranking policy remains unchanged; relevance filtering happens before the same rank function is applied to supporting candidates.

## TDD Evidence

Tests were changed before production code. The first bounded RED run executed 26 tests and failed 5 for the intended semantics:

- remote retrieval mode was hard-coded or marked hybrid from pre-limit candidates;
- local KOSHA remained risk-row eligible and created an independent row;
- regulation lookup returned zero items at `limit=1` because guideline scoring consumed the slot.

The `directEligible=true` fixture then failed with `evidence_role=direct`, confirming that metadata was incorrectly promoting local evidence. After the minimal fixes, the two bounded harness files passed 26/26. A first expanded attempt exposed an over-broad filter that blocked five established non-KOSHA SIF risk-row tests; that attempt is invalidated. The filter was narrowed to `kosha_guide` only and the complete expanded gate was rerun from the beginning.

For the remaining P1, the new row fixture failed before production changes with 6 KOSHA refs attached to one direct forklift row: 3 relevant refs, a duplicate `forklift-primary` ref, and unrelated `broad-loading` and `broad-crane` refs. The expected cap was 2 and the RED exit was 1. After the focused relevance, deduplication, and cap change, the same test passed 1/1 with exit 0.

## Final Verification

All Vitest runs used `--maxWorkers=1 --no-file-parallelism`.

| Gate | Final result | Exit |
| --- | ---: | ---: |
| bounded baseline | 26/26 passed, new test excluded | 0 |
| original | 8/8 passed | 0 |
| expanded | 113/113 passed | 0 |
| new row relevance | 1/1 passed | 0 |
| corpus audit | 34/34 passed | 0 |
| additional impacted risk/search | 41/41 passed | 0 |
| strict typecheck | passed | 0 |
| diff check | clean | 0 |
| sequential production build | passed, attempt 1/1 | 0 |

The final expanded composition remains `7 + 1 + 19 + 43 + 5 + 31 + 3 + 3 + 1 = 113`; the new P1 test was run separately to preserve that baseline count. The additional impacted tests are `generation-trace-privacy` 2 and `photo-vision-analysis` 39. Same-branch `git pull --rebase --autostash` reported already up to date with exit 0. Before the current P1 build, the number of build processes scoped to this worktree was 0. Exactly one sequential build was launched; its captured output shows `Compiled successfully`, 27/27 static pages, and exit 0.
