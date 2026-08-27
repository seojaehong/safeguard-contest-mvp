# Documents table is exposed without row-level security

- Severity: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Documents table is exposed without row-level security; summary=Migration 001 creates document bodies and citations without RLS; normal Supabase grants can expose direct REST access if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS, revoke broad grants, and add least-privilege tenant policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Documents table is exposed without row-level security; summary=Migration 001 creates document bodies and citations without RLS; normal Supabase grants can expose direct REST access if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS, revoke broad grants, and add least-privilege tenant policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Documents table is exposed without row-level security; summary=Migration 001 creates document bodies and citations without RLS; normal Supabase grants can expose direct REST access if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS, revoke broad grants, and add least-privilege tenant policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Documents table is exposed without row-level security; summary=Migration 001 creates document bodies and citations without RLS; normal Supabase grants can expose direct REST access if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS, revoke broad grants, and add least-privilege tenant policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Migration 001 creates document bodies and citations without RLS; normal Supabase grants can expose direct REST access if deployed.

## Root Cause



## Locations

- $(@{path=supabase/migrations/001_init.sql; startLine=8; endLine=16; role=source}.path):8 (source)

## Validation

No later canonical migration protects documents. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Live grants were not probed.

## Attack Path

No later canonical migration protects documents.

## Remediation

Enable RLS, revoke broad grants, and add least-privilege tenant policies.

## Regression Tests

- Reject the negative path for documents-no-rls.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
