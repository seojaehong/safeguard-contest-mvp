# North Star Current Gate

Checked at: 2026-07-20 KST

## Verdict

Current `master` and the current production-visible product line are aligned with the active SafeClaw North Star on these core axes:

- KOSHA exact trusted references and applicability policy
- KOSHA fail-closed grounding and runAsk integration
- KOSHA materialization into workpack outputs
- KOSHA guide corpus/provenance/supporting-row relevance
- Phase A ontology/evidence-chain/runtime grounding
- Customer-facing terminology boundary for internal harness/wiki terms
- TypeScript strict typecheck
- Production build
- Hermes/OpenClaw adapter boundary and provider-policy separation
- Recipient portal and foreign-worker confirmation browser contract
- `/documents` standalone management density reduction
- Live generation grounding comparison and DB-harness quality contract probe
- Application-level tenant-boundary tests and RLS / LLM Wiki approval preflight
- Hermes/OpenClaw runtime adapter, service-auth, and fail-closed route boundary
- Current live critical surface rerun with no P1/P2 UI blockers
- Operator wiki / public reference corpus governance and live API readiness
- Mobile landing density P3 remediation on local and live production build

This gate does not claim the entire 24h/72h North Star objective is complete. It records that the current high-risk KOSHA/SIF/ontology and terminology boundaries are green on the authoritative code state.

## Authority

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\recipient-foreign-live-gate-20260720`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Source HEAD before this live generation evidence refresh: `9615766de2d1807bdd3634b8dcff957e66052f14`
- Product code production marker after `/documents` compact patch: `5a77590bbecca47b122c5f498cfba0cad5486264`
- Latest evidence-only commits after production product marker: `bc10fbe9`, `ac304c74`
- Latest production build-info observed during operator wiki / corpus gate: `4025015b456c6c5903b40764c90782b7d90d503a`

## Verification

### KOSHA / Terminology Core Gate

Command:

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-kosha-applicability-policy.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-materialization-matrix.test.ts tests\customer-terminology-boundary.test.ts tests\user-visible-korean-copy.test.ts tests\knowledge-page-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 10 passed / 10
- Tests: 136 passed / 136
- Duration: 74.90s

### Runtime / Hermes / OpenClaw / LLM Wiki Boundary Gate

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-engine-protocol.test.ts tests\ai-provider-policy.test.ts tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts tests\llm-wiki-rls-approval-packet.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 11 passed / 11
- Tests: 212 passed / 212
- Duration: 13.61s

### KOSHA Guide / Ontology Expansion Gate

Command:

```powershell
npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\kosha-guide-provenance-gate.test.ts tests\kosha-guide-supporting-row-relevance.test.ts tests\kosha-current-review-provenance.test.ts tests\ontology-evidence-chains.test.ts tests\phase-a-runtime-evidence-grounding.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 8 passed / 8
- Tests: 225 passed / 225
- Duration: 12.30s

### Current KOSHA / SIF / Phase A Evidence Gate

Command:

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-kosha-applicability-policy.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-materialization-matrix.test.ts tests\kosha-guide-provenance-gate.test.ts tests\kosha-guide-supporting-row-relevance.test.ts tests\kosha-verified-subset-gate.test.ts tests\phase-a-runtime-evidence-grounding.test.ts tests\phase-a-runtime-evidence-bridge.test.ts tests\phase-a-product-materialization.test.ts tests\ontology-evidence-chains.test.ts tests\ontology-seed.test.ts tests\quality-contract.test.ts tests\sif-embedding-gate-status.test.ts tests\sif-embedding-runtime-probe.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 17 passed / 17
- Tests: 263 passed / 263
- Duration: 21.07s

### Recipient Portal / Foreign Distribution Gate

Command:

```powershell
npm.cmd run build
npm.cmd test -- tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Build: PASS, 28 / 28 static pages generated, `/share/[sessionId]` dynamic route included
- Recipient portal browser test files: 1 passed / 1
- Recipient portal tests: 5 passed / 5

Evidence:

- `evaluation/workspace-share-foreign-current-gate-2026-07-20/report.md`

### Documents Density / UI Consistency Gate

Command:

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run build
```

Result:

- Documents editor regression: 30 passed / 30
- Build: PASS, 28 / 28 static pages generated
- Production live `/documents`: desktop height 3500px -> 2286px, first textarea y 2006px -> 791px, horizontal overflow false

Evidence:

