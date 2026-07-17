# North Star Current Surface Verification

Date: 2026-07-17
Authoritative code HEAD: `858c38a7e9138be3b148ecb4025aa2430113c043`

## Scope

This verification records the current master state after the recipient share portal, foreign-language share boundary hardening, invited-recipient confirmation snapshot hardening, current KOSHA exact evidence, and Hermes/Knowledge governance gate recording work.

No DB schema changes, Supabase data mutations, provider activation, or ontology publication mutations were performed.

## Build / Deployment Smoke

Local production build for `757b845a29854f1adb78535752bba9e82b440d99`:

```powershell
npm.cmd run build
```

Result:

- Build: passed
- Static pages: 28/28 generated

Vercel CLI deployment inspection was not available in this local session because no Vercel credentials were configured. Live HTTP smoke was still run against `www.safeclaw.kr`.

Live route smoke:

```text
/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?workerId=11111111-1111-4111-8111-111111111111 -> 200, recipient page marker present
/workspace -> 200
/documents -> 200
```

## UI/UX Regression Gates

Workspace input density / stale example gate:

- Empty input topbar now uses concise copy: `준비됨` / `현장 상황 입력`.
- The previous duplicated waiting copy (`작업 입력 대기` + `입력 대기`) is covered by a browser regression.
- Existing focused browser contracts also confirm that clearing an example removes stale example affordances and that the filled desktop side rail remains height-aligned with the main input panel.

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the empty input topbar concise|removes stale example affordances|keeps a filled workspace rail aligned"
```

Result:

- Test files: 1 passed
- Tests: 3 passed, 23 skipped

Broader workspace/shared UI gate:

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts tests\user-visible-korean-copy.test.ts tests\frontend-shared-surfaces.test.ts
```

Result:

- Test files: 3 passed
- Tests: 48 passed, 1 skipped

```powershell
npm.cmd test -- tests\ontology-ui-remediation.test.ts tests\ontology-tablet-overflow.test.ts tests\why-mobile-layout.test.ts tests\product-module-shell.test.ts
```

Result:

- Test files: 3 passed, 1 skipped
- Tests: 14 passed, 2 skipped

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts tests\user-visible-korean-copy.test.ts tests\frontend-shared-surfaces.test.ts
```

Result:

- Test files: 3 passed
- Tests: 47 passed, 1 skipped

## Share / Foreign-Language Gates

```powershell
npm.cmd test -- tests\workflow-share-client.test.ts tests\workspace-share-mobile-browser.test.ts tests\share-recipient-portal-browser.test.ts
```

Result:

- Test files: 3 passed
- Tests: 31 passed

Invited recipient confirmation hardening:

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts -t "public recipient confirmation ignores forged body fields"
npm.cmd test -- tests\workpack-share-authority-routes.test.ts
npm.cmd test -- tests\workflow-share-client.test.ts tests\workpack-share-authority.test.ts tests\workspace-share-mobile-browser.test.ts tests\share-recipient-portal-browser.test.ts
```

Result:

- Focused public recipient confirmation: 1 file / 1 test passed
- Share authority route suite: 1 file / 31 tests passed
- Share/mobile/recipient bundle: 3 passed, 1 skipped / 38 passed, 1 skipped

The public recipient confirmation route now stores the invited server snapshot when `workerId` matches a share-session recipient. Client-supplied display name, language code, and worker snapshot are ignored for invited recipients.

Dispatch log idempotency hardening:

- Code commit: `e8d14eda`
- `POST /api/dispatch-logs` now requires a valid `dispatch-v1-{attemptUuid}-{hash}` request key before any workspace-context or workpack lookup.
- Saved log payloads are normalized with the server request idempotency key, so forged per-log payload keys cannot become archive evidence.
- This does not activate live provider dispatch. Provider dispatch remains fail-closed until persistent provider idempotency is backed by a stronger storage contract.

```powershell
npm.cmd test -- tests\dispatch-logs-tenant-boundary.test.ts
npm.cmd test -- tests\workflow-share-client.test.ts tests\workpack-share-authority.test.ts tests\workspace-share-mobile-browser.test.ts tests\share-recipient-portal-browser.test.ts tests\dispatch-logs-tenant-boundary.test.ts
```

