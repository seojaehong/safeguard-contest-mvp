# Northstar Hermes Runtime Remediation

## Candidate

- Product SHA: `d0b7517`
- Branch: `fix/northstar-hermes-runtime-20260715`
- Route: `/api/agent/chat`
- Status: focused verification passed; independent re-review pending

## Claim-level evidence boundary

Hermes receives an immutable Evidence Harness packet for audit, but its selectable output allowlist is now built per reference:

- direct claims require direct-evidence eligibility;
- SIF claims are labeled as accident/risk-priority evidence, not a statutory mandate;
- KOSHA claims require supporting-citation eligibility and the configured trust verifier;
- review-required or mismatched references remain in the audit packet but cannot become selectable claims.

A mixed packet containing one accepted KOSHA guide and one review-required KOSHA item is covered by a negative test. The unverified control never enters the claim allowlist or rendered output.

## Fixture boundary

The `D-C-13-2026` fixture uses values recovered from the local corpus, but that corpus is still `current-unverified` and the production trusted metadata registry is empty. The fixture is therefore described only as a **test-only recovered fixture**, not as a promoted official snapshot. Body, PDF hash, file ID, and mixed-packet mismatch tests fail closed before planner output can be rendered.

## Preserved invariants

- exact organization/site binding;
- local-only, explicitly tool-free OpenClaw agent;
- OpenAI OAuth attestation;
- `naturalize_only` role;
- no mutation or publication authority;
- human confirmation required;
- existing Vertex/Anthropic paths unchanged.

## Verification

- Hermes/OpenClaw focused tests: 2 files, 60 tests passed
- Strict TypeScript typecheck: passed
- Production build: 28 pages, build ID `YYu1fJ33HzzNu7_6SIvbO`
- `git diff --check`: passed

## Runtime blockers

- Production KOSHA trusted official metadata registry is empty.
- Installed OpenClaw CLI `2026.6.5` is behind config writer `2026.6.11`.
- The `safeclaw` profile lacks an explicit `agents.list` tool-free entry.
- Organization/site binding environment values are not configured for live execution.
- Local Hermes remains disabled on Vercel.

`runtimeReady` remains `false`; no live-answer claim is made.
