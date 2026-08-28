# Forwarded-header spoofing can partition public rate-limit identity

**Severity:** Low

`getClientIp` trusts the first `X-Forwarded-For` token. If the production edge does not replace that header, callers can rotate limiter identities.

## Remediation

Use an authenticated platform client-IP source or parse only a configured trusted-proxy chain.
