# Ontology failure responses bypass output ceilings and expose upstream bodies

- Severity: medium
- Confidence: high
- Rule: `information-exposure.public-ontology-error-projection`
- Target revision: `b5f145120766cd2ef904fce38ef32ed1a9facf74`

## Summary

Non-2xx Supabase bodies are embedded in Error.message and returned publicly; failure responses bypass the final success-only output ceiling.

## Code Evidence

- `lib/ontology-graph.ts:102-109`
- `lib/ontology-graph.ts:166-188`
- `app/api/ontology/graph/route.ts:11-20`

## Attack Path

Non-2xx Supabase bodies are embedded in Error.message and returned publicly; failure responses bypass the final success-only output ceiling.

- Impact: medium
- Likelihood: medium

## Limitations

- No live provider failure was induced.

## Remediation

Log bounded diagnostics server-side under a correlation ID and return fixed bounded public error codes for all failure paths.

## Scan Boundaries

No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation was performed. Exact saved Share remains `MISSING_EVIDENCE`. Approval-gated deployment and database claims remain unverified.

