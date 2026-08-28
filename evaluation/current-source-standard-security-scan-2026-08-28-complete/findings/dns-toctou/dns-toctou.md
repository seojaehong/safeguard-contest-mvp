# Upstream DNS validation is vulnerable to resolution-time rebinding

**Severity:** Low

The helper validates DNS and returns a URL; a later ordinary fetch performs another DNS resolution. An allowlisted malicious hostname can change answers between the two operations.

## Remediation

Pin the validated address through a TLS-safe custom dispatcher or equivalent connection policy.
