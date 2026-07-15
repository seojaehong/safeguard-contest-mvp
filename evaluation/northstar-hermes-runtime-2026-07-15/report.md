# Northstar Hermes Runtime Remediation

## Candidate

- Product SHA: `68ddda7dc5e6ea115edc4b8d8b28454f3779ba23`
- Production base SHA: `238a011b3d0d436b5d498c415795cede61b3045e`
- Branch: `fix/northstar-hermes-runtime-20260715`
- Route: `/api/agent/chat`
- Status: focused verification passed; independent re-review pending

## Claim-level evidence boundary

Hermes receives an immutable Evidence Harness packet for audit, but its selectable output allowlist is now built per reference:

- direct claims require direct-evidence eligibility;
- SIF claims are labeled as accident/risk-priority evidence, not a statutory mandate;
- KOSHA claims require supporting-citation eligibility and the configured trust verifier;
- a missing production KOSHA trust verifier is an explicit rejection, never implicit trust;
- `/api/agent/chat` injects the code-owned production KOSHA registry into the OpenClaw Hermes composition;
- review-required or mismatched references remain in the audit packet but cannot become selectable claims.

A mixed packet containing explicitly trusted and otherwise eligible but untrusted KOSHA items is covered by a negative test. Only the trusted citation enters the planner allowlist. A structurally valid packet whose eligible references yield no selectable claims also fails before planner execution.

## Production registry

The code-owned registry pins the approved current `D-C-13-2026` identity by stable document key, current version, body hash, official URL, official file ID, and publication date. The route test proves that this approved current identity is injected and accepted. Composition tests prove that unknown document keys and review-required references fail before OpenClaw planner execution.

## Preserved invariants

- exact organization/site binding;
- local-only, explicitly tool-free OpenClaw agent;
- OpenAI OAuth attestation;
- `naturalize_only` role;
- no mutation or publication authority;
- human confirmation required;
- existing Vertex/Anthropic paths unchanged.

## Verification

- Hermes/OpenClaw focused tests: 4 files, 75 tests passed
- Strict TypeScript typecheck: passed
- Fresh production build after removing this worktree's `.next` cache: passed
- Static generation: 28 items (`Generating static pages (28/28)`), not total route count
- Build ID: `7V9HOhxRxy6TfamvwIBut`
- `git diff --check`: passed

## Runtime blockers

- Installed OpenClaw CLI `2026.6.5` is behind config writer `2026.6.11`.
- The `safeclaw` profile lacks an explicit `agents.list` tool-free entry.
- Organization/site binding environment values are not configured for live execution.
- Local Hermes remains disabled on Vercel.

`runtimeReady` remains `false`; no live-answer claim is made.
