# SafeClaw Workpack Document Editors v2

> **HOLD_PENDING_INDEPENDENT_PASS**

이 문서는 구현자가 읽는 설계·결정·수용 기준이고 `spec.json`은 canonical machine registry다. 현재 검증은 JSON integrity와 Markdown stable registry coverage만 증명한다. 문장 단위 또는 전체 semantic parity는 주장하지 않는다.

- Branch: `feat/workpack-document-editors-v2`
- Base: `d3ad86530bc786d8024206cc5b7c7db60c055278`
- Reviewed HOLD: `dc8435c4211da54ed1f81cd5f5486d52d26ab6d0`
- Rejected remediation: `77f12a05acec6e1fb48fd94a0ccba329008062e2`
- Integration reference: `acf809ee47713123469c3c9b31edd11ad5f8deae`
- Production implementation started: `false`
- Allowed changes: this `spec.md` and `spec.json` only
- Database migration: forbidden
- Feature flag default: off
- Independent PASS before any implementation: required

## How To Use This Contract

`spec.json` is the canonical machine registry. It carries compact tuples, type bindings, exact files and commands, and acceptance assertions. This Markdown explains why those choices exist and how an implementation should satisfy them.

A field tuple has five positions:

| Index | Meaning |
| --- | --- |
| 0 | `path` |
| 1 | `type` |
| 2 | `required` |
| 3 | `codec` |
| 4 | `currentStructuredPath|null` |

For every tuple, the following paths are derived rather than repeated:

- editor state: `deliverables.editorV2.documents.<DocumentKey>.content.<fieldPath>`
- current-string fallback: `deliverables.<DocumentKey> -> [SafeClaw Editor v2 fields] -> {<fieldPath>}`
- export manifest: `documents.<DocumentKey>.content.<fieldPath>`
- round trips: `reload`, `xlsx`, `pdf`, `hwp`, `hwpx`

A `null` current path means v2-only. The adapter must check the exact legacy fallback and otherwise produce a typed empty value plus a blocking issue. It may not silently invent a default.

Shared type bindings are expanded before validation and export. `RiskAssessmentEditorRow`, `WorkerAttendanceConfirmation`, `ShareReadConfirmation`, and `ShareBlockBase` are each defined once and referenced by prefix in document registries.

The integrity table near the end records compact FNV-1a change fingerprints. It detects registry drift but is not a canonicalContract mirror. Wave 0 must create the durable cross-artifact validator as its first isolated commit before touching product files.

## Scope And Non-Goals

The bounded product flow remains **input -> documents -> share**.

Wave 1 makes these three documents real structured editors:

- `riskAssessmentDraft`

- `tbmBriefing`

- `tbmLogDraft`

The contract owns exactly 12 document editors. It does not authorize production code, tests, packages, CSS, API changes, DB changes, migrations, or evidence modifications in this task.

The following are explicitly out of scope for this spec remediation:

- implementing the editors

- changing export builders or routes

- adding a photo hydration API

- changing Supabase schema or generated DB types

- backfilling existing workpacks

- rewriting current evidence

- starting Wave 0 or any later wave before independent PASS

## Verified Production Seams

These are the current call sites the future implementation must reuse or deliberately extend. They are not proposed abstractions.

| ID | Path | Symbol | Implementation significance |
| --- | --- | --- | --- |
| SRC-01 | `lib/risk-assessment-schema.ts` | `RiskAssessmentRow` | All 21 production field names and enum/range validation are canonical; editor rows add only stable id in editorV2. |
| SRC-02 | `lib/types.ts` | `WorkPlanStructured | PermitInspectionStructured | TbmBriefingStructured | TbmLogStructured | EducationRecordStructured | TbmRiskLink` | Known fields project to these existing structured payloads; richer v2-only fields remain in editorV2 and export manifests. |
| SRC-03 | `lib/workpack-readiness.ts` | `applyWorkpackDeliverablesChange | assessWorkpackReadiness` | Current edit invalidates ontologyQa, qualityContract, and dbHarness; v2 extends invalidation to generationEvidence and generationEvidenceError. |
| SRC-04 | `app/api/ask/route.ts` | `POST` | Current full regeneration seam calls runAsk then attachGenerationEvidence; it is the fallback when no verified base exists, not an edit-preserving revalidator. |
| SRC-05 | `lib/generation-evidence.ts` | `verifyAskResponseGenerationEvidence | generationEvidenceReferences | attachGenerationEvidence | buildResponseContentDigest` | One seal exists only at top-level AskResponse. The digest deletes only top-level generationEvidence/error before hashing the rest; editorV2 must never copy the seal. |
| SRC-06 | `lib/workpack-ontology-qa.ts` | `attachWebOntologyQa | buildOntologyQaSource` | V2 review mode must attach a verdict without auto-mutating structured editor content; failed review returns blocking issues. |
| SRC-07 | `lib/quality-contract.ts` | `attachQualityContract` | Quality is recomputed only after deterministic editor projection and ontology review. |
| SRC-08 | `app/api/workpacks/route.ts` | `POST` | Current authoritative persistence is insert-only and requires valid generation evidence; v2 preserves immutable inserts and adds server-stamped human confirmation. |
| SRC-09 | `lib/workpack-store.ts` | `buildWorkpackEvidenceSummary | buildWorkpackInsertPayload | buildReopenData` | Existing deliverables/evidence_summary/status JSONB carry editorV2, structured data, review metadata, and seals without a migration. |
| SRC-10 | `lib/workpack-commercial-store.ts` | `assessStoredWorkpackShareAuthority` | Current authority does not verify editor block ID/revision/digest. Wave 4 owns that extension; v2 share stays blocked first. |
| SRC-11 | `app/api/workpacks/[id]/read-confirmations/route.ts` | `GET | POST` | Stores share-session read acknowledgment only; it cannot satisfy TBM attendance, understanding, signature, or safety confirmation. |
| SRC-12 | `app/api/workpacks/[id]/improvements/route.ts` | `GET | POST` | POST returns improvementId but not photo row id/storagePath; GET returns improvements and photo_summary but not workpack_improvement_photos. |
| SRC-13 | `components/WorkpackEditor.tsx` | `META_SECTION_PATTERNS | META_KEY_PATTERNS | parseSheetRows` | Existing patterns prove body/metadata separation is already recognized for export; v2 moves the boundary into a shared lossless adapter used before editing. |
| SRC-14 | `lib/search.ts` | `formatSafetyReferenceAppendix and deliverable appendix concatenation` | Current generation concatenates provenance into strings; v2 projects those appendices into separate evidence/review roots and never binds the combined string to an editor. |
| SRC-15 | `lib/official-safety-resources.ts` | `OFFICIAL_SAFETY_RESOURCES candidates` | Hardcoded URLs are untrusted candidates, including guidanceX.do. |
| SRC-16 | `lib/kosha.ts` | `fetchKoshaReferences | verifyReference | verified` | Only current runtime verified=true HTTPS results may become drawer links. |
| SRC-17 | `components/CurrentWorkpackModules.tsx` | `WorkpackEditor onChange -> applyWorkpackDeliverablesChange` | Current user edits propagate to workpack readiness; v2 passes canonical envelope changes and explicit revalidation invalidation through this call site. |
| SRC-18 | `app/api/workpacks/[id]/route.ts` | `GET` | Current reopen seam hydrates stored deliverables/evidence_summary/status; adapter precedence begins from the authoritative stored JSON. |
| SRC-19 | `app/api/export/xlsx/route.ts` | `POST` | Existing structured modes remain; v2 adds the deterministic hidden manifest and never drops richer fields. |
| SRC-20 | `app/api/export/pdf/route.ts` | `POST` | Visible PDF body uses submission content; deterministic provenance/audit appendix and field-path manifest remain outside editable body semantics. |
| SRC-21 | `app/api/export/hwp/route.ts` | `POST` | Existing HWP-compatible output remains; v2 appends deterministic semantic data outside the editable body. |
| SRC-22 | `lib/xlsx-builder.ts | lib/hwp-table-builder.ts | components/WorkpackEditor.tsx @rhwp client` | `builders and HWPX client` | All formats consume one ExportManifestBridge; current document-specific structured projections remain compatibility views. |
| SRC-23 | `app/api/workpacks/[id]/share-sessions/route.ts` | `GET | POST` | Current POST accepts recipients but no document/block/revision/digest binding. Wave 4 must validate and persist it in existing access_policy JSONB. |
| SRC-24 | `app/api/workflow/dispatch/route.ts` | `POST` | Current request rejects freshness fields and its session load has no binding. Wave 4 reads the server session binding and rejects stale state before provider preflight. |

## CONFLICT-001 Integration Ledger

Implementation reference is `acf809ee47713123469c3c9b31edd11ad5f8deae` on `feat/phase-a-evidence-integration`, or its designated successor at implementation time.

`feat/documents-mobile-priority` at `ec132129979dcbb684a87c7bbe89ff2a85180533` is excluded as an input: `tests/documents-editor-layout.test.ts` is dirty and `output/playwright/2026-07-11/` is untracked. Its reviewed commits are already mapped into the integration lineage:

| Source | Integration mapping |
| --- | --- |
| `2226aa22b648d324b8cc4c5360bac7a19d39f298` | `cf451c5f34667d5d4a35d6b7f05aa50f936d4280` |
| `ec132129979dcbb684a87c7bbe89ff2a85180533` | `24513457c7855450c4c335269325df28a6ecbd37` |

Each wave has one owner before shared-file edits. Integration order is wave0 through wave5; hand-merge reviewed hunks from the current integration lineage. Never wholesale-copy files/directories from another worktree, never copy that dirty test or Playwright output, and rerun source-shape plus wave tests after each handoff.

| Order | Wave owner | Shared files | Handoff |
| --- | --- | --- | --- |
| 1 `wave0` | `workpack-editor-wave0` | `lib/workpack-readiness.ts`; `app/api/workpacks/route.ts`; `lib/workpack-store.ts`; `lib/workpack-commercial-store.ts` | contract validator first, then adapter/review authority |
| 2 `wave1` | `workpack-editor-wave1` | `components/WorkpackEditor.tsx`; `components/WorkpackEditor.module.css`; `components/CurrentWorkpackModules.tsx`; `tests/documents-editor-layout.test.ts`; `lib/xlsx-builder.ts`; `lib/hwp-table-builder.ts`; `app/api/export/xlsx/route.ts`; `app/api/export/pdf/route.ts`; `app/api/export/hwp/route.ts` | start from mapped integration commits; recreate tests from clean lineage |
| 3 `wave2` | `workpack-editor-wave2` | `lib/workpack-editor-document-specs.ts`; `lib/workpack-editor-adapter.ts`; `lib/workpack-editor-export-manifest.ts`; `tests/documents-editor-layout.test.ts`; `lib/xlsx-builder.ts`; `lib/hwp-table-builder.ts` | after Wave 1 releases shared modules |
| 4 `wave3` | `workpack-editor-wave3` | `lib/workpack-editor-document-specs.ts`; `lib/workpack-editor-adapter.ts`; `lib/workpack-editor-export-manifest.ts` | improvements route and photo libraries remain read-only |
| 5 `wave4` | `workpack-editor-wave4-share-freshness` | `lib/workpack-commercial.ts`; `lib/workpack-commercial-store.ts`; `app/api/workpacks/[id]/share-sessions/route.ts`; `app/api/workflow/dispatch/route.ts` | coordinate one owner with active share/workflow branches |
| 6 `wave5` | `workpack-editor-wave5-gate` | `tests/workpack-editor-browser-matrix.test.ts`; `tests/workpack-editor-export-roundtrip.test.ts`; `tests/documents-editor-layout.test.ts` | verification only after Waves 0-4 integrate |

## Measured Failing Baseline

The measurements below are RED fixtures from exact `d3ad865` Day review cockpit behavior. Passing geometry means replacing these conditions, not preserving them.

| Audit item | Failing measurement | Why it fails |
| --- | --- | --- |
| Repeated provenance literal | `중처법 §4-3호 증빙` appears 5 times | Same claim is repeated as rail, badge, trigger, and detail chrome |
| Same provenance | Up to 6 copies | Counts and labels disagree across surfaces |
| Evidence typography | 11px/16px | Too small for default workbench text |
| 968px app clamp | 194/453/260px | Persistent 260px evidence track compresses the document |
| 1150px viewport | 194/507/260px | Usable preview text is only about 250px |
| Risk edit payload | 5,221 characters | Editable body is mixed with provenance, KOSHA, internal DB, QA, and management notes |
| Desktop textarea | 563x460px; scroll 4975/455px | Fixed master textarea creates a deep internal scroll |
| Desktop body | scrollHeight 4927px | Result summary, citation list, and operation graph repeat below editor |
| Mobile 391x844 | workpack y=1456, editor y=1655 | Core editor begins too far down |
| Mobile textarea | 252x460px; scroll 11511/455px | Nested editor and page scrolling |
| Mobile page | scrollHeight 9120px | Evidence and appendices dominate the route |

The fixture remains useful after implementation: the same generated response must parse into document fields plus a separate read-only appendix without dropping a line.

## MODEL-BOUNDARY-001 Editable Body And Audit Separation

A document is not a string. Each document envelope has five roots:

| Root | Type | Editable | Purpose |
| --- | --- | --- | --- |
| `content` | `DocumentDraftByKey[K]` | yes | editable document-specific fields only |
| `legacySubmissionBody` | `LegacyBody` | no | read-only lossless legacy body |
| `legacyAppendix` | `LegacyAppendix` | no | read-only raw provenance/review sections |
| `inlineCitationRefs` | `string[]` | picker only | editable through evidence picker only |
| `unmappedLegacyLines` | `string[]` | no | read-only and blocking until classified |

Three workpack-level roots stay outside document content:

- `evidence`: `Record<string,EditorEvidenceRef>`
- `reviewArtifacts`: `dbHarness + ontologyQa + qualityContract` only
- `auditHistory`: `prior invalidated appendices/digests`

This boundary is enforced before parsing, editing, materialization, validation, export, and share freshness calculation.

The generation seal is not an editor root. It exists only as top-level `AskResponse.generationEvidence` with top-level `generationEvidenceError`. `editorV2.reviewArtifacts.generationEvidence`, copied snapshots, and copied signatures are forbidden.

Exact existing digest boundary:

1. Verify the untouched base response with `verifyAskResponseGenerationEvidence`.
2. Build the final response candidate, including editorV2 and fresh non-seal review artifacts.
3. Ensure the candidate has no nested seal; clear only top-level generationEvidence/error.
4. Existing `buildResponseContentDigest` canonicalizes and hashes every remaining AskResponse field.
5. Existing `attachGenerationEvidence` attaches one top-level envelope, then verification runs again.

`lib/generation-evidence.ts` is read-only in Waves 0 and 1. No algorithm or envelope change is required, so the seal cannot hash a copy of itself.

### Legacy Split Algorithm

1. Prefer verified editorV2 content.
2. Otherwise prefer current production structured payload.
3. Tokenize the exact legacy deliverables.<DocumentKey> string while retaining original line endings and section order.
4. Classify versioned META_SECTION_PATTERNS and META_KEY_PATTERNS into legacyAppendix; classify known form sections into legacySubmissionBody.
5. Parse only legacySubmissionBody into document fields.
6. Normalize recognized appendix provenance into evidence and non-seal reviewArtifacts while preserving the raw section verbatim in legacyAppendix.
7. Put unknown lines in unmappedLegacyLines and block authoritative revalidation instead of guessing.

Serializer flow:

1. Serialize document content to deterministic submission-body prose or structured payload.
2. Serialize field-path fallback lines in the non-editable [SafeClaw Editor v2 fields] section.
3. Materialize a fresh non-editable provenance/review appendix from current evidence and reviewArtifacts only when a legacy/export consumer requires it.
4. Never bind the combined legacy string back to an editable control.

The raw appendix is retained in original order and line endings. Recognized values may also normalize into evidence/review roots, but normalization never replaces the raw audit copy.

Known appendix headings include:

- `연결 상태`
- `KOSHA 기술지침/기술지원규정 직접 인용`
- `KOSHA 기술지침/기술지원규정 검토 필요`
- `내부 안전지식 DB 반영`
- `근거 요약`
- `반영 근거`
- `법령 근거 요약`
- `KOSHA 보강`
- `확인 근거 첨부`
- `중대재해 예방 관리체계 점검`
- `교육 적합성 확인`
- `유사 재해사례`
- `KOSHA 교육포털 연계`
- `TBM 필수 반영 체크`

Editable content must never contain:

- `DB harness summaries`
- `ontology QA payloads`
- `qualityContract payloads`
- `generation evidence seals`
- `KOSHA/law source metadata`
- `internal safety DB metadata`
- `management notes`
- `operation graph`
- `raw provenance appendix`

