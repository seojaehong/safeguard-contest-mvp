# Share Recipient Current Reconciliation

Generated at: 2026-07-18 KST

## Verdict

The older read-only handoff that said a recipient portal did not exist is stale for the current authoritative code line.

Current HEAD includes:

- `app/share/[sessionId]/page.tsx`
- `app/api/share-sessions/[sessionId]/route.ts`
- route coverage for `/share/[sessionId]`
- browser contracts for invited worker confirmation, mobile fit, language fallback, Vietnamese worker chrome, and confirmation success copy

## Verified Facts

- Current source HEAD during this check: `51d45720e0a8cc280703af549416eede926dd072`
- Live `/api/build-info` at check time still mapped to deployed commit `2f121d3488908ca450398bfbb70f5f97827023fa`.
- Live `/share/not-a-session?lang=vi` returned HTTP 200.
- Live `/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?workerId=11111111-1111-4111-8111-111111111111` returned HTTP 200.

The live probes prove the recipient route is deployed and routable. They do not prove a real production share session exists for the fixture IDs.

## Local Production Contract

Focused recipient portal browser contract:

```text
npm.cmd test -- tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  1 passed (1)
Tests       4 passed (4)
```

Share flow contract bundle:

```text
npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\workflow-share-client.test.ts tests\workspace-share-mobile-browser.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false
Test Files  5 passed (5)
Tests       79 passed (79)
```

## Current Product Boundary

The implemented path is an invited-worker recipient portal:

- manager creates a share session and recipient snapshot
- worker opens `/share/[sessionId]?workerId=...`
- page shows the worker-facing notice, core three documents, language-specific chrome for supported launch languages, and a read-confirmation button
- public anonymous sharing remains off by default
- confirmation history is saved through the share-session route

This is suitable for launch-video capture of foreign-worker distribution if the demo uses an actual created share session URL.

## Remaining Caveats

- Provider dispatch remains preview-only unless provider credentials and idempotency are proven in the target environment.
- The live fixture URL only proves routing; a real demo recording should use a share session generated from the current `/workspace` flow.
- The newly pushed evidence-only commit `51d45720` was still in CI at the first live probe, while the live route was already present from `2f121d34`.
