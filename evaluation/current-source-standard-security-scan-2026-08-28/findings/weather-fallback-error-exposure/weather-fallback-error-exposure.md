# Weather fallback responses still expose raw upstream error text

- Severity: $(@{ruleId=information-exposure.upstream-errors; identity=; title=Weather fallback responses still expose raw upstream error text; summary=Provider errors become successful fallback signal details despite route-level catch redaction.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Log raw provider failures server-side and return fixed fallback messages or enumerated public codes.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=information-exposure.upstream-errors; identity=; title=Weather fallback responses still expose raw upstream error text; summary=Provider errors become successful fallback signal details despite route-level catch redaction.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Log raw provider failures server-side and return fixed fallback messages or enumerated public codes.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=information-exposure.upstream-errors; identity=; title=Weather fallback responses still expose raw upstream error text; summary=Provider errors become successful fallback signal details despite route-level catch redaction.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Log raw provider failures server-side and return fixed fallback messages or enumerated public codes.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=information-exposure.upstream-errors; identity=; title=Weather fallback responses still expose raw upstream error text; summary=Provider errors become successful fallback signal details despite route-level catch redaction.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Log raw provider failures server-side and return fixed fallback messages or enumerated public codes.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Provider errors become successful fallback signal details despite route-level catch redaction.

## Root Cause

Public error projection excludes fallback DTO construction.

## Locations

- $(@{path=lib/weather.ts; startLine=409; endLine=500; role=source}.path):409 (source)
- $(@{path=lib/weather.ts; startLine=540; endLine=703; role=source}.path):540 (source)
- $(@{path=lib/weather.ts; startLine=940; endLine=951; role=sink}.path):940 (sink)
- $(@{path=app/api/weather/route.ts; startLine=108; endLine=110; role=entrypoint}.path):108 (entrypoint)

## Validation

Upstream diagnostics reach weather.detail and signals[].detail.

- No live provider failure induced.

## Attack Path

Observe fallback output during provider failure.

## Remediation

Log raw provider failures server-side and return fixed fallback messages or enumerated public codes.

## Regression Tests

- Inject raw provider error and assert response omits it.
- Cover every provider branch.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
