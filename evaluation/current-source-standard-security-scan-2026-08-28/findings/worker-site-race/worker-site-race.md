# Concurrent worker upserts bypass the site-transfer check

- Severity: $(@{ruleId=race-condition.worker-site-binding; identity=; title=Concurrent worker upserts bypass the site-transfer check; summary=Concurrent first imports for one natural key and different sites can pass preflight and race an upsert that updates site_id.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Lock the natural key and reject site changes transactionally.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=race-condition.worker-site-binding; identity=; title=Concurrent worker upserts bypass the site-transfer check; summary=Concurrent first imports for one natural key and different sites can pass preflight and race an upsert that updates site_id.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Lock the natural key and reject site changes transactionally.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=race-condition.worker-site-binding; identity=; title=Concurrent worker upserts bypass the site-transfer check; summary=Concurrent first imports for one natural key and different sites can pass preflight and race an upsert that updates site_id.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Lock the natural key and reject site changes transactionally.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=race-condition.worker-site-binding; identity=; title=Concurrent worker upserts bypass the site-transfer check; summary=Concurrent first imports for one natural key and different sites can pass preflight and race an upsert that updates site_id.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Lock the natural key and reject site changes transactionally.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Concurrent first imports for one natural key and different sites can pass preflight and race an upsert that updates site_id.

## Root Cause



## Locations

- $(@{path=app/api/workers/route.ts; startLine=84; endLine=120; role=source}.path):84 (source)
- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=21; endLine=42; role=sink}.path):21 (sink)

## Validation

Lookup and upsert are separate and the payload contains site_id. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Sequential transfers are rejected.

## Attack Path

Lookup and upsert are separate and the payload contains site_id.

## Remediation

Lock the natural key and reject site changes transactionally.

## Regression Tests

- Reject the negative path for worker-site-race.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
