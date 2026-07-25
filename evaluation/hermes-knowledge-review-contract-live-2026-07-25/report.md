# Hermes Knowledge Review Authority Contract

Checked: `2026-07-25T01:23:06.9093575Z`

Verdict: `PASS_LIVE_PRODUCTION_HERMES_KNOWLEDGE_REVIEW_AUTHORITY_CONTRACT`

## Live Result

- Production commit: `49dded5bb88a27e34014ecc4dee4e4146b2681c6`
- Product commit: `602596c1bb1c728e18fc83a0177dbf5659cb89a5`
- Endpoint: `POST /api/knowledge/regenerate`
- HTTP status: `200`
- Mode: `generate=false`, stateless candidate
- Raw event fixtures: `5`
- AI/provider execution: `false`
- Candidate persistence: `false`

## Review Contract

- Authority order: `SIF -> KOSHA -> law -> organization history -> site history -> external context`
- Present authority lanes: `SIF, KOSHA, law, organization history, site history`
- Role counts: `1 / 1 / 1 / 1 / 1`, external context `0`
- Candidate state: `unpublished`
- Human review required: `true`
- Tenant memory public promotion allowed: `false`
- Site-manager acceptance required before workpack use: `true`
- Machine evidence replaces human review: `false`
- DB mutation allowed: `false`
- Publish allowed: `false`

## Verification

- Focused tests: `8 files / 86 tests PASS`
- Strict typecheck: `PASS`
- Production build: `PASS`, static pages `28/28`

## Boundary

This live probe proves the reviewer-facing authority split and stateless candidate response only. It does not publish an LLM Wiki candidate, approve RLS, mutate a database, call an AI provider, create a Share session, or reproduce an exact saved `/share/[sessionId]`. LLM Wiki publication and RLS remain `APPROVAL_GATED`; exact saved Share remains `MISSING_EVIDENCE`.
