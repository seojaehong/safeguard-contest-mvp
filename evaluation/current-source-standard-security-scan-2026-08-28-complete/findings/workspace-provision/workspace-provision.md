# Workspace provisioning can create duplicate organizations or sites

**Severity:** Low

First-use provisioning selects then inserts organizations and sites without uniqueness-backed serialization.

## Remediation

Add uniqueness constraints and transactional upserts.
