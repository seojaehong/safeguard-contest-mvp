# Public RLS exposes complete safety-reference bodies and payloads

- Severity: $(@{ruleId=information-exposure.raw-corpus; identity=; title=Public RLS exposes complete safety-reference bodies and payloads; summary=Raw safety-reference rows include body and payload while public SELECT bypasses the bounded API projection.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Remove anon SELECT and expose an approved bounded view.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=information-exposure.raw-corpus; identity=; title=Public RLS exposes complete safety-reference bodies and payloads; summary=Raw safety-reference rows include body and payload while public SELECT bypasses the bounded API projection.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Remove anon SELECT and expose an approved bounded view.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=information-exposure.raw-corpus; identity=; title=Public RLS exposes complete safety-reference bodies and payloads; summary=Raw safety-reference rows include body and payload while public SELECT bypasses the bounded API projection.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Remove anon SELECT and expose an approved bounded view.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=information-exposure.raw-corpus; identity=; title=Public RLS exposes complete safety-reference bodies and payloads; summary=Raw safety-reference rows include body and payload while public SELECT bypasses the bounded API projection.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Remove anon SELECT and expose an approved bounded view.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Raw safety-reference rows include body and payload while public SELECT bypasses the bounded API projection.

## Root Cause



## Locations

- $(@{path=supabase/migrations/004_safety_reference_catalog.sql; startLine=16; endLine=31; role=source}.path):16 (source)
- $(@{path=supabase/migrations/004_safety_reference_catalog.sql; startLine=58; endLine=72; role=sink}.path):58 (sink)
- $(@{path=lib/safety-reference-catalog.ts; startLine=250; endLine=335; role=sink}.path):250 (sink)

## Validation

The HTTP API redacts body and payload but direct PostgREST does not. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Source PDFs may be public; normalized payload is outside the public contract.

## Attack Path

The HTTP API redacts body and payload but direct PostgREST does not.

## Remediation

Remove anon SELECT and expose an approved bounded view.

## Regression Tests

- Reject the negative path for raw-safety-corpus.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
