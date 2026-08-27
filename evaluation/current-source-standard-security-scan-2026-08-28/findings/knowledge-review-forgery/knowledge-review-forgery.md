# Tenant owners can forge knowledge approval and review-receipt state

- Severity: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Tenant owners can forge knowledge approval and review-receipt state; summary=Owner FOR ALL policies permit direct writes to review status, provider attribution, output, and receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke direct approval-field writes and use a transactional SECURITY DEFINER review RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Tenant owners can forge knowledge approval and review-receipt state; summary=Owner FOR ALL policies permit direct writes to review status, provider attribution, output, and receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke direct approval-field writes and use a transactional SECURITY DEFINER review RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Tenant owners can forge knowledge approval and review-receipt state; summary=Owner FOR ALL policies permit direct writes to review status, provider attribution, output, and receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke direct approval-field writes and use a transactional SECURITY DEFINER review RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Tenant owners can forge knowledge approval and review-receipt state; summary=Owner FOR ALL policies permit direct writes to review status, provider attribution, output, and receipts.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Revoke direct approval-field writes and use a transactional SECURITY DEFINER review RPC.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Owner FOR ALL policies permit direct writes to review status, provider attribution, output, and receipts.

## Root Cause



## Locations

- $(@{path=supabase/migrations/003_knowledge_runtime.sql; startLine=21; endLine=64; role=source}.path):21 (source)
- $(@{path=supabase/migrations/003_knowledge_runtime.sql; startLine=94; endLine=126; role=sink}.path):94 (sink)
- $(@{path=lib/knowledge-review.ts; startLine=1029; endLine=1208; role=sink}.path):1029 (sink)

## Validation

Direct PostgREST can write state guarded review code later trusts. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Publication remains approval-gated.

## Attack Path

Direct PostgREST can write state guarded review code later trusts.

## Remediation

Revoke direct approval-field writes and use a transactional SECURITY DEFINER review RPC.

## Regression Tests

- Reject the negative path for knowledge-review-forgery.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
