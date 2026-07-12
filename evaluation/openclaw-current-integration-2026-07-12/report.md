# OpenClaw broker current-base integration

## Integration boundary

- Current-base commit: `7def9dddb222204b81376eadca7a4e28cf2ce909`
- Integrated HEAD: `8caf81bb3304ca7c56e2ed864426a0647560f733`
- Source reviewed commit: `4859fb10d3115fb812dae7322b14b53b7a750c7b`
- Integration method: selectively cherry-pick the five reviewed OpenClaw commits; no whole-branch merge
- Database schema/data mutation: none
- OAuth login, credential-evaluating live turn, paid provider call, and deployment: not performed

The integrated diff is limited to the OpenClaw broker/chat/context/engine adapter, `ClawChat`, the broker context wiring in `FieldOperationsWorkspace`, dedicated tests, design notes, and evidence. It does not modify `app/globals.css`, `SafeGuardCommandCenter.tsx`, `WorkpackEditor.tsx`, current-workpack, DB harness, KOSHA corpus, or PDF code.

## Source review

Independent security review of source commit `4859fb1` returned PASS with no P0-P3 findings. The reviewer verified:

- mixed credentials fail closed;
- exact `main` agent OpenAI OAuth profile selection;
- server-side user and site ownership checks;
- shared preflight/run concurrency and abort propagation;
- stable `401`, `403`, and backend `503` semantics.

## Current-base verification

- Expanded OpenClaw dependency gate:
  - command: `npm.cmd test -- tests/claw-chat-route.test.ts tests/openclaw-chat.test.ts tests/engine-adapter.test.ts tests/openclaw-broker-ui-context.test.ts tests/agent-loop.test.ts tests/rate-limit.test.ts tests/sse-client.test.ts tests/api-guard.test.ts --maxWorkers=1 --no-file-parallelism`
  - result: 8 files, 87 tests passed
- Strict typecheck:
  - command: `npm.cmd run typecheck`
  - result: passed
- Production build:
  - command: `npm.cmd run build`
  - result: compiled, 27/27 static pages generated; `/api/agent/context` included
- `git diff --check 7def9dd..HEAD`:
  - result: passed

## Existing design-contract debt observed

An additional UI regression group completed with 54 tests: 44 passed, 1 skipped, and 9 failed. The failures resolve to untouched owners:

- seven static workbench-contract assertions against `SafeGuardCommandCenter.tsx` and `app/globals.css`;
- two composer first-viewport geometry assertions in `SafeGuardCommandCenter`.

Neither owner is in the OpenClaw integration diff. These failures remain part of the separate frontend design-contract remediation gate and are not represented as an OpenClaw PASS. The OpenClaw integration must still receive a fresh current-base task review before it becomes authoritative main history.
