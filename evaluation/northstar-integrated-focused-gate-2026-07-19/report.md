# North Star Integrated Focused Gate

Date: 2026-07-19
Source HEAD: `6ec45d2eefd311859a98ae5c0a07934442a3fc85`
Live build-info at verification time: `6ec45d2eefd311859a98ae5c0a07934442a3fc85`

## Scope

This gate verifies the highest-risk launch/North Star paths together on the current master worktree:

- clean workspace and input layout regressions;
- share client and recipient portal contracts;
- foreign-worker dispatch copy and mobile share preview;
- KOSHA guide corpus audit;
- ontology browser surface contract;
- knowledge governance and public presentation contract;
- Hermes/OpenClaw EngineAdapter and remote Hermes readiness boundaries.

This is a focused integration gate, not a full production E2E provider dispatch proof.

## Commands

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts tests\workspace-input-css-contract.test.ts tests\workflow-share-client.test.ts tests\share-recipient-portal-browser.test.ts tests\foreign-worker-languages.test.ts tests\kosha-guide-corpus-audit.test.ts tests\ontology-ui-browser.test.ts tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts tests\hermes-engine-adapter.test.ts tests\engine-runtime-readiness-policy.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-service-auth.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 12 passed, 2 skipped / 14 total
- Tests: 343 passed, 6 skipped / 349 total
- Duration: 181.33s

```powershell
npm.cmd run typecheck
```

Result:

- TypeScript strict typecheck PASS

## Current CI / Live Snapshot

At the time of this gate:

- `/api/build-info` returned live production commit `6ec45d2eefd311859a98ae5c0a07934442a3fc85`.
- GitHub Actions for earlier evidence commits had turned green for:
  - live mobile control contrast;
  - workspace input cleanliness;
  - live knowledge presentation;
  - live ontology browser evidence;
  - share recipient portal contract;
  - KOSHA ontology and exact registry gates.
- GitHub Actions for this exact gate's preceding `docs: verify hermes knowledge northstar gate` commit was still in progress when checked. Local focused verification above is the authoritative evidence for this report.

## Verified Claims

- The workspace no longer relies on stale default scenario text after clean storage in the focused regression contract.
- Share recipient routing and share-client contracts remain present.
- Foreign-worker dispatch text gates protect localized previews from Korean label leakage in the tested variants.
- KOSHA guide corpus and exact-reference work remains compatible with the focused corpus audit.
- Ontology UI contract remains bounded by the selected-neighborhood model, avoiding the former hairball failure in the focused browser test.
- Knowledge governance keeps Hermes/LLM candidate-only and non-publishing.
- Remote Hermes readiness remains fail-closed without the full service-auth, tenant, policy, transport, and ledger contract.

## Remaining Non-Claims

- This gate does not prove live SMS/email/Kakao provider delivery.
- This gate does not prove a live Hermes worker pool.
- This gate does not approve GPT OAuth PoC or Phase B schema/product implementation.
- This gate does not replace a future full-suite/build/browser 108-row audit.
