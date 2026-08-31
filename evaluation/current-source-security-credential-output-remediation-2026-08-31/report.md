# Credential Output Security Remediation

- Verdict: `PASS_LIVE_DEPLOYED_SOURCE_CREDENTIAL_OUTPUT_CONTRACT`
- Product and production commit: `32bba02b79b4beefe0a217b1afe7180483398cf4`
- Sealed finding: `csf_ad5c841841dbdcc55b2c1d5a` (`credential-exposure.token-stdout`, low)

## Remediation

The MCP-token and Supabase-auth issuance CLIs no longer print bearer tokens to stdout by default. Both CLIs require an output mode before authentication or database work begins. `--reveal` is accepted only on an interactive TTY. Linux automation uses `--output-file`, exclusive file creation, mode `0600`, a post-write mode check, and rejection of pre-existing files. Windows file output is rejected because this helper cannot verify POSIX `0600`; Windows operators must use interactive reveal.

Tier1 onboarding now creates a temporary `0700` directory, receives the MCP token through a new `0600` file, reads it into the existing one-process handoff, and deletes the file and directory through normal cleanup or an exit trap. MCP database storage remains hash-only and the Supabase login function keeps its original authentication behavior.

## Verification

- Focused and adjacent regression: `5` files / `88` tests PASS.
- GitHub CI included the new `8` credential-output tests and existing `5` MCP CLI tests as PASS. The full suite retained `8` pre-existing unrelated failures in `knowledge-promotion-gate` and `knowledge-write-request-budget`; CI build was skipped after those failures.
- Node syntax: `3/3` files PASS; Tier1 Bash syntax PASS.
- Strict TypeScript: `npm.cmd run typecheck` PASS.
- Production build: Next.js `15.5.22`, `28/28` static pages PASS.
- Three real process probes rejected missing or unverifiable output modes before credential work and returned no plaintext token.
- Production marker: `32bba02b`, deployment `safeguard-contest-2g6e5evg1-seojaehongs-projects.vercel.app`.

No MCP token, Supabase auth token, database row, provider dispatch, Share session, vector, Wiki publication, or KOSHA registry entry was created during verification.

## Boundary

This receipt does not rewrite or close the sealed 21-finding scan. The immutable original 18-finding baseline and sealed current-head scan remain unchanged, and a fresh follow-up scan is required before reclassification. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, approval-gated findings remain open, and security-complete remains false.
