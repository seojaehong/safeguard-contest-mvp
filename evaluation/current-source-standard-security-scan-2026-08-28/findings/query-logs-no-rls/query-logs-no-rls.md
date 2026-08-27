# Query logs table is exposed without row-level security

- Severity: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Query logs table is exposed without row-level security; summary=Migration 001 creates query_logs without RLS, exposing stored query text under normal grants if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS and make writes service-role-only.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Query logs table is exposed without row-level security; summary=Migration 001 creates query_logs without RLS, exposing stored query text under normal grants if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS and make writes service-role-only.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Query logs table is exposed without row-level security; summary=Migration 001 creates query_logs without RLS, exposing stored query text under normal grants if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS and make writes service-role-only.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.missing-row-level-security; identity=; title=Query logs table is exposed without row-level security; summary=Migration 001 creates query_logs without RLS, exposing stored query text under normal grants if deployed.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Enable RLS and make writes service-role-only.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Migration 001 creates query_logs without RLS, exposing stored query text under normal grants if deployed.

## Root Cause



## Locations

- $(@{path=supabase/migrations/001_init.sql; startLine=1; endLine=6; role=source}.path):1 (source)

## Validation

No later canonical migration protects query_logs. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Live grants were not probed.

## Attack Path

No later canonical migration protects query_logs.

## Remediation

Enable RLS and make writes service-role-only.

## Regression Tests

- Reject the negative path for query-logs-no-rls.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