Result:

- Dispatch log tenant boundary: 1 file / 8 tests passed
- Share/mobile/recipient/dispatch bundle: 4 passed, 1 skipped / 46 passed, 1 skipped

Additional strict gate:

```powershell
npm.cmd run typecheck
```

Result:

- TypeScript strict typecheck: passed

The foreign recipient contract now explicitly verifies:

- foreign recipient preview does not include Korean text
- Korean text in a foreign-language message variant fails closed with `koreanLeakLanguageCodes`
- mobile share presentation has no horizontal overflow and preserves one primary CTA
- recipient portal route renders the invited-worker flow and posts only worker-scoped confirmation data

## KOSHA Evidence Harness Gate

The current KOSHA exact registry evidence is recorded separately in:

- `evaluation/kosha-wave2-wave3-current-master-verification-2026-07-17.md`

Current verified exact KOSHA assets:

- `D-C-13-2026`
- `D-C-7-2026`
- `B-E-10-2026`

Current exact KOSHA trace reality:

- NFT manifests: 81
- Complete exact KOSHA consumers: 17
- Partial exact KOSHA consumers: 0
- Exact asset bytes: 187,009

Focused KOSHA / ontology grounding gate:

```powershell
npm.cmd test -- --run tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-grounding.test.ts tests\exact-kosha-applicability-policy.test.ts tests\grounded-generation-contract.test.ts tests\ontology-evidence-chains.test.ts tests\ontology-operation-memory.test.ts --maxWorkers=1 --no-file-parallelism
```

Result:

- Test files: 7 passed
- Tests: 176 passed

## Hermes / EngineAdapter / Knowledge Review Gate

The long-term Hermes/OpenClaw direction remains bounded by the accepted ADR:

- SafeClaw MCP/DB/Evidence Harness remains the system of record and effect authority.
- Hermes/OpenClaw/fork execution is only allowed behind `EngineAdapter`.
- Runtime selection remains separate from model-provider fallback.
- LLM/wiki updates are candidate-only until human review.

Focused gate:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\remote-hermes-contract.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\knowledge-governance.test.ts tests\knowledge-review-actions.test.ts tests\llm-wiki-rls-approval-packet.test.ts
```

Result:

- Test files: 8 passed
- Tests: 198 passed

Additional Knowledge / LLM Wiki UI and governance gates:

```powershell
npm.cmd test -- tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-governance-ui-contract.test.ts tests\knowledge-review-inbox-browser.test.ts
```

Result:

- Test files: 4 passed
- Tests: 19 passed

```powershell
npm.cmd test -- tests\knowledge-governance.test.ts tests\knowledge-review-actions.test.ts tests\knowledge-promotion-gate.test.ts tests\knowledge-review-route.test.ts tests\knowledge-regenerate-route.test.ts
```

Result:

- Test files: 5 passed
- Tests: 92 passed

## Document Editing UX Gate

The current document editor surface is not claimed as the final 12-document product editor, but its present layout and structured-section contracts were rechecked.

Structured fallback isolation fix:

- Empty documents now keep a later edited fallback section isolated after reparsing.
- Example locked by test: editing `workPermitDraft` section `작업 전 허가조건` must not make `허가 기본 정보` inherit the same text.

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts tests\workpack-editor-structured-sections.test.ts
```

Result:

- Test files: 2 passed
- Tests: 37 passed

Focused regression and type gate:

```powershell
npm.cmd test -- tests\workpack-editor-structured-sections.test.ts
npm.cmd test -- tests\documents-editor-layout.test.ts
npm.cmd run typecheck
```

Result:

- Structured sections: 1 file / 7 tests passed
- Documents layout: 1 file / 30 tests passed
- TypeScript strict typecheck: passed

## Remaining North Star Work

This is not a completion claim for the full North Star objective. The following remain active workstreams:

- Hermes/OpenClaw engine adapter and service-auth operating model
- LLM wiki / knowledge review queue beyond current Phase A evidence harness
- richer document-specific editing controls beyond the current shared editor surface
- production provider dispatch activation and end-to-end recipient confirmation with real workers
- continued UI density review across non-core pages
