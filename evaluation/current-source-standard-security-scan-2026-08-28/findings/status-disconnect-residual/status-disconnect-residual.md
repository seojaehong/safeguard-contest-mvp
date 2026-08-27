# Disconnected safety-status requests release admission while underlying work continues

- Severity: $(@{ruleId=resource-exhaustion.disconnect-cancellation; identity=; title=Disconnected safety-status requests release admission while underlying work continues; summary=The abort wrapper rejects and releases its lease while three operations without AbortSignal continue.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Propagate AbortSignal to every operation or retain the lease until Promise.all settles.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=resource-exhaustion.disconnect-cancellation; identity=; title=Disconnected safety-status requests release admission while underlying work continues; summary=The abort wrapper rejects and releases its lease while three operations without AbortSignal continue.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Propagate AbortSignal to every operation or retain the lease until Promise.all settles.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=resource-exhaustion.disconnect-cancellation; identity=; title=Disconnected safety-status requests release admission while underlying work continues; summary=The abort wrapper rejects and releases its lease while three operations without AbortSignal continue.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Propagate AbortSignal to every operation or retain the lease until Promise.all settles.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=resource-exhaustion.disconnect-cancellation; identity=; title=Disconnected safety-status requests release admission while underlying work continues; summary=The abort wrapper rejects and releases its lease while three operations without AbortSignal continue.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; codeEvidence=System.Object[]; rootCause=; remediation=Propagate AbortSignal to every operation or retain the lease until Promise.all settles.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

The abort wrapper rejects and releases its lease while three operations without AbortSignal continue.

## Root Cause

Cancellation and lease lifetime attach to wrapper, not actual work.

## Locations

- $(@{path=app/api/safety-reference/status/route.ts; startLine=14; endLine=37; role=entrypoint}.path):14 (entrypoint)
- $(@{path=lib/public-distributed-rate-limit.ts; startLine=641; endLine=648; role=root_control}.path):641 (root_control)
- $(@{path=lib/safety-reference-catalog.ts; startLine=3382; endLine=3427; role=sink}.path):3382 (sink)

## Validation

All protected operations continue after wrapper abort.

- Corpus caching limits some repeats.

## Attack Path

Start work then disconnect repeatedly while leases release early.

## Remediation

Propagate AbortSignal to every operation or retain the lease until Promise.all settles.

## Regression Tests

- Abort after start and assert lease remains until settlement.
- Verify disconnects cannot exceed concurrency.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
