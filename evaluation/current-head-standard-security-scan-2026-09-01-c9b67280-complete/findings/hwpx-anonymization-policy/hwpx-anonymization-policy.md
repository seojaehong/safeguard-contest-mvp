# HWPX anonymization succeeds without a valid cleanup policy

## Severity

Medium

## Attack Path

A template with identifiers can be emitted as anonymized when cleanup-token configuration is absent or malformed.

## Source Evidence

scripts/anonymize_hwpx_templates.mjs:25-42 returns an empty token list on policy errors and 202-228 still writes status ok.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Require a valid non-empty digest-bound policy and verify forbidden identifiers are absent before success.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

