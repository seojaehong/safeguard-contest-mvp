# SafeClaw North Star Current Ledger

검증 일시: 2026-07-20 KST

## Current Production

- Production URL: `https://www.safeclaw.kr`
- Production build marker: `0835874c788797c0fa00b650e3ea31574b2868ac`
- Branch: `master`
- Deployment URL reported by `/api/build-info`: `safeguard-contest-7vkyit6kx-seojaehongs-projects.vercel.app`

## Closed in This Pass

### Workspace Documents / Share UI

- Commit: `0835874c788797c0fa00b650e3ea31574b2868ac`
- Branch also pushed: `fix/northstar-share-recipient-20260720`
- Production deployed: yes, `/api/build-info` returns `0835874c`.

Evidence:

- `npm.cmd run build`: PASS, 28/28 static pages.
- `npm.cmd run typecheck`: PASS.
- `tests/north-star-document-ux.test.ts` + `tests/workspace-share-mobile-browser.test.ts`: 2 files / 5 tests PASS.
- `tests/share-recipient-portal-browser.test.ts`: 1 file / 5 tests PASS.
- Share authority/simplification tests: 4 files / 86 tests PASS.
- Geometry artifact: `evaluation/workspace-doc-share-geometry-2026-07-20/report.md`.

What changed:

- Mobile document selector no longer relies on a native horizontal scrollbar for the core 3 documents.
- Document review/editor contract has no horizontal overflow, clipped controls, fixed/sticky overlap, sub-44px controls, or nested scroll in the verified North Star test.
- Recipient link failure states use localized generic copy and do not leak Korean server errors into Vietnamese/English surfaces.

Remaining product gap:

- Document edit is still dense. The editor is usable and contract-clean, but the structured risk rows remain long. This is a product IA gap, not a regression blocker for the current hotfix.
- Share desktop is no longer a pure mobile-card layout, but full desktop-grade composition should still be revisited in the next share v2 pass.

### KOSHA Guide / Exact Registry

Current `master` already supersedes the old wave2 branch.

- Current exact KOSHA pins: `D-C-13`, `D-C-7`, `B-E-10`.
- Exact asset files present:
  - `data/safety-knowledge/exact-kosha/d-c-13-2026.json`
  - `data/safety-knowledge/exact-kosha/d-c-7-2026.json`
  - `data/safety-knowledge/exact-kosha/b-e-10-2026.json`
- Additional recheck branch: `integrate/kosha-wave2-current-20260720`
- Recheck commit: `e5204327a0b55f471ec390833e3ebf50ea39a2ab`
- Recheck artifact: `evaluation/kosha-current-master-recheck-2026-07-20/report.md`.

Evidence on current master:

- Focused KOSHA Vitest: 5 files / 80 tests PASS.
- Python acquisition: 19/19 PASS.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS, 28/28 static pages.

Decision:

- Do not merge stale `feat/kosha-trust-registry-wave2` into current `master`; it would risk reverting newer `B-E-10` and KOSHA corpus tracing.
- Future KOSHA work must branch from current `master` and preserve all three exact pins.

## Still Open Toward North Star

1. Document editor IA v2
   - Reduce risk-row density without hiding required controls.
   - Keep provenance outside editable body.
   - Verify desktop and 390px mobile with browser metrics.

2. Share v2 desktop and real dispatch loop
   - Keep the share page focused on target, channel, preview, and one send CTA.
   - Verify actual authenticated dispatch/session flow end-to-end.
   - Keep recipient read/ack path separate from admin-only logs.

3. KOSHA next wave
   - Start from current master.
   - Add exact pins only after body/PDF/provenance/human review receipt pass.
   - Do not promote metadata-only KOSHA candidates as direct evidence.

4. Hermes / OpenClaw long path
   - Keep SafeClaw DB/MCP evidence harness as system of record.
   - Hermes/OpenClaw remains an EngineAdapter/worker path, not a DB mutation authority.
   - Human confirmation stays mandatory for publish/organization knowledge promotion.

5. LLM Wiki / Knowledge
   - Preserve the three-layer boundary: public safety ontology, organization ontology, site operation memory.
   - Do not expose raw internal enum/provenance terms on user-facing pages.
   - Do not promote photo/person/signature/raw worker data across organizations.

## Next Recommended Worktree

`fix/document-editor-ia-v2-20260720`

Scope:

- Document editor density only.
- No DB schema migration.
- No KOSHA registry changes.
- No provider/Hermes changes.
- Browser gates: desktop 1440 and mobile 390; no nested scroll, no horizontal overflow, editor first useful content near first viewport, provenance collapsed outside textarea/body.

