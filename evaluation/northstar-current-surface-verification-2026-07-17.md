# North Star Current Surface Verification

Date: 2026-07-17
Authoritative HEAD: `484b29b8cfd4fe45d4aa8f98100f379e45d9f3b2`

## Scope

This verification records the current master state after the recipient share portal and foreign-language share boundary hardening work.

No DB schema changes, Supabase data mutations, provider activation, or ontology publication mutations were performed.

## Deployment

GitHub/Vercel status for `484b29b8cfd4fe45d4aa8f98100f379e45d9f3b2`:

- Vercel: success

Live route smoke:

```text
/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?workerId=11111111-1111-4111-8111-111111111111 -> 200, recipient page marker present
/ontology -> 200
/why -> 200
/workspace -> 200
```

## UI/UX Regression Gates

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

## Remaining North Star Work

This is not a completion claim for the full North Star objective. The following remain active workstreams:

- Hermes/OpenClaw engine adapter and service-auth operating model
- LLM wiki / knowledge review queue beyond current Phase A evidence harness
- broader document editing UX for 12 document types
- production provider dispatch activation and end-to-end recipient confirmation with real workers
- continued UI density review across non-core pages
