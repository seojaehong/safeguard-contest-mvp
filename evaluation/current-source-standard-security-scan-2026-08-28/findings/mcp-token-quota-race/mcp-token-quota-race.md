# MCP token quota check and issuance are non-atomic

- Severity: $(@{ruleId=race-condition.token-quota; identity=; title=MCP token quota check and issuance are non-atomic; summary=Concurrent issuance calls can all pass a separate count check and insert past the cap.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Use a locked transactional recount-and-insert RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=race-condition.token-quota; identity=; title=MCP token quota check and issuance are non-atomic; summary=Concurrent issuance calls can all pass a separate count check and insert past the cap.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Use a locked transactional recount-and-insert RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=race-condition.token-quota; identity=; title=MCP token quota check and issuance are non-atomic; summary=Concurrent issuance calls can all pass a separate count check and insert past the cap.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Use a locked transactional recount-and-insert RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=race-condition.token-quota; identity=; title=MCP token quota check and issuance are non-atomic; summary=Concurrent issuance calls can all pass a separate count check and insert past the cap.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Use a locked transactional recount-and-insert RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Concurrent issuance calls can all pass a separate count check and insert past the cap.

## Root Cause



## Locations

- $(@{path=app/api/mcp-tokens/route.ts; startLine=247; endLine=278; role=source}.path):247 (source)
- $(@{path=lib/mcp-token-service.ts; startLine=80; endLine=82; role=sink}.path):80 (sink)
- $(@{path=supabase/migrations/007_mcp_tokens.sql; startLine=14; endLine=30; role=sink}.path):14 (sink)

## Validation

No serialized database operation enforces the cap. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Tokens remain site-bound and expiring.

## Attack Path

No serialized database operation enforces the cap.

## Remediation

Use a locked transactional recount-and-insert RPC.

## Regression Tests

- Reject the negative path for mcp-token-quota-race.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
