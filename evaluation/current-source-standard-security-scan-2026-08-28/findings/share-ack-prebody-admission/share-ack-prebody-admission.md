# Share acknowledgement admission occurs after unauthenticated body consumption

- Severity: $(@{ruleId=resource-exhaustion.share-prebody-admission; identity=; title=Share acknowledgement admission occurs after unauthenticated body consumption; summary=The public ACK route reads and parses up to 16 KiB for up to ten seconds before distributed admission.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Acquire a coarse distributed IP rate/concurrency lease before body reads, retaining the recipient-specific limiter after parsing.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=resource-exhaustion.share-prebody-admission; identity=; title=Share acknowledgement admission occurs after unauthenticated body consumption; summary=The public ACK route reads and parses up to 16 KiB for up to ten seconds before distributed admission.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Acquire a coarse distributed IP rate/concurrency lease before body reads, retaining the recipient-specific limiter after parsing.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=resource-exhaustion.share-prebody-admission; identity=; title=Share acknowledgement admission occurs after unauthenticated body consumption; summary=The public ACK route reads and parses up to 16 KiB for up to ten seconds before distributed admission.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Acquire a coarse distributed IP rate/concurrency lease before body reads, retaining the recipient-specific limiter after parsing.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=resource-exhaustion.share-prebody-admission; identity=; title=Share acknowledgement admission occurs after unauthenticated body consumption; summary=The public ACK route reads and parses up to 16 KiB for up to ten seconds before distributed admission.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Acquire a coarse distributed IP rate/concurrency lease before body reads, retaining the recipient-specific limiter after parsing.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

The public ACK route reads and parses up to 16 KiB for up to ten seconds before distributed admission.

## Root Cause

Admission is ordered after attacker-controlled body consumption.

## Locations

- $(@{path=app/api/share-sessions/[sessionId]/route.ts; startLine=137; endLine=153; role=entrypoint}.path):137 (entrypoint)
- $(@{path=lib/public-work-budget.ts; startLine=28; endLine=35; role=root_control}.path):28 (root_control)

## Validation

Body read and parse precede admission.

- No load test or saved session creation.

## Attack Path

Many slow bodies consume pre-admission serverless work.

## Remediation

Acquire a coarse distributed IP rate/concurrency lease before body reads, retaining the recipient-specific limiter after parsing.

## Regression Tests

- Assert coarse admission precedes body reader.
- Verify parallel slow bodies are rejected.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
