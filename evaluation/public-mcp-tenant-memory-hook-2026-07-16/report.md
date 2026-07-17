# Public MCP tenant memory hook

## Result

The public `run_safeclaw_harness_agent` route now loads tenant memory only through `loadTenantHarnessMemoryForMcp`. The route no longer reads workpack questions, improvement text, task/hazard labels, OCR, vision summaries, or `analysis_payload`.

The returned runtime surface contains only approved/reflected structured provenance in `tenantMemoryDigest`. Official SIF/KOSHA reference retrieval and the fixed four-stage harness quality pipeline are preserved.

## TDD evidence

- RED: the new route test observed zero bounded-adapter calls and found the legacy raw-memory query in the route source.
- GREEN: `npm.cmd test -- tests/mcp-harness-tenant-memory-route.test.ts tests/tenant-harness-memory.test.ts tests/tenant-harness-memory-claw-tool.test.ts tests/mcp-tools.test.ts tests/mcp-reviewed-route-task-binding.test.ts tests/phase-a-runtime-evidence-bridge.test.ts` completed with 6 files and 62 tests passed.
- PASS: dependency sync with `npm.cmd install`; package and lock manifests remained unchanged.
- PASS: strict TypeScript typecheck.
- PASS: `PUBLIC_MCP_TENANT_MEMORY_HOOK_STATUS` is `INTEGRATED`; legacy raw-memory parameters remain ignored.
- DB migration/data mutation: none.

## Changed boundary

- `app/api/mcp/[transport]/implementation.ts`
- `lib/tenant-harness-memory.ts`
- `lib/mcp-tools.ts`
- `tests/mcp-harness-tenant-memory-route.test.ts`
- `tests/tenant-harness-memory.test.ts`
