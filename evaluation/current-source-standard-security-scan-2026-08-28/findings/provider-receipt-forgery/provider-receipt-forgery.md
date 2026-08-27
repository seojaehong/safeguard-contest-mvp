# Owners can forge provider dispatch receipts through direct PostgREST

- Severity: $(@{ruleId=data-authenticity.provider-receipt-forgery; identity=; title=Owners can forge provider dispatch receipts through direct PostgREST; summary=The owner FOR ALL dispatch_logs policy exposes provider receipt fields to direct tenant writes.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke tenant mutation rights and write receipts only through a server path.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=data-authenticity.provider-receipt-forgery; identity=; title=Owners can forge provider dispatch receipts through direct PostgREST; summary=The owner FOR ALL dispatch_logs policy exposes provider receipt fields to direct tenant writes.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke tenant mutation rights and write receipts only through a server path.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=data-authenticity.provider-receipt-forgery; identity=; title=Owners can forge provider dispatch receipts through direct PostgREST; summary=The owner FOR ALL dispatch_logs policy exposes provider receipt fields to direct tenant writes.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke tenant mutation rights and write receipts only through a server path.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=data-authenticity.provider-receipt-forgery; identity=; title=Owners can forge provider dispatch receipts through direct PostgREST; summary=The owner FOR ALL dispatch_logs policy exposes provider receipt fields to direct tenant writes.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke tenant mutation rights and write receipts only through a server path.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

The owner FOR ALL dispatch_logs policy exposes provider receipt fields to direct tenant writes.

## Root Cause



## Locations

- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=76; endLine=90; role=source}.path):76 (source)
- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=183; endLine=200; role=sink}.path):183 (sink)
- $(@{path=app/api/dispatch-logs/route.ts; startLine=72; endLine=77; role=sink}.path):72 (sink)
- $(@{path=app/api/dispatch-logs/route.ts; startLine=105; endLine=157; role=sink}.path):105 (sink)

## Validation

Direct table access bypasses the API server-receipt gate. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Provider dispatch is preview-only.

## Attack Path

Direct table access bypasses the API server-receipt gate.

## Remediation

Revoke tenant mutation rights and write receipts only through a server path.

## Regression Tests

- Reject the negative path for provider-receipt-forgery.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