When the classifier cannot decide whether a line is submission content or audit content, it stores that line in `unmappedLegacyLines`, exposes a blocking issue, and refuses authoritative revalidation. Guessing is not allowed.

## MODEL-ADAPTER-001 Common Field Projection

Field parser and serializer behavior is selected by codec ID. Projection locations are formulas, so each document registry needs only its field tuple and optional current path.

Parser precedence:

1. verified stored deliverables.editorV2
2. valid local v2 draft with matching baseGenerationDigest
3. current structured payload
4. legacy submission body plus v2 field fallback
5. typed empty with blocking issue

Unknown behavior:

> Preserve unknown keys/lines verbatim; never default silently.

The current structured projection is a compatibility view, not the canonical owner. Richer IDs, evidence, verification, worker confirmation, actionTaken, and share freshness stay in `deliverables.editorV2` and the export manifest even where current production types lack fields.

### Codec Registry

| Codec | Parse contract | Serialize contract | Invalid input |
| --- | --- | --- | --- |
| `exactString` | acceptStringPreservingUnicodeAndInteriorAndBoundaryWhitespace | canonicalJsonString | `validation_error_and_preserve_raw_in_unmapped` |
| `stableId` | acceptNonEmptyStringOrGenerateDeterministicIdFromSourceRevisionAndArrayIndex | canonicalJsonString | `validation_error` |
| `strictInteger` | acceptFiniteIntegerOnly | canonicalJsonNumber | `validation_error_and_preserve_raw_in_unmapped` |
| `strictNumber` | acceptFiniteNumberOnly | canonicalJsonNumber | `validation_error_and_preserve_raw_in_unmapped` |
| `strictBoolean` | acceptBooleanOnly | canonicalJsonBoolean | `validation_error_and_preserve_raw_in_unmapped` |
| `strictEnum` | acceptExactDeclaredEnumMemberOnly | canonicalJsonString | `validation_error_and_preserve_raw_in_unmapped` |
| `orderedStringArray` | acceptStringArrayPreservingOrderDuplicatesAndExactValues | canonicalJsonArray | `validation_error_and_preserve_raw_in_unmapped` |
| `stableIdArrayNonEmpty` | acceptArrayWithAtLeastOneNonEmptyStableIdPreservingOrderAndRejectUnknownReferences | canonicalJsonArray | `blocking_reference_error` |
| `stableIdArrayAllowEmpty` | acceptZeroOrMoreNonEmptyStableIdsPreservingOrderAndRejectUnknownReferences | canonicalJsonArray | `blocking_reference_error` |
| `documentKeyArray` | acceptArrayOfExactDocumentKeyMembersPreservingOrder | canonicalJsonArray | `blocking_reference_error` |
| `localDate` | acceptExactStringThenValidateYYYYMMDDOrDeclaredFieldFallback | canonicalJsonString | `validation_error_and_preserve_raw_in_unmapped` |
| `isoDateTime` | acceptExactStringThenValidateISO8601 | canonicalJsonString | `validation_error_and_preserve_raw_in_unmapped` |
| `digest` | acceptStringMatchingSha256Base64urlPrefix | canonicalJsonString | `blocking_freshness_error` |
| `actorProvenance` | acceptStrictActorProvenanceObjectAndRejectModelClaimingHumanIdentity | canonicalJsonObjectWithSortedKeys | `blocking_human_confirmation_error` |
| `nullableExactString` | acceptNullOrStringPreservingUnicodeAndInteriorAndBoundaryWhitespace | canonicalJsonNullOrString | `blocking_type_error` |
| `nullableStableId` | acceptNullOrNonEmptyStableIdWithoutGeneratingOrCoercing | canonicalJsonNullOrString | `blocking_reference_error` |
| `nullableStrictNumber` | acceptNullOrFiniteNumberOnly | canonicalJsonNullOrNumber | `blocking_type_error` |
| `canonicalObject` | acceptPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonObjectWithSortedKeys | `blocking_type_error` |
| `nullableCanonicalObject` | acceptNullOrPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonNullOrObjectWithSortedKeys | `blocking_type_error` |
| `documentKey` | acceptExactDocumentKeyMemberOnly | canonicalJsonString | `blocking_reference_error` |
| `evidenceTargetArray` | acceptOrderedArrayOfStrictEvidenceMaterializationTargetsAndRejectUnknownKeys | canonicalJsonArrayWithTargetObjectKeysSorted | `blocking_reference_error` |
| `nullableStrictEnum` | acceptNullOrExactDeclaredEnumMemberOnly | canonicalJsonNullOrString | `blocking_type_error` |
| `canonicalArray` | acceptArrayRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonArray | `blocking_type_error` |

All JSON input begins as `unknown`. Type guards must reject arrays where objects are expected, reject undeclared enum members, preserve exact Unicode strings, and preserve unknown values in the unmapped root. TypeScript `any` is forbidden.

## Common Type Registry

These structures are defined once. Documents bind them by prefix instead of copying their field contracts.

### RiskAssessmentEditorRow

