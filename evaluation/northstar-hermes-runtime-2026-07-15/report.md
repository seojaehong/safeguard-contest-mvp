# Northstar Hermes Runtime P1 Remediation

## Candidate

- Implementation base SHA: `6fc00ef463a621ef03d96510b52ee1a70dea7f0c`
- Branch: `fix/northstar-hermes-runtime-20260715`
- Route: `/api/agent/chat`
- Status: P1 remediation verified; independent re-review pending

## Remediated boundary

- The production KOSHA verifier now computes SHA-256 from the actual UTF-8 `item.body` in a server-only module.
- Trust requires the computed digest and metadata digest to match the unchanged code-owned registry pin.
- Metadata-only identity with an arbitrary body is rejected.
- KOSHA planner claims come only from controls or anchor excerpts that are exact normalized extracts of the verified body.
- Forged metadata plus arbitrary `controls` cannot enter the Hermes claim allowlist.
- When metadata controls are empty, a verified body anchor may supply the claim; arbitrary prose is not synthesized.

## TDD evidence

- RED: forged body with pinned metadata was accepted by the old production verifier.
- GREEN: the same exploit is rejected after actual-body hashing.
- RED: a forged post-Harness control entered the planner allowlist.
- GREEN: the forged control is excluded while an extract present in the pinned body remains selectable.

## Preserved invariants

- exact organization/site binding;
- local-only, explicitly tool-free OpenClaw agent;
- OpenAI OAuth attestation;
- `naturalize_only` role and immutable evidence packet attestation;
- no mutation or publication authority;
- human confirmation required;
- existing provider selection and fallback policy unchanged.

## Verification

- Focused runtime/provider tests: 6 files, 95 tests passed.
- Strict TypeScript typecheck: passed.
- Production build: passed; static generation completed at 28/28.
- Build ID: `6jAB9kHRJbdawnVN1-c9e`.
- `git diff --check`: passed.

## Excluded work

No DB/schema change, data mutation, deployment, or publication was performed.

## Runtime blockers

- Installed OpenClaw CLI `2026.6.5` is behind config writer `2026.6.11`.
- The `safeclaw` profile lacks an explicit `agents.list` tool-free entry.
- Organization/site binding environment values are not configured for live execution.
- Local Hermes remains disabled on Vercel.

`runtimeReady` remains `false`; no live-answer claim is made.
