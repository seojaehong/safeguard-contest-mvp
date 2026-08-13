# Agent chat distributed admission remediation

Verdict: `NOTICE_LIVE_DEPLOYED_SOURCE_AGENT_CHAT_DISTRIBUTED_ADMISSION_ACTIVATION_PENDING`

Product and production commit: `50de0f830aa35cc498e322371604785e6d188d69`

## Remediation

- `/api/agent/chat` pre-auth IP admission uses the `agent-chat-pre-auth` atomic distributed counter when complete Upstash configuration is present.
- Authenticated user admission independently uses the `agent-chat-authenticated` atomic distributed counter.
- Engine execution uses the `agent-chat-engine-work` atomic distributed lease when configured while retaining the process-local guarded adapter.
- The lease capacity follows `OPENCLAW_MAX_CONCURRENT`, and its TTL remains longer than the configured engine timeout.
- Busy admission fails before availability or engine work; completion, cancellation, and availability-failure paths release the lease idempotently.
- Partial distributed configuration fails closed before authentication, body parsing, site lookup, or engine work.
- Absent configuration preserves the existing process-instance limit so current production availability is unchanged.
- Limiter keys contain SHA-256-derived identifiers rather than raw client IP or user IDs.

## Verification

- Focused agent-chat suite: 1 file / 22 tests PASS.
- Focused and adjacent limiter/broker suite: 5 files / 42 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Live no-provider probe: unauthenticated `POST /api/agent/chat` returned `401 AUTH_REQUIRED` with `X-SafeClaw-Rate-Limit: instance` at production `50de0f83`.

## Boundary

This proves deployed source support for atomic distributed user quotas and engine leases, with the local guard retained. It does not prove distributed production activation: the live header remains `instance`, so `agent-chat-process-local-quotas` stays runtime-open. No provider generation or dispatch, database mutation, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Security-complete remains false, a fresh full-repository scan remains required for canonical closure, and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
