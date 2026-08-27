# Direct improvement approval forgery can poison tenant harness memory

- Severity: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Direct improvement approval forgery can poison tenant harness memory; summary=Owners can set improvement approval metadata while harness memory trusts approved or reflected rows.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make approval fields server-only and require an immutable review receipt.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Direct improvement approval forgery can poison tenant harness memory; summary=Owners can set improvement approval metadata while harness memory trusts approved or reflected rows.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make approval fields server-only and require an immutable review receipt.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Direct improvement approval forgery can poison tenant harness memory; summary=Owners can set improvement approval metadata while harness memory trusts approved or reflected rows.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make approval fields server-only and require an immutable review receipt.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.review-state-forgery; identity=; title=Direct improvement approval forgery can poison tenant harness memory; summary=Owners can set improvement approval metadata while harness memory trusts approved or reflected rows.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Make approval fields server-only and require an immutable review receipt.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Owners can set improvement approval metadata while harness memory trusts approved or reflected rows.

## Root Cause



## Locations

- $(@{path=supabase/migrations/010_commercial_operations.sql; startLine=51; endLine=68; role=source}.path):51 (source)
- $(@{path=supabase/migrations/010_commercial_operations.sql; startLine=195; endLine=210; role=sink}.path):195 (sink)
- $(@{path=lib/tenant-harness-memory.ts; startLine=151; endLine=175; role=sink}.path):151 (sink)
- $(@{path=lib/tenant-harness-memory.ts; startLine=243; endLine=316; role=sink}.path):243 (sink)

## Validation

The owner policy can fabricate the status consumed as approval evidence. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Migration 010 is approval-gated.

## Attack Path

The owner policy can fabricate the status consumed as approval evidence.

## Remediation

Make approval fields server-only and require an immutable review receipt.

## Regression Tests

- Reject the negative path for improvement-review-forgery.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
