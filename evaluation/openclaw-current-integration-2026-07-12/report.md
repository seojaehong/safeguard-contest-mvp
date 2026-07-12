# OpenClaw broker current-base integration

## Integration boundary

- Current-base commit: `6a5d57cd42518569a244df59875db963a1281fb5`
- Integrated code HEAD: `3bd8fe3a09aaf7c34bad715d2c7f21664f315190`
- Verification evidence parent: `0ea2185b3cd305d310569cfe1a98c9b6365de96a`
- Source reviewed commit: `4859fb10d3115fb812dae7322b14b53b7a750c7b`
- Integration method: selectively cherry-pick the five reviewed OpenClaw commits; no whole-branch merge
- Database schema/data mutation: none
- OAuth login, credential-evaluating live turn, paid provider call, and deployment: not performed

The integrated diff is limited to the OpenClaw broker/chat/context/engine adapter, `ClawChat`, the broker context wiring in `FieldOperationsWorkspace`, dedicated tests, design notes, and evidence. It does not modify `app/globals.css`, `SafeGuardCommandCenter.tsx`, `WorkpackEditor.tsx`, current-workpack, DB harness, KOSHA corpus, or PDF code.

## Independent reviews

Independent security review of source commit `4859fb1` returned PASS with no P0-P3 findings. The reviewer verified:

- mixed credentials fail closed;
- exact `main` agent OpenAI OAuth profile selection;
- server-side user and site ownership checks;
- shared preflight/run concurrency and abort propagation;
- stable `401`, `403`, and backend `503` semantics.

Independent review of the first current-base integration also returned SPEC PASS and CODE QUALITY PASS with no P0-P3 findings. The five source patches were patch-identical in `git range-diff`; no whole-branch ancestry was imported. The reviewed series was then rebased without conflict onto the newer UI-only base `6a5d57c` and all current-base gates below were rerun.

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

## Separate design-contract debt

Before the UI-only W5 rebase, an additional UI regression group completed with 54 tests: 44 passed, 1 skipped, and 9 failed. The failures resolved to untouched owners:

- seven static workbench-contract assertions against `SafeGuardCommandCenter.tsx` and `app/globals.css`;
- two composer first-viewport geometry assertions in `SafeGuardCommandCenter`.

Neither owner is in the OpenClaw integration diff. W5 subsequently changed `app/globals.css`, so these exact aggregate counts are historical evidence rather than a claimed current frontend count. Frontend release readiness remains a separate fail-closed gate. The OpenClaw code itself was rerun on the W5 base and is approved for authoritative integration.
