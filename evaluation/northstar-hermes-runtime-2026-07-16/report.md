# Northstar Hermes Runtime Verification

## Scope

- Authoritative source SHA: `85f98af720adaaefe69a23631bcbec7890f50081`
- Runtime: local OpenClaw profile `safeclaw`, agent `main`
- Verification date: `2026-07-16`
- Database or schema mutation: none

## Result

The local OpenClaw OAuth runtime is executable. This does not make the Vercel
`/api/agent/chat` route Hermes-ready because the production route deliberately
disables local Hermes and the organization/site binding variables are not
configured.

## Actual runtime evidence

- OpenClaw CLI reports `2026.6.11`, matching the current config writer.
- The `main` agent has `tools.allow=[]` and `tools.deny=["*"]`.
- OpenAI OAuth status resolves as usable for `openai/gpt-5.5`.
- A real local OAuth turn returned `SAFECLAW_OAUTH_RUNTIME_OK` with exit code 0.
- Execution metadata reported provider `openai`, model `gpt-5.5`, no fallback,
  and an empty runtime tool list.
- The turn completed in 45,458 ms. No secret or token value is stored here.

The OpenClaw process emitted two non-blocking operational warnings: a legacy
config-health state conflict and an empty `plugins.allow` list that permits a
discovered Codex plugin to auto-load. The tool-free agent contract still removed
all tools, but explicit plugin allowlisting remains a hardening follow-up.

## SafeClaw boundary

The product adapter remains fail-closed unless all of these are true:

1. `SAFECLAW_ENGINE_MODE=experimental-hermes`
2. `SAFECLAW_HERMES_LOCAL_POC=1`
3. `OPENCLAW_LOCAL=1`
4. `SAFECLAW_HERMES_BOUND_ORGANIZATION_ID` is present
5. `SAFECLAW_HERMES_BOUND_SITE_ID` is present
6. The authenticated request context exactly matches both bindings
7. Runtime capability, tool-free policy, and OpenAI OAuth attestations pass
8. The Evidence Harness returns complete SIF and trusted KOSHA evidence

Vercel intentionally resolves `experimental-hermes` to disabled. This prevents
a local user OAuth credential from becoming a shared production credential.

## Verification

- Focused Hermes/provider tests: 5 files, 87 tests passed.
- Actual local OAuth turn: exit code 0, exact marker returned.
- Vercel deployment for the authoritative SHA: passed.
- GitHub CI for the authoritative SHA: failed in unrelated stale evidence and
  KOSHA-expanded photo-analysis assertions; remediation is required before the
  launch gate can pass.

## Readiness

- Local OAuth engine execution: ready.
- SafeClaw attestation and Evidence Harness contracts: test-verified.
- Authenticated organization/site-bound local route: not configured.
- Vercel Hermes route: intentionally unavailable.
- Customer production engine: not ready; service authentication and a remote
  worker/queue boundary remain Phase B work.

