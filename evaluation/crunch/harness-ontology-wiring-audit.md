# SafeClaw Harness/Ontology Frontend Wiring Audit

- Audit date: 2026-07-10
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate`
- Scope: workspace text/photo input -> generation API -> DB/SIF/KOSHA retrieval -> canonical risk rows/TBM -> `ontologyQa`/`qualityContract` -> `SafeGuardCommandCenter` -> persistence/share/read-confirmation/export.
- Non-actions: production code, tests, schema, and data were not modified. No commit or push was performed.
- Baseline verification: `npm.cmd test -- tests/workpack-ontology-qa.test.ts tests/quality-contract.test.ts tests/workpack-readiness.test.ts tests/workspace-pages.test.ts tests/workpack-store.test.ts tests/operation-improvements.test.ts tests/commercial-harness.test.ts tests/workspace-operation-graph.test.ts` passed: 8 files, 54 tests, 18.57s.

## Executive Verdict

**Share/readiness should remain HOLD.** The backend computes substantial retrieval, provenance, ontology, structured-output, and persistence signals, but there is no single authoritative readiness snapshot enforced by navigation, dispatch, share-session creation, read confirmation, and export. Several green labels prove only that metadata exists, not that the cited controls reached the canonical risk/TBM structures or the exported artifact.

The most consequential split is this: ontology remediation can make the prose QA pass, while structured TBM/XLSX output remains unchanged; then client-only readiness can be bypassed by calling an unauthenticated dispatch route directly.

## Current End-to-End Trace

1. `/workspace` mounts `SafeGuardCommandCenter` (`app/workspace/page.tsx:10-23`). Text and up to ten photos enter the client; photos are posted to `/api/input-photos/hazard-analysis` (`components/SafeGuardCommandCenter.tsx:1141-1163`, `components/SafeGuardCommandCenter.tsx:1188-1204`).
2. Accepted photo candidates are appended to the question and converted to harness improvements (`components/SafeGuardCommandCenter.tsx:1281-1305`). Generation uses `/api/ask` in template mode or `/api/ask/stream` with a plain-endpoint fallback (`components/SafeGuardCommandCenter.tsx:1523-1532`, `components/SafeGuardCommandCenter.tsx:1546-1599`).
3. Both ask routes parse `harnessMemory` and call `runAsk` (`app/api/ask/route.ts:18-28`, `app/api/ask/stream/route.ts:24-48`). `runAsk` launches legal, weather, KOSHA, accident, and four safety-reference searches, then merges/reranks their results (`lib/search.ts:1513-1550`, `lib/search.ts:1551-1597`).
4. The merged catalog feeds deterministic risk rows, photo rows, TBM links, and enhanced-mode structured TBM (`lib/search.ts:1851-1903`). The same retrieval result becomes `dbHarness.packet`, including source counts, vector/ranked/REST mode, required-document coverage, and ontology status (`lib/search.ts:1906-1919`, `lib/db-harness.ts:216-272`).
5. Generated prose is decorated with harness memory, then checked against the published ontology. Missing ontology labels are appended to prose and the prose is rereviewed; the final response receives `qualityContract` (`lib/search.ts:2089-2099`, `lib/workpack-ontology-qa.ts:167-189`).
6. The command center derives `workpackReadiness`, passes it to the document-stage `FieldOperationsWorkspace`, and separately renders a share summary page (`components/SafeGuardCommandCenter.tsx:1657-1686`, `components/SafeGuardCommandCenter.tsx:2208-2251`, `components/SafeGuardCommandCenter.tsx:2371-2409`). Saving, dispatch, share sessions, acknowledgments, and exports then diverge into independent paths.

## Findings

### Critical: share authority is client-only and the live dispatch endpoint is anonymous

`assessWorkpackReadiness` is evaluated only in the browser (`components/SafeGuardCommandCenter.tsx:1660-1666`). `WorkflowSharePanel` disables its two send buttons when `readiness.canShare` is false (`components/WorkflowSharePanel.tsx:347-348`, `components/WorkflowSharePanel.tsx:533-540`, `components/WorkflowSharePanel.tsx:577-590`), but the server does not recompute or require that contract.

`POST /api/workflow/dispatch` has a rate limiter but no user/session check (`app/api/workflow/dispatch/route.ts:212-215`). Its request type accepts `workpack?: unknown` (`app/api/workflow/dispatch/route.ts:12-17`); it checks only channel/workpack presence (`app/api/workflow/dispatch/route.ts:230-258`) and forwards the caller-supplied object to the live webhook (`app/api/workflow/dispatch/route.ts:295-307`). The frontend also sends no authorization header (`components/WorkflowSharePanel.tsx:301-310`). A caller can therefore bypass every ontology, quality, DB-harness, placeholder, ownership, and invited-recipient check.

The navigation gate compounds the mismatch: any generated workpack may open the share page (`lib/workspace-pages.ts:26-35`). The current test explicitly expects a blocked workpack to have an active share step (`tests/workspace-pages.test.ts:51-76`).

**Focused tests proposed**

- `tests/workflow-dispatch-readiness.test.ts`: a blocked/missing readiness snapshot returns `409`, does not invoke `postWebhookWithTimeout`, and cannot enter fixture/live dispatch.
- The same route test must reject an unauthenticated request and a workpack not owned by the authenticated workspace.
- `tests/workspace-pages.test.ts`: add `canShare` to the page-gate input and assert that `targetPage:"share"` is denied when false.
- Browser regression: a blocked response shows reasons but neither opens the operational share surface nor copies/sends a dispatch payload.

### Critical: ontology auto-remediation can self-certify prose while structured exports remain stale

The QA source contains only six prose deliverables (`lib/workpack-ontology-qa.ts:9-42`). On a miss, `applyOntologyQaRemediation` appends the exact missing hazard/control/article labels to those prose strings (`lib/workpack-ontology-qa.ts:87-155`), then `attachWebOntologyQa` rereviews that modified prose and stores the second verdict (`lib/workpack-ontology-qa.ts:180-189`). The current test treats that second-pass string match as a successful `통과` (`tests/workpack-ontology-qa.test.ts:88-109`).

No structured risk row, `tbmRiskLinks`, `tbmBriefingStructured`, or `tbmLogStructured` is updated by remediation. Yet `qualityContract` trusts the rereviewed verdict (`lib/quality-contract.ts:82-97`), and readiness trusts `qualityContract.overall` (`lib/workpack-readiness.ts:31-38`). XLSX export prefers structured TBM objects over edited/remediated prose (`components/WorkpackEditor.tsx:2044-2077`); risk exports also send the original structured risk rows (`components/WorkpackEditor.tsx:2078-2089`, `components/WorkpackEditor.tsx:2103-2115`). The visible QA result can therefore say pass while the field-facing spreadsheet omits the control that caused the pass.

**Focused tests proposed**

- Extend `tests/workpack-ontology-qa.test.ts`: after remediation, assert the workpack remains non-shareable until every missing control is represented in canonical risk rows and linked TBM structures, not merely in appended prose.
- Add an export contract test: a remediated control must appear in `tbmBriefingStructured`/`tbmLogStructured` and the generated XLSX payload before readiness becomes ready.
- Add a negative test proving that inserting the ontology label verbatim into a prose appendix alone cannot change readiness from blocked to ready.

### High: document edits invalidate neither readiness nor derived structures

`FieldOperationsWorkspace` creates `workspaceData` by overlaying edited prose onto the original response (`components/FieldOperationsWorkspace.tsx:816-820`) and uses that edited object for saving and dispatch (`components/FieldOperationsWorkspace.tsx:923-934`, `components/FieldOperationsWorkspace.tsx:1066-1073`). However, the `readiness` prop is computed once from the parent response (`components/SafeGuardCommandCenter.tsx:1660`, `components/SafeGuardCommandCenter.tsx:2404-2409`), not from `workspaceData`.

An editor can remove a required control, introduce a placeholder, or materially change a document while the send button still reflects the pre-edit verdict. Conversely, removing a placeholder does not clear the block. The edited prose also does not regenerate structured risk/TBM objects, ontology QA, evidence labels, or the quality contract.

Exports are always available except while the individual builder is running (`components/WorkpackEditor.tsx:2432-2450`), and the export routes validate shape, not readiness (`app/api/export/xlsx/route.ts:154-223`).

**Focused tests proposed**

- Component test: editing a ready document to add `작성 ___` immediately invalidates the current readiness snapshot and disables copy/send/export.
- Component test: deleting an ontology-required control marks the workpack dirty and requires QA rerun; it must not continue using the old `qualityContract.generatedAt`.
- Export route test: an independently submitted blocked snapshot is rejected, not converted to XLSX/HWP/PDF.
- Round-trip test: the content hash/version used for readiness must equal the version dispatched and exported.

### High: DB-harness coverage proves declared metadata, not row/TBM propagation

Document coverage is computed from `primary_documents`, `reflected_documents`, or an improvement's declared `reflectedDocuments` (`lib/db-harness.ts:117-149`). Missing evidence is then based on those declarations plus the presence of any SIF case (`lib/db-harness.ts:236-245`). `qualityContract` marks the harness ready from aggregate evidence count, coverage count, and ontology status (`lib/quality-contract.ts:201-214`).

None of these checks proves that a retrieved SIF/KOSHA item reached `riskAssessmentRows[].evidenceRefs`, `tbmRiskLinks[].evidenceRefs`, structured TBM controls, or the selected export. The existing ready-path test builds references whose metadata says all documents are covered and asserts ready without checking output propagation (`tests/quality-contract.test.ts:256-275`).

**Focused tests proposed**

- `tests/harness-propagation-readiness.test.ts`: for every required document marked covered, require at least one stable reference ID/title to appear in the canonical risk/TBM provenance for that document.
- Reject ready when a reference declares `primary_documents:["TBM 브리핑"]` but no TBM link/measure carries that reference.
- Artifact test: generate the selected XLSX/HWP payload and assert the same canonical reference/control set survives rendering.
- SIF-specific test: `sifCases > 0` is insufficient unless at least one task-relevant SIF case is linked to a risk row and a TBM confirmation item.

### High: failed/unconfigured photo analysis is promoted into `photo_analysis` evidence and document coverage

When vision returns no candidates, the client silently falls back to question/file-name heuristics and marks them `source:"local"` (`components/SafeGuardCommandCenter.tsx:1176-1185`). Accepted local candidates are nevertheless emitted as `sourceType:"photo_analysis"`, with `visionStatus:"unconfigured"` and `analysisMode:"manual_text"` (`lib/operation-improvements.ts:161-179`).

The risk-row builder accepts every `sourceType:"photo_analysis"` item without requiring successful vision evidence (`lib/search.ts:422-459`). The DB harness also counts every improvement's declared documents as coverage, regardless of `visionStatus` (`lib/db-harness.ts:139-149`). A file-name heuristic can therefore become a canonical risk row/TBM seed and help satisfy document coverage while labels still refer to photo analysis.

**Focused tests proposed**

- Extend `tests/operation-improvements.test.ts` with a local candidate: it must remain `operator_note`/review-required, not authoritative `photo_analysis`.
- Extend `tests/commercial-harness.test.ts`: `visionStatus:"unconfigured"` plus `analysisMode:"manual_text"` must not satisfy authoritative document coverage or a ready quality state.
- UI test: failed/unconfigured vision must display “사용자 검토 후보” and never “사진 분석 완료” or equivalent evidence-ready styling.

### High: persistence drops the generation-time harness packet, and exports re-query mutable evidence

`buildWorkpackEvidenceSummary` stores quality, ontology, labels, and structured output, but omits `dbHarness` (`lib/workpack-store.ts:66-79`). `buildReopenData` consequently reconstructs no harness packet (`lib/workpack-store.ts:136-160`), while readiness treats a missing packet as a blocker (`lib/workpack-readiness.ts:40-42`). The round-trip test claims no quality/ontology/structured loss but never checks `dbHarness` or readiness equivalence (`tests/workpack-store.test.ts:113-128`).

The operation graph and learning export do not use the exact generation-time evidence set. Both search the catalog again using only the stored question (`app/api/workpacks/[id]/operation-graph/route.ts:109-125`, `app/api/workpacks/[id]/learning-export/route.ts:113-129`). If catalog rows, ranking, feature flags, or embeddings change, a saved workpack's exported “하네스 JSONL” can cite evidence that was not used to generate that workpack, while omitting evidence that was used.

**Focused tests proposed**

- Extend `tests/workpack-store.test.ts`: persist and reopen the complete `dbHarness`; `assessWorkpackReadiness(before)` must equal `assessWorkpackReadiness(after)`.
- Learning-export route test: change the mocked current search result after save and assert export still uses persisted generation-time reference IDs and retrieval metadata.
- Operation-graph test: server graph evidence IDs must equal the saved packet's IDs; a fresh search may be shown only as a separately labeled “current comparison,” never as generation authority.

### Medium: evidence and progress labels overstate what was verified

`buildEvidenceLabels` is explicitly a static document-type-to-article lookup and does not validate prose citations (`lib/smsa-mapping.ts:1-8`, `lib/smsa-mapping.ts:158-170`). Nevertheless, `qualityContract` calls all required static labels “증빙 매핑” and marks the item ready by key count alone (`lib/quality-contract.ts:126-142`). `runAsk` creates those labels from a fixed key list regardless of document content (`lib/search.ts:2057-2072`). In the evidence rail, a static label is presented as “직접 근거,” styled ready, and may receive the URL of the first unrelated citation (`components/SafeGuardCommandCenter.tsx:713-727`).

Progress status also uses response existence as success: weather, law, and SIF/KOSHA stages become ready whenever `data` exists (`components/SafeGuardCommandCenter.tsx:495-518`). With zero SIF references after generation, the SIF rail still says “조회 예정,” not unavailable/empty (`components/SafeGuardCommandCenter.tsx:446-455`). “현장 이력” becomes ready at generation time even though no DB save occurred (`components/SafeGuardCommandCenter.tsx:479-483`), mirroring a `persistence` item that means only “saveable later” (`lib/quality-contract.ts:218-235`).

Detailed computed signals are hidden behind generic reasons: readiness reports only “품질 계약 보완 필요” and “DB 하네스 근거 보강 필요” (`lib/workpack-readiness.ts:45-50`) instead of surfacing `qualityContract.items`, retrieval mode/vector reason, missing evidence, validation issues, and document-specific coverage.

**Focused tests proposed**

- Evidence test: static labels without a matching citation/source record cannot produce evidence-ready status or a clickable source URL.
- UI state table test: generated + fallback/unconfigured/zero-count inputs must render warn/unavailable, never complete/ready/“조회 예정.”
- Persistence label test: generated-but-unsaved and saved workpacks must have distinct statuses; only the latter may say DB connected/saved.
- Accessibility regression: the share warning must enumerate the exact failed quality items and harness missing-evidence entries.

### Medium: the share-session/read-confirmation backend is not wired to the workspace claims

The share page claims invited-only access, worker snapshots, and acknowledgment storage (`components/SafeGuardCommandCenter.tsx:2227-2251`), but repository-wide frontend usage calls only `/api/workflow/dispatch` and `/api/dispatch-logs` (`components/WorkflowSharePanel.tsx:239-314`). No component calls `/api/workpacks/[id]/share-sessions` or `/read-confirmations`.

The dormant server paths are not sufficient gates either. Share-session creation accepts an empty recipient list and immediately inserts `status:"active"` (`app/api/workpacks/[id]/share-sessions/route.ts:88-130`, `lib/workpack-commercial.ts:98-131`). Read confirmation accepts a caller-supplied session ID and snapshot, then inserts after checking only display name and nonempty snapshot (`app/api/workpacks/[id]/read-confirmations/route.ts:71-96`, `lib/workpack-commercial.ts:134-175`). It does not prove that the session is active, belongs to the workpack, or contains that worker.

**Focused tests proposed**

- Share-session route test: reject blocked workpacks, empty recipients, and sessions whose recipient snapshots cannot be resolved.
- Read-confirmation route test: reject missing/inactive/foreign-workpack sessions and workers absent from the immutable recipient snapshot.
- Workspace integration test: creation of a ready share session returns a session ID, dispatch stores it, and acknowledgment updates the same session; the UI must not claim acknowledgment readiness before that sequence exists.

## Authoritative Readiness Invariants

The following conditions should be evaluated server-side from one immutable workpack revision and reused by UI, save, share session, dispatch, acknowledgment, and export:

1. **Revision identity:** question, edited deliverables, canonical risk rows/TBM structures, retrieval packet, ontology result, and quality contract share one revision/content hash. Any edit invalidates prior QA/readiness.
2. **Generation-time provenance:** persisted `dbHarness.packet` is the authority. Later searches cannot replace it in reopen, operation graph, or learning export.
3. **Retrieval truth:** every mode/count/vector reason shown in UI equals the request's actual `retrievalContract`; zero, fallback, unconfigured, and review-required are not rendered as complete.
4. **Propagation, not declaration:** required-document coverage is ready only when stable source provenance and required controls are present in the canonical risk rows/TBM structures and survive the chosen export renderer.
5. **Ontology parity:** QA pass requires control parity across prose and structured artifacts. Auto-appending labels to prose cannot by itself satisfy the gate.
6. **Photo authority:** only analyzed, user-accepted visual evidence may be labeled photo analysis. Local/file-name/manual candidates remain review-required and cannot satisfy authoritative evidence coverage.
7. **Persistence truth:** “saved/connected” requires a successful owned workpack row containing the full readiness evidence. “Saveable” is a separate non-ready state.
8. **Server-enforced share:** authenticated ownership, ready revision, nonempty invited recipient snapshot, active session, and exact revision match are required before dispatch.
9. **Acknowledgment integrity:** confirmation belongs to an active session, owned workpack, and snapshotted recipient; it is not accepted from arbitrary caller JSON.
10. **Export parity:** blocked or stale revisions cannot be exported as submission-ready artifacts. Each export records the revision and readiness verdict it rendered.

## Recommended Test Gate

Before calling share/readiness complete, run a focused suite that covers the above invariants across pure policy, route, and browser layers:

- Pure policy: `quality-contract`, `workpack-readiness`, ontology/structured parity, DB-harness propagation, and photo authority.
- Route: dispatch auth/readiness, share-session membership, acknowledgment membership, persistence round-trip, and generation-time export provenance.
- Browser: blocked navigation, exact warning reasons, edit invalidation, ready share-session creation, and export button state.
- Artifact parity: one fixture must prove the same SIF/KOSHA source IDs and ontology controls in response JSON, risk rows, TBM structures, saved workpack, reopened workpack, XLSX/HWP/PDF payload, operation graph, and learning JSONL.

The current 54 passing focused tests are useful regression coverage, but several explicitly codify the unsafe behavior above: share remains navigable while blocked, prose-only ontology remediation becomes pass, and persistence round-trip omits the DB harness. They should be revised as part of the gate rather than treated as readiness evidence.
