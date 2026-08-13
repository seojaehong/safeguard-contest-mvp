# Agent chat distributed admission remediation

Verdict: `NOTICE_LIVE_DEPLOYED_SOURCE_AGENT_CHAT_DISTRIBUTED_ADMISSION_ACTIVATION_PENDING`

Product and production commit: `674999ce1562e76c7bb384a84e1dd67ea1bf6767`

## Remediation

- `/api/agent/chat` pre-auth IP admission uses the `agent-chat-pre-auth` atomic distributed counter when complete Upstash configuration is present.
- Authenticated user admission independently uses the `agent-chat-authenticated` atomic distributed counter.
- Partial distributed configuration fails closed before authentication, body parsing, site lookup, or engine work.
- Absent configuration preserves the existing process-instance limit so current production availability is unchanged.
- Limiter keys contain SHA-256-derived identifiers rather than raw client IP or user IDs.

## Verification

- Focused agent-chat suite: 1 file / 19 tests PASS.
- Focused and adjacent limiter/broker suite: 5 files / 39 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Live no-provider probe: unauthenticated `POST /api/agent/chat` returned `401 AUTH_REQUIRED` with `X-SafeClaw-Rate-Limit: instance` at production `674999ce`.

## Boundary

This proves deployed source support and fail-closed configuration handling. It does not prove distributed production activation: the live header remains `instance`, so `agent-chat-process-local-quotas` stays runtime-open. No provider generation or dispatch, database mutation, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Security-complete remains false, a fresh full-repository scan remains required for canonical closure, and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
