# Organization-only RLS permits inconsistent cross-tenant relationship tuples

- Severity: $(@{ruleId=tenant-integrity.related-object-binding; identity=; title=Organization-only RLS permits inconsistent cross-tenant relationship tuples; summary=Child tables authorize only organization_id while accepting independent related-object IDs, permitting mixed-tenant tuples.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add composite tenant foreign keys and RLS checks for every related object.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=tenant-integrity.related-object-binding; identity=; title=Organization-only RLS permits inconsistent cross-tenant relationship tuples; summary=Child tables authorize only organization_id while accepting independent related-object IDs, permitting mixed-tenant tuples.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add composite tenant foreign keys and RLS checks for every related object.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=tenant-integrity.related-object-binding; identity=; title=Organization-only RLS permits inconsistent cross-tenant relationship tuples; summary=Child tables authorize only organization_id while accepting independent related-object IDs, permitting mixed-tenant tuples.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add composite tenant foreign keys and RLS checks for every related object.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=tenant-integrity.related-object-binding; identity=; title=Organization-only RLS permits inconsistent cross-tenant relationship tuples; summary=Child tables authorize only organization_id while accepting independent related-object IDs, permitting mixed-tenant tuples.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add composite tenant foreign keys and RLS checks for every related object.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Child tables authorize only organization_id while accepting independent related-object IDs, permitting mixed-tenant tuples.

## Root Cause



## Locations

- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=21; endLine=90; role=source}.path):21 (source)
- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=132; endLine=181; role=sink}.path):132 (sink)
- $(@{path=supabase/migrations/003_knowledge_runtime.sql; startLine=1; endLine=64; role=sink}.path):1 (sink)
- $(@{path=supabase/migrations/003_knowledge_runtime.sql; startLine=77; endLine=126; role=sink}.path):77 (sink)
- $(@{path=supabase/migrations/010_commercial_operations.sql; startLine=21; endLine=95; role=sink}.path):21 (sink)
- $(@{path=supabase/migrations/010_commercial_operations.sql; startLine=161; endLine=227; role=sink}.path):161 (sink)

## Validation

Independent foreign keys and organization-only policies do not enforce one tenant tuple. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Routes often add checks.
- Migration 010 deployment was not probed.

## Attack Path

Independent foreign keys and organization-only policies do not enforce one tenant tuple.

## Remediation

Add composite tenant foreign keys and RLS checks for every related object.

## Regression Tests

- Reject the negative path for composite-tenant-binding.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
