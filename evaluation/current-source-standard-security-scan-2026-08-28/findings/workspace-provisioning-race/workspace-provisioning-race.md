# Workspace provisioning can create duplicate organizations and sites

- Severity: $(@{ruleId=race-condition.workspace-provisioning; identity=; title=Workspace provisioning can create duplicate organizations and sites; summary=Concurrent first-use calls can duplicate organizations and same-name sites through select-then-insert.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add idempotency keys, uniqueness, and transactional provisioning.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.severity.level)
- Confidence: $(@{ruleId=race-condition.workspace-provisioning; identity=; title=Workspace provisioning can create duplicate organizations and sites; summary=Concurrent first-use calls can duplicate organizations and same-name sites through select-then-insert.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add idempotency keys, uniqueness, and transactional provisioning.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.confidence.level)
- Rule: $(@{ruleId=race-condition.workspace-provisioning; identity=; title=Workspace provisioning can create duplicate organizations and sites; summary=Concurrent first-use calls can duplicate organizations and same-name sites through select-then-insert.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add idempotency keys, uniqueness, and transactional provisioning.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.ruleId)
- CWE: $(@(@{ruleId=race-condition.workspace-provisioning; identity=; title=Workspace provisioning can create duplicate organizations and sites; summary=Concurrent first-use calls can duplicate organizations and same-name sites through select-then-insert.; severity=; confidence=; taxonomy=; locations=System.Object[]; writeup=; remediation=Add idempotency keys, uniqueness, and transactional provisioning.; validation=; attackPath=; remediationTests=System.Object[]; preventiveControls=System.Object[]; provenance=}.taxonomy.cwe) -join ', ')
- Current source: 899951952ee184d527742d541f976f7e72482f2e

## Summary

Concurrent first-use calls can duplicate organizations and same-name sites through select-then-insert.

## Root Cause



## Locations

- $(@{path=lib/supabase-admin.ts; startLine=645; endLine=715; role=source}.path):645 (source)
- $(@{path=supabase/migrations/002_workspace_productization.sql; startLine=3; endLine=19; role=sink}.path):3 (sink)

## Validation

Provisioning is non-atomic and lacks natural-key uniqueness. Parent validation confirmed controlling blobs are identical at 4e3e7e5d and 89995195.

- Duplicates remain same-user owned.

## Attack Path

Provisioning is non-atomic and lacks natural-key uniqueness.

## Remediation

Add idempotency keys, uniqueness, and transactional provisioning.

## Regression Tests

- Reject the negative path for workspace-provisioning-race.
- Preserve the intended bounded path.

## Boundaries

This finding was validated without database, provider, Share-session, vector, Wiki, or KOSHA registry mutation. Exact saved Share remains MISSING_EVIDENCE. The immutable original 18-finding baseline is preserved separately.
