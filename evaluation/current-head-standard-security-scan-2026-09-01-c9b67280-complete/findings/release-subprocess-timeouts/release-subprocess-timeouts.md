# Release and publication subprocesses lack execution deadlines

## Severity

Low

## Attack Path

A hanging dependency, build plugin, or test input can occupy a release or CI worker indefinitely.

## Source Evidence

scripts/final_release_closeout.mjs:51-61 and publish_reports_wave1_evidence.mjs:21-31 call spawnSync without timeout.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Use the bounded subprocess helper with deadlines, output caps, and process-tree termination.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