Production base: `RiskAssessmentRow from lib/risk-assessment-schema.ts`

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `id` | string | always | `stableId` | (v2 only) |
| `location` | string | always | `exactString` | structured.riskAssessmentRows[].location |
| `process` | string | always | `exactString` | structured.riskAssessmentRows[].process |
| `task` | string | always | `exactString` | structured.riskAssessmentRows[].task |
| `equipment` | string | always | `exactString` | structured.riskAssessmentRows[].equipment |
| `hazard` | string | always | `exactString` | structured.riskAssessmentRows[].hazard |
| `fourM` | "Man"\|"Machine"\|"Media"\|"Management" | always | `strictEnum` | structured.riskAssessmentRows[].fourM |
| `accidentType` | RiskAssessmentRow.accidentType | always | `strictEnum` | structured.riskAssessmentRows[].accidentType |
| `currentControls` | string | always | `exactString` | structured.riskAssessmentRows[].currentControls |
| `likelihood` | integer 1..5 | always | `strictInteger` | structured.riskAssessmentRows[].likelihood |
| `severity` | integer 1..5 | always | `strictInteger` | structured.riskAssessmentRows[].severity |
| `riskLevel` | "low"\|"medium"\|"high" | always | `strictEnum` | structured.riskAssessmentRows[].riskLevel |
| `additionalControls` | string | always | `exactString` | structured.riskAssessmentRows[].additionalControls |
| `owner` | string | always | `exactString` | structured.riskAssessmentRows[].owner |
| `due` | string | always | `localDate` | structured.riskAssessmentRows[].due |
| `verification` | string | always | `exactString` | structured.riskAssessmentRows[].verification |
| `verificationStatus` | "planned"\|"done"\|"needsReview" | always | `strictEnum` | structured.riskAssessmentRows[].verificationStatus |
| `verificationDate` | string | always | `localDate` | structured.riskAssessmentRows[].verificationDate |
| `verificationChecker` | string | always | `exactString` | structured.riskAssessmentRows[].verificationChecker |
| `whyLikelihood` | string | always | `exactString` | structured.riskAssessmentRows[].whyLikelihood |
| `whySeverity` | string | always | `exactString` | structured.riskAssessmentRows[].whySeverity |
| `evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | structured.riskAssessmentRows[].evidenceRefs |

Field notes:

- `id`: Editor-only stable identity derived deterministically for legacy rows; it never replaces a production field.
- `riskLevel`: Validate/derive from likelihood and severity with production validator.

### ActorProvenance

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `actorType` | "authenticated_user"\|"worker_self"\|"recorded_for_worker" | as declared | `strictEnum` | (v2 only) |
| `actorId` | string | as declared | `stableId` | (v2 only) |
| `displayName` | string | as declared | `exactString` | (v2 only) |
| `recordedForWorkerId` | string\|null | as declared | `nullableStableId` | (v2 only) |
| `occurredAt` | string | as declared | `isoDateTime` | (v2 only) |
| `authority` | "server_session"\|"worker_confirmation" | as declared | `strictEnum` | (v2 only) |

Authority: authenticated server session or explicit worker confirmation; model/system human identity is rejected

### HumanConfirmation

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `reviewerId` | string | always | `stableId` | (v2 only) |
| `reviewerDisplayName` | string | always | `exactString` | (v2 only) |
| `confirmedAt` | string | always | `isoDateTime` | (v2 only) |
| `materializationDigest` | string | always | `digest` | (v2 only) |
| `evidenceDigest` | string | always | `digest` | (v2 only) |
| `revision` | integer | always | `strictInteger` | (v2 only) |
| `disclaimerVersion` | string | always | `exactString` | (v2 only) |
| `actor` | ActorProvenance | always | `actorProvenance` | (v2 only) |

Authority: POST /api/workpacks server only

### WorkerAttendanceConfirmation

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `id` | string | always | `stableId` | (v2 only) |
| `workerId` | string | always | `stableId` | (v2 only) |
| `displayName` | string | always | `exactString` | (v2 only) |
| `attendanceStatus` | "expected"\|"present"\|"late"\|"absent" | always | `strictEnum` | (v2 only) |
| `understandingStatus` | "not_confirmed"\|"understood"\|"needs_followup" | always | `strictEnum` | (v2 only) |
| `signatureMethod` | "none"\|"drawn"\|"uploaded"\|"external_reference" | always | `strictEnum` | (v2 only) |
| `signatureRef` | string | when signatureMethod is not none | `exactString` | (v2 only) |
| `confirmedAt` | string | when confirmed | `isoDateTime` | (v2 only) |
| `actionTaken` | string | when needs_followup or absent | `exactString` | (v2 only) |
| `actor` | ActorProvenance | when confirmed | `actorProvenance` | (v2 only) |

Proves:

- attendance at a named TBM or education event
- worker understanding status
- signature or confirmation method
- event-specific actionTaken

### ShareReadConfirmation

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `id` | string | after read | `stableId` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].id |
| `shareBlockId` | string | always | `stableId` | (v2 only) |
| `shareSessionId` | string\|null | always | `nullableStableId` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].share_session_id |
| `workerId` | string\|null | when known | `nullableStableId` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].worker_id |
| `workerDisplayName` | string | always | `exactString` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].worker_display_name |
| `languageCode` | string | always | `exactString` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].language_code |
| `confirmationMethod` | "button" | always | `strictEnum` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].confirmation_method |
| `readAt` | string | always | `isoDateTime` | GET /api/workpacks/[id]/read-confirmations -> confirmations[].read_at |

Proves:

- a share-session recipient opened or acknowledged the shared material

Cannot prove:

- TBM attendance
- education attendance
- understanding
- signature
- work completion
- safety approval
- human document confirmation

### ShareBlockBase

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `id` | string | always | `stableId` | (v2 only) |
| `documentKey` | DocumentKey | always | `documentKey` | (v2 only) |
| `sourceDocumentKeys` | DocumentKey[] | at least one | `documentKeyArray` | (v2 only) |
| `sourceRevision` | integer | always | `strictInteger` | (v2 only) |
| `evidenceDigest` | string | always | `digest` | (v2 only) |
| `languageCode` | string | always | `exactString` | (v2 only) |
| `channel` | "sms"\|"kakao"\|"band"\|"link" | always | `strictEnum` | (v2 only) |
| `actionRequired` | string | always | `exactString` | (v2 only) |
| `confirmationRequired` | boolean | always | `strictBoolean` | (v2 only) |
| `state` | "draft"\|"stale"\|"ready"\|"dispatched" | always | `strictEnum` | (v2 only) |
| `shareSessionId` | string\|null | always | `nullableStableId` | workpack_share_sessions.id or null before server creation |

Stales on:

- edit to any sourceDocumentKey
- evidence add/remove/change
- translation source edit
- worker audience or language change
- human confirmation cleared
- server digest mismatch

### EvidenceMaterializationTarget

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `documentKey` | DocumentKey | always | `documentKey` | evidenceLabels[documentKey] and structured document owner |
| `rowOrSectionId` | string | always | `stableId` | stable structured row/section mapping |
| `fieldPath` | string | always | `exactString` | structured.*.evidenceRefs owner field path |
| `stableKey` | string | always | `stableId` | stable structured row/section mapping |

### EditorEvidenceRef

| Relative path | Type | Required | Codec | Current source/target |
| --- | --- | --- | --- | --- |
| `id` | string | always | `stableId` | Stable editor key; use SafetyReferenceItem.id unchanged when present, otherwise ontology citedUid |
| `sourceItemId` | string\|null | catalog evidence only | `nullableStableId` | SafetyReferenceItem.id exactly; null for ontology-only evidence |
| `rawItemType` | string\|null | catalog evidence only | `nullableExactString` | SafetyReferenceItem.item_type exactly, including technical-guideline, technical-support-regulation, and future values |
| `rawSourceId` | string\|null | catalog evidence only | `nullableStableId` | SafetyReferenceItem.source_id exactly |
| `rawEvidenceRole` | "direct"\|"supporting"\|null | catalog evidence when present | `nullableStrictEnum` | SafetyReferenceItem.evidence_role exactly; null remains null |
| `normalizedSourceClass` | "law"\|"kosha_guidance"\|"sif_case"\|"photo"\|"field_record"\|"other" | always | `strictEnum` | Derived classification stored alongside, never instead of, rawItemType/rawSourceId |
| `lifecycle` | "current"\|"stale"\|"retired"\|"unknown" | always | `strictEnum` | SafetyReferenceItem.kosha_guide.lifecycle or reviewed ontology/catalog derivation |
| `reviewState` | "draft"\|"verified"\|"published"\|"unknown" | always | `strictEnum` | ontology reviewState or explicit unknown |
| `resolution` | "resolved"\|"unresolved" | always | `strictEnum` | ontology evidence resolution |
| `quality` | "accepted"\|"review_required"\|null | always | `nullableStrictEnum` | SafetyReferenceItem.kosha_guide.quality or null |
| `evidenceRole` | "direct"\|"supporting" | always | `strictEnum` | Exact rawEvidenceRole when present; otherwise a versioned derivation recorded without mutating rawEvidenceRole |
| `directEligibility` | boolean | always | `strictBoolean` | SafetyReferenceItem.kosha_guide.directEligible or deterministic law/SIF rule |
| `obligationClassification` | "statutory_mandate"\|"technical_guidance_only"\|"statutory_mandate_with_guidance"\|"review_required" | always | `strictEnum` | ontology evidence-chain obligation classification |
| `relation` | "mandatedBy"\|"supportedBy"\|"prioritizedBy"\|"observedBy" | always | `strictEnum` | ontology evidence relation |
| `roleDetail` | "hazard_priority_only"\|"technical_guidance_only"\|null | always | `nullableStrictEnum` | ontology SIF role or KOSHA guidance role |
| `bodyKind` | "native"\|"unknown"\|null | always | `nullableStrictEnum` | SafetyReferenceItem.kosha_guide.bodyKind or null |
| `citedUid` | string\|null | ontology evidence only | `nullableExactString` | Ontology citedUid exactly; null for non-ontology catalog/photo/field evidence |
| `productionItemId` | string\|null | optional | `nullableStableId` | ontology KOSHA guidance productionItemId or null |
| `chunkId` | string\|null | optional | `nullableStableId` | ontology KOSHA guidance chunk.chunkId or null |
| `chunkSha256` | string\|null | optional | `nullableExactString` | ontology KOSHA guidance chunk.chunkSha256 or null |
| `page` | number\|null | optional | `nullableStrictNumber` | SafetyReferenceItem.kosha_guide.anchors[0].page or ontology guidance chunk.page |
| `location` | string\|null | optional | `nullableExactString` | ontology KOSHA guidance chunk.location or null |
| `sourceUrl` | string\|null | optional | `nullableExactString` | SafetyReferenceItem.source_url or law officialUrl |
| `materializationTargets` | EvidenceMaterializationTarget[] | always | `evidenceTargetArray` | structured document evidenceRefs plus evidenceLabels document mapping |
| `unresolvedReason` | string\|null | optional | `nullableExactString` | ontology QA missing/registry bridge reason or null |

`RiskAssessmentEditorRow` expansion is editor-only `id` plus the exact production `RiskAssessmentRow` order:

`id` -> `location` -> `process` -> `task` -> `equipment` -> `hazard` -> `fourM` -> `accidentType` -> `currentControls` -> `likelihood` -> `severity` -> `riskLevel` -> `additionalControls` -> `owner` -> `due` -> `verification` -> `verificationStatus` -> `verificationDate` -> `verificationChecker` -> `whyLikelihood` -> `whySeverity` -> `evidenceRefs`

The aliases `hazard4M`, `existingControls`, `dueDate`, and `reason` are forbidden for risk rows.

## MODEL-EVIDENCE-001 Provenance Contract

`EditorEvidenceRef` replaces the rejected `reviewed:boolean` shape. It preserves `sourceItemId`, raw `item_type`, raw `source_id`, and raw `evidence_role` separately from `normalizedSourceClass`. Non-ontology evidence has `citedUid=null`; no adapter fabricates one. `technical-guideline`, `technical-support-regulation`, and future item types remain byte-preserved.

Valid combinations:

| Normalized class | Allowed role | Direct eligibility | Required provenance | Allowed obligation |
| --- | --- | --- | --- | --- |
| `law` | `direct` | `true` | lifecycle=current; reviewState=published; resolution=resolved; quality=null; relation=mandatedBy; roleDetail=null | statutory_mandate, statutory_mandate_with_guidance |
| `kosha_guidance` | exact raw `direct` or `supporting` | `true` | lifecycle=current; reviewState=verified_or_published; resolution=resolved; quality=accepted; relation=supportedBy; roleDetail=technical_guidance_only; bodyKind=native; anchor=chunkSha256,page,location present | technical_guidance_only, statutory_mandate_with_guidance |
| `kosha_guidance` | `supporting` | `false` | quality=review_required, lifecycle stale/retired, unresolved bridge, unknown body, missing chunk hash/page/location, or reviewState=draft | review_required |
| `sif_case` | `supporting` | `false` | relation=prioritizedBy; roleDetail=hazard_priority_only | review_required |
| `photo` | `supporting` | `false` | relation=observedBy | review_required |
| `field_record` | `supporting` | `false` | relation=observedBy | review_required |
| `other` | preserved/derived | `false` | raw identity retained; reviewed normalization absent | review_required |

Rules:

- Published, resolved, current law with `mandatedBy` may be direct statutory evidence.

- KOSHA role preserves the raw direct/supporting value. Direct wording support never upgrades technical guidance into a statutory mandate. Direct eligibility still requires current, accepted, resolved, native, anchored material.

- KOSHA cannot establish `statutory_mandate` without a separate eligible published law source.

- SIF is `hazard_priority_only`: it can prioritize a hazard but cannot confirm a control, legal duty, approval, or human review.

- Photo and field records may support an observation or `actionTaken`; they cannot establish legal duty.

- Unresolved or `review_required` evidence remains visible in the drawer and blocks confirmation/share.

Evidence digest includes original IDs, all three raw identity fields, normalized class, nullable citedUid, lifecycle/review/quality/role/obligation, production/chunk IDs, chunk hash, page/location, materialization targets, and URL validation result. Unknown types therefore round-trip and change the digest without silently becoming eligible.

## FLOW-001 Edit To Persist To Share

Two valid review paths exist. No content mutation is required merely to confirm:

- no edit: `generated` -> validate unchanged content -> `review_pending` -> explicit authenticated confirmation -> `human_confirmed`
- edited: `generated|human_confirmed` -> edit/invalidate -> `edited` -> revalidate/reseal -> `review_pending` -> explicit authenticated confirmation -> `human_confirmed`

| From | Event | To | Effect set |
| --- | --- | --- | --- |
| `generated` | `USER_EDIT` | `edited` | `EDIT_INVALIDATE` |
| `generated` | `VALIDATE_UNEDITED_PASS` | `review_pending` | `VALIDATE_UNEDITED_PASS` |
| `generated` | `VALIDATE_UNEDITED_FAIL` | `generated` | `VALIDATE_UNEDITED_FAIL` |
| `human_confirmed` | `USER_EDIT` | `edited` | `EDIT_INVALIDATE` |
| `edited` | `REVALIDATION_PASS` | `review_pending` | `REVALIDATE_PASS` |
| `edited` | `REVALIDATION_FAIL` | `edited` | `REVALIDATE_FAIL` |
| `review_pending` | `USER_EDIT` | `edited` | `EDIT_INVALIDATE` |
| `review_pending` | `AUTHENTICATED_CONFIRM_AND_SAVE` | `human_confirmed` | `SERVER_CONFIRM_SAVE` |

### FLOW-INVALIDATE-001 Edit

Every user edit:

- increments the editor revision

- changes only document content and explicit evidence references

- clears human confirmation

- clears top-level AskResponse dbHarness, ontologyQa, qualityContract, generationEvidence/error and editorV2 non-seal review artifacts

- moves prior digests and appendices to audit history

- marks dependent share blocks stale

- keeps local undo/checkpoint history

### FLOW-REVALIDATE-001 Deterministic Review

Endpoint: `POST /api/workpack/revalidate`

Request:

- `mode=validate_unedited|revalidate_edited`
- `sealed baseResponse`
- `editorV2 candidate`
- `expectedBaseGenerationDigest`
- `expectedRevision`

Server sequence:

1. Verify the untouched base top-level seal and recover trusted references.
2. For `validate_unedited`, assert every document content/body byte is unchanged; for edited mode, project only editable content.
3. Validate risk rows/references, rebuild dbHarness, attach review-only ontology QA, and attach qualityContract.
4. Compute evidenceDigest, then materializationDigest over canonical `{version,revision,documents,evidenceDigest,reviewArtifacts,auditHead,unmapped}`. Exclude the digest itself, humanConfirmation, and top-level seal/error.
5. Set review_pending metadata, clear top-level seal/error on the final candidate, and call existing attachGenerationEvidence.
6. Verify the returned top-level envelope. A nested envelope is a blocking error.

Pass conditions:

- risk valid
- evidence resolves
- dbHarness ready
- ontology QA pass
- quality ready
- zero dropped/unmapped fields

Fallback seam: POST /api/ask only when base is absent/unsealed/invalid; full regeneration never claims edit preservation

A failed edited review remains `edited`; a failed unchanged review remains `generated`. Both retain content, report blockers, and keep share locked.

### FLOW-SAVE-001 Human Confirmation And Immutable Save

Endpoint: `POST /api/workpacks`

The endpoint accepts only a top-level sealed `review_pending` response plus expected revision/digests and `confirmMaterialization=true`. It authenticates the session, ignores client identity, stamps actor provenance, transitions to `human_confirmed` without changing document content, clears the top-level seal/error on the candidate, reseals through existing helpers, and inserts one new workpack row using existing JSONB columns.

There is no update-in-place path and no DB migration.

Generated/model output may never set:

- approved state

- reviewer or approver identity

- legal confirmation

- safety confirmation

- signature

- TBM or education attendance

- worker understanding

- human-confirmed review state

Required plain-language disclaimer:

> 자동 생성 문서와 자동 검수 결과는 현장 조건 확인, 법적 판단, 작업 승인 또는 안전 책임자의 확인을 대신하지 않습니다. 실제 작업 전 담당자가 내용·근거·작업자 이해 여부를 직접 확인해야 합니다.

### FLOW-SHARE-001 Stored Authority

Current v2 server freshness enforcement is **not installed**. Until Wave 4 route tests pass, feature-flag-on share-session creation and dispatch are disabled with `freshness_server_contract_missing`; flag-off legacy behavior is unchanged.

Wave 4 exact contract:

1. Each block carries owning `documentKey`, stable `id` as blockId, sourceRevision, and evidenceDigest.
2. `POST app/api/workpacks/[id]/share-sessions/route.ts` accepts those four assertions plus recipients, reloads the stored block, and rejects missing/stale/mismatched/non-human-confirmed state with 409.
3. The validated binding is stored at existing `workpack_share_sessions.access_policy.editorV2Binding`; no migration.
4. `app/api/workflow/dispatch/route.ts` keeps its current client request shape. `loadActiveOwnedShareSession` loads the server binding, reloads current authority, and rejects any identity/revision/digest/readiness mismatch before fixture or live provider preflight.

Stale share behavior:

- set block state=stale
- disable session creation and dispatch
- retain old read confirmations as historical records only
- show one primary action: rebuild share block

Rebuild creates a new block identity, retains intended recipients only, and clears session, dispatch, and current acknowledgment display. Historical read receipts remain history.

## CONFIRM-001 Worker And Share Confirmation

`WorkerAttendanceConfirmation` is event-specific. It may prove named attendance, understanding status, signature method, and follow-up action when backed by worker/self or authenticated recorded-for-worker provenance.

`ShareReadConfirmation` proves only that a share-session recipient opened or acknowledged shared material.

A share-read ID or timestamp may not populate worker attendance, understanding, signature, TBM completion, education completion, work completion, safety approval, or human document confirmation.

## Persistence And Commands

Primary storage: `deliverables.editorV2` inside `existing workpacks.deliverables JSONB`.

| Envelope field | Type | Authority | Codec | Current source |
| --- | --- | --- | --- | --- |
| `version` | "safeclaw-workpack-editor/v2" | `code_constant` | `strictEnum` | (v2 only) |
| `baseGenerationDigest` | string | `verified_generation_evidence` | `digest` | generationEvidence.snapshot.responseContentDigest |
| `revision` | integer | `server_validated_monotonic_revision` | `strictInteger` | (v2 only) |
| `materializationDigest` | string | `server_recomputed` | `digest` | independent canonical materialization input; never responseContentDigest-derived |
| `evidenceDigest` | string | `server_recomputed` | `digest` | generationEvidenceReferences plus dbHarness/ontologyQa provenance derivation |
| `reviewState` | "generated"\|"edited"\|"review_pending"\|"human_confirmed" | `state_machine` | `strictEnum` | (v2 only) |
| `documents` | Record<DocumentKey,DocumentEnvelope> | `adapter_and_editor` | `canonicalObject` | deliverables strings plus deliverables.*Structured and structured riskAssessmentRows/tbmRiskLinks |
| `reviewArtifacts` | ReviewArtifacts | `server_recomputed` | `canonicalObject` | dbHarness + ontologyQa + qualityContract only; seal forbidden |
| `auditHistory` | AuditHistoryEntry[] | `adapter_and_server` | `canonicalArray` | (v2 only) |
| `evidence` | Record<string,EditorEvidenceRef> | `verified_base_plus_human_selection` | `canonicalObject` | dbHarness.packet plus ontologyQa.result plus evidenceLabels |
| `humanConfirmation` | HumanConfirmation\|null | `authenticated_server_only` | `nullableCanonicalObject` | (v2 only) |
| `unmapped` | Record<string,unknown> | `lossless_parser` | `canonicalObject` | unrecognized current deliverables and legacy lines |

Digest order is evidenceDigest -> materializationDigest -> review state/human stamp -> existing `attachGenerationEvidence`. The final top-level responseContentDigest may include the already-computed materializationDigest and humanConfirmation, but neither editor digest includes itself. The top-level seal/error is persisted with AskResponse and is never copied into editorV2.

Command behavior:

- Autosave: local draft recovery only; it is never authoritative server save
- Undo: {"scope":"selected document content transaction only; evidence/review artifacts and server confirmations are never undoable client-side","historyLimit":50,"textCoalescingMs":750,"resetOn":["successful authoritative save","Load newer conflict resolution"],"preserves":["stable row IDs","legacy appendix audit history","unknown values"]}
- Cancel: Before revalidation, Cancel restores the selected document to its last explicit local checkpoint after confirmation. During a network request it requests abort where safe, retains the checkpoint, and never rolls back a completed server insert.
- Save: The only authoritative save is the authenticated review_pending -> human_confirmed POST /api/workpacks transition; local autosave/checkpoints are recovery only.
- Offline: local editing and local checkpoint allowed; revalidate, confirm, server save, export authority, and share disabled
- Conflict: pause autosave and require Keep mine or Load newer; never merge free text automatically

Shortcuts:

- `Ctrl+S requests the current permitted primary save/review action`
- `Ctrl+Z undo`
- `Ctrl+Y redo`
- `Ctrl+Shift+Z redo`

## PHOTO-001 Honest Before And After State

Canonical field: `documents.photoEvidenceDraft.content.improvements[].photoState`

Phase A states: `not_selected`, `local_display_only`, `upload_in_flight`, `server_metadata_only`, `upload_failed`. Hydratable stored pixels are a deferred capability, not a sixth state.

| State | Exact meaning |
| --- | --- |
| `not_selected` | No selected filename or object URL. |
| `local_display_only` | One or two local `File` objects may exist only in component memory. |
| `upload_in_flight` | Existing improvements POST is pending; interrupted reload maps to `upload_failed` and preserves the raw prior state in audit history. |
| `server_metadata_only` | Actual successful POST with nonempty `improvementId`, or matching GET row; filenames may reload but pixels cannot. |
| `upload_failed` | POST failed or was interrupted; any local preview survives only for the current mounted session. |

Transitions are total and explicit: select `not_selected -> local_display_only`; POST start `local_display_only -> upload_in_flight`; success with nonempty `improvementId` `upload_in_flight -> server_metadata_only`; failure/interruption `upload_in_flight -> upload_failed`; retry `upload_failed -> upload_in_flight`; replacement `server_metadata_only -> local_display_only`.

Legacy `recordState` + `photoAssetState` mapping:

| Legacy pair | Canonical result |
| --- | --- |
| `local_pending|display_only` + `not_selected|local_display_only` | `not_selected` when no file metadata exists; otherwise `local_display_only`. |
| `server_improvement_recorded` + `persistence_unverified` | `server_metadata_only` only with nonnull `serverImprovementId`. |
| `error` + any legacy asset state | `upload_failed`. |
| Unknown or conflicting values | Preserve both raw values in `unmapped`; emit a blocking issue. |

Local files and object URLs live only in component memory. Object URLs are revoked on replacement, removal, and unmount. File/Blob/object URL values never enter editorV2 or localStorage.

The current improvements POST may return:

- `improvementId`
- `reviewStatus`
- `sourceType`
- `vision summary fields`

It does not return:

- `workpack_improvement_photos.id`
- `storagePath`
- `storageBucket`
- `signed URL`

The current GET can reload improvement text, status, source type, photo-summary filenames, and analysis metadata. It cannot hydrate a photo row ID, storage path, binary, or signed URL.

Therefore Wave 3 may show local display-only pixels and reloaded filenames with `server_metadata_only` plus preview-unavailable text. It may not show a fabricated stored thumbnail, `assetId`, or `storagePath`; Wave 3 owns no API, DB, schema, or migration change.

## UI-COMPOSE-001 Default Workbench

Default priority, in order:

- **document selector**

- **document title and lifecycle status**

- **edit and download secondary commands**

- **preview or structured editor**

- **share readiness**

The following are absent from default composition:

- `yellow preview evidence badge`
- `persistent right evidence rail`
- `duplicate left evidence-readiness summary`
- `directEvidence cards`
- `DB harness cards`
- `safety-control readiness cards`
- `supporting-reference lists`
- `law open-action lists`
- `below-editor result summary`
- `below-editor citation list`
- `below-editor operation graph`
- `unvalidated external safety links`

Inline citation markers may remain in the document because they are semantic document content. Full source metadata, DB harness, QA, materialization, and open actions do not remain beside the document.

### UI-EVIDENCE-001 One Trigger And Drawer

Exact trigger copy: `근거 N건 · 확인 필요 M건`

The trigger is neutral secondary chrome. It is neither yellow nor primary.

The drawer title is `근거 및 검수`. It owns:

- full EditorEvidenceRef provenance
- directEvidence
- supportingEvidence
- DB harness
- safety-control readiness
- ontology QA
- qualityContract
- generation evidence and materialization digests
- review_required and unresolved work
- law open actions
- validated external safety links
- audit history and raw legacy appendix
- result summary
- citation list
- operation graph

Desktop: Fixed overlay on the inline end, width clamp(360px,42vw,480px); it overlays and never becomes a grid column or shrinks the preview.

Mobile: Full-width modal sheet, max-height 100dvh, one internal scrolling surface, sticky close/title row, no horizontal overflow.

Opening the drawer does not change document width. Closing restores focus to the trigger. Background content is inert while the mobile sheet is open.

### UI-COUNT-001 One Authoritative Count

Selector: `selectDocumentEvidenceSummary`

N and M are derived for the selected document only. No header/docpack/left-rail count is read. The same selected IDs populate drawer sections.

Derivation:

1. Deduplicate evidence IDs referenced by the selected document.
2. N is the number of distinct resolved or unresolved referenced IDs; no docpack/header/left-rail count is read.
3. M is the number of those IDs with unresolved resolution, review_required quality or obligation, non-current lifecycle, missing target, digest mismatch, or invalid external link when a link action is requested.
4. Partition the same IDs into directEvidence, supportingEvidence, lawActions, and reviewRequired for drawer sections.
5. On selector error render 근거 수치 확인 불가 and lock confirmation/share; never fall back to independently computed counts.

If the selector fails, render `근거 수치 확인 불가`, lock confirmation/share, and do not substitute another count source.

### UI Layout Targets

| View | Selector | Main editor | Readable preview | Evidence rail |
| --- | --- | --- | --- | --- |
| 1150x900 | <=220px | >=700px | >=560px | 0px |
| 1440x1000 | document track only | >=920px | >=720px | 0px |
| <=767px | native 44px select | one full-width track | container width | 0px |

Two tracks only: minmax(176px,220px) document selector plus minmax(0,1fr) main, 16px gap; no evidence track.

One main track. Document navigation is a native 44px select above the title; no left or right rail. Structured sections use progressive disclosure.

### UI-MOBILE-001 No Double Scroll

There is no v2 master-document textarea.

After Edit: After Edit, scroll and focus the selected document heading so getBoundingClientRect().top is at most 160px.

Default expanded sections: 1

Desktop multiline: auto-grow from 96px to 320px; after 320px only the focused field may scroll internally

Mobile multiline: auto-grow with overflow-y:hidden and no max-height; the page is the sole editor scroll container

Mobile rows: Show one expanded row or section at a time; collapsed summaries remain 44px minimum.

Nested-scroll assertion: At 390x844 and 391x844, no visible editor textarea has scrollHeight greater than clientHeight by more than 1px; only the evidence drawer may own an internal vertical scroller.

Audited sample page-height ceiling: 3600px.

### UI-TYPE-001 Readability

| Role | Minimum | Use |
| --- | --- | --- |
| Title | 20/28px | document title |
| Body | 15/23px | editor body |
| Table | 14/20px | dense rows |
| Label | 13/18px | controls and columns |
| Caption | 12/18px | drawer metadata only |

Letter spacing is 0. Default workbench text may not be 11px. A narrow column may not stack hud11/caption12/table13 as three muted levels.

### UI-ACTION-001 One Primary CTA

| State | Sole primary CTA |
| --- | --- |
| `generated` | `검토 시작` |
| `edited` | `재검수 요청` |
| `review_pending` | `확인하고 저장` |
| `human_confirmed` | `공유로 이동` |
| `stored_fresh` | `공유로 이동` |
| `share_block_stale` | `공유본 다시 만들기` |

Download visible label: `다운로드`

Download aria-label: `다운로드`

Edit, download, evidence, and document navigation are secondary unless one is the state primary. Share readiness is status text, not a competing CTA.

### UI-WARN-001 Source Confirmation Warning

`준제출형 source-confirmation caveat` is a real warning directly below title/status and before the evidence trigger in DOM/accessibility order. It has `role=alert`, `data-severity=warning`, minimum 14px/20px semibold text, a 2px leading border, text contrast >=4.5:1, and border contrast >=3:1 in Day and Night. The evidence trigger has neither alert role nor warning severity.

It is distinct from the removed yellow preview evidence badge.

### LINK-001 External Safety Links

Candidate catalog: `lib/official-safety-resources.ts`

Current verification seam: `lib/kosha.ts fetchKoshaReferences -> verifyReference -> reference.verified`

A URL is clickable only when the current reference is `verified=true`, uses HTTPS, exactly matches the verified normalized URL, and belongs to the current evidence/materialization digest.

Unvalidated links have no `href`; a disabled `링크 확인 필요` row may appear inside the drawer only.

The hardcoded `https://www.kosha.or.kr/kosha/data/guidanceX.do` candidate is omitted as a link while unverified.

