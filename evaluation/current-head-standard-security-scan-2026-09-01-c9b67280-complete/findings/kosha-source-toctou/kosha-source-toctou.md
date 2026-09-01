# KOSHA corpus bytes can change after identity capture

## Severity

Medium

## Attack Path

A same-run local or CI artifact supplier can replace a preflighted ZIP or PDF before parsing.

## Source Evidence

scripts/snapshot_kosha_guide_corpus.py hashes paths at 1138-1169 and reopens them at 1925-1941 without revalidation.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Parse immutable staged bytes or revalidate file digest and ZIP member metadata immediately before reads.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

