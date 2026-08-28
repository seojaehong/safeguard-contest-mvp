# Direct improvement writes can forge approval provenance

**Severity:** Low

Tenant owners can directly set `review_status`, `approved_by`, and `approved_at` on improvement records.

## Remediation

Make approval columns service-only and require a trusted reviewer transition.