- `evaluation/documents-current-density-gate-2026-07-20/report.md`

### Live Generation Grounding / Quality Comparison Gate

Commands:

```powershell
node evaluation\live-generation-grounding-comparison-2026-07-20\run-live-generation-grounding-comparison.mjs
node scripts\live_harness_quality_probe.mjs --base-url https://www.safeclaw.kr --output live-harness-quality-probe-current-2026-07-20 --timeout-ms 120000
```

Result:

- Production build marker during `/api/ask` comparison: `ac304c7446e3d998c3f68d983430626b3f1cd7cf`
- `template`: HTTP 200, 698ms, quality `blocked`, structured rows 0, references 4
- `enhanced`: HTTP 200, 20,013ms, quality `ready`, structured rows 5, references 6
- Enhanced DB harness: direct evidence 2, SIF cases 3, supporting evidence 2, missing evidence 0, core document coverage 3 / 3
- Live harness quality probe: PASS, failed contracts 0

Evidence:

- `evaluation/live-generation-grounding-comparison-2026-07-20/report.md`
- `evaluation/live-generation-grounding-comparison-2026-07-20/comparison.json`
- `evaluation/live-harness-quality-probe-current-2026-07-20/report.md`
- `evaluation/live-harness-quality-probe-current-2026-07-20/summary.json`

### RLS / Tenant Boundary Current Gate

Commands:

```powershell
npm.cmd test -- tests\supabase-tenant-isolation-harness.test.ts tests\workpack-commercial-tenant-hardening.test.ts tests\tenant-harness-memory.test.ts tests\tenant-harness-memory-claw-tool.test.ts tests\mcp-harness-tenant-memory-route.test.ts tests\education-records-tenant-boundary.test.ts tests\dispatch-logs-tenant-boundary.test.ts tests\rls-llm-wiki-approval-preflight.test.ts tests\llm-wiki-rls-approval-packet.test.ts --maxWorkers=1 --fileParallelism=false
node scripts\rls_llm_wiki_approval_preflight.mjs --output evaluation\rls-llm-wiki-approval-preflight-current-2026-07-20
```

Result:

- Tenant/RLS application tests: 9 files passed / 9, 82 tests passed / 82
- Approval preflight: `approval_ready_open`
- Failed preflight checks: 0
- Launch readiness: `false`
- DB mutation performed: `false`

Evidence:

- `evaluation/rls-current-tenant-boundary-gate-2026-07-20/report.md`
- `evaluation/rls-current-tenant-boundary-gate-2026-07-20/report.json`
- `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.md`
- `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json`

### Hermes / OpenClaw Runtime Current Gate

