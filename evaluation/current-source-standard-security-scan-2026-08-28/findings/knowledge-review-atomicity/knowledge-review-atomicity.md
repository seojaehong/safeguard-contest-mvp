# Knowledge review transitions are not atomic

- Severity: $(@{ruleId=race-condition.review-transition; identity=; title=Knowledge review transitions are not atomic; summary=Knowledge review updates events sequentially and the run separately, leaving partial states on failure.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Move the entire transition into one locked database transaction.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=race-condition.review-transition; identity=; title=Knowledge review transitions are not atomic; summary=Knowledge review updates events sequentially and the run separately, leaving partial states on failure.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Move the entire transition into one locked database transaction.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=race-condition.review-transition; identity=; title=Knowledge review transitions are not atomic; summary=Knowledge review updates events sequentially and the run separately, leaving partial states on failure.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Move the entire transition into one locked database transaction.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=race-condition.review-transition; identity=; title=Knowledge review transitions are not atomic; summary=Knowledge review updates events sequentially and the run separately, leaving partial states on failure.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Move the entire transition into one locked database transaction.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Knowledge review updates events sequentially and the run separately, leaving partial states on failure.

## Root Cause



## Locations

- $(@{path=lib/knowledge-review.ts; startLine=1285; endLine=1343; role=source}.path):1285 (source)
- $(@{path=lib/knowledge-review.ts; startLine=1392; endLine=1422; role=sink}.path):1392 (sink)

## Validation

Error paths explicitly acknowledge partial event commits. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Compare-and-set aids recovery but not atomicity.

## Attack Path

Error paths explicitly acknowledge partial event commits.

## Remediation

Move the entire transition into one locked database transaction.

## Regression Tests

- Reject the negative path for knowledge-review-atomicity.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
