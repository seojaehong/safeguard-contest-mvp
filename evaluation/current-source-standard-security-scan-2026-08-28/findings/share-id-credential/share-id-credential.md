# Public Share documents treat tenant object identifiers as recipient credentials

- Severity: $(@{ruleId=authorization-bypass.share-object-id; identity=; title=Public Share documents treat tenant object identifiers as recipient credentials; summary=Unauthenticated GET uses sessionId plus workerId membership as sufficient authority to return workpack documents.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Require recipient-specific random or signed short-lived invitation proof.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=authorization-bypass.share-object-id; identity=; title=Public Share documents treat tenant object identifiers as recipient credentials; summary=Unauthenticated GET uses sessionId plus workerId membership as sufficient authority to return workpack documents.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Require recipient-specific random or signed short-lived invitation proof.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=authorization-bypass.share-object-id; identity=; title=Public Share documents treat tenant object identifiers as recipient credentials; summary=Unauthenticated GET uses sessionId plus workerId membership as sufficient authority to return workpack documents.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Require recipient-specific random or signed short-lived invitation proof.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=authorization-bypass.share-object-id; identity=; title=Public Share documents treat tenant object identifiers as recipient credentials; summary=Unauthenticated GET uses sessionId plus workerId membership as sufficient authority to return workpack documents.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Require recipient-specific random or signed short-lived invitation proof.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Unauthenticated GET uses sessionId plus workerId membership as sufficient authority to return workpack documents.

## Root Cause



## Locations

- $(@{path=app/api/share-sessions/[sessionId]/route.ts; startLine=79; endLine=130; role=source}.path):79 (source)
- $(@{path=lib/workpack-commercial-store.ts; startLine=320; endLine=449; role=sink}.path):320 (sink)

## Validation

Possession of two UUIDs is the complete document-read credential. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Sessions expire.
- Production storage is missing and exact Share is MISSING_EVIDENCE.

## Attack Path

Possession of two UUIDs is the complete document-read credential.

## Remediation

Require recipient-specific random or signed short-lived invitation proof.

## Regression Tests

- Reject the negative path for share-id-credential.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
