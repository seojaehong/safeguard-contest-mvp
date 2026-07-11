# OpenClaw Broker P0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the unauthenticated OpenClaw spawn path with schema-free tenant binding and fail-closed engine selection.

**Architecture:** Move request policy and runtime execution behind testable dependencies. Authenticate through existing Supabase helpers, authorize an explicit owner-scoped site, then invoke a guarded adapter whose default production implementation is unavailable.

**Tech Stack:** Next.js route handlers, TypeScript strict mode, Supabase, Vitest, Node child processes.

## Global Constraints

- No database schema or migration changes.
- No credential changes, token rotation, tunnel deployment, paid calls, or public exposure.
- Preserve OpenAI OAuth-only validation and `shell: false` spawning.
- Browser errors must be stable and redacted.

---

### Task 1: Route authentication and site authorization

**Files:**
- Modify: `tests/claw-chat-route.test.ts`
- Modify: `app/api/agent/chat/route.ts`
- Create: `lib/openclaw-broker-auth.ts`

**Interfaces:**
- Produces: `resolveBrokerRequestContext(request, requestedSiteId)` returning an authenticated user/org/site context or a stable broker error.

- [x] Write route tests for missing/invalid auth, missing/wrong site, and valid adapter reachability.
- [x] Run focused tests and confirm the new cases fail for the vulnerable behavior.
- [x] Implement bearer authentication and owner-scoped site resolution.
- [x] Run focused tests and confirm they pass.

### Task 2: Engine boundary and runtime guards

**Files:**
- Create: `lib/engine-adapter.ts`
- Modify: `lib/openclaw-chat.ts`
- Modify: `app/api/agent/chat/route.ts`
- Modify: `tests/openclaw-chat.test.ts`

**Interfaces:**
- Produces: `EngineAdapter`, `BrokerRequestContext`, `createGuardedEngineAdapter`, and fail-closed adapter selection.

- [x] Write failing tests for disabled/serverless selection, site binding, relay allowlists, effects, concurrency, timeout cleanup, redaction, and spawn options.
- [x] Run focused tests and verify RED.
- [x] Implement the minimal adapter contract, local adapter, guard, relay boundary types, and stable errors.
- [x] Run focused tests and verify GREEN.

### Task 3: Evidence and release gates

**Files:**
- Create: `evaluation/openclaw-broker-hardening-2026-07-12/report.md`
- Create: `evaluation/openclaw-broker-hardening-2026-07-12/report.json`

**Interfaces:**
- Produces: a topology, verification, and deferred-work record.

- [x] Record Vercel/local truth, stable codes, sidecar requirement, and distributed quota deferral.
- [x] Run focused tests, typecheck, build27, and `git diff --check`.
- [x] Inspect the final diff for bypasses, secret exposure, direct writes, and unrelated changes.
- [ ] Pull with rebase, commit, push, and record the exact SHA and gates.

### Follow-up: Consolidated Review Corrections

- [x] Add a server-authenticated read-only owned-site selector route and wire the actual workspace `ClawChat` callsite to it.
- [x] Remove guest chat behavior and require token plus owned-site context before any chat control is enabled.
- [x] Use the installed CLI's documented opaque `--session-key` per broker run; remove the partial relay boundary.
- [x] Remove effect metadata as an enforcement claim; expose no executable capabilities and fail local execution closed pending sidecar authorization.
- [x] Add coarse pre-auth IP and authenticated identity limits, child-close ordering, already-aborted, and stable-code-only logging tests.
- [x] Record focused tests, strict typecheck, normal build, and final whitespace gate. The full suite remains intentionally unrun.