Commands:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\openclaw-broker-ui-context.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-service-auth.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-provider-policy.test.ts --maxWorkers=1 --fileParallelism=false
Invoke-WebRequest -Uri https://www.safeclaw.kr/api/agent/chat -Method Post -ContentType 'application/json' -Body '{"message":"status"}' -TimeoutSec 20 -SkipHttpErrorCheck
```

Result:

- Runtime/adapter tests: 13 files passed / 13, 289 tests passed / 289
- Live unauthenticated broker smoke: HTTP 401, `AUTH_REQUIRED`, engine execution not reached
- Production build-info observed during live smoke: `a888a4681293dcddf72b309af8a5532919d49d62`

Evidence:

- `evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.md`
- `evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json`

### Live Critical Surface Rerun

Command:

```powershell
node evaluation\live-critical-surface-current-2026-07-20-rerun\run-live-critical-surface-rerun.mjs
```

Result:

- Production build marker: `6ac736394b58bbade424fc876ccc99e96a503de9`
- Routes checked: `/`, `/workspace`, `/why`, `/ontology`, `/knowledge`, `/documents`, `/reports`, `/share/not-a-session?lang=vi`
- Viewports: desktop 1440x900, mobile 390x844
- P1/P2 findings: 0
- Remaining finding: P3, `/` mobile landing remains long at 12.8x viewport
- `/documents` desktop live height after compact patch: 2286px
- `/share/not-a-session?lang=vi` mobile live height: 855px, horizontal overflow false

Evidence:

- `evaluation/live-critical-surface-current-2026-07-20-rerun/report.md`
- `evaluation/live-critical-surface-current-2026-07-20-rerun/report.json`

### Operator Wiki / Public Reference Corpus Current Gate

Commands:

```powershell
npm.cmd test -- tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-review-actions.test.ts tests\knowledge-review-route.test.ts tests\knowledge-review-prepare.test.ts tests\knowledge-review-prepare-route.test.ts tests\knowledge-review-inbox-browser.test.ts tests\knowledge-promotion-gate.test.ts tests\knowledge-runtime-smoke.test.ts tests\ontology-knowledge-tool.test.ts tests\ontology-graph-store.test.ts tests\ontology-query.test.ts tests\safety-reference-status-route.test.ts tests\safety-reference-status-bundled-corpus.test.ts tests\workpack-commercial-tenant-hardening.test.ts tests\reporting-downloads.test.ts --maxWorkers=1 --fileParallelism=false
Invoke-RestMethod https://www.safeclaw.kr/api/safety-reference/status
Invoke-RestMethod https://www.safeclaw.kr/api/knowledge/governance
Invoke-RestMethod https://www.safeclaw.kr/api/ontology/graph
```

Result:

- Tests: 18 files passed / 18, 208 tests passed / 208
- Production build-info: `4025015b456c6c5903b40764c90782b7d90d503a`
- Safety reference corpus: `ready`, 9,920 items, 1,040 technical references, search ready
- Knowledge governance: 4 stages, 6 authority lanes, LLM DB mutation disabled, LLM publish disabled, human review required
- Published ontology graph: 166 nodes, 169 edges, uncited dropped nodes 0, uncited dropped edges 0

Evidence:

- `evaluation/operator-wiki-reference-corpus-current-gate-2026-07-20/report.md`
- `evaluation/operator-wiki-reference-corpus-current-gate-2026-07-20/report.json`

### Landing Mobile Density Current Gate

Commands:

```powershell
npm.cmd test -- tests\frontend-design-contract.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run build
$env:PORT='3020'; npm.cmd run start -- --hostname 127.0.0.1
```

Result:

- Frontend design contract: 1 file passed / 1, 22 tests passed / 22
- Build: PASS, 28 / 28 static pages generated
- Live production build-info after deploy: `042859ccd2da59c1f6afe4b0915eeba0e07cf5b2`
- Local production `/` mobile 390x844 height: 2,785px, 3.30x viewport, horizontal overflow false
- Live production `/` mobile 390x844 height: 2,785px, 3.30x viewport, horizontal overflow false
- Local production `/` desktop 1440x900 height: 5,604px, 6.23x viewport, horizontal overflow false
- Mobile landing nav hidden so it cannot target hidden mobile sections

Evidence:

- `evaluation/landing-mobile-density-current-2026-07-20/report.md`
- `evaluation/landing-mobile-density-current-2026-07-20/report.json`
- `evaluation/landing-mobile-density-current-2026-07-20/geometry.json`
- `evaluation/landing-mobile-density-current-2026-07-20/live-geometry.json`

### TypeScript

Command:

```powershell
npm.cmd run typecheck
```

Result:

- PASS

### Production Build

Command:

```powershell
npm.cmd run build
```

Result:

- PASS
- Static pages: 28 / 28 generated

## Current Reading

The current implementation preserves the accepted product direction:

- SIF/KOSHA evidence remains the grounding layer, not an unreviewed model-training claim.
- KOSHA guide references are tested through exact trust registry, applicability, provenance, offline harness, and materialization gates.
- Ontology/LLM wiki work remains bounded by evidence-chain/runtime grounding, human review, and customer-facing terminology boundaries.
- Hermes/OpenClaw are protected as EngineAdapter/runtime concerns rather than `ai-provider-policy` model-provider branches or product-core replacements.
- Internal terms and machine labels remain available for machine/export contracts but are guarded from default user-facing surfaces.
- Foreign-worker distribution now has a recipient portal browser contract, but real provider delivery still depends on production channel configuration.

## Remaining North Star Work

The broader objective remains active. The next highest-value workstreams are:

1. Public Reference Corpus / Operator Wiki Export: current governance and live API readiness are green; continue improving review/export surfaces without turning Markdown/wiki into runtime truth.
2. Landing page follow-up: live mobile density is remediated; revisit only if homepage content strategy changes.
3. RLS live launch proof: application boundary is green, but live tenant A/B, Storage, service-role, and publication RPC gates remain approval-gated.
4. Hermes/OpenClaw live execution proof: adapter boundary is green, but an authenticated operator-owned runtime E2E is still not claimed.
5. Re-run generation comparison after the next production product commit to keep the evidence current.
