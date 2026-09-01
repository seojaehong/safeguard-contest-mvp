# Final-output integrity audit buffers unbounded HTTP responses

## Severity

Low

## Attack Path

A slow or oversized configured endpoint can stall or exhaust the local audit worker.

## Source Evidence

scripts/final_output_integrity_audit.mjs:155-171 fetches without a deadline and calls response.text without a byte cap.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Use AbortController deadlines and bounded streaming response reads.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