### Deterministic Browser Assertions

| ID | Fixture/view | Assertion |
| --- | --- | --- |
| `BROWSER-001` | all | document.documentElement.scrollWidth === document.documentElement.clientWidth |
| `BROWSER-002` | coreGenerated/default | exactly one [data-testid=evidence-summary-trigger], zero yellow evidence badges, zero persistent evidence rails, zero duplicate left evidence summaries, and zero default result/citation/operation-graph panels |
| `BROWSER-003` | coreGenerated/default | document.body.innerText has zero occurrences of 중처법 §4-3호 증빙; open drawer has at most one |
| `BROWSER-004` | coreGenerated/default | trigger text and accessible name both equal 근거 3건 · 확인 필요 1건 and drawer section totals use the same selectDocumentEvidenceSummary result object |
| `BROWSER-005` | 1150x900 | selector width <=220px, main editor width >=700px, readable body width >=560px, evidence rail width=0px |
| `BROWSER-006` | 1440x1000 | main editor width >=920px, readable body width >=720px, evidence rail width=0px |
| `BROWSER-007` | mixedLegacyRisk | no input/textarea/contenteditable value contains any appendixSentinel, dbHarness, ontologyQa, qualityContract, generationEvidence, management note, or operation graph token |
| `BROWSER-008` | 390x844 and 391x844 | after activating 편집, selected editor heading getBoundingClientRect().top <=160px |
| `BROWSER-009` | 390x844 and 391x844 | every visible editor textarea has scrollHeight <= clientHeight+1, page scrollHeight <=3600px for mixedLegacyRisk collapsed fixture, and only an open drawer may have overflow-y auto/scroll |
| `BROWSER-010` | all/default | computed body font-size>=15px and line-height>=23px; table>=14/20; label>=13/18; no default text=11px; letter-spacing=0px |
| `BROWSER-011` | each lifecycle fixture | enabled visible [data-cta-priority=primary] count is exactly one when an action is available and zero in loading/offline; all other commands lack primary styling |
| `BROWSER-012` | all/default | each Download control has textContent=다운로드 and aria-label=다운로드 byte-for-byte |
| `BROWSER-013` | sourceWarning/day+night | warning has role=alert, data-severity=warning, font-size>=14px, line-height>=20px, font-weight>=600, leading border width=2px, text contrast>=4.5:1, border contrast>=3:1; evidence trigger lacks alert role/severity |
| `BROWSER-014` | drawer/day+night | opening drawer changes main editor width by <=1px; focus remains inside, Escape closes, trigger regains focus, and mobile background is inert |
| `BROWSER-015` | coreGenerated | direct/supporting evidence, DB harness, safety readiness, law actions, provenance, materialization, and review_required nodes are absent when drawer closed and present only under the open drawer |
| `BROWSER-016` | unverified guidanceX.do | zero rendered anchors have href containing guidanceX.do; only verified=true HTTPS URLs tied to current digest render anchors inside drawer |
| `BROWSER-017` | each viewport day vs night | selector, title, warning, command row, evidence trigger, editor, primary action, and share-readiness bounding x/y/width/height differ by <=1px and DOM/accessibility order is identical |
| `BROWSER-018` | all/default | every visible interactive target is >=44x44 CSS px; [data-editor-stack] computed gap=8px; non-overlay selector/title/commands/editor/share-readiness rectangles have zero intersection area |

## Accessibility And System States

Baseline: WCAG 2.2 AA.

- One active tabpanel with matching accessible name.

- Native select document navigation on mobile.

- Programmatic labels, descriptions, and error associations for every control.

- Polite live regions for save/review status and focused validation summary links.

- Move up and Move down controls for every reorder operation.

- Predictable focus after add, remove, undo, cancel, and conflict resolution.

- Color is never the only state indicator.

- Day and Night contrast parity.

- Reduced-motion support.

- Minimum 44 by 44 CSS pixel interactive targets.

- Evidence trigger rendered text and accessible name match; drawer uses dialog semantics, focus trap, Escape close, and trigger focus restoration.

- Download visible label and aria-label are both exactly 다운로드.

- The 준제출형 source-confirmation caveat uses role=alert and is announced before provenance controls.

- On mobile the document page is the sole editor scrolling surface; drawer scrolling is isolated while the background is inert.

State behavior:

- **empty**: Document-specific structured empty state with one create action; no empty state exposes a mixed master textarea.

- **loading**: Stable editor geometry skeleton near the top; stale values and appendices are not editable during hydration.

- **error**: Last recoverable structured local draft remains visible with Retry and Restore generated source; provenance parse failures remain in audit/unmapped and block authority.

- **offline**: Local structured editing and local checkpoint allowed; evidence drawer shows last verified snapshot as stale. Revalidate, confirm, server save, authoritative export, and share are disabled.

- **conflict**: Explicit Keep mine or Load newer decision.

- **readOnly**: Selection, copy, evidence navigation, and blockers remain available; edit actions hidden.

Stable dimensions are required for tabs, icon buttons, counters, rows, and sticky actions. Loading text, validation badges, and dynamic counts may not shift the grid.

## Component Boundaries And Reuse

Orchestration boundaries:

- WorkpackEditor owns selected document, canonical draft, commands, lifecycle, the single evidence drawer state, and feature-flag fallback.

- DocumentEditorRegistry exhaustively maps all 12 keys to typed specifications and thin domain wrappers.

- DocumentEditorShell owns one tabpanel, title/status, source-confirmation warning, one neutral evidence trigger, one primary lifecycle action, and secondary edit/download commands; it has no evidence rail.

- WorkpackEditorAdapter owns body/appendix separation, parse, serialize, dual projection, digest input, and unknown preservation.

- WorkpackReviewClient calls revalidation and save seams but cannot stamp human identity.

- selectDocumentEvidenceSummary is the only count source for EvidenceSummaryTrigger and EvidenceDetailsDrawer.

- EvidenceDetailsDrawer owns provenance, review artifacts, validated links, open actions, and audit appendices as one progressive-disclosure surface.

- WorkerAttendanceEditor owns event attendance/understanding and never consumes ShareReadConfirmation.

- ExportManifestBridge owns one canonical manifest for XLSX, PDF, HWP, and HWPX and keeps appendices outside editable body semantics.

Reusable primitives:

- `FieldGroup`
- `ExactTextField`
- `AutoGrowTextField`
- `EnumSelect`
- `DateTimeField`
- `ChecklistField`
- `EditableRowList`
- `ResponsiveDataGrid`
- `PeoplePicker`
- `EvidenceReferencePicker`
- `WorkerAttendanceEditor`
- `LanguageVariantEditor`
- `ShareBlockEditor`
- `ValidationSummary`
- `DocumentActionBar`
- `EvidenceSummaryTrigger`
- `EvidenceDetailsDrawer`
- `SourceConfirmationWarning`

Each document component name is both its file basename and named export. In particular, `workpackSummaryDraft` resolves to `components/workpack-editor/WorkpackSummaryEditor.tsx#WorkpackSummaryEditor`, and `workPermitDraft` resolves to `components/workpack-editor/WorkPermitEditor.tsx#WorkPermitEditor`. The aliases `SummaryEditor` and `PermitInspectionEditor` are forbidden.

A document wrapper is required when sequencing, row behavior, validation, projection, or primary action differs. Shared primitives are not a universal schema renderer.

Do not create twelve copy-pasted editors. Create twelve typed document specifications and only the thin wrappers needed for distinct domain interactions.

The desired implementation has 12 exhaustive typed document definitions, a smaller set of domain wrappers, and reusable controls. It does not have one title-swapped universal textarea and it does not have 12 copied editor trees.

## Document Registry

Each document section lists only its direct field delta. Shared fields appear through `typeBindings` and are defined once above. Expansion order is explicit in `spec.json.schemaOrder`.

Common gates for every document:

- Only structured content is editable; raw provenance appendix stays outside controls.
- Every field uses the common codec and derived projection formulas.
- Unknown values are preserved and block authority instead of disappearing.
- Inline citation markers open the single evidence drawer.
- Day/Night and all viewport containment assertions apply.
### DOC-01 점검결과 요약

- Key: `workpackSummaryDraft`
- Draft type: `WorkpackSummaryDraft`
- Component: `WorkpackSummaryEditor`
- Family: `finding-summary`
- Document command: `조치 항목 추가`
- Command hierarchy: Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `meta.title` | string | always | `exactString` | (v2 only) |
| `meta.siteName` | string | always | `exactString` | (v2 only) |
| `meta.inspectionDate` | string | always | `localDate` | (v2 only) |
| `meta.inspectorNames` | string[] | at least one | `orderedStringArray` | (v2 only) |
| `meta.overallResult` | "pass"\|"conditional"\|"fail" | always | `strictEnum` | (v2 only) |
| `meta.executiveSummary` | string | always | `exactString` | (v2 only) |
| `meta.nextAction` | string | when overallResult is not pass | `exactString` | (v2 only) |
| `findings[].id` | string | always | `stableId` | (v2 only) |
| `findings[].category` | string | always | `exactString` | (v2 only) |
| `findings[].finding` | string | always | `exactString` | (v2 only) |
| `findings[].severity` | "critical"\|"major"\|"minor"\|"observation" | always | `strictEnum` | (v2 only) |
| `findings[].owner` | string | when status is open | `exactString` | (v2 only) |
| `findings[].dueDate` | string | when status is open | `localDate` | (v2 only) |
| `findings[].status` | "open"\|"in_progress"\|"done" | always | `strictEnum` | (v2 only) |
| `findings[].evidenceRefs` | string[] | at least one unless explicit no-evidence reason | `stableIdArrayNonEmpty` | (v2 only) |

Required interactions:

- Filter by open, in-progress, and done without changing canonical row order.
- Jump from a finding's inline citation marker to the matching item in the single 근거 및 검수 drawer.
- Completed findings collapse only after the first open item remains visible.

Document gates:

- Require at least one finding or an explicit no-findings statement.
- Open findings require owner and dueDate.
- Every evidenceRefs value must resolve to envelope evidence.


### DOC-02 위험성평가표

- Key: `riskAssessmentDraft`
- Draft type: `RiskAssessmentEditorDraft`
- Component: `RiskAssessmentEditor`
- Family: `production-risk-grid`
- Document command: `위험행 추가`
- Command hierarchy: Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.

Shared type bindings:

| Prefix | Type | Current-path overrides |
| --- | --- | --- |
| `rows[]` | `RiskAssessmentEditorRow` | (none) |

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| (none) | all fields from shared binding | - | - | - |

Projection notes:

- `rows[].id`: Editor-only stable identity; never replaces a RiskAssessmentRow production field.

Required interactions:

- Add, duplicate, reorder, and remove rows with stable editor IDs.
- Use a desktop grid and an equivalent sequential mobile row editor.
- Show only concise citation markers in rows; lifecycle, role, eligibility, obligation, unresolved, and review_required detail opens in the single 근거 및 검수 drawer.
- Offer selected risk rows to TBM without mutating existing TBM drafts.
- Confirm removal when a row is referenced by TBM, work plan, permit, or evidence targets.

Document gates:

- Run validateRiskAssessmentRows against exactly the 21 production fields.
- Derive and verify riskLevel from likelihood and severity.
- Resolve every evidenceRefs ID and block unresolved or review_required direct use.
- Require explicit remapping before deleting a referenced row.


### DOC-03 작업계획서

- Key: `workPlanDraft`
- Draft type: `WorkPlanEditorDraft`
- Component: `WorkPlanEditor`
- Family: `existing-structured-plan`
- Document command: `작업단계 추가`
- Command hierarchy: Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `workOverview.workName` | string | always | `exactString` | deliverables.workPlanStructured.workOverview.workName |
| `workOverview.description` | string | always | `exactString` | deliverables.workPlanStructured.workOverview.description |
| `workOverview.workerCount` | integer | always | `strictInteger` | deliverables.workPlanStructured.workOverview.workerCount |
| `workOverview.location` | string | always | `exactString` | deliverables.workPlanStructured.workOverview.location |
| `workOverview.condition` | string | always | `exactString` | deliverables.workPlanStructured.workOverview.condition |
| `workOverview.equipment` | string[] | zero or more | `orderedStringArray` | deliverables.workPlanStructured.workOverview.equipment |
| `workSteps[].id` | string | always | `stableId` | (v2 only) |
| `workSteps[].stepNo` | integer | always | `strictInteger` | deliverables.workPlanStructured.workSteps[].stepNo |
| `workSteps[].action` | string | always | `exactString` | deliverables.workPlanStructured.workSteps[].action |
| `workSteps[].equipment` | string | always | `exactString` | deliverables.workPlanStructured.workSteps[].equipment |
| `workSteps[].safetyMeasure` | string | always | `exactString` | deliverables.workPlanStructured.workSteps[].safetyMeasure |
| `workSteps[].owner` | string | always | `exactString` | deliverables.workPlanStructured.workSteps[].owner |
| `workSteps[].relatedRiskRowIds` | string[] | zero or more | `stableIdArrayAllowEmpty` | deliverables.workPlanStructured.workSteps[].relatedRiskRowIndex |
| `workSteps[].evidenceRefs` | string[] | zero or more | `stableIdArrayAllowEmpty` | deliverables.workPlanStructured.workSteps[].evidenceRefs |
| `workSteps[].verification` | string | always | `exactString` | deliverables.workPlanStructured.workSteps[].verification |
| `stopCriteria` | string[] | at least one | `orderedStringArray` | deliverables.workPlanStructured.stopCriteria |
| `emergencyResponse.contacts[].id` | string | always | `stableId` | (v2 only) |
| `emergencyResponse.contacts[].role` | string | always | `exactString` | deliverables.workPlanStructured.emergencyResponse.contacts[].role |
| `emergencyResponse.contacts[].phone` | string | always | `exactString` | deliverables.workPlanStructured.emergencyResponse.contacts[].phone |
| `emergencyResponse.evacRoute` | string | always | `exactString` | deliverables.workPlanStructured.emergencyResponse.evacRoute |
| `emergencyResponse.firstAid` | string | always | `exactString` | deliverables.workPlanStructured.emergencyResponse.firstAid |
| `approvers.author` | string | always | `exactString` | deliverables.workPlanStructured.approvers.author |
| `approvers.reviewer` | string | always | `exactString` | deliverables.workPlanStructured.approvers.reviewer |
| `approvers.approver` | string | always | `exactString` | deliverables.workPlanStructured.approvers.approver |

