# Agent chat durable admission

Verdict: `PASS_LIVE_DEPLOYED_SOURCE_DURABLE_AGENT_ADMISSION_RESCAN_PENDING`

Product and production commit: `ffccacd10f01451fba28e08ec0bbdf3a6e41dc70`

## Remediation

- Authenticated Agent Chat quota now requires the atomic distributed counter in production.
- Agent engine work now requires the distributed `agent-chat-engine-work` lease in production.
- Missing distributed configuration fails before authenticated body parsing, site lookup, availability checks, model work, or tool work.
- Busy, availability-failure, completion, and cancellation paths retain the prior idempotent lease behavior.
- Local development keeps the process-instance fallback, and unauthenticated requests retain the existing 401 boundary.

## Verification

- Focused Agent Chat suite: 1 file / 24 tests PASS.
- Core adjacent limiter and engine route suite: 5 files / 55 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Live source marker reached `ffccacd1`.
- A no-provider unauthenticated POST returned `401 AUTH_REQUIRED` with `X-SafeClaw-Rate-Limit: instance`. This preserves the public auth boundary and indicates that distributed production configuration is not active.

The broader six-file Hermes attempt passed 107 tests and retained one existing RED. That fixture reached the approval-gated `public.workpack_improvements` table and received PGRST205 because the table is absent from the live schema cache. It is not attributed to this admission change.

## Boundary

This proves deployed source that refuses authenticated Agent Chat engine work unless durable production admission is available. It does not prove Upstash activation or an authenticated runtime request because no user token was used. The sealed finding `csf_dbfc57f541ee5079a9bf9735` remains immutable and canonical closure still requires a fresh full-repository scan. No provider generation or dispatch, database mutation, Share-session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and all approval-gated operations remain approval-gated.
