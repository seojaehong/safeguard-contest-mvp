# Current-source Security Residual Remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_SECURITY_RESIDUAL_REMEDIATION_RESCAN_PENDING`
- Product source: `c68cc7b7a63c3dfb64ed2be147248ecd186c2098`
- Production marker: `5b1f246bcf0587b2c0ac66affab2680fb6ff5fd9` (`master`, production)
- Sealed scan baseline: `3358978a-75d1-454a-9dcd-4b63b52b9768` at `ab30f5c5269430a558fcd8ef5c6331fb3c952a4e`
- Scope: the three approval-free source residuals only

## Remediation

- `provider-detail`: raw provider and relay diagnostics remain server-side; public responses expose stable mode and health summaries.
- `dns-toctou`: approved HTTPS origins resolve once, all addresses must be public, the selected address is pinned into the Node HTTPS lookup, original TLS identity is preserved, and the connected socket must match the pin.
- `xff-spoof`: Vercel production uses the platform-authenticated client-IP header and fails closed when it is absent; non-Vercel proxy headers require an explicit trust setting.

## Verification

- Focused security: 3 files, 33 tests, PASS.
- Adjacent public admission and product harness: 7 files, 141 tests, PASS.
- Strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Live verification: deployed source marker includes the product commit. No behavioral probe was claimed because these controls do not expose a safe deterministic read-only endpoint.

## Boundary

This is deployed-source plus local contract evidence, not follow-up scan closure or a claim that production behavior was directly probed. The sealed 17-finding scan and immutable 18-finding baseline are unchanged. A follow-up security scan is required before these findings can be marked closed.

No database, provider dispatch, Share-session, embedding/vector, Wiki publication, or KOSHA exact-registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; all approval-gated findings remain open.
