# Tenant Harness Memory P1 Fix Evidence

## Verdict

- Review date: `2026-07-16`
- Branch: `feat/tenant-harness-memory-20260715`
- Scoped claw runtime: **PASS**
- Public MCP integration: **SPEC_PENDING**
- Public `app/api/mcp` implementation modified: **no**
- Commit/push: **not performed by request**

## Fixed Contract

- The loader no longer selects `question`, `task_label`, `hazard_label`, or `improvement_text`.
- Runtime output contains only a reconstructed `tenantMemoryDigest`: opaque IDs, approved/reflected status, enum source type, timestamps, provenance IDs, and allowlisted reflected documents.
- Unknown fields are discarded again at the MCP transformation boundary. Injected name, phone, email, `question`, and `improvementText` values do not appear in the packet, prompt, or serialized tool result.
- Workpacks are queried only by `workpack_id` values obtained from same-tenant `approved/reflected` improvement rows. With no approval evidence, workpack loading is skipped with `approval_evidence_required`.
- Site tokens remain filtered by `organization_id AND site_id`; DB organization tokens remain bounded by `organization_id`. Existing caps remain workpacks `8`, improvements `12`.
- Reflected documents remain allowlisted. The legacy four-item `qualityPipeline` tuple is unchanged; actual stage outcomes remain separate in `qualityPipelineStatus`.
- Legacy raw memory arguments are accepted only as a compile-compatibility shim for the Phase A public MCP path and are deliberately ignored.

## TDD Evidence

RED 1:

```powershell
npm.cmd test -- tests/tenant-harness-memory.test.ts -t "returns only a structured digest"
```

Result: `1 failed`; serialized output contained the seeded name, phone, email, `question`, and `improvementText`.

RED 2:

```powershell
npm.cmd test -- tests/tenant-harness-memory-claw-tool.test.ts -t "rebuilds a structured tenant digest"
```

Result: `1 failed`; the seeded contact data crossed `packet`, `promptContext`, and the final tool JSON.

GREEN:

```powershell
npm.cmd test -- tests/tenant-harness-memory.test.ts tests/tenant-harness-memory-claw-tool.test.ts tests/mcp-tools.test.ts
npm.cmd run typecheck
```

Result: `3` test files, `48` tests passed; strict TypeScript typecheck passed.

Logs:

- `evaluation/tenant-harness-memory-2026-07-15/green-focused-tests.log`
- `evaluation/tenant-harness-memory-2026-07-15/green-typecheck.log`

## Public MCP Boundary

`PUBLIC_MCP_TENANT_MEMORY_HOOK_STATUS` is explicitly `SPEC_PENDING`. Phase A still owns the public `app/api/mcp/[transport]/implementation.ts` integration. This worktree does not claim that path is integrated or probe-verified; its legacy raw arguments are ignored by `buildHarnessAgentResult`, preventing them from entering the returned runtime payload until Phase A adopts the structured adapter.
