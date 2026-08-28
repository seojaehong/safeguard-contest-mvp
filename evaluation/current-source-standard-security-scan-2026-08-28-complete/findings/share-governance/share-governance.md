# Direct Share-session writes bypass readiness and recipient governance

**Severity:** Low

Direct owner writes can construct recipient snapshots, access policy, status, and expiry without the route-level readiness checks.

## Remediation

Revoke direct mutation and create sessions through a transactional trusted function.
