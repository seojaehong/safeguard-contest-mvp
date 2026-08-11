# Codex Security Follow-up Remediation

## Verdict

`PASS_CURRENT_SOURCE_SECURITY_FOLLOWUP_LIVE_PENDING`

Product commit: `2a7d46905da8f9a5fb77e2eda919d48f59e850f0`

The sealed follow-up scan `3f0107a8-e4a4-4a5b-be37-a28bcea8b05a` reported three findings. This wave closes their current-source contracts without changing the immutable original 18-finding baseline.

## Remediation

- Ask disconnects now propagate into answer and deliverable providers and the accident/safety-reference retrieval branches. Abort errors no longer start provider fallback or retry work. Vertex caller work stops promptly, with the SDK transport-cancellation limitation kept explicit.
- Public document exports now use an atomic Upstash sorted-set concurrency lease shared across instances. Production does not fall back to process-local concurrency when the distributed lease is missing or unavailable.
- Safety-reference REST, ranked RPC, and vector RPC response bodies remain inside the five-second deadline and a streamed one MiB response limit. Malformed JSON remains an explicit failure.

## Verification

- Focused Vitest: 7 files, 91 tests, 0 failures.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.

## Boundaries

This is current-source evidence. Live production verification remains pending until the production marker reaches `2a7d4690`.

No DB mutation, provider dispatch, Share-session creation, vector runtime mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and existing approval-gated boundaries remain open. The two deferred forwarding-header candidates from the scan remain deferred rather than being silently closed.
