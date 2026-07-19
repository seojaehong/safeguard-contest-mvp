# Recipient Portal Dispatch Link Remediation

## Summary

Authoritative base before this change: `254ce5be667070ee7d26f25f5e98568bd3ec95bd`.

The share recipient portal already exists at `/share/[sessionId]`, but provider dispatch previously carried only per-language message bodies. This left a product gap: a worker could be previewed by the manager, yet the actual provider payload did not include the worker-specific read-confirmation URL.

This remediation keeps the canonical language message unchanged and adds the personal recipient portal URL only at the provider delivery boundary.

## Changed Contract

- `message`: canonical saved worker-language body. It remains free of `/share/` links and remains the comparison target for language safety.
- `portalUrl`: worker-specific `/share/[sessionId]?workerId=[workerId]` URL.
- `deliveryText`: actual provider body. It is `message + portalUrl` when a valid session and worker UUID are available.
- SMS length fail-closed now evaluates `deliveryText`, not only the canonical message.
- The n8n dispatch template now uses `deliveryText` when present and falls back to `message`.

## Verification

- `npm.cmd test -- tests\workflow-share-client.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 31 tests PASS
- `npm.cmd test -- tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 37 tests PASS
- `npm.cmd test -- tests\workflow-share-client.test.ts tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files / 49 tests PASS
- `npm.cmd test -- tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 4 tests PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages
- `npm.cmd run typecheck`
  - PASS on sequential rerun after build

## Notes

An earlier `npm.cmd run typecheck` was started in parallel with `npm.cmd run build` and failed because `.next/types` was being regenerated. That run is excluded as a build-artifact race. The valid evidence is the sequential rerun after the production build completed.

No DB schema, RLS policy, or stored data was changed.
