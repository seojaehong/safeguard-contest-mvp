# HWPX inventory reads full files before enforcing a size limit

## Severity

Low

## Attack Path

A large local HWPX candidate can force full-memory allocation during inventory.

## Source Evidence

scripts/hwpx_template_inventory.mjs:44-66 calls readFileSync before any byte ceiling.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Stat and reject oversized files, then parse only a bounded ZIP tail and central directory.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