Projection notes:

- `workSteps[].relatedRiskRowIds`: Map stable IDs to zero-based canonical risk row indices; retain IDs in editorV2.
- `approvers.author`: Generated value is an unverified display placeholder; it is not HumanConfirmation.
- `approvers.reviewer`: Generated value is an unverified display placeholder; it is not HumanConfirmation.
- `approvers.approver`: Generated value is an unverified display placeholder; it is not HumanConfirmation.

Required interactions:

- Reorder steps while stable IDs remain unchanged and stepNo is normalized at projection.
- Import selected risk rows as linked draft controls.
- Reveal emergency and display-only approver sections after core steps.

Document gates:

- Require at least one step with action, equipment, safetyMeasure, owner, and verification.
- Resolve every relatedRiskRowIds and evidenceRefs value.
- Never treat generated approver text as authenticated approval.


### DOC-04 안전작업허가 확인서

- Key: `workPermitDraft`
- Draft type: `WorkPermitEditorDraft`
- Component: `WorkPermitEditor`
- Family: `existing-structured-permit`
- Document command: `허가조건 추가`
- Command hierarchy: Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `applicability` | "required"\|"not_required"\|"undetermined" | always | `strictEnum` | (v2 only) |
| `notRequiredReason` | string | when applicability is not_required | `exactString` | (v2 only) |
| `basicInfo.permitNo` | string | when applicability is required | `exactString` | deliverables.permitInspectionStructured.basicInfo.permitNo |
| `basicInfo.permitType` | PermitInspectionStructured.basicInfo.permitType | when applicability is required | `strictEnum` | deliverables.permitInspectionStructured.basicInfo.permitType |
| `basicInfo.workName` | string | when applicability is required | `exactString` | deliverables.permitInspectionStructured.basicInfo.workName |
| `basicInfo.location` | string | when applicability is required | `exactString` | deliverables.permitInspectionStructured.basicInfo.location |
| `basicInfo.workDate` | string | when applicability is required | `localDate` | deliverables.permitInspectionStructured.basicInfo.workDate |
| `basicInfo.workerCount` | integer | when applicability is required | `strictInteger` | deliverables.permitInspectionStructured.basicInfo.workerCount |
| `basicInfo.requester` | string | when applicability is required | `exactString` | deliverables.permitInspectionStructured.basicInfo.requester |
| `basicInfo.approver` | string | when applicability is required | `exactString` | deliverables.permitInspectionStructured.basicInfo.approver |
| `conditions[].id` | string | always | `stableId` | (v2 only) |
| `conditions[].category` | PermitInspectionStructured.conditions[].category | always | `strictEnum` | deliverables.permitInspectionStructured.conditions[].category |
| `conditions[].requirement` | string | always | `exactString` | deliverables.permitInspectionStructured.conditions[].requirement |
| `conditions[].action` | string | always | `exactString` | deliverables.permitInspectionStructured.conditions[].action |
| `conditions[].owner` | string | always | `exactString` | deliverables.permitInspectionStructured.conditions[].owner |
| `conditions[].status` | PermitInspectionStructured.conditions[].status | always | `strictEnum` | deliverables.permitInspectionStructured.conditions[].status |
| `conditions[].relatedRiskRowId` | string\|null | optional | `nullableStableId` | deliverables.permitInspectionStructured.conditions[].relatedRiskRowIndex |
| `conditions[].evidenceRefs` | string[] | zero or more | `stableIdArrayAllowEmpty` | deliverables.permitInspectionStructured.conditions[].evidenceRefs |
| `conditions[].verification` | string | always | `exactString` | deliverables.permitInspectionStructured.conditions[].verification |
| `attachments[].id` | string | always | `stableId` | (v2 only) |
| `attachments[].name` | string | always | `exactString` | deliverables.permitInspectionStructured.attachments[].name |
| `attachments[].required` | boolean | always | `strictBoolean` | deliverables.permitInspectionStructured.attachments[].required |
| `attachments[].status` | PermitInspectionStructured.attachments[].status | always | `strictEnum` | deliverables.permitInspectionStructured.attachments[].status |
| `attachments[].note` | string | always | `exactString` | deliverables.permitInspectionStructured.attachments[].note |
| `completionChecks[].id` | string | always | `stableId` | (v2 only) |
| `completionChecks[].item` | string | always | `exactString` | deliverables.permitInspectionStructured.completionChecks[].item |
| `completionChecks[].method` | string | always | `exactString` | deliverables.permitInspectionStructured.completionChecks[].method |
| `completionChecks[].owner` | string | always | `exactString` | deliverables.permitInspectionStructured.completionChecks[].owner |
| `completionChecks[].status` | PermitInspectionStructured.completionChecks[].status | always | `strictEnum` | deliverables.permitInspectionStructured.completionChecks[].status |
| `approvers.requester` | string | always | `exactString` | deliverables.permitInspectionStructured.approvers.requester |
| `approvers.safetyManager` | string | always | `exactString` | deliverables.permitInspectionStructured.approvers.safetyManager |
| `approvers.siteManager` | string | always | `exactString` | deliverables.permitInspectionStructured.approvers.siteManager |
| `approvers.completionChecker` | string | always | `exactString` | deliverables.permitInspectionStructured.approvers.completionChecker |

Projection notes:

- `basicInfo.requester`: Generated value is unverified display text.
- `basicInfo.approver`: Generated value is unverified display text.
- `conditions[].relatedRiskRowId`: Map stable ID to zero-based canonical risk row index; null remains absent.
- `approvers.requester`: Display placeholder only.
- `approvers.safetyManager`: Display placeholder only.
- `approvers.siteManager`: Display placeholder only.
- `approvers.completionChecker`: Display placeholder only.

Required interactions:

- Selecting not_required preserves an intentional empty legacy permit and requires notRequiredReason.
- Selecting required reveals the exact PermitInspectionStructured fields.
- Bulk mark visible unchecked conditions as one undo transaction.

Document gates:

- Required permits need complete basicInfo, at least one condition, and completion checks.
- Not-required permits require an explicit reason and do not auto-generate structured permit data.
- Resolve risk and evidence references.
- Generated approver strings never satisfy HumanConfirmation.


### DOC-05 TBM/작업 전 안전점검회의

