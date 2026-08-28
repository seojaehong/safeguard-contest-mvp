# Direct dispatch-log writes can forge provider delivery receipts

**Severity:** Low

Direct owner writes can populate provider, provider status, workflow-run, and failure fields without a server-generated receipt.

## Remediation

Make provider receipt fields service-only and bind them to an immutable idempotent receipt.
