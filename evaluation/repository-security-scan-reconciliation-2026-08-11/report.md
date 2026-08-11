# Repository Security Scan Reconciliation

## Verdict

`PASS_CORRECTED_FRESH_CURRENT_SOURCE_SCAN_SEALED_OPEN_FINDINGS`

Two sealed repository scans claim the same target revision, `f0c8a7be02becd53c21fb80842cf23c571f22b1f`, but report incompatible outcomes:

- `8fe9c06a-018c-446f-aa98-1b37df95287a`: partial coverage, 17 reportable findings, 1 deferred candidate.
- `03305068-49ff-4b73-8a24-84a91e64ff56`: complete coverage, 0 reportable findings, 0 deferred candidates.

Neither immutable scan is rewritten. The zero-finding result is not accepted as a Northstar security-complete proof.

## Corrected Fresh Scan

The corrected Standard scan `c4e9e2f1-7ce4-4313-a651-32205fca401f` is sealed at current-source revision `910eccb713848aa4aee26f0c411ed0f07ada04a6`, which includes the later deployed security remediation chain.

- Coverage: partial, 4 reviewed security surfaces.
- Findings: 14 reportable (8 medium, 6 low).
- Deferred candidates: 9.
- Machine predicates agree with the recorded dispositions.
- Security-complete claim allowed: false.

## Canonical Receipt Contradictions

The `03305068` discovery and validation receipts contain fail-open evidence contradictions:

1. `document_export_work_budgets` is classified `no_issue_found` while `sharedBudgetHelperPresent`, `xlsxUsesBudgetHelper`, and `hwpUsesBudgetHelper` are all `false`.
2. `archive_enrichment_membership` is classified `no_issue_found` while `workpackSiteFilterRequiresAuthorizedOrg` is `false`.

The receipt narrative cannot override its own negative control predicates.

## Later Security Chain

The later diff scan `3f0107a8-e4a4-4a5b-be37-a28bcea8b05a` found three reportable findings and deferred two candidates. All three findings have deployed remediation evidence at product commit `c4f58947dbbee20fb77edeb0edfddcc08c87f6a4`, but the two deferred candidates remain visible.

## Resolution

- The corrected fresh scan is complete and includes `c4f58947dbbee20fb77edeb0edfddcc08c87f6a4`.
- Require every receipt disposition to agree with its machine predicates.
- Preserve both original scans and the immutable original 18-finding baseline.
- Do not claim security-complete or zero-current-findings: the corrected scan retains 14 reportable findings and 9 deferred candidates.

## Boundaries

No DB, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`, and approval-gated boundaries remain unchanged.
