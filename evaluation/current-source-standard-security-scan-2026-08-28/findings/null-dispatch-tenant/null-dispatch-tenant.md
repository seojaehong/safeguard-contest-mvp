# NULL dispatch-log tenants bypass row-level authorization

- Severity: $(@{ruleId=authorization-bypass.null-tenant-rls; identity=; title=NULL dispatch-log tenants bypass row-level authorization; summary=dispatch_logs is nullable and its RLS accepts NULL, so authenticated roles can manage unscoped receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make organization_id non-null and remove NULL wildcard policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.null-tenant-rls; identity=; title=NULL dispatch-log tenants bypass row-level authorization; summary=dispatch_logs is nullable and its RLS accepts NULL, so authenticated roles can manage unscoped receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make organization_id non-null and remove NULL wildcard policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.null-tenant-rls; identity=; title=NULL dispatch-log tenants bypass row-level authorization; summary=dispatch_logs is nullable and its RLS accepts NULL, so authenticated roles can manage unscoped receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make organization_id non-null and remove NULL wildcard policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.null-tenant-rls; identity=; title=NULL dispatch-log tenants bypass row-level authorization; summary=dispatch_logs is nullable and its RLS accepts NULL, so authenticated roles can manage unscoped receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make organization_id non-null and remove NULL wildcard policies.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

dispatch_logs is nullable and its RLS accepts NULL, so authenticated roles can manage unscoped receipts.

## Root Cause



## Locations

- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=76; endLine=90; role=source}.path):76 (source)
- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=183; endLine=200; role=sink}.path):183 (sink)

## Validation

The policy explicitly accepts NULL for reads and writes. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Direct PostgREST bypasses application filters.
- Live grants were not probed.

## Attack Path

The policy explicitly accepts NULL for reads and writes.

## Remediation

Make organization_id non-null and remove NULL wildcard policies.

## Regression Tests

- Reject the negative path for null-dispatch-tenant.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