- Key: `tbmBriefing`
- Draft type: `TbmBriefingEditorDraft`
- Component: `TbmBriefingEditor`
- Family: `risk-linked-briefing`
- Document command: `위험성평가에서 불러오기`
- Command hierarchy: Shown as the only dominant action only when no global lifecycle action is active; editing and row commands remain secondary.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `meta.dateTime` | string | always | `isoDateTime` | deliverables.tbmBriefingStructured.meta.dateTime |
| `meta.location` | string | always | `exactString` | deliverables.tbmBriefingStructured.meta.location |
| `meta.target` | string | always | `exactString` | deliverables.tbmBriefingStructured.meta.target |
| `meta.attendees` | string | always | `exactString` | deliverables.tbmBriefingStructured.meta.attendees |
| `todayWork.name` | string | always | `exactString` | deliverables.tbmBriefingStructured.todayWork.name |
| `todayWork.location` | string | always | `exactString` | deliverables.tbmBriefingStructured.todayWork.location |
| `todayWork.time` | string | always | `exactString` | deliverables.tbmBriefingStructured.todayWork.time |
| `todayWork.equipment` | string[] | zero or more | `orderedStringArray` | deliverables.tbmBriefingStructured.todayWork.equipment |
| `hazards[].id` | string | always | `stableId` | (v2 only) |
| `hazards[].category` | "Man"\|"Machine"\|"Media"\|"Management" | always | `strictEnum` | deliverables.tbmBriefingStructured.hazards[].category |
| `hazards[].description` | string | always | `exactString` | deliverables.tbmBriefingStructured.hazards[].description |
| `hazards[].riskRowId` | string | always | `stableId` | deliverables.tbmRiskLinks[].riskRowIndex |
| `hazards[].weatherSignal` | string | when applicable | `exactString` | deliverables.tbmRiskLinks[].weatherSignal |
| `hazards[].confirmQuestion` | string | always | `exactString` | deliverables.tbmRiskLinks[].confirmQuestion |
| `hazards[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | deliverables.tbmRiskLinks[].evidenceRefs |
| `measures[].id` | string | always | `stableId` | (v2 only) |
| `measures[].hazardId` | string | always | `stableId` | deliverables.tbmBriefingStructured.measures[].hazardRef |
| `measures[].action` | string | always | `exactString` | deliverables.tbmBriefingStructured.measures[].action |
| `measures[].owner` | string | always | `exactString` | deliverables.tbmBriefingStructured.measures[].owner |
| `measures[].verification` | string | always | `exactString` | deliverables.tbmRiskLinks[].verification |
| `measures[].actionTaken` | string | after briefing | `exactString` | (v2 only) |
| `measures[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | deliverables.tbmRiskLinks[].evidenceRefs |
| `stopCriteria` | string[] | at least one | `orderedStringArray` | deliverables.tbmBriefingStructured.stopCriteria |
| `confirmTopics` | string[] | at least one | `orderedStringArray` | deliverables.tbmBriefingStructured.confirmTopics |
| `photoEvidenceLocation` | string | always | `exactString` | deliverables.tbmBriefingStructured.photoEvidenceLocation |

Projection notes:

- `hazards[].id`: Stable editor identity. Existing arrays hydrate deterministically from sourceRevision and array index.
- `hazards[].riskRowId`: Canonical stable ID is losslessly stored in editorV2; the compatibility adapter resolves it to the current risk-row index and rejects missing or ambiguous rows.
- `measures[].id`: Stable editor identity. Existing arrays hydrate deterministically from sourceRevision and array index.
- `measures[].hazardId`: Canonical hazard ID is losslessly stored in editorV2; the compatibility projection writes the referenced hazard's one-based index.
- `measures[].actionTaken`: Never infer from planned action; blank means no action has been recorded.

Required interactions:

- Import selected risk rows by stable row ID; show a mapping conflict instead of guessing when a source row no longer exists.
- Edit hazards and measures independently while retaining explicit hazardId links.
- Open evidence detail from the single header provenance trigger; do not render per-row provenance cards by default.
- Record actionTaken only as a human-authored post-briefing observation.

Document gates:

- Every riskRowId resolves to exactly one riskAssessmentDraft row.
- Every measure.hazardId resolves to exactly one hazard.
- Every evidenceRefs ID resolves and obeys the evidence role matrix.
- Generated planned actions never populate actionTaken.


### DOC-06 TBM 기록

- Key: `tbmLogDraft`
- Draft type: `TbmLogEditorDraft`
- Component: `TbmLogEditor`
- Family: `attendance-and-risk-log`
- Document command: `참석 확인`
- Command hierarchy: The only dominant document command during editing; lifecycle Save/Revalidate/Confirm/Share supersedes it when present.

Shared type bindings:

| Prefix | Type | Current-path overrides |
| --- | --- | --- |
| `workerAttendance[]` | `WorkerAttendanceConfirmation` | {"displayName":"deliverables.tbmLogStructured.attendance.attendees[]"} |

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `meta.dateTime` | string | always | `isoDateTime` | deliverables.tbmLogStructured.meta.dateTime |
| `meta.location` | string | always | `exactString` | deliverables.tbmLogStructured.meta.location |
| `meta.workType` | string | always | `exactString` | deliverables.tbmLogStructured.meta.workType |
| `meta.instructor` | string | always | `exactString` | deliverables.tbmLogStructured.meta.instructor |
| `attendance.expected` | integer | always | `strictInteger` | deliverables.tbmLogStructured.attendance.expected |
| `attendance.actual` | integer | always | `strictInteger` | deliverables.tbmLogStructured.attendance.actual |
| `attendance.attendees` | string[] | zero or more | `orderedStringArray` | deliverables.tbmLogStructured.attendance.attendees |
| `attendance.absenceReason` | string | when actual differs from expected | `exactString` | deliverables.tbmLogStructured.attendance.absenceReason |
| `attendance.confirmationMethod` | string | always | `exactString` | deliverables.tbmLogStructured.attendance.confirmationMethod |
| `todayWork.name` | string | always | `exactString` | deliverables.tbmLogStructured.todayWork.name |
| `todayWork.location` | string | always | `exactString` | deliverables.tbmLogStructured.todayWork.location |
| `todayWork.time` | string | always | `exactString` | deliverables.tbmLogStructured.todayWork.time |
| `todayWork.equipment` | string[] | zero or more | `orderedStringArray` | deliverables.tbmLogStructured.todayWork.equipment |
| `workerConfirmations` | string[] | at least one | `orderedStringArray` | deliverables.tbmLogStructured.workerConfirmations |
| `hazardsDiscussed[].id` | string | always | `stableId` | (v2 only) |
| `hazardsDiscussed[].category` | "Man"\|"Machine"\|"Media"\|"Management" | always | `strictEnum` | deliverables.tbmLogStructured.hazardsDiscussed[].category |
| `hazardsDiscussed[].description` | string | always | `exactString` | deliverables.tbmLogStructured.hazardsDiscussed[].description |
| `hazardsDiscussed[].riskRowId` | string | when linked | `stableId` | deliverables.tbmLogStructured.hazardsDiscussed[].relatedRiskRowIndex |
| `hazardsDiscussed[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | deliverables.tbmRiskLinks[].evidenceRefs |
| `hazardsDiscussed[].verification` | string | always | `exactString` | deliverables.tbmRiskLinks[].verification |
| `hazardsDiscussed[].actionTaken` | string | after TBM | `exactString` | (v2 only) |
| `safetyEducation.topic` | string | always | `exactString` | deliverables.tbmLogStructured.safetyEducation.topic |
| `safetyEducation.keyPoints` | string[] | at least one | `orderedStringArray` | deliverables.tbmLogStructured.safetyEducation.keyPoints |
| `safetyEducation.materials` | string | always | `exactString` | deliverables.tbmLogStructured.safetyEducation.materials |
| `unaddressedItems[].id` | string | always | `stableId` | (v2 only) |
| `unaddressedItems[].item` | string | always | `exactString` | deliverables.tbmLogStructured.unaddressedItems[].item |
| `unaddressedItems[].plannedAction` | string | always | `exactString` | deliverables.tbmLogStructured.unaddressedItems[].plannedAction |
| `unaddressedItems[].owner` | string | always | `exactString` | deliverables.tbmLogStructured.unaddressedItems[].owner |
| `unaddressedItems[].dueDate` | string | always | `localDate` | deliverables.tbmLogStructured.unaddressedItems[].dueDate |
| `unaddressedItems[].actionTaken` | string | when completed | `exactString` | (v2 only) |
| `photoEvidence.captureLocations` | string[] | zero or more | `orderedStringArray` | deliverables.tbmLogStructured.photoEvidence.captureLocations |
| `photoEvidence.storagePath` | string | always | `exactString` | deliverables.tbmLogStructured.photoEvidence.storagePath |
| `signatures.author` | string | human-only | `exactString` | deliverables.tbmLogStructured.signatures.author |
| `signatures.reviewer` | string | human-only | `exactString` | deliverables.tbmLogStructured.signatures.reviewer |
| `signatures.approver` | string | human-only | `exactString` | deliverables.tbmLogStructured.signatures.approver |

Projection notes:

- `attendance.actual`: Derived from workerAttendance present or late states on save; a mismatching imported value produces a validation error.
- `attendance.attendees`: Compatibility projection of workerAttendance.displayName for present or late workers; editorV2 remains authoritative for per-worker state.
- `workerAttendance[].displayName`: Legacy attendees hydrate one item per name with deterministic IDs and unconfirmed statuses.
- `workerAttendance[].signatureRef`: Opaque user-supplied reference only; it is not a share-read receipt.
- `workerAttendance[].actionTaken`: Human-authored follow-up only; generation leaves it blank.
- `hazardsDiscussed[].riskRowId`: Canonical stable ID maps to the current risk row index only after exact resolution.
- `photoEvidence.storagePath`: Descriptive legacy text only; it never proves a persisted photo asset.

Required interactions:

- Use WorkerAttendanceEditor for per-worker attendance, understanding, signature method, actor, and follow-up; do not reuse share-read controls.
- Link discussed hazards to stable risk row IDs and reveal evidence in the single provenance drawer.
- Derive actual attendance from worker rows and expose discrepancies before save.
- Keep author, reviewer, and approver blank for generated content; identity can only be attached by an authenticated human action.

Document gates:

- attendance.actual equals present plus late worker rows.
- Understanding confirmation requires present or late attendance, confirmedAt, and a human actor.
- Every riskRowId and evidenceRefs value resolves exactly.
- A ShareReadConfirmation never satisfies attendance, understanding, signature, or TBM completion.


### DOC-07 안전보건교육 기록

- Key: `safetyEducationRecordDraft`
- Draft type: `EducationRecordEditorDraft`
- Component: `EducationRecordEditor`
- Family: `curriculum-and-attendance`
- Document command: `교육 대상 확인`
- Command hierarchy: Secondary to the active global lifecycle action and never combined with save, confirmation, or share in one dominant button.

Shared type bindings:

| Prefix | Type | Current-path overrides |
| --- | --- | --- |
| `workerAttendance[]` | `WorkerAttendanceConfirmation` | (none) |

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `educationName` | string | always | `exactString` | deliverables.educationRecordStructured.educationName |
| `type` | "정기교육"\|"특별교육"\|"외국인교육"\|"신규자교육"\|"관리감독자교육"\|"기타" | always | `strictEnum` | deliverables.educationRecordStructured.type |
| `dateTime` | string | always | `isoDateTime` | deliverables.educationRecordStructured.dateTime |
| `location` | string | always | `exactString` | deliverables.educationRecordStructured.location |
| `target` | string | always | `exactString` | deliverables.educationRecordStructured.target |
| `instructor` | string | human-only | `exactString` | deliverables.educationRecordStructured.instructor |
| `confirmer` | string | human-only | `exactString` | deliverables.educationRecordStructured.confirmer |
| `curriculum[].id` | string | always | `stableId` | (v2 only) |
| `curriculum[].topic` | string | always | `exactString` | deliverables.educationRecordStructured.curriculum[].topic |
| `curriculum[].lawCitation` | string | when applicable | `exactString` | deliverables.educationRecordStructured.curriculum[].lawCitation |
| `curriculum[].keyPoints` | string[] | at least one | `orderedStringArray` | deliverables.educationRecordStructured.curriculum[].keyPoints |
| `curriculum[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `curriculum[].actionTaken` | string | after education | `exactString` | (v2 only) |
| `understandingCheck` | string | always | `exactString` | deliverables.educationRecordStructured.understandingCheck |
| `tbmLink` | string | always | `exactString` | deliverables.educationRecordStructured.tbmLink |
| `followupRecommendation` | string | always | `exactString` | deliverables.educationRecordStructured.followupRecommendation |

Required interactions:

- Edit curriculum rows and attach evidence without exposing source links on the default document surface.
- Reuse WorkerAttendanceEditor because the per-worker attendance and understanding semantics exactly match TBM records.
- Keep generated instructor and confirmer identity empty until authenticated human input.

Document gates:

- Each curriculum row has a topic, key point, and valid evidence role for any lawCitation.
- Understanding confirmation requires present or late attendance and human actor provenance.
- Share-read receipts do not count as education attendance or signatures.


### DOC-08 비상대응 절차

- Key: `emergencyResponseDraft`
- Draft type: `EmergencyResponseEditorDraft`
- Component: `EmergencyResponseEditor`
- Family: `scenario-response-plan`
- Document command: `비상 시나리오 추가`
- Command hierarchy: A secondary document command whenever a global lifecycle action is available.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `planTitle` | string | always | `exactString` | (v2 only) |
| `siteName` | string | always | `exactString` | (v2 only) |
| `effectiveDate` | string | always | `localDate` | (v2 only) |
| `emergencyCoordinator` | string | always | `exactString` | (v2 only) |
| `alarmMethods` | string[] | at least one | `orderedStringArray` | (v2 only) |
| `assemblyPoints[].id` | string | always | `stableId` | (v2 only) |
| `assemblyPoints[].name` | string | always | `exactString` | (v2 only) |
| `assemblyPoints[].location` | string | always | `exactString` | (v2 only) |
| `assemblyPoints[].capacity` | integer | always | `strictInteger` | (v2 only) |
| `assemblyPoints[].accessibilityNote` | string | when applicable | `exactString` | (v2 only) |
| `contacts[].id` | string | always | `stableId` | (v2 only) |
| `contacts[].role` | string | always | `exactString` | (v2 only) |
| `contacts[].name` | string | human-only | `exactString` | (v2 only) |
| `contacts[].phone` | string | human-only | `exactString` | (v2 only) |
| `contacts[].alternatePhone` | string | when applicable | `exactString` | (v2 only) |
| `scenarios[].id` | string | always | `stableId` | (v2 only) |
| `scenarios[].hazard` | string | always | `exactString` | (v2 only) |
| `scenarios[].riskRowIds` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `scenarios[].trigger` | string | always | `exactString` | (v2 only) |
| `scenarios[].immediateActions` | string[] | at least one | `orderedStringArray` | (v2 only) |
| `scenarios[].evacuationRoute` | string | always | `exactString` | (v2 only) |
| `scenarios[].responsibleRole` | string | always | `exactString` | (v2 only) |
| `scenarios[].callOrder` | string[] | at least one | `orderedStringArray` | (v2 only) |
| `scenarios[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `scenarios[].verification` | string | always | `exactString` | (v2 only) |
| `scenarios[].actionTaken` | string | after drill or incident | `exactString` | (v2 only) |
| `workerAccountingMethod` | string | always | `exactString` | (v2 only) |
| `drillSchedule` | string | always | `exactString` | (v2 only) |
| `postIncidentReporting` | string | always | `exactString` | (v2 only) |

Required interactions:

- Edit contacts, assembly points, and scenarios as separate tables with stable IDs.
- Link scenarios to risk rows and evidence; show provenance only through the header drawer.
- Progressively disclose contact details and drill history.

Document gates:

- Every scenario resolves at least one risk row and one eligible evidence reference.
- Every scenario names a route, responsible role, verification method, and call order.
- Generated output cannot set human names, phone numbers, completion, or approval.


### DOC-09 사진/증빙

- Key: `photoEvidenceDraft`
- Draft type: `PhotoEvidenceEditorDraft`
- Component: `ImprovementEvidenceEditor`
- Family: `before-after-improvement`
- Document command: `Before/After 선택`
- Command hierarchy: The only dominant document command while adding a local photo pair; lifecycle actions supersede it after any edit.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `siteTimeZone` | string | always | `exactString` | (v2 only) |
| `improvements[].localId` | string | always | `stableId` | (v2 only) |
| `improvements[].taskLabel` | string | always | `exactString` | GET /api/workpacks/[id]/improvements -> improvements[].task_label or POST form.taskLabel |
| `improvements[].hazardLabel` | string | always | `exactString` | GET /api/workpacks/[id]/improvements -> improvements[].hazard_label or POST form.hazardLabel |
| `improvements[].improvementText` | string | always | `exactString` | GET /api/workpacks/[id]/improvements -> improvements[].improvement_text or POST form.improvementText |
| `improvements[].reflectedDocumentKeys` | DocumentKey[] | at least one | `documentKeyArray` | GET /api/workpacks/[id]/improvements -> improvements[].reflected_documents or POST form.reflectedDocuments |
| `improvements[].beforeFileName` | string\|null | always | `nullableExactString` | GET /api/workpacks/[id]/improvements -> improvements[].photo_summary.beforePhotoName or POST beforePhoto.name or null |
| `improvements[].afterFileName` | string\|null | always | `nullableExactString` | GET /api/workpacks/[id]/improvements -> improvements[].photo_summary.afterPhotoName or POST afterPhoto.name or null |
| `improvements[].captureNote` | string | always | `exactString` | (v2 only) |
| `improvements[].actionTaken` | string | human-only | `exactString` | (v2 only) |
| `improvements[].evidenceRefs` | string[] | zero or more | `stableIdArrayAllowEmpty` | (v2 only) |
| `improvements[].photoState` | "not_selected"\|"local_display_only"\|"upload_in_flight"\|"server_metadata_only"\|"upload_failed" | always | `strictEnum` | Total mapping from the common Phase A photo state machine; successful POST/GET can yield server_metadata_only only |
| `improvements[].serverImprovementId` | string\|null | always | `nullableStableId` | POST /api/workpacks/[id]/improvements -> improvementId or GET improvements[].id or null |
| `improvements[].reviewStatus` | string | after successful response | `exactString` | POST /api/workpacks/[id]/improvements -> reviewStatus or GET improvements[].review_status |
| `improvements[].sourceType` | "manual"\|"photo_analysis" | after successful response | `strictEnum` | POST /api/workpacks/[id]/improvements -> sourceType or GET improvements[].source_type |
| `improvements[].verificationNote` | string | human-only | `exactString` | (v2 only) |

Projection notes:

- `improvements[].reflectedDocumentKeys`: Adapter uses the exact 12-key title map in both directions and preserves unmapped legacy labels in unmapped; it never guesses.
- `improvements[].actionTaken`: Never copied from a generated recommendation.
- `improvements[].photoState`: Exactly PHOTO-001. Wave 3 has no hydrated/stored pixel state because existing GET/POST responses expose no photo asset ID or storage path.
- `improvements[].serverImprovementId`: Nonnull proves only an improvement row response/reload, never a photo asset row or authorized pixel URL.

Required interactions:

- Select and compare Before/After files locally; use object URLs only in ephemeral component state and revoke them on replace, remove, or unmount.
- Submit the existing improvements endpoint only when a stored workpack exists; record the returned improvementId but never claim the photos are reloadable.
- After reload, show filenames with `server_metadata_only` and preview unavailable; never fabricate a thumbnail, assetId, or storagePath.
- Defer hydratable stored photos until an existing response actually exposes an authorized asset reference or a separately approved API change.

Document gates:

- Never serialize File, Blob, object URL, assetId, or storagePath into editorV2.
- Before/After comparison requires both filenames; one-sided selections remain `local_display_only`.
- `server_metadata_only` requires an actual successful POST response or matching GET row and nonnull `serverImprovementId`.
- No export may imply that `server_metadata_only` pixels were embedded; manifests preserve all metadata and state.


### DOC-10 외국인 근로자 출력본

- Key: `foreignWorkerBriefing`
- Draft type: `ForeignWorkerPrintDraft`
- Component: `ForeignWorkerPrintEditor`
- Family: `multilingual-print-packet`
- Document command: `언어 추가`
- Command hierarchy: A secondary document command whenever the global lifecycle action is visible.

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `packetTitle` | string | always | `exactString` | (v2 only) |
| `sourceDocumentKeys` | DocumentKey[] | at least one | `documentKeyArray` | (v2 only) |
| `sourceRevision` | integer | always | `strictInteger` | (v2 only) |
| `evidenceDigest` | string | always | `digest` | (v2 only) |
| `targetWorkerIds` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `variants[].id` | string | always | `stableId` | (v2 only) |
| `variants[].code` | string | always | `exactString` | deliverables.foreignWorkerLanguages[].code |
| `variants[].label` | string | always | `exactString` | deliverables.foreignWorkerLanguages[].label |
| `variants[].nativeLabel` | string | always | `exactString` | deliverables.foreignWorkerLanguages[].nativeLabel |
| `variants[].rationale` | string | always | `exactString` | deliverables.foreignWorkerLanguages[].rationale |
| `variants[].lines` | string[] | at least one | `orderedStringArray` | deliverables.foreignWorkerLanguages[].lines |
| `variants[].evidenceRefs` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `printFooter` | string | always | `exactString` | (v2 only) |
| `workerConfirmationRequired` | boolean | always | `strictBoolean` | (v2 only) |

Required interactions:

- Generate print variants from current source documents, then edit each language independently.
- Display source revision and evidence freshness in status, with full provenance in the one evidence drawer.
- Print output can request later WorkerAttendance confirmation but cannot create it.

Document gates:

- Each variant has unique code, native label, nonempty lines, and eligible evidence.
- Source revision and evidence digest must match the current human-confirmed workpack before print/export.
- Generated translation is review_pending and never counts as worker understanding.


### DOC-11 외국인 근로자 전송본

- Key: `foreignWorkerTransmission`
- Draft type: `ForeignWorkerTransmissionDraft`
- Component: `ForeignWorkerTransmissionEditor`
- Family: `versioned-share-blocks`
- Document command: `공유 블록 다시 만들기`
- Command hierarchy: Shown as the sole dominant action only for stale blocks; otherwise the global lifecycle action owns emphasis.

Shared type bindings:

| Prefix | Type | Current-path overrides |
| --- | --- | --- |
| `shareBlocks[]` | `ShareBlockBase` | {"languageCode":"deliverables.foreignWorkerLanguages[].code"} |
| `shareReadConfirmations[]` | `ShareReadConfirmation` | (none) |

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `shareBlocks[].recipientWorkerIds` | string[] | at least one | `stableIdArrayNonEmpty` | (v2 only) |
| `shareBlocks[].bodyLines` | string[] | at least one | `orderedStringArray` | deliverables.foreignWorkerLanguages[].lines |

Required interactions:

- Rebuild stale blocks from current sourceRevision and evidenceDigest, creating a new block ID while retaining intended recipients only.
- Create share sessions and dispatch only after server authority confirms a human-confirmed workpack and matching freshness values.
- Show read receipts as share history; never promote them to attendance, signature, TBM completion, education completion, or understanding.

Document gates:

- Every share block contains sourceDocumentKeys, sourceRevision, and evidenceDigest.
- Any source, evidence, language, audience, or confirmation change sets state=stale and clears shareSessionId.
- ShareReadConfirmation must match the block and server session but has no WorkerAttendance authority.


### DOC-12 현장 공유 메시지

- Key: `kakaoMessage`
- Draft type: `FieldShareMessageDraft`
- Component: `FieldShareMessageEditor`
- Family: `versioned-share-blocks`
- Document command: `공유 블록 다시 만들기`
- Command hierarchy: Shown as the sole dominant action only for stale blocks; otherwise the global lifecycle action owns emphasis.

Shared type bindings:

| Prefix | Type | Current-path overrides |
| --- | --- | --- |
| `shareBlocks[]` | `ShareBlockBase` | (none) |
| `shareReadConfirmations[]` | `ShareReadConfirmation` | (none) |

Direct field delta:

| Field path | Type | Required | Codec | Current structured source/target |
| --- | --- | --- | --- | --- |
| `shareBlocks[].subject` | string | always | `exactString` | (v2 only) |
| `shareBlocks[].body` | string | always | `exactString` | deliverables.kakaoMessage |
| `shareBlocks[].recipientGroup` | string | always | `exactString` | (v2 only) |

Required interactions:

- Build concise site messages from selected source documents without exposing provenance links on the default surface.
- Rebuild stale blocks before session creation or dispatch.
- Keep all provenance, audit, materialization, and review_required detail in the evidence drawer and export manifest.

Document gates:

- Every block has current sourceRevision and evidenceDigest.
- Dispatch is blocked unless server save authority is human_confirmed and all selected evidence is eligible.
- Read receipts remain share acknowledgments only.


## EXPORT-001 Deterministic Compatibility

Same canonical envelope, revision, evidenceDigest, and stable row order produce the same legacy projection, structured projection, and embedded export manifest.

Byte-for-byte binary identity is not required. Semantic identity is required.

| Format | Deterministic semantic location |
| --- | --- |
| XLSX | hidden worksheet named _safeclaw_editor_v2, cell A1 canonical JSON |
| PDF | final appendix headed SafeClaw 편집 데이터 with deterministic field-path/value rows and manifest digest |
| HWPX | Contents/safeclaw-editor-v2.json registered in content.hpf |
| HWP | final HTML table headed SafeClaw 편집 데이터 |

Visible submission content keeps concise inline citation markers. Full provenance, DB harness, ontology QA, materialization, review-required state, and audit history are generated from separate roots and remain outside editable body semantics.

Round-trip gates:

1. Legacy mixed string -> versioned body/appendix split -> structured parse -> serialize -> split preserves editable fields and every raw appendix line without exposing appendix text to an editor.
2. draft -> dual projection -> JSON serialize -> buildReopenData -> adapter deep-equals normalized draft
3. XLSX unzip/load and parse _safeclaw_editor_v2 A1 deep-equals export manifest
4. PDF text extraction contains every deterministic field-path/value record and matching digest
5. HWPX unzip and parse Contents/safeclaw-editor-v2.json deep-equals export manifest
6. HWP HTML parse contains every deterministic field-path/value record
7. No parser may substitute defaults without emitting a blocking issue and preserving the raw value

Current compatibility paths remain:

- `riskAssessmentDraft`: single plus structuredRiskRows
- `workPlanDraft`: workPlanStructured
- `workPermitDraft`: permitInspectionStructured
- `tbmBriefing`: tbmBriefingStructured
- `tbmLogDraft`: tbmLogStructured
- `safetyEducationRecordDraft`: educationRecordStructured
- `otherDocuments`: single legacy rows
- `editedRiskCorrection`: V2 must stop sending edited=true with structured rows removed; project edited canonical risk rows explicitly.

## Implementation Waves

All files listed under `ownedFiles` are future implementation ownership, not changes authorized by this spec-only task. A wave must first create its RED tests, observe expected failures, implement within ownership, and pass its GREEN/refactor gates.

### wave0 Migration-free adapter and authority

Objective: Create the contract validator first, then strict types, lossless body/appendix adapters, deterministic digests, no-edit/edited validation, and immutable server confirmation/save. V2 sharing remains blocked until Wave 4.

Document scope: (infrastructure or hardening only)

Entry gate: An independent reviewer marks this exact spec commit PASS; current generated response fixtures and seals are available.

Owned files:

- `scripts/workpack_editor_contract_audit.mjs`
- `tests/workpack-editor-contract.test.ts`
- `lib/workpack-editor-types.ts`
- `lib/workpack-editor-adapter.ts`
- `lib/workpack-editor-legacy-boundary.ts`
- `lib/workpack-editor-review.ts`
- `app/api/workpack/revalidate/route.ts`
- `lib/workpack-readiness.ts`
- `app/api/workpacks/route.ts`
- `lib/workpack-store.ts`
- `lib/workpack-commercial-store.ts`

Read-only dependencies:

- `lib/risk-assessment-schema.ts`
- `lib/types.ts`
- `lib/generation-evidence.ts`
- `lib/db-harness.ts`
- `lib/workpack-ontology-qa.ts`
- `lib/quality-contract.ts`
- `lib/search.ts`

Test files:

- `tests/workpack-editor-contract.test.ts`
- `tests/workpack-editor-types.test.ts`
- `tests/workpack-editor-adapter.test.ts`
- `tests/workpack-editor-legacy-boundary.test.ts`
- `tests/workpack-editor-review-lifecycle.test.ts`
- `tests/workpack-editor-revalidate-route.test.ts`
- `tests/workpack-readiness.test.ts`
- `tests/workpack-store.test.ts`
- `tests/workpack-share-authority.test.ts`

Commands:

- **prerequisite**: `node scripts/workpack_editor_contract_audit.mjs && npx.cmd vitest run tests/workpack-editor-contract.test.ts --maxWorkers=1 --no-file-parallelism`
- **red**: `npx.cmd vitest run tests/workpack-editor-types.test.ts tests/workpack-editor-adapter.test.ts tests/workpack-editor-legacy-boundary.test.ts tests/workpack-editor-review-lifecycle.test.ts tests/workpack-editor-revalidate-route.test.ts --maxWorkers=1 --no-file-parallelism`
- **green**: `npx.cmd vitest run tests/workpack-editor-types.test.ts tests/workpack-editor-adapter.test.ts tests/workpack-editor-legacy-boundary.test.ts tests/workpack-editor-review-lifecycle.test.ts tests/workpack-editor-revalidate-route.test.ts tests/workpack-readiness.test.ts tests/workpack-store.test.ts tests/workpack-share-authority.test.ts --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **diff**: `git diff --check`

TDD gates:

- PREREQUISITE: Contract audit script/test is the first isolated commit and must be green before any product file is edited.
- RED: mixed 5221-character risk fixture fails until body and every known appendix section are separated and preserved.
- RED: Edited content still carrying active top-level dbHarness/ontologyQa/qualityContract/generationEvidence or nested seal copies fails.
- GREEN: Generated content validates to review_pending without document mutation; edited content revalidates before review_pending.
- GREEN: Reseal uses existing top-level generation-evidence functions unchanged and all 12 adapters preserve unknown values.
- GREEN: only the server can stamp ActorProvenance and human_confirmed; invalid seal/revision/digest fails closed.
- REFACTOR: no any, no DB migration, and current /api/ask fallback remains behaviorally intact.

Exit gate: Contract validator, adapters, no-edit/edited lifecycle, top-level reseal, and immutable save are green; v2 share is still explicitly blocked pending Wave 4.

Rollback: Disable the feature flag, stop routing v2 clients to /api/workpack/revalidate, and leave existing /api/ask plus insert-only /api/workpacks behavior active. Remove only new unreferenced modules/route if needed; no data or schema rollback.

Feature flag: `FLAG-001`; browser matrix: `(not applicable)`; migration: `false`

Production-fix boundary: `lib/generation-evidence.ts` is read-only. Wave 0 reuses its existing top-level digest, attach, and verify functions unchanged.

### wave1 Core structured editors and simplified review surface

Objective: Make risk assessment, TBM briefing, and TBM record genuinely structured while removing repeated provenance, mixed master textareas, dual rails, and nested mobile scrolling.

Document scope: `riskAssessmentDraft`, `tbmBriefing`, `tbmLogDraft`

Entry gate: Wave 0 is green and an independent reviewer has marked this exact spec commit PASS.

Owned files:

- `components/WorkpackEditor.tsx`
- `components/WorkpackEditor.module.css`
- `components/CurrentWorkpackModules.tsx`
- `components/workpack-editor/DocumentEditorRegistry.tsx`
- `components/workpack-editor/DocumentEditorShell.tsx`
- `components/workpack-editor/RiskAssessmentEditor.tsx`
- `components/workpack-editor/TbmBriefingEditor.tsx`
- `components/workpack-editor/TbmLogEditor.tsx`
- `components/workpack-editor/ResponsiveDataGrid.tsx`
- `components/workpack-editor/AutoGrowTextField.tsx`
- `components/workpack-editor/WorkerAttendanceEditor.tsx`
- `components/workpack-editor/EvidenceSummaryTrigger.tsx`
- `components/workpack-editor/EvidenceDetailsDrawer.tsx`
- `components/workpack-editor/SourceConfirmationWarning.tsx`
- `lib/workpack-editor-document-specs.ts`
- `lib/workpack-editor-evidence-summary.ts`
- `lib/workpack-editor-export-manifest.ts`
- `lib/official-safety-resources.ts`
- `lib/kosha.ts`
- `lib/xlsx-builder.ts`
- `lib/hwp-table-builder.ts`
- `app/api/export/xlsx/route.ts`
- `app/api/export/pdf/route.ts`
- `app/api/export/hwp/route.ts`

Read-only dependencies:

- `lib/risk-assessment-schema.ts`
- `lib/types.ts`
- `app/api/workpacks/[id]/improvements/route.ts`
- `app/api/workpacks/[id]/read-confirmations/route.ts`

Test files:

- `tests/workpack-editor-wave1.test.ts`
- `tests/workpack-editor-content-boundary.test.ts`
- `tests/workpack-editor-evidence-drawer.test.ts`
- `tests/workpack-editor-browser-matrix.test.ts`
- `tests/workpack-editor-export-roundtrip.test.ts`
- `tests/official-safety-resources-validation.test.ts`
- `tests/documents-editor-layout.test.ts`
- `tests/editor-export-integrity.test.ts`
- `tests/tbm-deterministic-structures.test.ts`
- `tests/xlsx-export-route.test.ts`

Commands:

- **red**: `npx.cmd vitest run tests/workpack-editor-wave1.test.ts tests/workpack-editor-content-boundary.test.ts tests/workpack-editor-evidence-drawer.test.ts tests/workpack-editor-browser-matrix.test.ts tests/workpack-editor-export-roundtrip.test.ts tests/official-safety-resources-validation.test.ts --maxWorkers=1 --no-file-parallelism`
- **green**: `npx.cmd vitest run tests/workpack-editor-wave1.test.ts tests/workpack-editor-content-boundary.test.ts tests/workpack-editor-evidence-drawer.test.ts tests/workpack-editor-export-roundtrip.test.ts tests/official-safety-resources-validation.test.ts tests/documents-editor-layout.test.ts tests/editor-export-integrity.test.ts tests/tbm-deterministic-structures.test.ts tests/xlsx-export-route.test.ts --maxWorkers=1 --no-file-parallelism`
- **browser**: `npx.cmd vitest run tests/workpack-editor-browser-matrix.test.ts --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **build**: `npm.cmd run build`
- **diff**: `git diff --check`

TDD gates:

- RED: existing single textarea, repeated provenance, 11px evidence labels, 260px right rail, and nested mobile scroll fixtures fail.
- RED: risk/TBM lossless export tests fail until riskRowId, evidenceRefs, verification, WorkerAttendance, and actionTaken survive every target.
- GREEN: the three document editors use strict schemas and domain interactions, not title-swapped textareas.
- GREEN: one selector owns all evidence counts and one drawer owns all detail.
- GREEN: browser matrix and semantic export round trips pass.
- REFACTOR: wrappers share only genuine primitives; no universal any-based schema renderer and no twelve duplicated components.

Browser assertions:

- `BROWSER-001` through `BROWSER-018` above run for every required Wave 1 browser/viewport/theme row; the fixture names and numeric/DOM assertions are normative.

Exit gate: Core three editors are structured, every Wave 1 browser assertion passes, exports round-trip, and flag-off restores current UI without deleting v2 state.

Rollback: Disable the feature flag to restore the current WorkpackEditor textarea path. Keep v2 data and manifests untouched; export routes ignore optional manifests when flag/context is absent. Revert only Wave 1 owned files if needed.

Feature flag: `FLAG-001`; browser matrix: `BROWSER-MATRIX-001`; migration: `false`

### wave2 Plans, permit, and education

Objective: Add structured plan, permit, and education editors using risk links, approval boundaries, curriculum rows, and the genuine shared WorkerAttendance primitive.

Document scope: `workPlanDraft`, `workPermitDraft`, `safetyEducationRecordDraft`

Entry gate: Wave 1 green with browser and export gates.

Owned files:

- `components/workpack-editor/WorkPlanEditor.tsx`
- `components/workpack-editor/WorkPermitEditor.tsx`
- `components/workpack-editor/EducationRecordEditor.tsx`
- `components/workpack-editor/EvidenceReferencePicker.tsx`
- `components/workpack-editor/PeoplePicker.tsx`
- `lib/workpack-editor-document-specs.ts`
- `lib/workpack-editor-adapter.ts`
- `lib/workpack-editor-export-manifest.ts`
- `lib/xlsx-builder.ts`
- `lib/hwp-table-builder.ts`
- `app/api/export/xlsx/route.ts`
- `app/api/export/pdf/route.ts`
- `app/api/export/hwp/route.ts`

Read-only dependencies:

- `lib/types.ts`
- `lib/risk-assessment-schema.ts`

Test files:

- `tests/workpack-editor-wave2.test.ts`
- `tests/workpack-editor-worker-attendance.test.ts`
- `tests/workpack-editor-export-roundtrip.test.ts`
- `tests/editor-export-integrity.test.ts`
- `tests/documents-editor-layout.test.ts`

Commands:

- **red**: `npx.cmd vitest run tests/workpack-editor-wave2.test.ts tests/workpack-editor-worker-attendance.test.ts tests/workpack-editor-export-roundtrip.test.ts --maxWorkers=1 --no-file-parallelism`
- **green**: `npx.cmd vitest run tests/workpack-editor-wave2.test.ts tests/workpack-editor-worker-attendance.test.ts tests/workpack-editor-export-roundtrip.test.ts tests/editor-export-integrity.test.ts tests/documents-editor-layout.test.ts --maxWorkers=1 --no-file-parallelism`
- **browser**: `npx.cmd vitest run tests/workpack-editor-browser-matrix.test.ts --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **diff**: `git diff --check`

TDD gates:

- RED: current structured fixtures lose v2-only IDs/evidence/actionTaken until adapter and manifests are extended.
- GREEN: current WorkPlanStructured, PermitInspectionStructured, and EducationRecordStructured paths round-trip with all richer v2 fields.
- GREEN: generated approver/instructor/confirmer placeholders cannot become human confirmation.
- REFACTOR: reuse tables/attendance only where field semantics match.

Browser assertions:

- `BROWSER-001` through `BROWSER-018` rerun for each Wave 2 document.
- Clicking a `[data-risk-row-id]` reference focuses the unique matching row and does not change `documentElement.scrollWidth`.
- WorkerAttendance controls live under `[data-confirmation-kind=attendance]`; share-read rows live under `[data-confirmation-kind=share-read]`; neither contains the other kind.

Exit gate: Three document schemas, lifecycle, matrix, and export gates pass with no Wave 1 regression.

Rollback: Disable the feature flag; the existing text and structured payloads remain readable. Revert only Wave 2 owned files; no schema/data rollback.

Feature flag: `FLAG-001`; browser matrix: `BROWSER-MATRIX-001`; migration: `false`

### wave3 Summary, emergency, and honest photo evidence

Objective: Add summary/scenario editors and honest local/display-only Before/After handling without claiming photo asset hydration.

Document scope: `workpackSummaryDraft`, `emergencyResponseDraft`, `photoEvidenceDraft`

Entry gate: Wave 2 green and current improvements endpoint contract fixtures pinned.

Owned files:

- `components/workpack-editor/WorkpackSummaryEditor.tsx`
- `components/workpack-editor/EmergencyResponseEditor.tsx`
- `components/workpack-editor/ImprovementEvidenceEditor.tsx`
- `components/workpack-editor/LocalPhotoPair.tsx`
- `lib/workpack-editor-document-specs.ts`
- `lib/workpack-editor-adapter.ts`
- `lib/workpack-editor-export-manifest.ts`

Read-only dependencies:

- `app/api/workpacks/[id]/improvements/route.ts`
- `lib/workpack-commercial.ts`
- `lib/photo-vision-analysis.ts`

Test files:

- `tests/workpack-editor-wave3.test.ts`
- `tests/workpack-editor-photo-state.test.ts`
- `tests/workpack-editor-export-roundtrip.test.ts`
- `tests/workpack-improvement-route.test.ts`
- `tests/photo-vision-analysis-route.test.ts`

Commands:

- **red**: `npx.cmd vitest run tests/workpack-editor-wave3.test.ts tests/workpack-editor-photo-state.test.ts tests/workpack-editor-export-roundtrip.test.ts --maxWorkers=1 --no-file-parallelism`
- **green**: `npx.cmd vitest run tests/workpack-editor-wave3.test.ts tests/workpack-editor-photo-state.test.ts tests/workpack-editor-export-roundtrip.test.ts tests/workpack-improvement-route.test.ts tests/photo-vision-analysis-route.test.ts --maxWorkers=1 --no-file-parallelism`
- **browser**: `npx.cmd vitest run tests/workpack-editor-browser-matrix.test.ts --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **diff**: `git diff --check`

TDD gates:

- RED: tests reject stored/hydrated photo state from current GET/POST.
- GREEN: `not_selected/local_display_only/upload_in_flight/server_metadata_only/upload_failed` map one-to-one to DOC-09 `photoState`, and legacy two-field values map totally.
- GREEN: no app/api, DB, schema, migration, package, or Supabase type file changes are present in this wave.
- REFACTOR: photo binary remains ephemeral and metadata stays in canonical fields/manifests.

Browser assertions:

- `BROWSER-001` through `BROWSER-018` rerun for each Wave 3 document.
- An object URL exists only while `local_display_only|upload_in_flight` is mounted and is revoked exactly once on replace, remove, or unmount.
- A reloaded `server_metadata_only` row renders filenames plus preview-unavailable text and zero `img[src^=blob:]`, assetId, storagePath, or stored-thumbnail nodes.

Exit gate: Photo state claims match actual endpoint responses and all three documents pass shared browser/export gates.

Rollback: Disable the feature flag and revoke local object URLs. Existing improvement records remain untouched; no endpoint or DB rollback exists because Wave 3 owns neither.

Feature flag: `FLAG-001`; browser matrix: `BROWSER-MATRIX-001`; migration: `false`

API change: `false`; the improvements route remains read-only to this wave.

### wave4 Multilingual output and versioned sharing

Objective: Add multilingual/share-block editors and install server freshness enforcement in share-session creation and workflow dispatch using existing JSONB only.

Document scope: `foreignWorkerBriefing`, `foreignWorkerTransmission`, `kakaoMessage`

Entry gate: Wave 3 green; v2 share remains blocked until this wave's route tests are green.

Owned files:

- `components/workpack-editor/ForeignWorkerPrintEditor.tsx`
- `components/workpack-editor/ForeignWorkerTransmissionEditor.tsx`
- `components/workpack-editor/FieldShareMessageEditor.tsx`
- `components/workpack-editor/LanguageVariantEditor.tsx`
- `components/workpack-editor/ShareBlockEditor.tsx`
- `lib/workpack-editor-document-specs.ts`
- `lib/workpack-editor-adapter.ts`
- `lib/workpack-editor-export-manifest.ts`
- `lib/workpack-commercial.ts`
- `lib/workpack-commercial-store.ts`
- `app/api/workpacks/[id]/share-sessions/route.ts`
- `app/api/workflow/dispatch/route.ts`

Read-only dependencies:

- `app/api/workpacks/[id]/read-confirmations/route.ts`
- `lib/types.ts`

Test files:

- `tests/workpack-editor-wave4.test.ts`
- `tests/workpack-editor-share-freshness.test.ts`
- `tests/workpack-editor-confirmation-boundaries.test.ts`
- `tests/foreign-worker-languages.test.ts`
- `tests/workflow-share-panel-behavior.test.ts`
- `tests/workpack-share-authority-routes.test.ts`
- `tests/workflow-dispatch-freshness.test.ts`

Commands:

- **red**: `npx.cmd vitest run tests/workpack-editor-wave4.test.ts tests/workpack-editor-share-freshness.test.ts tests/workpack-editor-confirmation-boundaries.test.ts --maxWorkers=1 --no-file-parallelism`
- **green**: `npx.cmd vitest run tests/workpack-editor-wave4.test.ts tests/workpack-editor-share-freshness.test.ts tests/workpack-editor-confirmation-boundaries.test.ts tests/foreign-worker-languages.test.ts tests/workflow-share-panel-behavior.test.ts tests/workpack-share-authority-routes.test.ts tests/workflow-dispatch-freshness.test.ts --maxWorkers=1 --no-file-parallelism`
- **browser**: `npx.cmd vitest run tests/workpack-editor-browser-matrix.test.ts --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **diff**: `git diff --check`

TDD gates:

- RED: Current share-session route ignores documentKey/blockId/sourceRevision/evidenceDigest and current dispatch lacks a persisted binding; v2 share stays locked.
- GREEN: Share-session POST validates the authoritative block and stores `editorV2Binding` in existing `access_policy` JSONB.
- GREEN: Dispatch loads that server binding and returns 409 before provider preflight for missing/stale/mismatched identity, revision, digest, confirmation, or readiness.
- GREEN: rebuild creates a new block with current sourceRevision/evidenceDigest and clears session/dispatch/read-display state.
- REFACTOR: ForeignWorkerTransmission and FieldShareMessage share versioned blocks but retain distinct fields and interaction wrappers.

Browser assertions:

- `BROWSER-001` through `BROWSER-018` rerun for each Wave 4 document.
- Before Wave 4 capability is reported, v2 share/dispatch controls are disabled with `freshness_server_contract_missing`.
- A stale block renders exactly one primary rebuild action and zero enabled dispatch actions.
- Share-read nodes use `data-confirmation-kind=share-read` and never render under attendance/understanding/signature/completion summaries.

Exit gate: All three documents pass freshness, authority, confirmation-boundary, browser, and export gates.

Rollback: Disable the feature flag; current foreignWorker strings and kakaoMessage remain available. Existing share sessions/read confirmations remain historical and untouched.

Feature flag: `FLAG-001`; browser matrix: `BROWSER-MATRIX-001`; migration: `false`

API change: `true`. Extend only existing request parsing and existing `workpack_share_sessions.access_policy` JSONB; no schema/migration. Dispatch accepts no client freshness override.

### wave5 Full regression and release hold

Objective: Run all contract, browser, export, compatibility, and rollback gates before enabling the feature flag.

Document scope: (infrastructure or hardening only)

Entry gate: Waves 0-4 green with no unresolved dropped-field or provenance-boundary issue.

Owned files:

- `tests/workpack-editor-browser-matrix.test.ts`
- `tests/workpack-editor-export-roundtrip.test.ts`

Read-only dependencies:

- `all production files owned by Waves 0-4`

Test files:

- `tests/workpack-editor-contract.test.ts`
- `tests/workpack-editor-browser-matrix.test.ts`
- `tests/workpack-editor-export-roundtrip.test.ts`
- `tests/documents-editor-layout.test.ts`
- `tests/editor-export-integrity.test.ts`
- `tests/workpack-readiness.test.ts`
- `tests/workpack-store.test.ts`
- `tests/workpack-share-authority-routes.test.ts`
- `tests/workflow-dispatch-freshness.test.ts`
- `tests/workpack-improvement-route.test.ts`

Commands:

- **contract**: `node scripts/workpack_editor_contract_audit.mjs`
- **targeted**: `npx.cmd vitest run tests/workpack-editor-contract.test.ts tests/workpack-editor-browser-matrix.test.ts tests/workpack-editor-export-roundtrip.test.ts tests/documents-editor-layout.test.ts tests/editor-export-integrity.test.ts tests/workpack-readiness.test.ts tests/workpack-store.test.ts tests/workpack-share-authority-routes.test.ts tests/workflow-dispatch-freshness.test.ts tests/workpack-improvement-route.test.ts --maxWorkers=1 --no-file-parallelism`
- **full**: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism`
- **typecheck**: `npm.cmd run typecheck`
- **build**: `npm.cmd run build`
- **diff**: `git diff --check`

TDD gates:

- RED audit fixtures remain pinned and demonstrably fail against d3ad865 behavior.
- GREEN every canonical field, appendix, evidence record, viewport, browser, theme, and authority gate.
- GREEN flag-off fallback and flag-on rollback rehearsal.
- RELEASE remains HOLD until an independent reviewer marks the implementation commit PASS.

Browser assertions:

- `BROWSER-001` through `BROWSER-018` pass for every required browser/viewport/theme row.
- Contract audit verifies 12 keys/titles, 21 risk fields, every expanded codec/path, Wave scopes, viewport registry, and component export/file names.
- No editorV2 or reviewArtifacts object contains generationEvidence/error; the top-level seal verifies after unchanged validation, edited revalidation, and human confirmation.
- Generated content reaches review_pending without content mutation; edited content cannot bypass revalidation.
- Wave 4 share-session binding and dispatch stale-rejection tests pass before v2 share controls enable.
- Photo state is the single common/DOC-09 enum and never claims hydratable pixels.
- Feature flag off restores current behavior and no database migration exists.

Production-fix boundary: Any failure may be fixed only in a production file already owned by Waves 0-4; adding a new production path requires spec amendment and independent re-review.

Exit gate: All commands pass, changed paths are within declared ownership, feature flag remains off by default, and an independent reviewer issues PASS.

Rollback: Keep the feature flag off. Revert only Wave-owned production changes; preserve optional JSON and immutable revisions. No DB rollback.

Feature flag: `FLAG-001`; browser matrix: `BROWSER-MATRIX-001`; migration: `false`

## Viewport Matrix

| ID | Size | Themes | Required containment |
| --- | --- | --- | --- |
| `desktop1440` | 1440x1000 | day, night | two tracks only; main editor >=920px, readable preview >=720px, no right rail, no horizontal overflow |
| `measuredDesktop1150` | 1150x900 | day, night | selector <=220px, main editor >=700px, readable preview >=560px, evidence rail 0px; drawer overlays without reflow |
| `compactDesktop1280` | 1280x720 | day, night | two tracks only; selector may collapse; primary action and warning remain visible |
| `mobile390` | 390x844 | day, night | single column; editor heading <=160px after Edit focus; no nested editor scroll; no horizontal overflow |
| `auditMobile391` | 391x844 | day, night | failing 252x460 mixed textarea and 9120px page are absent; default sample page <=3600px; drawer is full-width |
| `smallMobile320` | 320x568 | day, night | labels wrap; 44px controls; no clipped actions, nested editor scroll, or horizontal overflow |

### Browser Matrix BROWSER-MATRIX-001

| Browser | Viewport | Themes |
| --- | --- | --- |
| Chromium | `desktop1440` | day, night |
| Chromium | `measuredDesktop1150` | day, night |
| Chromium | `compactDesktop1280` | day, night |
| Chromium | `mobile390` | day, night |
| Chromium | `auditMobile391` | day, night |
| Chromium | `smallMobile320` | day, night |
| Firefox | `desktop1440` | day, night |
| Firefox | `measuredDesktop1150` | day, night |
| Firefox | `mobile390` | day, night |
| WebKit | `desktop1440` | day, night |
| WebKit | `measuredDesktop1150` | day, night |
| WebKit | `mobile390` | day, night |

## Acceptance IDs

The exact machine assertions live in `spec.json`. This table maps each stable ID to its Markdown owner; it is registry coverage, not prose or semantic parity.

| ID | Owner section |
| --- | --- |
| `PARITY-001` | Current integrity gate |
| `SCOPE-001` | Scope and non-goals |
| `DOC-001` | Document registry |
| `COMPONENT-001` | Component boundaries |
| `RISK-001` | Common type registry |
| `FIELD-001` | Common field projection |
| `FIELD-002` | Codec registry |
| `BODY-001` | Editable body boundary |
| `BODY-002` | Editable body boundary |
| `BODY-003` | Editable body boundary |
| `FLOW-001` | Edit to persist to share |
| `FLOW-002` | Edit to persist to share |
| `FLOW-003` | Edit to persist to share |
| `FLOW-004` | Edit to persist to share |
| `FLOW-005` | Edit to persist to share |
| `HUMAN-001` | Human confirmation |
| `CONFIRM-001` | Confirmation boundaries |
| `EVIDENCE-001` | Provenance contract |
| `EVIDENCE-002` | Provenance contract |
| `SHARE-001` | Stored share authority |
| `SHARE-002` | Stored share authority |
| `PHOTO-001` | Photo persistence |
| `EXPORT-001` | Export determinism |
| `UI-001` | Default workbench |
| `UI-002` | Default workbench |
| `UI-003` | Default workbench |
| `UI-004` | Default workbench |
| `UI-005` | Default workbench |
| `UI-006` | Default workbench |
| `UI-007` | Default workbench |
| `UI-008` | Default workbench |
| `UI-009` | Default workbench |
| `UI-010` | Default workbench |
| `UI-011` | Default workbench |
| `LINK-001` | External safety links |
| `STATE-001` | System states |
| `CONFLICT-001` | Integration ledger |
| `ROLLBACK-001` | Feature flag and waves |
| `WAVE-001` | Implementation waves |
| `WAVE-002` | Implementation waves |
| `PASS-001` | Independent gate |

## Current Integrity Fingerprints

Algorithm: `fnv1a64 over UTF-8 JSON of normalized registries`

These detect compact registry drift only. They are not a `canonicalContract`, a Markdown semantic mirror, or proof of future behavior. Document registries are expanded through shared type bindings before hashing.

| Document ID | Key | Expanded fields | Digest |
| --- | --- | --- | --- |
| DOC-01 | `workpackSummaryDraft` | 15 | `79795d3bd3c15992` |
| DOC-02 | `riskAssessmentDraft` | 22 | `6b4a3ad7fd99b6e4` |
| DOC-03 | `workPlanDraft` | 24 | `89a545142f088f30` |
| DOC-04 | `workPermitDraft` | 33 | `adc9332eef6ef367` |
| DOC-05 | `tbmBriefing` | 25 | `681c90307ae7525b` |
| DOC-06 | `tbmLogDraft` | 45 | `60aea561cdcd5852` |
| DOC-07 | `safetyEducationRecordDraft` | 26 | `3a8e8a6d4b7dffca` |
| DOC-08 | `emergencyResponseDraft` | 29 | `df6f7f4c2ba3512d` |
| DOC-09 | `photoEvidenceDraft` | 16 | `69ab5c57fa10bbcf` |
| DOC-10 | `foreignWorkerBriefing` | 14 | `db4999b52b3afbd0` |
| DOC-11 | `foreignWorkerTransmission` | 21 | `c2d6a715e4f46a5f` |
| DOC-12 | `kakaoMessage` | 22 | `41b2932756b91dd0` |

| Wave | Document count | Ownership digest |
| --- | --- | --- |
| wave0 | 0 | `d5d20cc0702daaaf` |
| wave1 | 3 | `43d777e896eb1696` |
| wave2 | 3 | `f52783820840ba71` |
| wave3 | 3 | `88be720b6e7048d7` |
| wave4 | 3 | `9fb8cd297d6c3da3` |
| wave5 | 0 | `604d3c9194f073e8` |

- Viewports: 6 / `c95625222074ee9b`
- Browser rows: 12 / `2229ba55536c5e94`
- Contract IDs: 41 / `e0205088c5816fa7`
- Browser assertions: 18 / `6fddac770de4137b`

## Mechanical Validation Before Commit

Run in the dedicated worktree:

```powershell
node -e "const fs=require('fs');const p='evaluation/workpack-document-editors-v2-2026-07-13/spec.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.meta.status!=='HOLD_PENDING_INDEPENDENT_PASS'||j.independentGate.holdState!==j.meta.status||j.documents.length!==12)process.exit(1);console.log('JSON_PARSE=PASS')"
node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync("evaluation/workpack-document-editors-v2-2026-07-13/spec.json"));const w=fs.readFileSync("components/WorkpackEditor.tsx","utf8");const r=fs.readFileSync("lib/risk-assessment-schema.ts","utf8");const keys=[...w.match(/export type DocumentKey =([\s\S]*?);/)[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);const meta=w.match(/const documentMeta: EditableDocument\[\] = \[([\s\S]*?)\n\];/)[1];const docs=[...meta.matchAll(/key: "([^"]+)"[\s\S]*?title: "([^"]+)"/g)].map(x=>[x[1],x[2]]);const fields=[...r.match(/export type RiskAssessmentRow = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map(x=>x[1]);if(JSON.stringify(keys)!==JSON.stringify(j.documents.map(x=>x.key))||JSON.stringify(docs)!==JSON.stringify(j.documents.map(x=>[x.key,x.title]))||JSON.stringify(fields)!==JSON.stringify(j.common.typeRegistry.RiskAssessmentEditorRow.fields.slice(1).map(x=>x[0])))process.exit(1);console.log("SOURCE_SHAPE=PASS")'
node -e 'const fs=require("fs"),p="evaluation/workpack-document-editors-v2-2026-07-13/",j=JSON.parse(fs.readFileSync(p+"spec.json")),m=fs.readFileSync(p+"spec.md","utf8"),f=j.integrityFingerprints,H=v=>{let h=14695981039346656037n;for(const b of Buffer.from(JSON.stringify(v))){h^=BigInt(b);h=BigInt.asUintN(64,h*1099511628211n)}return h.toString(16).padStart(16,"0")},E=d=>[...d.typeBindings.flatMap(b=>j.common.typeRegistry[b.type].fields.map(q=>{const x=[b.prefix+"."+q[0],...q.slice(1)];if(Object.hasOwn(b.currentOverrides,q[0]))x[4]=b.currentOverrides[q[0]];return x})),...d.fields];for(let i=0;i<j.documents.length;i++){const e=E(j.documents[i]),r=f.documents[i];if(r[2]!==e.length||r[3]!==H(e)||!m.includes(r[3]))process.exit(1)}for(let i=0;i<j.implementation.waves.length;i++){const w=j.implementation.waves[i],r=f.waves[i],n={documents:w.documents,ownedFiles:w.ownedFiles,readOnlyDependencies:w.readOnlyDependencies,testFiles:w.testFiles,commands:w.commands,rollback:w.rollback};if(r[2]!==H(n)||!m.includes(r[2]))process.exit(1)}for(const [v,r] of [[j.implementation.viewports,f.viewports],[j.implementation.browserMatrix,f.browserMatrix],[j.contractIds,f.contractIds],[j.ui.browserAssertions,f.browserAssertions]])if(r[0]!==v.length||r[1]!==H(v)||!m.includes(r[1]))process.exit(1);const c=new Set(Object.keys(j.common.codecs)),t=[...Object.values(j.common.typeRegistry).flatMap(x=>x.fields),...j.documents.flatMap(x=>x.fields)];if(t.some(x=>!c.has(x[3]))||[...j.contractIds,...j.ui.browserAssertions.map(x=>x[0])].some(x=>!m.includes("`"+x+"`")))process.exit(1);console.log("REGISTRY_INTEGRITY=PASS")'
git diff --check
git diff --name-only
```

Current gate: `CURRENT_REGISTRY_CHECKS_ONLY`; semantic parity: `NOT_CLAIMED`. Before any product edit, Wave 0 must first create `scripts/workpack_editor_contract_audit.mjs` and `tests/workpack-editor-contract.test.ts` in an isolated commit. That validator must parse JSON, extract Markdown stable-ID tables, expand shared bindings, compare all document fields/codecs/waves/viewports and production DocumentKey/RiskAssessmentRow, and fail on unresolved codecs or undocumented shared files. Those future files are not cited as a current PASS.

## Independent PASS Gate

Do not start Wave 0 or any later wave until another independent reviewer marks this exact commit PASS after running the current checks.

Current state: **HOLD_PENDING_INDEPENDENT_PASS**.

After that PASS, Wave 0's validator prerequisite runs before any product file change. An independent reviewer must issue PASS against the exact pushed SHA; no implementation starts from this commit.
