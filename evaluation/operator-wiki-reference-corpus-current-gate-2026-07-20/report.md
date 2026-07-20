# Operator Wiki / Reference Corpus Current Gate

Checked at: 2026-07-20T04:21:59.100Z

## Verdict

PASS, with publication and DB mutation still approval-gated.

The current production deployment exposes the official-reference corpus, knowledge-governance boundary, and published ontology graph in a way that matches the SafeClaw North Star:

- SIF/KOSHA/legal references remain a structured evidence corpus.
- The operator wiki is a review/export surface, not the system of record.
- LLMs cannot directly mutate DB state or publish knowledge.
- Published ontology remains advisory and requires source/provenance separation.

This does not claim that organization-specific wiki publication, live tenant A/B publication, or DB migration has been launched.

## Authority

- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\recipient-foreign-live-gate-20260720`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Source HEAD: `b93d5b9815a718a271a72adec5b03c3bd6404898`
- Production build-info at live checks: `b93d5b9815a718a271a72adec5b03c3bd6404898`
- Production branch: `master`

## Focused Tests

Command:

```powershell
npm.cmd test -- tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-review-actions.test.ts tests\knowledge-review-route.test.ts tests\knowledge-review-prepare.test.ts tests\knowledge-review-prepare-route.test.ts tests\knowledge-review-inbox-browser.test.ts tests\knowledge-promotion-gate.test.ts tests\knowledge-runtime-smoke.test.ts tests\ontology-knowledge-tool.test.ts tests\ontology-graph-store.test.ts tests\ontology-query.test.ts tests\safety-reference-status-route.test.ts tests\safety-reference-status-bundled-corpus.test.ts tests\workpack-commercial-tenant-hardening.test.ts tests\reporting-downloads.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 18 passed / 18
- Tests: 208 passed / 208
- Duration: 116.66s

## Live API Evidence

### Safety Reference Status

- `ok`: `true`
- `status`: `ready`
- `items`: 9920
- `technicalTotal`: 1040
- `technicalSupportRegulations`: 237
- `technicalGuidelines`: 803
- `searchReady`: `true`
- Exact trusted KOSHA pins: D-C-13, D-C-7, B-E-10

### Knowledge Governance

- `ok`: `true`
- Stages: 4
- Authority lanes: 6
- First stage: `knowledge_event` / `원본 이벤트`
- First authority lane: `sif` / `SIF 재해·통제 근거`
- `llmDbMutationAllowed`: `false`
- `llmPublishAllowed`: `false`
- `humanReviewRequired`: `true`

### Published Ontology Graph

- `ok`: `true`
- `configured`: `true`
- `scope`: `published`
- Nodes: 166
- Edges: 169
- Published nodes: 166
- Published edges: 169
- Dropped uncited nodes: 0
- Dropped uncited edges: 0
- Advisory notice present: true

Node counts by kind:

- Accident: 0
- Article: 56
- Control: 64
- Document: 3
- Duty: 2
- Hazard: 31
- Task: 10

## Boundary Decisions Confirmed

- The production reference corpus is ready for lookup, but corpus count is not presented as document-quality proof by itself.
- SIF remains incident/control evidence, not a legal-duty source.
- KOSHA technical guides remain practical control guidance and must not be displayed as statutes.
- Published ontology is advisory and carries a legal-review caveat.
- Operator wiki / Markdown / JSON exports remain secondary review artifacts.
- Human review remains required before any knowledge item is promoted.
- No DB schema migration, mass data mutation, or ontology publication mutation was performed in this gate.

## Remaining Work

1. Add live tenant A/B proof for knowledge publication only after explicit DB/RLS approval.
2. Keep organization/site wiki publication behind a human review and tenant boundary gate.
3. Add authenticated operator-owned Hermes/OpenClaw E2E proof before claiming live agent execution.
4. Continue improving operator surfaces so they say `공식자료 기반 안전지식 베이스`, not model-training or autonomous legal judgment.
