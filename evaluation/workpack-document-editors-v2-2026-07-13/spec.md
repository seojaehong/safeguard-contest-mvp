# SafeClaw Workpack Document Editors v2

> **HOLD_PENDING_FRESH_REVIEW**
>
> **IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL**

이 문서는 구현자가 읽는 설계·결정·수용 기준이고 `spec.json`은 규범 원본이다. 끝의 `SAFECLAW-NORMATIVE`와 `SAFECLAW-HUMAN` 구간은 JSON에서 결정론적으로 생성되며 validator가 byte-for-byte 비교한다. 나머지 Markdown도 정규화한 typed SHA-256으로 JSON에 묶이므로 generated block, 단일 digest, 또는 내장 mirror만으로 parity를 자가 승인할 수 없다.

- Branch: `feat/workpack-document-editors-v2-target-ready`
- `sourceBase`: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- `currentIntegrationTarget`: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- `remediationParent`: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- Candidate scope: `spec.md`, `spec.json`, `validate-contract.mjs` in one commit
- Evidence scope: `review-evidence.json` only in a child commit whose parent is the candidate
- Historical context: `sourceBase...candidate`; no accumulated future range is claimed to contain only three files
- Production implementation started: `false`
- Allowed changes: the three candidate files plus the separate evidence-only manifest
- Database/schema/migration/RPC change in this task: forbidden
- Entire Wave program, including Wave 0: `BLOCKED_PENDING_USER_DB_APPROVAL`
- Feature flag default: off
- Implementation start gate: fresh independent spec PASS **AND** explicit user DB approval

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

The generated structural table near the end binds the complete JSON, including schemas, codecs, workflow/authority, export seams, waves, UI/browser contracts, and conflict snapshot. The generated human requirements and all remaining prose are independently bound too.

## Scope And Non-Goals

The bounded product flow remains **input -> documents -> share**.

After both start gates are satisfied, Wave 1 is the first UI wave and makes these three documents real structured editors:

- `riskAssessmentDraft`

- `tbmBriefing`

- `tbmLogDraft`

The contract owns exactly 12 document editors. This remediation authorizes no product code, product tests, packages, locks, CSS, API, DB, schema, migration, or existing evidence change.

The following are explicitly out of scope for this spec remediation:

- implementing the editors

- changing export builders or routes

- adding a photo hydration API

- changing Supabase schema or generated DB types

- backfilling existing workpacks

- rewriting current evidence

- starting Wave 0 or any later wave before both fresh independent PASS and explicit user DB approval

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
| SRC-08 | `app/api/workpacks/route.ts` | `POST` | Verifies a top-level seal and inserts once. It has no chain lookup, expectedRevision, idempotency replay, transaction, or concurrent-writer exclusion; it is not v2 revision authority. |
| SRC-09 | `lib/workpack-store.ts` | `buildWorkpackEvidenceSummary | buildWorkpackInsertPayload | buildReopenData` | JSONB can preserve editor data, but cannot alone guarantee unique monotonic revisions or idempotency. |
| SRC-10 | `lib/workpack-commercial-store.ts` | `assessStoredWorkpackShareAuthority` | Current legacy readiness does not verify editor block ID/revision/digest. No executable wave extends it. |
| SRC-11 | `app/api/workpacks/[id]/read-confirmations/route.ts` | `GET | POST` | Stores share-session read acknowledgment only; it cannot satisfy TBM attendance, understanding, signature, or safety confirmation. |
| SRC-12 | `app/api/workpacks/[id]/improvements/route.ts` | `GET | POST` | POST returns improvementId but not photo row id/storagePath; GET returns improvements and photo_summary but not workpack_improvement_photos. |
| SRC-13 | `components/WorkpackEditor.tsx` | `META_SECTION_PATTERNS | META_KEY_PATTERNS | parseSheetRows` | Existing patterns prove body/metadata separation is already recognized for export; v2 moves the boundary into a shared lossless adapter used before editing. |
| SRC-14 | `lib/search.ts` | `formatSafetyReferenceAppendix and deliverable appendix concatenation` | Current generation concatenates provenance into strings; v2 projects those appendices into separate evidence/review roots and never binds the combined string to an editor. |
| SRC-15 | `lib/official-safety-resources.ts` | `OFFICIAL_SAFETY_RESOURCES candidates` | Hardcoded URLs are untrusted candidates, including guidanceX.do. |
| SRC-16 | `lib/kosha.ts` | `fetchKoshaReferences | verifyReference | verified` | Only current runtime verified=true HTTPS results may become drawer links. |
| SRC-17 | `components/CurrentWorkpackModules.tsx` | `WorkpackEditor onChange -> applyWorkpackDeliverablesChange` | Current user edits propagate to workpack readiness; v2 passes canonical envelope changes and explicit revalidation invalidation through this call site. |
| SRC-18 | `app/api/workpacks/[id]/route.ts` | `GET` | Current reopen seam hydrates stored deliverables/evidence_summary/status; adapter precedence begins from the authoritative stored JSON. |
| SRC-19 | `components/WorkpackEditor.tsx -> app/api/export/xlsx/route.ts` | `downloadXlsx -> POST` | At target `f98ae7d`, the editor posts single or one of five structured modes to `/api/export/xlsx`; route integration belongs only to Wave 5. |
| SRC-20 | `components/WorkpackEditor.tsx -> app/api/export/pdf/route.ts` | `printPdf -> POST ?format=html` | The editor requests HTML and opens the returned document for print; PDF round-trip integration belongs only to Wave 5. |
| SRC-21 | `components/WorkpackEditor.tsx -> app/api/export/hwp/route.ts` | `downloadHwp -> binary POST` | The editor posts document rows/profile/scenario/risk rows and downloads the binary `.hwp` response. This is not an HTML-only seam. |
| SRC-22 | `components/WorkpackEditor.tsx` | `buildHwpxWithRhwp -> downloadHwpx` | HWPX is built client-side with `@rhwp/core` `HwpDocument.exportHwpx`. `GET /api/export/hwpx-template` exists but is not the editor call site and is excluded from editor round-trip exits. |
| SRC-23 | `app/api/workpacks/[id]/share-sessions/route.ts` | `GET | POST` | Current POST accepts recipients but no authoritative document/block/revision/digest binding. V2 session creation stays disabled. |
| SRC-24 | `app/api/workflow/dispatch/route.ts` | `POST` | Current dispatch has no editor freshness authority. Client/app preflight cannot replace transactional server checking. |
| SRC-25 | `supabase/migrations/002_workspace_productization.sql` | `workpacks` | No logical/parent workpack, revision, idempotency, or unique chain columns/constraints exist. |
| SRC-26 | `app/api/workpacks/[id]/improvements/route.ts` | `GET | POST` | Creates/reads candidates only; no confirm/reject transition, immutable review event, photo-row ID, storage path, or authorized URL. |
| SRC-27 | `lib/safety-reference-catalog.ts` | `SafetyReferenceItem` | Raw catalog provenance includes source fields and complete KOSHA guide anchors/reference/version/evidence fields. |
| SRC-28 | `lib/ontology/evidence-chain-registry.ts` | `LawEvidenceRecord | SifEvidenceRecord | KoshaGuidanceRecord` | Raw ontology records preserve discriminator; guidance includes supportStatement, registryMapping, and provenanceBridge. |

## CONFLICT-001 Integration Ledger

This is snapshot `CONFLICT-SNAPSHOT-2026-07-14T03:03:57.9752330+09:00`, captured after a fresh `git fetch origin --prune`. It is historical, ref-bound evidence, not a perpetual live-head claim. This target-ready candidate is created directly from `f98ae7d`, so its source base, integration target, remediation parent, and candidate/target merge-base are all that full SHA. Candidate/evidence commit scopes are checked separately, so no two-dot or accumulated-range file claim is made. The measured `d3ad865` cockpit remains only a historical failing browser fixture.

| Candidate | Bound local/remote head | Snapshot state | Exact high-risk overlap | Decision |
| --- | --- | --- | --- | --- |
| integration | `feat/phase-a-evidence-integration@f98ae7d` / `origin@f98ae7d` | clean | Current export call sites and target source blobs | Bound target; any target blob change requires a new candidate/evidence pair. |
| ontology | `fix/phase-a-ontology-review@9539f04` / `origin@9539f04` | clean, unreviewed remediation after prior rejection | HWP/PDF/XLSX, `WorkpackEditor`, `CurrentWorkpackModules`, `search`, `types`, `workpack-store` | Pause only intersecting future files; consume no committed hunk before owner resolution. |
| reports | `fix/reports-mobile-task-distance@6f7ee77` / `origin@6f7ee77` | clean evidence head over product `986b7fb` | Inherited HWP/PDF/template lineage; report CSS/tests remain separately owned | Resolve only export symbols if Wave 5 starts. |
| web | local `fix/web-localization-current-target@6d0b4dd`, remote `2fb3cc8`, ahead two | untracked evidence only | No current planned ownership intersection | Disjoint work does not block; recheck only if intersection becomes nonempty. |
| editor-first | `feature/editor-first-ui-v2@57b778e` / `origin@57b778e` | dirty image-only outputs | Committed editor/integration/export/test overlaps | Compare owned symbols after approval; no wholesale merge or file/output copy. |
| share-session | local-only `feature/share-session-ui-v2@76a67c5` | clean | share-session/dispatch routes and authority tests | Stale local candidate; server share stays approval-blocked. |
| workpack-share | `feat/workpack-share-v2@8804e33` / `origin@8804e33` | another owner's dirty evaluation spec/validator only | Inherited export lineage; share authority remains absent | Do not copy that remediation; recheck export lineage only if Wave 5 starts. |

Before any implementation or integration, run `git fetch origin --prune`, resolve every local/remote ref, inspect every named worktree, recompute merge-bases, and run `git diff --unified=0 <fresh-merge-base>...<fresh-head> -- <planned-owned/readOnly/test/authority paths>`. A changed target, target blob, ownership boundary, authority proposal, or newly intersecting path requires amendment and fresh review. Head/dirty changes with an empty recomputed intersection, generated logs/caches/screenshots, and unrelated evidence do not. Integration order is explicit DB approval plus spec PASS, refreshed target selection, then symbol-level owner resolution. Whole-file, directory, stale-worktree, output, and evidence copies are forbidden.

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
| `nullableStrictInteger` | acceptNullOrFiniteIntegerOnly | canonicalJsonNullOrNumber | `blocking_type_error` |
| `canonicalObject` | acceptPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonObjectWithSortedKeys | `blocking_type_error` |
| `nullableCanonicalObject` | acceptNullOrPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonNullOrObjectWithSortedKeys | `blocking_type_error` |
| `documentKey` | acceptExactDocumentKeyMemberOnly | canonicalJsonString | `blocking_reference_error` |
| `evidenceTargetArray` | acceptOrderedArrayOfStrictEvidenceMaterializationTargetsAndRejectUnknownKeys | canonicalJsonArrayWithTargetObjectKeysSorted | `blocking_reference_error` |
| `nullableStrictEnum` | acceptNullOrExactDeclaredEnumMemberOnly | canonicalJsonNullOrString | `blocking_type_error` |
| `canonicalArray` | acceptArrayRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles | canonicalJsonArray | `blocking_type_error` |
| `losslessDiscriminatedEvidence` | narrow raw union; preserve absent/null and extension values | merge typed+extensions collision-free | `blocking_provenance_error_and_preserve_original_json_in_unmapped` |

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

`EditorEvidenceRef = { id; raw; display; materializationTargets }`. `raw` is a lossless discriminated union; `display` is derived and never overwrites it.

| `raw.kind` | Exact source snapshot |
| --- | --- |
| `safety_reference_item` | Every `SafetyReferenceItem` required/optional value, raw `id/source_id/item_type/evidence_role`, and complete `kosha_guide`: `referenceId`, `stableDocumentKey`, `version`, `quality`, `lifecycle`, `bodyKind`, every `anchors[].page/excerpt`, `evidenceRef`, `directEligible`. |
| `ontology_law` | Complete `LawEvidenceRecord`, including cited UID, relation, article, URL/effective date/layer, review state, and resolution. |
| `ontology_sif` | Complete `SifEvidenceRecord`, including item ID, rank, `hazard_priority_only`, autoConfirm, cited UID, review state, and resolution. |
| `ontology_kosha_guidance` | Complete `KoshaGuidanceRecord`, including all item/production/guide IDs, chunk ID/hash/fragment/page/location/**supportStatement**, `registryMapping`, `provenanceBridge`, role, review state, and resolution. |
| `photo_candidate` | Candidate/pair IDs and before/after digests; never evidence-eligible. |
| `field_record` | Record ID/type/time and actor provenance. |

Unknown non-reserved keys move to `extensions: JsonObject` and merge back without value loss; known/reserved collisions fail closed into `unmapped`. Optional absence and explicit null remain distinct. Non-ontology members have derived `display.citedUid=null` and `display.resolution=null`; neither value is fabricated. `technical-guideline`, future item types, raw direct/supporting role, page/chunk/location, obligation, lifecycle, review state, materialization, and unresolved/review-required state survive reload and export.

`RiskAssessmentEditorRow` expansion is editor-only `id` plus the exact production `RiskAssessmentRow` order:

`id` -> `location` -> `process` -> `task` -> `equipment` -> `hazard` -> `fourM` -> `accidentType` -> `currentControls` -> `likelihood` -> `severity` -> `riskLevel` -> `additionalControls` -> `owner` -> `due` -> `verification` -> `verificationStatus` -> `verificationDate` -> `verificationChecker` -> `whyLikelihood` -> `whySeverity` -> `evidenceRefs`

The aliases `hazard4M`, `existingControls`, `dueDate`, and `reason` are forbidden for risk rows.

## MODEL-EVIDENCE-001 Provenance Contract

`reviewed:boolean` is forbidden. Eligibility is computed from the raw union into a separate display projection. The evidence digest includes the complete canonical raw member and extensions, derived display projection, targets, and link-validation state.

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

Unknown types therefore round-trip and change the digest without silently becoming eligible.

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

- increments `localDraftRevision` only; authoritative revision does not move

- changes only document content and explicit evidence references

- clears human confirmation

- clears top-level AskResponse dbHarness, ontologyQa, qualityContract, generationEvidence/error and editorV2 non-seal review artifacts

- moves prior digests and appendices to audit history

- marks dependent share blocks stale

- keeps local undo/checkpoint history

### FLOW-REVALIDATE-001 Deterministic Review

Planned endpoint: `POST /api/workpacks/revalidate` (absent now; Wave 5 may add review-only behavior)

Request:

- `mode=validate_unedited|revalidate_edited`
- `sealed baseResponse`
- `editorV2 candidate`
- `expectedBaseGenerationDigest`
- `localDraftRevision`

Server sequence:

1. Verify the untouched base top-level seal and recover trusted references.
2. For `validate_unedited`, assert every document content/body byte is unchanged; for edited mode, project only editable content.
3. Validate risk rows/references, rebuild dbHarness, attach review-only ontology QA, and attach qualityContract.
4. Compute evidenceDigest, then materializationDigest over the canonical envelope including local/server identity fields. Exclude the digest itself, humanConfirmation, and top-level seal/error.
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

Current `POST /api/workpacks` is insert-only and **is not v2 revision authority**. The entire implementation program, including Wave 0 codecs, adapters, local draft code, tests, and UI, is `BLOCKED_PENDING_USER_DB_APPROVAL`. Only this spec/validator review may proceed. Starting any product wave requires both a fresh independent spec PASS and explicit user approval of the migration/transactional RPC authority.

`REVISION-001` is blocked because no current unique/transactional facility guarantees logical root identity, monotonic revisions, replay, immutable photo-review events, or concurrent-writer exclusion. A select-latest then insert sequence in app code is race-prone and forbidden.

The approval must choose exactly one root strategy:

- **Strategy A, client logical ID:** the client generates one stable UUID `logicalWorkpackId` before the first attempt. The transaction enforces unique organization/logicalWorkpackId root, revision, and idempotency tuples.
- **Strategy B, server logical ID:** the client generates one stable `rootOperationKey`; the transaction enforces unique organization/rootOperationKey and allocates `logicalWorkpackId` exactly once.

Future common request fields are a sealed `review_pending` response, `parentWorkpackId|null`, `expectedRevision`, nonempty `idempotencyKey`, materialization/evidence digests, and `confirmMaterialization=true`, plus exactly the selected root identity field. Successors carry `logicalWorkpackId`, exact `parentWorkpackId`, and `expectedRevision>=1`.

One transaction/RPC must:

1. Authenticate and derive actor ID/display/time from server context; ignore client identity/time/approval.
2. Verify the incoming review-pending top-level seal and recompute its claimed pre-authority materialization/evidence digests without mutating content.
3. Look up the organization-scoped idempotency record inside the transaction. Same key and request digest returns the original actor/time/seal/result with `replayed=true` and no new row. Same key with another digest returns `409 idempotency_mismatch`; a missing key returns `400 idempotency_key_required`.
4. For a root, insert/lock the selected strategy's unique root identity and allocate revision 1. Reusing a root identity for a different operation returns `409 logical_root_conflict` or `409 root_operation_mismatch`. For a successor, lock the latest chain row, require exact parent/revision, and allocate latest+1 under a unique organization/logicalWorkpackId/revision constraint.
5. Stale revision or wrong parent returns `409 revision_conflict` with latest workpack ID/revision/digests and no mutation. Concurrent root or same-parent saves yield exactly one commit; losers get the defined 409 or an exact replay.
6. Put allocated logical/parent/revision values into the final candidate, then recompute evidenceDigest and materializationDigest so the latter binds that authoritative chain.
7. Stamp ActorProvenance/HumanConfirmation with final digests/revision and server time, change state without mutating documents, delete only top-level seal/error, call existing `attachGenerationEvidence`, atomically insert revision plus replay record, and return chain/parent/revision/digests/actor/time/seal/replay.

Required tests after approval cover both candidate strategies before one is selected, root/successor, every named 400/409, exact replay, concurrent roots/successors, server actor/time, seal/reseal, no-edit confirmation, and edited revalidation. No codec, product, DB, RPC, or migration work is authorized by this artifact.

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

Current v2 server freshness enforcement is **not installed**. No Wave 0-5 file owner may edit either route. Session creation/dispatch remain disabled with `freshness_server_contract_missing` until `REVISION-001` and separately reviewed `blocked-server-share-authority` both pass.

Each block still carries owning `documentKey`, stable block ID, authoritative `sourceRevision`, and `evidenceDigest`. The future share-session route treats client values as assertions, resolves the latest logical revision through approved authority, validates the block and human confirmation, and stores only a server-derived binding. The dispatch route reloads that binding and latest authoritative revision immediately before provider preflight; missing/stale/mismatched state returns 409 before any provider call. Existing `access_policy` is usable only if transactional coupling is proven; otherwise the approved RPC/migration must own it.

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
| `logicalWorkpackId` | string\|null | null before approved authority | `nullableStableId` | never synthesize locally |
| `parentWorkpackId` | string\|null | null for root/uncommitted draft | `nullableStableId` | immediate immutable parent after authority |
| `revision` | integer\|null | null before server transaction | `nullableStrictInteger` | authoritative only |
| `localDraftRevision` | integer | local counter | `strictInteger` | never accepted as server revision |
| `materializationDigest` | string | local deterministic then server rechecked | `digest` | independent canonical input |
| `evidenceDigest` | string | local deterministic then server rechecked | `digest` | complete raw/display provenance |
| `reviewState` | "generated"\|"edited"\|"review_pending"\|"human_confirmed" | `state_machine` | `strictEnum` | (v2 only) |
| `documents` | Record<DocumentKey,DocumentEnvelope> | `adapter_and_editor` | `canonicalObject` | deliverables strings plus deliverables.*Structured and structured riskAssessmentRows/tbmRiskLinks |
| `reviewArtifacts` | ReviewArtifacts | `server_recomputed` | `canonicalObject` | dbHarness + ontologyQa + qualityContract only; seal forbidden |
| `auditHistory` | AuditHistoryEntry[] | `adapter_and_server` | `canonicalArray` | (v2 only) |
| `evidence` | Record<string,EditorEvidenceRef> | `verified_base_plus_human_selection` | `canonicalObject` | dbHarness.packet plus ontologyQa.result plus evidenceLabels |
| `humanConfirmation` | HumanConfirmation\|null | `authenticated_server_only` | `nullableCanonicalObject` | (v2 only) |
| `unmapped` | Record<string,unknown> | `lossless_parser` | `canonicalObject` | unrecognized current deliverables and legacy lines |

Digest order is evidenceDigest -> materializationDigest -> review state/human stamp -> existing `attachGenerationEvidence`. The final top-level responseContentDigest may include the already-computed materializationDigest and humanConfirmation, but neither editor digest includes itself. The top-level seal/error is persisted with AskResponse and is never copied into editorV2.

Planned command behavior after both start gates pass:

- Autosave: local draft recovery only; it is never authoritative server save
- Undo: {"scope":"selected document content transaction only; evidence/review artifacts and server confirmations are never undoable client-side","historyLimit":50,"textCoalescingMs":750,"resetOn":["successful authoritative save","Load newer conflict resolution"],"preserves":["stable row IDs","legacy appendix audit history","unknown values"]}
- Cancel: Before revalidation, Cancel restores the selected document to its last explicit local checkpoint after confirmation. During a network request it requests abort where safe, retains the checkpoint, and never rolls back a completed server insert.
- Save: local checkpoint may exist only after implementation is unblocked; until `REVISION-001` is implemented, authoritative confirmation/save/share controls remain disabled.
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

After both program start gates pass, Wave 3 may show local display-only pixels and reloaded filenames with `server_metadata_only` plus preview-unavailable text. It may not show a fabricated stored thumbnail, `assetId`, or `storagePath`; Wave 3 owns no API, DB, schema, or migration change. No Wave 3 work may start while the program is blocked.

`PHOTO-002` review authority is separately blocked. Current POST creates `review_status=candidate`; existing `approved_by/approved_at` columns do not provide a confirm/reject route, immutable analysis/control/photo binding, event history, or concurrency.

- State is `candidate -> confirmed|rejected` only through a future authenticated immutable event. A later correction appends a superseding event and revision; it never rewrites history.
- Identity binds server event, improvement/pair, action, `transactionId`, and root idempotency operation. Reviewer ID/display comes from the authenticated session; `confirmedAt` or `rejectedAt` and `occurredAt` come from the server clock.
- Analysis binds nonempty `analysis_id`, the exact canonical `analysis_payload` JSON snapshot and recomputed typed digest, plus model provider/name/version copied from the authenticated analysis record. Later model output cannot replace it.
- Controls bind ordered nonempty candidate control IDs, each exact candidate text digest, accepted control IDs/text digests for confirmation, or rejection reason. Generated controls alone remain ineligible.
- Source `beforeImageSha256` is non-null. `afterImageSha256` is non-null for confirmation and completed-pair rejection; it may be null only for `missing_after_photo` rejection. Filenames, URLs, and storage paths cannot substitute for source-byte digests.
- Raw photo bytes, File/Blob values, object URLs, local previews, and unapproved EXIF remain site-memory/session only. They never enter editorV2, future approval/provider/CI/DOM requirement records, or the review event.
- Candidate, POST success, model analysis, local preview, and `server_metadata_only` never enter document/share evidence. Only a persisted confirmed event whose analysis, control, and image digests match immutable snapshots may derive a photo evidence ref; rejection remains audit-only.
- The approved transaction locks candidate revision and analysis, validates reviewer/action/root identity and all snapshots/digests, creates resulting revision=candidate+1, recomputes document/evidence/materialization digests, reseals the top-level response, computes `canonicalEventDigest` excluding itself, and atomically writes event, snapshot, revision, seal, audit, and replay result.
- Confirmed/rejected persistence cannot exist before explicit user approval of immutable event/history and transactional revision authority. Even local candidate UI remains blocked until that approval and fresh independent spec PASS.

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

Desktop multiline: auto-grow with `overflow-y:hidden`; long content is split into semantic sections and the page scrolls

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
| `review_pending` with authority blocked | no enabled primary; one revision-authority blocker |
| `review_pending` after approved authority | `확인하고 저장` |
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
| `BROWSER-019` | mixedLegacyRisk/edit | editable submission root contains no provenance/review/graph token or value over 2000 chars; those details exist only in the open drawer |
| `BROWSER-020` | drawer | closed surface has zero direct/DB/readiness/support/law-action nodes; open drawer has one section root per available category and close removes it from accessibility tree |
| `BROWSER-021` | photo candidate | candidate/metadata-only rows have evidence-eligible=false, null review event/control, zero share controls, asset/storage nodes, or reloaded image |
| `BROWSER-022` | all editors at 391x844 | textarea overflow-y=hidden, no max-height, scrollHeight<=clientHeight+1, and no ancestor editor scroller before the document page |
| `BROWSER-023` | blocked server authority | null chain/revision yields zero enabled confirm/save/share/dispatch controls and one revision-authority-required blocker |
| `BROWSER-024` | 200% root typography policy | all 144 cases keep deviceScaleFactor/devicePixelRatio/visualViewport scale=1, change root policy baseline->double and type scale 1->2 exactly once, independently compute 1.9..2.1 font/line ratios, and prove designated long-text reflow |
| `BROWSER-025` | 200% independent containment | future tests generated from the locator census measure zero cross-parent overlap, fixed/sticky escape, ancestor clipping, inner transform/zoom, document overflow, nested editor/textarea scroll, or late mobile editor start; current browser executions=0 |

### ZOOM-001 Future 200 Percent Implementation Contract

Browser executions for this specification artifact are exactly `0`. The post-approval implementation matrix remains Chromium, Firefox, and WebKit x `desktop1440` and `mobile390` x Day/Night x all 12 document keys: 144 cases. Each fresh context must start with `deviceScaleFactor=1`, `devicePixelRatio=1`, `visualViewport.scale=1`, `data-safeclaw-text-policy=baseline`, root `--safeclaw-type-scale=1`, and `text-size-adjust=100%`.

Future tests are generated from a locator census. The harness captures baseline computed styles and geometry, then in one evaluate transaction sets `data-safeclaw-text-policy=double`, root `--safeclaw-type-scale=2`, and harness-owned `applicationCount=1`. Typography tokens consume that root value. Browser-native zoom, CSS `zoom`, transforms, screenshot scaling, device-scale changes, nested multipliers, and a second application are forbidden.

The future locator census must name every priority region, reflow probe, textarea, drawer, editor root, and mobile editor heading. A later reviewed test implementation must measure parent, role, visibility, DOMRect, client/scroll dimensions, line count, and computed font/line/overflow/position/transform/zoom/text-size/max-height values at baseline and scaled states.

Those later tests must independently compute text ratios and reflow, fixed/sticky viewport containment, all cross-parent priority intersections, clipping through every overflow ancestor, inner transform/zoom, document overflow, nested scroll, textarea hidden-scroll, 44px targets, 8px stack gap, and mobile editor root/heading y budgets. The present spec validator validates only that this requirement exists. It executes no synthetic geometry fixtures and cannot print a browser behavior PASS.

### TASK-001 Objective Distance Budgets

Measurements start from a fresh selected-document fixture. Use bounding-rect top, cumulative absolute `window.scrollY` delta, and pointer activations.

| ID | Route | Max clicks | Max scroll | Position budget at 1440x1000 / 391x844 |
| --- | --- | --- | --- | --- |
| `TASK-001` | selector -> Edit | 1 | 0px | selected control/action <=160/220px desktop; <=200/280px mobile |
| `TASK-002` | selector -> first field | 1 | 240px | field <=360px desktop, <=420px mobile; focused heading 96..160px |
| `TASK-003` | selector -> review/revalidate | 2 | 240px | sole primary within bottom 96px; first invalid field focuses without extra click |
| `TASK-004` | selector -> confirm/save | 2 | 240px | authority-ready primary within bottom 96px; blocked fixture has zero enabled controls |
| `TASK-005` | selector -> Download | 2 | 0px | trigger <=240px desktop, <=320px mobile; trigger+format choice |
| `TASK-006` | selector -> share readiness/route | 1 | 0px | readiness <=300px desktop, <=360px mobile; blocked fixture has no enabled route |

The document surface starts at y<=160px desktop and y<=200px at 391x844. Any budget excess, duplicate primary, hidden first field, horizontal overflow, or enabled blocked-authority action fails.

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

Exact paths and single owners live in `spec.json.components.fileMap` and are mechanically checked against each wave write set. Wave 0 owns types/codecs/adapter; Wave 1 owns common field/table/evidence/attendance primitives; Wave 2 owns `PeoplePicker`; Wave 4 owns language/share-block primitives; Wave 5 owns shell/action/evidence-drawer/review-client/export bridge. Every document component is `components/workpack-editor/<component>.tsx` and belongs only to its document wave. Every `testFiles` path is likewise unique; later regression commands may run but not re-own earlier tests.

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
| `improvements[].beforeDigest` | string\|null | when bytes available | `nullableExactString` | editorV2/manifest only; never filename-derived |
| `improvements[].afterDigest` | string\|null | when bytes available | `nullableExactString` | editorV2/manifest only; never filename-derived |
| `improvements[].pairId` | string\|null | when both digests exist | `nullableStableId` | local identity until authoritative event |
| `improvements[].captureNote` | string | always | `exactString` | (v2 only) |
| `improvements[].actionTaken` | string | human-only | `exactString` | (v2 only) |
| `improvements[].evidenceRefs` | string[] | zero or more | `stableIdArrayAllowEmpty` | (v2 only) |
| `improvements[].photoState` | "not_selected"\|"local_display_only"\|"upload_in_flight"\|"server_metadata_only"\|"upload_failed" | always | `strictEnum` | Total mapping from the common Phase A photo state machine; successful POST/GET can yield server_metadata_only only |
| `improvements[].serverImprovementId` | string\|null | always | `nullableStableId` | POST /api/workpacks/[id]/improvements -> improvementId or GET improvements[].id or null |
| `improvements[].reviewStatus` | string | after successful response | `exactString` | POST /api/workpacks/[id]/improvements -> reviewStatus or GET improvements[].review_status |
| `improvements[].sourceType` | "manual"\|"photo_analysis"\|"operator_note" | after successful response | `strictEnum` | POST /api/workpacks/[id]/improvements -> sourceType or GET improvements[].source_type |
| `improvements[].reviewDecision` | "confirmed"\|"rejected"\|null | authoritative event only | `nullableStrictEnum` | null in Wave 3 |
| `improvements[].reviewEventId` | string\|null | authoritative event only | `nullableStableId` | null before approved event route |
| `improvements[].acceptedControlText` | string\|null | confirmed event only | `nullableExactString` | null before human confirmation |
| `improvements[].verificationNote` | string | human-only | `exactString` | (v2 only) |

Projection notes:

- `improvements[].reflectedDocumentKeys`: Adapter uses the exact 12-key title map in both directions and preserves unmapped legacy labels in unmapped; it never guesses.
- `improvements[].actionTaken`: Never copied from a generated recommendation.
- `improvements[].photoState`: Exactly PHOTO-001. Wave 3 has no hydrated/stored pixel state because existing GET/POST responses expose no photo asset ID or storage path.
- `improvements[].serverImprovementId`: Nonnull proves only a candidate row response/reload, never an asset, review event, evidence eligibility, or URL.
- `improvements[].reviewDecision`: Remains null until `PHOTO-002` authority returns an immutable authenticated event.

Required interactions:

- Select and compare Before/After files locally; use object URLs only in ephemeral component state and revoke them on replace, remove, or unmount.
- Submit the existing endpoint only for a stored workpack; the returned improvementId is a candidate, not reloadable pixels or review.
- After reload, show filenames with `server_metadata_only` and preview unavailable; never fabricate a thumbnail, assetId, or storagePath.
- Candidate cannot enter evidence/share until `PHOTO-002` confirms pair digests and accepted control text; defer pixels and review persistence.

Document gates:

- Never serialize File, Blob, object URL, assetId, or storagePath into editorV2.
- Before/After comparison requires both filenames and source digests; one-sided selections remain `local_display_only`.
- `server_metadata_only` requires an actual response/GET row and remains candidate-only.
- Review decision/event/control remain null until `PHOTO-002`; export never implies embedded pixels or confirmation.


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

- Every block has an authoritative sourceRevision and evidenceDigest; local draft revision is insufficient.
- Dispatch remains disabled until `REVISION-001` and separately reviewed share authority pass.
- Read receipts remain share acknowledgments only.


## EXPORT-001 Deterministic Compatibility

Same canonical envelope, revision, evidenceDigest, and stable row order produce the same legacy projection, structured projection, and embedded export manifest.

Byte-for-byte binary identity is not required. Semantic identity is required.

| Format | Deterministic semantic location |
| --- | --- |
| XLSX | hidden worksheet named _safeclaw_editor_v2, cell A1 canonical JSON |
| PDF HTML response | final appendix headed SafeClaw 편집 데이터 with deterministic field-path/value rows and manifest digest |
| HWPX client output | `buildHwpxWithRhwp` adds `Contents/safeclaw-editor-v2.json`, registers it in `content.hpf`, then `HwpDocument.exportHwpx` emits the package |
| binary HWP response | final document table headed SafeClaw 편집 데이터 with deterministic field-path/value rows and manifest digest |

Actual target `f98ae7d` seams, all owned only by future Wave 5, are:

- XLSX: `WorkpackEditor.downloadXlsx -> POST /api/export/xlsx`.
- PDF: `WorkpackEditor.printPdf -> POST /api/export/pdf?format=html`.
- HWP: `WorkpackEditor.downloadHwp -> POST /api/export/hwp`, returning a binary `.hwp` Blob.
- HWPX: `WorkpackEditor.buildHwpxWithRhwp -> downloadHwpx`, using `@rhwp/core` client-side with no editor export route.

`GET /api/export/hwpx-template` exists at the target but is not called by `WorkpackEditor` for HWPX export and is a read-only dependency, not an editor round-trip exit. No route or builder changes occur in this specification task.

Visible submission content keeps concise inline citation markers. Full provenance, DB harness, ontology QA, materialization, review-required state, and audit history are generated from separate roots and remain outside editable body semantics.

Round-trip gates:

1. Pure codec fixtures: legacy mixed string -> versioned body/appendix split -> structured parse -> serialize -> split preserves editable fields and every raw appendix line without exposing appendix text to an editor.
2. Wave 5 reload: draft -> dual projection -> JSON serialize -> buildReopenData -> adapter deep-equals normalized draft.
3. Wave 5 XLSX: POST response unzip/load and `_safeclaw_editor_v2!A1` parse deep-equals export manifest.
4. Wave 5 PDF: HTML response text extraction contains every deterministic field-path/value record and matching digest.
5. Wave 5 HWPX: client output unzip and `Contents/safeclaw-editor-v2.json` parse deep-equals export manifest.
6. Wave 5 HWP: binary parser reads the final document table and every deterministic field-path/value record.
7. No parser may substitute defaults without emitting a blocking issue and preserving the raw value.

Current compatibility paths remain:

- `riskAssessmentDraft`: single plus structuredRiskRows
- `workPlanDraft`: workPlanStructured
- `workPermitDraft`: permitInspectionStructured
- `tbmBriefing`: tbmBriefingStructured
- `tbmLogDraft`: tbmLogStructured
- `safetyEducationRecordDraft`: educationRecordStructured
- `otherDocuments`: single legacy rows
- `editedRiskCorrection`: V2 must stop sending edited=true with structured rows removed; project edited canonical risk rows explicitly.

### CODEC-001 Full Fixture Matrix

Every one of `DOC-01` through `DOC-12` declares the same seven cases. After implementation is unblocked, Wave 0 may run only in-memory `missing|empty|null|optional|unknown|legacy` codec/parser fixtures. Wave 5 alone runs reload plus XLSX/PDF/binary-HWP server exits and the client HWPX exit:

| Case | Exact expectation |
| --- | --- |
| missing | Required field blocks and preserves raw; optional absence stays absent. |
| empty | Empty ID array passes only zero-or-more; at-least-one fails. |
| null | Passes only nullable codecs; explicit null remains distinct from absence. |
| optional | Every conditional field is exercised absent and present. |
| unknown | Non-reserved key survives in extension bag; collision/invalid known type fails closed into unmapped. |
| legacy | Every expanded field reads its current structured path or exact string fallback, reloads deep-equal, and preserves raw appendix/unmapped. |
| export | Every field, risk/TBM link, raw evidence, verification, WorkerAttendance, ShareReadConfirmation, actionTaken, null/absence, order, extension, and digest survives XLSX/PDF/HWP/HWPX semantic extraction. |

The normative 12-row matrix and per-document field coverage live in `spec.json.implementation.codecFixtureMatrix`; the validator rejects a missing row, case, target, field codec, ownership split, or actual export call site. Spec review validates declarations only and reports no export behavior PASS.

## Implementation Waves

**Program status: BLOCKED_PENDING_USER_DB_APPROVAL.** No Wave 0 codec, adapter, local draft, test, UI, route, export, or browser work may start until the immutable candidate/evidence pair receives a fresh independent PASS **and** the user explicitly approves the DB migration/transactional RPC authority. Spec and validator review are the only permitted activity.

All paths below are future ownership after both gates. Every product/test file has exactly one write owner; later waves consume earlier APIs and cannot re-own files. Exact `ownedFiles`, `testFiles`, `readOnlyDependencies`, TDD gates, and rollback boundaries are canonical in `spec.json.implementation.waves`. While blocked, every wave has the same closed command shape: `status=BLOCKED_NO_EXECUTABLE_COMMANDS`, `executionCount=0`, and `tokens=[]`. No shell string is accepted; post-approval commands require a separately reviewed amendment.

| Wave | Single owner | Exact document scope | Post-approval role and exit |
| --- | --- | --- | --- |
| `wave0` | `workpack-editor-local-contract` | none | Strict types/codecs, all 12 adapters, body/appendix split, local lifecycle/checkpoint primitives. Pure in-memory codec fixtures only; no route, browser, reload, export, authority, or behavior PASS. |
| `wave1` | `workpack-editor-core-components` | `riskAssessmentDraft`, `tbmBriefing`, `tbmLogDraft` | Shared 44px/8px field primitives plus three genuinely structured editors; lossless links/evidence/verification/attendance/actionTaken. |
| `wave2` | `workpack-editor-plan-components` | `workPlanDraft`, `workPermitDraft`, `safetyEducationRecordDraft` | Three document-specific editors consuming Wave 0/1 APIs. |
| `wave3` | `workpack-editor-evidence-components` | `workpackSummaryDraft`, `emergencyResponseDraft`, `photoEvidenceDraft` | Three editors plus ephemeral/local-display photo pairing only; no persisted confirm/reject, fake asset hydration, API, or DB work. |
| `wave4` | `workpack-editor-multilingual-components` | `foreignWorkerBriefing`, `foreignWorkerTransmission`, `kakaoMessage` | Three editors, language variants, and share-block drafting; no server share freshness authority. |
| `wave5` | `workpack-editor-integration` | none | Registry/shell/action/drawer integration, actual reload and XLSX/PDF/binary-HWP/client-HWPX exits, all browser/task/200% gates, and flag-off fallback. Authority-dependent controls stay disabled. |

### Exact Primitive Ownership

Wave 0 owns `lib/workpack-editor-{types,codecs,adapter,legacy-boundary,document-specs,local-draft,review}.ts`. Wave 1 owns field, list/grid, evidence picker, attendance, validation primitives and the three core editor files. Wave 2 owns `PeoplePicker` and its three editors; Wave 3 owns `LocalPhotoPair` and its three editors; Wave 4 owns language/share-block primitives and its three editors. Wave 5 alone owns `WorkpackEditor`, `CurrentWorkpackModules`, registry/shell/action/evidence UI, review client/route, evidence summary, export manifest bridge, and the three server export routes. The generated tables list each exact path and test once; duplicate write ownership is a validation failure.

### TDD And Integration Gates

1. The present artifact starts no wave and authorizes no wave command. After both start approvals, a separately reviewed amendment must bind exact token arrays before any RED/GREEN execution begins.
2. Wave 0 proves pure missing/empty/null/optional/unknown/legacy codec fixtures for all 12; it cannot claim reload/export or browser behavior.
3. Wave 1 proves structured risk/TBM/TBM-log editing before any later document wave.
4. Waves 2-4 prove only their document deltas while preserving stable IDs, raw provenance, appendices, and unknown extensions.
5. After approval and a separate verifier/test design, Wave 5 proves reload and the three server plus one client export exits, all 12 documents, Day/Night, containment, task distance, one CTA, drawer/body separation, and the 144-case 200% matrix generated from the locator census.
6. No wave may print authoritative save/share/photo confirmation PASS. Those exits remain with separate blocked owners after approved transactional authority.
7. Integration order follows the freshly rechecked conflict ledger; no whole-file/directory/stale-worktree/output/evidence copy is allowed.

### Rollback And Feature Flag

Future implementation is migration-free only at the UI/codec layer and defaults `NEXT_PUBLIC_SAFECLAW_WORKPACK_EDITORS_V2=0`. Flag-off restores current editor/export rendering while preserving unknown `editorV2` JSON. Rollback reverts only the owning wave's product/test changes; it never deletes stored optional JSON or immutable revisions. The authority migration/RPC and any photo/share server work require separate approved rollback plans.

### Blocked Authorities

These are not executable waves and own no currently authorized edit:

| Future owner | Future write boundary | Approval condition |
| --- | --- | --- |
| `blocked-server-revision-authority` | workpacks route/store, revision authority module/tests, approved migration/RPC | User selects one root identity strategy and approves unique constraints, transaction, replay, concurrency, actor/time, reseal, and rollback. |
| `blocked-server-share-authority` | share-session/dispatch routes, commercial authority, freshness tests | Revision authority first; bind document/block/revision/digest transactionally and coordinate the local-only share branch. |
| `blocked-photo-review-authority` | authenticated review route/module/test, immutable event storage | Revision authority plus approved candidate/result revision/event/seal transaction. |

A new write path or moved owner requires a spec amendment, refreshed conflict snapshot, validator GREEN, and fresh independent review.
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

## Generated Human Normative Contract

`spec.json` is the canonical source. The structural block below enumerates every top-level domain without an allowlist; each domain row contains its complete nested value and the root row independently binds the whole contract. A second generated block binds the concise human requirements, while normalized prose outside both blocks is also hash-bound from JSON.

<!-- SAFECLAW-NORMATIVE:BEGIN -->

### Complete Structural Contract

Every top-level JSON domain is enumerated without an allowlist. Each domain row contains its complete canonical normalized value, including all nested fields; the root row independently binds the whole contract.

### Normalized Domains

| Path | Kind | Direct children | Recursive leaves | Max depth | Canonical SHA-256 | Canonical normalized value |
| --- | --- | --- | --- | --- | --- | --- |
| "$" | "object" | 19 | 4599 | 8 | "sha256:3d5193b655ea25494417c50223c52cafb907f7f05497be1c6b88c97717bf91cf" | "&lt;bound by complete top-level domain rows&gt;" |
| "common" | "object" | 4 | 729 | 6 | "sha256:3d90446286502116bbf73143cbc683f1516b0c17d81b860751f0c28a12452e42" | {"codecs":{"actorProvenance":{"onInvalid":"blocking_human_confirmation_error","parse":"acceptStrictActorProvenanceObjectAndRejectModelClaimingHumanIdentity","serialize":"canonicalJsonObjectWithSortedKeys"},"canonicalArray":{"onInvalid":"blocking_type_error","parse":"acceptArrayRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles","serialize":"canonicalJsonArray"},"canonicalObject":{"onInvalid":"blocking_type_error","parse":"acceptPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles","serialize":"canonicalJsonObjectWithSortedKeys"},"digest":{"onInvalid":"blocking_freshness_error","parse":"acceptStringMatchingSha256Base64urlPrefix","serialize":"canonicalJsonString"},"documentKey":{"onInvalid":"blocking_reference_error","parse":"acceptExactDocumentKeyMemberOnly","serialize":"canonicalJsonString"},"documentKeyArray":{"onInvalid":"blocking_reference_error","parse":"acceptArrayOfExactDocumentKeyMembersPreservingOrder","serialize":"canonicalJsonArray"},"evidenceTargetArray":{"onInvalid":"blocking_reference_error","parse":"acceptOrderedArrayOfStrictEvidenceMaterializationTargetsAndRejectUnknownKeys","serialize":"canonicalJsonArrayWithTargetObjectKeysSorted"},"exactString":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptStringPreservingUnicodeAndInteriorAndBoundaryWhitespace","serialize":"canonicalJsonString"},"isoDateTime":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptExactStringMatchingStrictRFC3339WithCalendarAndOffsetValidation; reject Date.parse-only or locale/space/date-only values","serialize":"canonicalJsonString"},"localDate":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptExactStringThenValidateYYYYMMDDOrDeclaredFieldFallback","serialize":"canonicalJsonString"},"losslessDiscriminatedEvidence":{"onInvalid":"blocking_provenance_error_and_preserve_original_json_in_unmapped","parse":"narrow unknown by kind/sourceType, validate every known field, preserve absent versus null, move unknown non-reserved keys to extensions, and never require ontology-only fields on non-ontology members","serialize":"merge typed fields and extensions without collision, omit originally absent optional fields, preserve explicit null and array order, then canonicalize object keys"},"nullableCanonicalObject":{"onInvalid":"blocking_type_error","parse":"acceptNullOrPlainObjectRecursivelyRejectingUndefinedFunctionsSymbolsAndCycles","serialize":"canonicalJsonNullOrObjectWithSortedKeys"},"nullableExactString":{"onInvalid":"blocking_type_error","parse":"acceptNullOrStringPreservingUnicodeAndInteriorAndBoundaryWhitespace","serialize":"canonicalJsonNullOrString"},"nullableRfc3339":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptNullOrExactStringMatchingStrictRFC3339WithCalendarAndOffsetValidation; reject Date.parse-only or locale/space/date-only values","serialize":"canonicalJsonNullOrString"},"nullableSha256HexDigest":{"onInvalid":"blocking_digest_error","parse":"acceptNullOrExactStringMatching^sha256:[0-9a-f]{64}$","serialize":"canonicalJsonNullOrSameLowercasePrefixedString"},"nullableStableId":{"onInvalid":"blocking_reference_error","parse":"acceptNullOrNonEmptyStableIdWithoutGeneratingOrCoercing","serialize":"canonicalJsonNullOrString"},"nullableStrictEnum":{"onInvalid":"blocking_type_error","parse":"acceptNullOrExactDeclaredEnumMemberOnly","serialize":"canonicalJsonNullOrString"},"nullableStrictInteger":{"onInvalid":"blocking_type_error","parse":"acceptNullOrFiniteIntegerOnly","serialize":"canonicalJsonNullOrNumber"},"nullableStrictNumber":{"onInvalid":"blocking_type_error","parse":"acceptNullOrFiniteNumberOnly","serialize":"canonicalJsonNullOrNumber"},"orderedStringArray":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptStringArrayPreservingOrderDuplicatesAndExactValues","serialize":"canonicalJsonArray"},"sha256HexDigest":{"onInvalid":"blocking_digest_error","parse":"acceptExactStringMatching^sha256:[0-9a-f]{64}$","serialize":"sameLowercasePrefixedString"},"stableId":{"onInvalid":"validation_error","parse":"acceptNonEmptyStringOrGenerateDeterministicIdFromSourceRevisionAndArrayIndex","serialize":"canonicalJsonString"},"stableIdArrayAllowEmpty":{"onInvalid":"blocking_reference_error","parse":"acceptZeroOrMoreNonEmptyStableIdsPreservingOrderAndRejectUnknownReferences","serialize":"canonicalJsonArray"},"stableIdArrayNonEmpty":{"onInvalid":"blocking_reference_error","parse":"acceptArrayWithAtLeastOneNonEmptyStableIdPreservingOrderAndRejectUnknownReferences","serialize":"canonicalJsonArray"},"strictBoolean":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptBooleanOnly","serialize":"canonicalJsonBoolean"},"strictEnum":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptExactDeclaredEnumMemberOnly","serialize":"canonicalJsonString"},"strictInteger":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptFiniteIntegerOnly","serialize":"canonicalJsonNumber"},"strictNumber":{"onInvalid":"validation_error_and_preserve_raw_in_unmapped","parse":"acceptFiniteNumberOnly","serialize":"canonicalJsonNumber"}},"projection":{"currentNullMeaning":"v2-only; hydrate from exact legacy fallback, otherwise typed empty plus blocking issue","editorV2":"deliverables.editorV2.documents.&lt;DocumentKey&gt;.content.&lt;fieldPath&gt;","exportManifest":"documents.&lt;DocumentKey&gt;.content.&lt;fieldPath&gt;","legacyFallback":"deliverables.&lt;DocumentKey&gt; -&gt; [SafeClaw Editor v2 fields] -&gt; {&lt;fieldPath&gt;}","parserPrecedence":["verified stored deliverables.editorV2","valid local v2 draft with matching baseGenerationDigest","current structured payload","legacy submission body plus v2 field fallback","typed empty with blocking issue"],"roundTripTargets":["reload","xlsx","pdf","hwp","hwpx"],"unknownRule":"Preserve unknown keys/lines verbatim; never default silently."},"rawProvenance":{"codec":"losslessDiscriminatedEvidence","displayProjection":"deriveEvidenceDisplayRef(raw, validationContext) returns normalizedSourceClass, title, lifecycle, reviewState, nullable resolution, quality, evidenceRole, directEligibility, obligationClassification, relation, roleDetail, citedUid, page/location, URL validation, reviewRequired, and unresolvedReason. It never mutates raw.","roundTrip":"serializeRawEvidence(parseRawEvidence(input)) deep-equals input for all known, optional, unknown, technical-guideline, future-item-type, ontology, null, and absent-field fixtures.","union":[{"identity":"Preserve id, source_id, item_type, and evidence_role exactly. citedUid and resolution are absent/null because this member is not ontology evidence. Future item_type strings remain in raw.item_type.","kind":"safety_reference_item","koshaGuide":["referenceId","stableDocumentKey","version","quality","lifecycle","bodyKind","anchors[].page","anchors[].excerpt","evidenceRef","directEligible"],"optional":["body","source_url","evidence_role","reflected_documents","short_summary","evidence_role_label","document_reflection_label","source_kind_label","operation_signal_label","display_title","display_summary","retrieval_source","vector_similarity","kosha_guide"],"required":["id","source_id","item_type","category","subcategory","title","summary","keywords","risk_tags","primary_documents","controls"],"sourceType":"SafetyReferenceItem"},{"identity":"Preserve the complete record and citedUid; sourceType must equal law.","kind":"ontology_law","required":["sourceType","relation","articleNo","title","citedUid","officialUrl","effectiveDate","graphArticleNodeId","layer","reviewState","resolution"],"sourceType":"LawEvidenceRecord"},{"identity":"Preserve the complete record; sourceType must equal sif_case and role remains hazard_priority_only.","kind":"ontology_sif","required":["sourceType","itemId","title","citedUid","rank","role","autoConfirm","reviewState","resolution"],"sourceType":"SifEvidenceRecord"},{"identity":"Preserve supportStatement, registryMapping, provenanceBridge and the complete record; sourceType must equal kosha_guidance.","kind":"ontology_kosha_guidance","required":["sourceType","evidenceId","itemId","productionItemId","guideCode","citedUid","chunk.chunkId","chunk.chunkSha256","chunk.chunkIdFragment","chunk.page","chunk.location","chunk.supportStatement","registryMapping","provenanceBridge","productionRowStatus","localSnapshotState","role","reviewState","resolution"],"sourceType":"KoshaGuidanceRecord"},{"identity":"candidateState is never evidence-eligible; only a separately persisted confirmed review event can derive a new evidence ref. resolution is absent/null.","kind":"photo_candidate","required":["candidateId","beforeDigest","afterDigest","pairId","candidateState"],"sourceType":"PhotoCandidateProvenance"},{"identity":"Preserve the source record and actor; resolution is absent/null.","kind":"field_record","required":["recordId","recordType","capturedAt","actor"],"sourceType":"FieldRecordProvenance"}],"unknownFieldRule":"For every union member, split unrecognized non-reserved keys into extensions: JsonObject and merge them back byte-for-value on serialization; a collision with a known/reserved key fails closed. Never coerce, synthesize, or discard a raw value."},"typeRegistry":{"ActorProvenance":{"authority":"authenticated server session or explicit worker confirmation; model/system human identity is rejected","fields":[["actorType","\"authenticated_user\"&#124;\"worker_self\"&#124;\"recorded_for_worker\"","as declared","strictEnum",null],["actorId","string","as declared","stableId",null],["displayName","string","as declared","exactString",null],["recordedForWorkerId","string&#124;null","as declared","nullableStableId",null],["occurredAt","string","as declared","isoDateTime",null],["authority","\"server_session\"&#124;\"worker_confirmation\"","as declared","strictEnum",null]]},"EditorEvidenceRef":{"digestRule":"evidenceDigest is sha256:base64url over refs sorted by id and containing the complete canonical raw union member, its extensions, derived display projection, materialization targets, and URL validation result.","fields":[["id","string","always","stableId","Stable editor identity derived from the raw member's original stable ID without replacing it"],["raw","RawProvenance","always","losslessDiscriminatedEvidence","Exact SafetyReferenceItem, ontology record, photo candidate, or field record plus collision-safe extensions"],["display","EvidenceDisplayRef","always","canonicalObject","Derived presentation/eligibility projection; never serialized back over raw"],["display.normalizedSourceClass","\"law\"&#124;\"kosha_guidance\"&#124;\"sif_case\"&#124;\"photo\"&#124;\"field_record\"&#124;\"other\"","always","strictEnum","Derived from raw discriminator and raw item_type"],["display.lifecycle","\"current\"&#124;\"stale\"&#124;\"retired\"&#124;\"unknown\"","always","strictEnum","Derived without changing raw lifecycle"],["display.reviewState","\"draft\"&#124;\"verified\"&#124;\"published\"&#124;\"unknown\"","always","strictEnum","Derived without changing raw reviewState"],["display.resolution","\"resolved\"&#124;\"unresolved\"&#124;null","always","nullableStrictEnum","Exact ontology resolution; null for safety_reference_item, photo_candidate, and field_record"],["display.quality","\"accepted\"&#124;\"review_required\"&#124;null","always","nullableStrictEnum","Raw KOSHA quality or explicit derived null"],["display.evidenceRole","\"direct\"&#124;\"supporting\"","always","strictEnum","Raw role when present, otherwise a versioned derivation"],["display.directEligibility","boolean","always","strictBoolean","Derived with valid-role constraints"],["display.obligationClassification","\"statutory_mandate\"&#124;\"technical_guidance_only\"&#124;\"statutory_mandate_with_guidance\"&#124;\"review_required\"","always","strictEnum","Derived ontology obligation; unknown and candidates are review_required"],["display.citedUid","string&#124;null","always","nullableExactString","Exact ontology citedUid; null and never fabricated for non-ontology evidence"],["display.reviewRequired","boolean","always","strictBoolean","Derived from lifecycle, reviewState, resolution, quality, mapping, eligibility, and target validity"],["display.unresolvedReason","string&#124;null","always","nullableExactString","Versioned reason or null"],["materializationTargets","EvidenceMaterializationTarget[]","zero or more","evidenceTargetArray","Empty is valid for unresolved/supporting evidence and blocks share only when the document requires a target"]],"losslessIdentityRule":"raw is the source of truth and round-trips every known, optional, nested, null, absent, and extension value. display is disposable and reproducible. Never require or fabricate citedUid/resolution for non-ontology evidence. Unknown/future item_type values normalize only in display to other/review_required.","normalizationMap":[{"normalizedSourceClass":"kosha_guidance","rawItemType":["technical-guideline","technical-support-regulation"]},{"normalizedSourceClass":"sif_case","rawItemType":["sif-case"]},{"normalizedSourceClass":"photo","rawItemType":["photo"]},{"normalizedSourceClass":"field_record","rawItemType":["field-record"]},{"effect":"review_required and not direct eligible","normalizedSourceClass":"other","rawItemType":["future or unmapped string"]}],"reviewRequiredRule":"quality=review_required, resolution=unresolved, obligationClassification=review_required, non-current lifecycle, missing target, or invalid direct use is derived; no reviewed boolean is stored.","reviewedBooleanForbidden":true,"validRoleCombinations":[{"allowedObligation":["statutory_mandate","statutory_mandate_with_guidance"],"forbidden":["technical_guidance_only","review_required","SIF-only legal claim"],"normalizedSourceClass":"law","required":{"directEligibility":true,"evidenceRole":"direct","lifecycle":"current","quality":null,"relation":"mandatedBy","resolution":"resolved","reviewState":"published","roleDetail":null}},{"allowedEvidenceRole":["direct","supporting"],"allowedObligation":["technical_guidance_only","statutory_mandate_with_guidance"],"evidenceRoleRule":"Preserve rawEvidenceRole when present. direct may describe document wording support but never upgrades a technical source into a statutory mandate.","forbidden":["statutory_mandate without a separate eligible published law source"],"normalizedSourceClass":"kosha_guidance","required":{"anchor":"chunkSha256,page,location present","bodyKind":"native","directEligibility":true,"lifecycle":"current","quality":"accepted","relation":"supportedBy","resolution":"resolved","reviewState":"verified_or_published","roleDetail":"technical_guidance_only"}},{"normalizedSourceClass":"kosha_guidance","required":{"directEligibility":false,"evidenceRole":"supporting","obligationClassification":"review_required"},"shareEffect":"blocking","when":"quality=review_required, lifecycle stale/retired, unresolved bridge, unknown body, missing chunk hash/page/location, or reviewState=draft"},{"forbidden":["statutory_mandate","statutory_mandate_with_guidance","technical_guidance_only","control auto-confirm","human confirmation"],"normalizedSourceClass":"sif_case","required":{"directEligibility":false,"evidenceRole":"supporting","obligationClassification":"review_required","relation":"prioritizedBy","roleDetail":"hazard_priority_only"}},{"normalizedSourceClass":"photo","note":"May support observed Before/After state or actionTaken only; cannot establish legal duty.","required":{"directEligibility":false,"evidenceRole":"supporting","obligationClassification":"review_required","relation":"observedBy"}},{"normalizedSourceClass":"field_record","note":"May support a field observation only; cannot establish legal duty.","required":{"directEligibility":false,"evidenceRole":"supporting","obligationClassification":"review_required","relation":"observedBy"}},{"normalizedSourceClass":"other","note":"Future and unmapped item types remain lossless but cannot unlock direct use or sharing until a reviewed normalization rule exists.","required":{"directEligibility":false,"obligationClassification":"review_required"}}]},"EvidenceMaterializationTarget":{"fields":[["documentKey","DocumentKey","always","documentKey","evidenceLabels[documentKey] and structured document owner"],["rowOrSectionId","string","always","stableId","stable structured row/section mapping"],["fieldPath","string","always","exactString","structured.*.evidenceRefs owner field path"],["stableKey","string","always","stableId","stable structured row/section mapping"]]},"HumanConfirmation":{"authority":"POST /api/workpacks server only","fields":[["reviewerId","string","always","stableId",null],["reviewerDisplayName","string","always","exactString",null],["confirmedAt","string","always","isoDateTime",null],["materializationDigest","string","always","digest",null],["evidenceDigest","string","always","digest",null],["revision","integer","always","strictInteger",null],["disclaimerVersion","string","always","exactString",null],["actor","ActorProvenance","always","actorProvenance",null]]},"RiskAssessmentEditorRow":{"base":"RiskAssessmentRow from lib/risk-assessment-schema.ts","fields":[["id","string","always","stableId",null],["location","string","always","exactString","structured.riskAssessmentRows[].location"],["process","string","always","exactString","structured.riskAssessmentRows[].process"],["task","string","always","exactString","structured.riskAssessmentRows[].task"],["equipment","string","always","exactString","structured.riskAssessmentRows[].equipment"],["hazard","string","always","exactString","structured.riskAssessmentRows[].hazard"],["fourM","\"Man\"&#124;\"Machine\"&#124;\"Media\"&#124;\"Management\"","always","strictEnum","structured.riskAssessmentRows[].fourM"],["accidentType","RiskAssessmentRow.accidentType","always","strictEnum","structured.riskAssessmentRows[].accidentType"],["currentControls","string","always","exactString","structured.riskAssessmentRows[].currentControls"],["likelihood","integer 1..5","always","strictInteger","structured.riskAssessmentRows[].likelihood"],["severity","integer 1..5","always","strictInteger","structured.riskAssessmentRows[].severity"],["riskLevel","\"low\"&#124;\"medium\"&#124;\"high\"","always","strictEnum","structured.riskAssessmentRows[].riskLevel"],["additionalControls","string","always","exactString","structured.riskAssessmentRows[].additionalControls"],["owner","string","always","exactString","structured.riskAssessmentRows[].owner"],["due","string","always","localDate","structured.riskAssessmentRows[].due"],["verification","string","always","exactString","structured.riskAssessmentRows[].verification"],["verificationStatus","\"planned\"&#124;\"done\"&#124;\"needsReview\"","always","strictEnum","structured.riskAssessmentRows[].verificationStatus"],["verificationDate","string","always","localDate","structured.riskAssessmentRows[].verificationDate"],["verificationChecker","string","always","exactString","structured.riskAssessmentRows[].verificationChecker"],["whyLikelihood","string","always","exactString","structured.riskAssessmentRows[].whyLikelihood"],["whySeverity","string","always","exactString","structured.riskAssessmentRows[].whySeverity"],["evidenceRefs","string[]","at least one","stableIdArrayNonEmpty","structured.riskAssessmentRows[].evidenceRefs"]],"notes":{"id":"Editor-only stable identity derived deterministically for legacy rows; it never replaces a production field.","riskLevel":"Validate/derive from likelihood and severity with production validator."}},"ShareBlockBase":{"fields":[["id","string","always","stableId",null],["documentKey","DocumentKey","always","documentKey",null],["sourceDocumentKeys","DocumentKey[]","at least one","documentKeyArray",null],["sourceRevision","integer","always","strictInteger",null],["evidenceDigest","string","always","digest",null],["languageCode","string","always","exactString",null],["channel","\"sms\"&#124;\"kakao\"&#124;\"band\"&#124;\"link\"","always","strictEnum",null],["actionRequired","string","always","exactString",null],["confirmationRequired","boolean","always","strictBoolean",null],["state","\"draft\"&#124;\"stale\"&#124;\"ready\"&#124;\"dispatched\"","always","strictEnum",null],["shareSessionId","string&#124;null","always","nullableStableId","workpack_share_sessions.id or null before server creation"]],"rebuild":"Rebuild creates a new block id and current revision/digest while preserving intended recipients only; it clears shareSessionId, dispatch state, and current acknowledgment display.","serverBinding":"Planned only. Current routes store/enforce no authoritative editor binding. Until REVISION-001 and blocked-server-share-authority pass, shareSessionId remains null and network share controls are disabled.","staleOn":["edit to any sourceDocumentKey","evidence add/remove/change","translation source edit","worker audience or language change","human confirmation cleared","server digest mismatch"]},"ShareReadConfirmation":{"cannotProve":["TBM attendance","education attendance","understanding","signature","work completion","safety approval","human document confirmation"],"fields":[["id","string","after read","stableId","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].id"],["shareBlockId","string","always","stableId",null],["shareSessionId","string&#124;null","always","nullableStableId","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].share_session_id"],["workerId","string&#124;null","when known","nullableStableId","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].worker_id"],["workerDisplayName","string","always","exactString","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].worker_display_name"],["languageCode","string","always","exactString","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].language_code"],["confirmationMethod","\"button\"","always","strictEnum","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].confirmation_method"],["readAt","string","always","isoDateTime","GET /api/workpacks/[id]/read-confirmations -&gt; confirmations[].read_at"]],"proves":["a share-session recipient opened or acknowledged the shared material"]},"WorkerAttendanceConfirmation":{"actor":"worker or authenticated recorder with explicit recordedForWorker provenance","fields":[["id","string","always","stableId",null],["workerId","string","always","stableId",null],["displayName","string","always","exactString",null],["attendanceStatus","\"expected\"&#124;\"present\"&#124;\"late\"&#124;\"absent\"","always","strictEnum",null],["understandingStatus","\"not_confirmed\"&#124;\"understood\"&#124;\"needs_followup\"","always","strictEnum",null],["signatureMethod","\"none\"&#124;\"drawn\"&#124;\"uploaded\"&#124;\"external_reference\"","always","strictEnum",null],["signatureRef","string","when signatureMethod is not none","exactString",null],["confirmedAt","string","when confirmed","isoDateTime",null],["actionTaken","string","when needs_followup or absent","exactString",null],["actor","ActorProvenance","when confirmed","actorProvenance",null]],"proves":["attendance at a named TBM or education event","worker understanding status","signature or confirmation method","event-specific actionTaken"]}}} |
| "components" | "object" | 10 | 139 | 3 | "sha256:4417ba5f67f8eef41fd2a4706e2e4be640a82c14428309cdfa46b16e7a35a678" | {"documentComponentPath":"components/workpack-editor/&lt;component&gt;.tsx; the basename and named export equal each documents[].component and the path belongs to that document's wave owner.","documentSpecificRule":"A document wrapper is required when sequencing, row behavior, validation, projection, or primary action differs. Shared primitives are not a universal schema renderer.","duplicationRule":"Do not create twelve copy-pasted editors. Create twelve typed document specifications and only the thin wrappers needed for distinct domain interactions.","exportNameRule":"Each document component field equals the named export and file basename exactly.","fileMap":[["WorkpackEditor","components/WorkpackEditor.tsx","wave5"],["CurrentWorkpackModules","components/CurrentWorkpackModules.tsx","wave5"],["DocumentEditorRegistry","components/workpack-editor/DocumentEditorRegistry.tsx","wave5"],["DocumentEditorShell","components/workpack-editor/DocumentEditorShell.tsx","wave5"],["WorkpackEditorAdapter","lib/workpack-editor-adapter.ts","wave0"],["WorkpackEditorCodecs","lib/workpack-editor-codecs.ts","wave0"],["WorkpackEditorTypes","lib/workpack-editor-types.ts","wave0"],["WorkpackEditorLegacyBoundary","lib/workpack-editor-legacy-boundary.ts","wave0"],["WorkpackEditorDocumentSpecs","lib/workpack-editor-document-specs.ts","wave0"],["WorkpackEditorLocalDraft","lib/workpack-editor-local-draft.ts","wave0"],["WorkpackEditorReviewLifecycle","lib/workpack-editor-review.ts","wave0"],["WorkpackReviewClient","lib/workpack-editor-review-client.ts","wave5"],["WorkpackRevalidateRoute","app/api/workpacks/revalidate/route.ts","wave5"],["selectDocumentEvidenceSummary","lib/workpack-editor-evidence-summary.ts","wave5"],["ExportManifestBridge","lib/workpack-editor-export-manifest.ts","wave5"],["FieldGroup","components/workpack-editor/FieldGroup.tsx","wave1"],["ExactTextField","components/workpack-editor/ExactTextField.tsx","wave1"],["AutoGrowTextField","components/workpack-editor/AutoGrowTextField.tsx","wave1"],["EnumSelect","components/workpack-editor/EnumSelect.tsx","wave1"],["DateTimeField","components/workpack-editor/DateTimeField.tsx","wave1"],["ChecklistField","components/workpack-editor/ChecklistField.tsx","wave1"],["EditableRowList","components/workpack-editor/EditableRowList.tsx","wave1"],["ResponsiveDataGrid","components/workpack-editor/ResponsiveDataGrid.tsx","wave1"],["EvidenceReferencePicker","components/workpack-editor/EvidenceReferencePicker.tsx","wave1"],["WorkerAttendanceEditor","components/workpack-editor/WorkerAttendanceEditor.tsx","wave1"],["ValidationSummary","components/workpack-editor/ValidationSummary.tsx","wave1"],["PeoplePicker","components/workpack-editor/PeoplePicker.tsx","wave2"],["LocalPhotoPair","components/workpack-editor/LocalPhotoPair.tsx","wave3"],["LanguageVariantEditor","components/workpack-editor/LanguageVariantEditor.tsx","wave4"],["ShareBlockEditor","components/workpack-editor/ShareBlockEditor.tsx","wave4"],["DocumentActionBar","components/workpack-editor/DocumentActionBar.tsx","wave5"],["EvidenceSummaryTrigger","components/workpack-editor/EvidenceSummaryTrigger.tsx","wave5"],["EvidenceDetailsDrawer","components/workpack-editor/EvidenceDetailsDrawer.tsx","wave5"],["SourceConfirmationWarning","components/workpack-editor/SourceConfirmationWarning.tsx","wave5"]],"forbiddenAliases":["SummaryEditor","PermitInspectionEditor"],"orchestrators":["WorkpackEditor owns selected document, canonical draft, commands, lifecycle, the single evidence drawer state, and feature-flag fallback.","DocumentEditorRegistry exhaustively maps all 12 keys to typed specifications and thin domain wrappers.","DocumentEditorShell owns one tabpanel, title/status, source-confirmation warning, one neutral evidence trigger, one primary lifecycle action, and secondary edit/download commands; it has no evidence rail.","WorkpackEditorAdapter owns body/appendix separation, parse, serialize, dual projection, digest input, and unknown preservation.","WorkpackReviewClient calls revalidation and save seams but cannot stamp human identity.","selectDocumentEvidenceSummary is the only count source for EvidenceSummaryTrigger and EvidenceDetailsDrawer.","EvidenceDetailsDrawer owns provenance, review artifacts, validated links, open actions, and audit appendices as one progressive-disclosure surface.","WorkerAttendanceEditor owns event attendance/understanding and never consumes ShareReadConfirmation.","ExportManifestBridge owns one canonical manifest for XLSX, PDF, HWP, and HWPX and keeps appendices outside editable body semantics."],"primitives":["FieldGroup","ExactTextField","AutoGrowTextField","EnumSelect","DateTimeField","ChecklistField","EditableRowList","ResponsiveDataGrid","PeoplePicker","EvidenceReferencePicker","WorkerAttendanceEditor","LanguageVariantEditor","ShareBlockEditor","LocalPhotoPair","ValidationSummary","DocumentActionBar","EvidenceSummaryTrigger","EvidenceDetailsDrawer","SourceConfirmationWarning"],"resolvedNames":{"workPermitDraft":"components/workpack-editor/WorkPermitEditor.tsx#WorkPermitEditor","workpackSummaryDraft":"components/workpack-editor/WorkpackSummaryEditor.tsx#WorkpackSummaryEditor"},"testOwnershipRule":"Every implementation.waves[].testFiles path is a write-owned file and appears in exactly one wave. Regression commands may execute read-only tests but may not list them as testFiles."} |
| "contractIds" | "array" | 55 | 55 | 1 | "sha256:547976029035c403cd492f637e7b04a60dd7f183f481a1a457342a2c9722c4cf" | ["PARITY-001","PARITY-002","RANGE-001","SCOPE-001","DOC-001","COMPONENT-001","OWNERSHIP-001","RISK-001","FIELD-001","FIELD-002","CODEC-001","BODY-001","BODY-002","BODY-003","FLOW-001","FLOW-002","FLOW-003","FLOW-004","FLOW-005","REVISION-001","IDEMPOTENCY-001","APPROVAL-001","HUMAN-001","CONFIRM-001","EVIDENCE-001","EVIDENCE-002","PROVENANCE-001","SHARE-001","SHARE-002","PHOTO-001","PHOTO-002","EXPORT-001","EXPORT-002","UI-001","UI-002","UI-003","UI-004","UI-005","UI-006","UI-007","UI-008","UI-009","UI-010","UI-011","TASK-001","ZOOM-001","LINK-001","STATE-001","CONFLICT-001","ROLLBACK-001","WAVE-001","WAVE-002","TRUST-001","VALIDATOR-001","PASS-001"] |
| "documents" | "array" | 12 | 1571 | 5 | "sha256:b9fca00043b59e4d178a958d4edd8d1577630051feb2be11d5bc2fd410a319c4" | [{"component":"WorkpackSummaryEditor","family":"finding-summary","fieldNotes":{},"fields":[["meta.title","string","always","exactString",null],["meta.siteName","string","always","exactString",null],["meta.inspectionDate","string","always","localDate",null],["meta.inspectorNames","string[]","at least one","orderedStringArray",null],["meta.overallResult","\"pass\"&#124;\"conditional\"&#124;\"fail\"","always","strictEnum",null],["meta.executiveSummary","string","always","exactString",null],["meta.nextAction","string","when overallResult is not pass","exactString",null],["findings[].id","string","always","stableId",null],["findings[].category","string","always","exactString",null],["findings[].finding","string","always","exactString",null],["findings[].severity","\"critical\"&#124;\"major\"&#124;\"minor\"&#124;\"observation\"","always","strictEnum",null],["findings[].owner","string","when status is open","exactString",null],["findings[].dueDate","string","when status is open","localDate",null],["findings[].status","\"open\"&#124;\"in_progress\"&#124;\"done\"","always","strictEnum",null],["findings[].evidenceRefs","string[]","at least one unless explicit no-evidence reason","stableIdArrayNonEmpty",null]],"gates":["Require at least one finding or an explicit no-findings statement.","Open findings require owner and dueDate.","Every evidenceRefs value must resolve to envelope evidence."],"id":"DOC-01","interactions":["Filter by open, in-progress, and done without changing canonical row order.","Jump from a finding's inline citation marker to the matching item in the single 근거 및 검수 drawer.","Completed findings collapse only after the first open item remains visible."],"key":"workpackSummaryDraft","primaryAction":"조치 항목 추가","primaryActionRule":"Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.","schemaOrder":["meta.title","meta.siteName","meta.inspectionDate","meta.inspectorNames","meta.overallResult","meta.executiveSummary","meta.nextAction","findings[].id","findings[].category","findings[].finding","findings[].severity","findings[].owner","findings[].dueDate","findings[].status","findings[].evidenceRefs"],"title":"점검결과 요약","type":"WorkpackSummaryDraft","typeBindings":[]},{"component":"RiskAssessmentEditor","family":"production-risk-grid","fieldNotes":{"rows[].id":"Editor-only stable identity; never replaces a RiskAssessmentRow production field."},"fields":[["rows","RiskAssessmentEditorRow[]","at least one","canonicalArray","structured.riskAssessmentRows"]],"gates":["Run validateRiskAssessmentRows against exactly the 21 production fields.","Derive and verify riskLevel from likelihood and severity.","Resolve every evidenceRefs ID and block unresolved or review_required direct use.","Require explicit remapping before deleting a referenced row."],"id":"DOC-02","interactions":["Add, duplicate, reorder, and remove rows with stable editor IDs.","Use a desktop grid and an equivalent sequential mobile row editor.","Show only concise citation markers in rows; lifecycle, role, eligibility, obligation, unresolved, and review_required detail opens in the single 근거 및 검수 drawer.","Offer selected risk rows to TBM without mutating existing TBM drafts.","Confirm removal when a row is referenced by TBM, work plan, permit, or evidence targets."],"key":"riskAssessmentDraft","primaryAction":"위험행 추가","primaryActionRule":"Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.","schemaOrder":["rows","@RiskAssessmentEditorRow:rows[]"],"title":"위험성평가표","type":"RiskAssessmentEditorDraft","typeBindings":[{"currentOverrides":{},"prefix":"rows[]","type":"RiskAssessmentEditorRow"}]},{"component":"WorkPlanEditor","family":"existing-structured-plan","fieldNotes":{"approvers.approver":"Generated value is an unverified display placeholder; it is not HumanConfirmation.","approvers.author":"Generated value is an unverified display placeholder; it is not HumanConfirmation.","approvers.reviewer":"Generated value is an unverified display placeholder; it is not HumanConfirmation.","workSteps[].relatedRiskRowIds":"Map stable IDs to zero-based canonical risk row indices; retain IDs in editorV2."},"fields":[["workOverview.workName","string","always","exactString","deliverables.workPlanStructured.workOverview.workName"],["workOverview.description","string","always","exactString","deliverables.workPlanStructured.workOverview.description"],["workOverview.workerCount","integer","always","strictInteger","deliverables.workPlanStructured.workOverview.workerCount"],["workOverview.location","string","always","exactString","deliverables.workPlanStructured.workOverview.location"],["workOverview.condition","string","always","exactString","deliverables.workPlanStructured.workOverview.condition"],["workOverview.equipment","string[]","zero or more","orderedStringArray","deliverables.workPlanStructured.workOverview.equipment"],["workSteps[].id","string","always","stableId",null],["workSteps[].stepNo","integer","always","strictInteger","deliverables.workPlanStructured.workSteps[].stepNo"],["workSteps[].action","string","always","exactString","deliverables.workPlanStructured.workSteps[].action"],["workSteps[].equipment","string","always","exactString","deliverables.workPlanStructured.workSteps[].equipment"],["workSteps[].safetyMeasure","string","always","exactString","deliverables.workPlanStructured.workSteps[].safetyMeasure"],["workSteps[].owner","string","always","exactString","deliverables.workPlanStructured.workSteps[].owner"],["workSteps[].relatedRiskRowIds","string[]","zero or more","stableIdArrayAllowEmpty","deliverables.workPlanStructured.workSteps[].relatedRiskRowIndex"],["workSteps[].evidenceRefs","string[]","zero or more","stableIdArrayAllowEmpty","deliverables.workPlanStructured.workSteps[].evidenceRefs"],["workSteps[].verification","string","always","exactString","deliverables.workPlanStructured.workSteps[].verification"],["stopCriteria","string[]","at least one","orderedStringArray","deliverables.workPlanStructured.stopCriteria"],["emergencyResponse.contacts[].id","string","always","stableId",null],["emergencyResponse.contacts[].role","string","always","exactString","deliverables.workPlanStructured.emergencyResponse.contacts[].role"],["emergencyResponse.contacts[].phone","string","always","exactString","deliverables.workPlanStructured.emergencyResponse.contacts[].phone"],["emergencyResponse.evacRoute","string","always","exactString","deliverables.workPlanStructured.emergencyResponse.evacRoute"],["emergencyResponse.firstAid","string","always","exactString","deliverables.workPlanStructured.emergencyResponse.firstAid"],["approvers.author","string","always","exactString","deliverables.workPlanStructured.approvers.author"],["approvers.reviewer","string","always","exactString","deliverables.workPlanStructured.approvers.reviewer"],["approvers.approver","string","always","exactString","deliverables.workPlanStructured.approvers.approver"]],"gates":["Require at least one step with action, equipment, safetyMeasure, owner, and verification.","Resolve every relatedRiskRowIds and evidenceRefs value.","Never treat generated approver text as authenticated approval."],"id":"DOC-03","interactions":["Reorder steps while stable IDs remain unchanged and stepNo is normalized at projection.","Import selected risk rows as linked draft controls.","Reveal emergency and display-only approver sections after core steps."],"key":"workPlanDraft","primaryAction":"작업단계 추가","primaryActionRule":"Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.","schemaOrder":["workOverview.workName","workOverview.description","workOverview.workerCount","workOverview.location","workOverview.condition","workOverview.equipment","workSteps[].id","workSteps[].stepNo","workSteps[].action","workSteps[].equipment","workSteps[].safetyMeasure","workSteps[].owner","workSteps[].relatedRiskRowIds","workSteps[].evidenceRefs","workSteps[].verification","stopCriteria","emergencyResponse.contacts[].id","emergencyResponse.contacts[].role","emergencyResponse.contacts[].phone","emergencyResponse.evacRoute","emergencyResponse.firstAid","approvers.author","approvers.reviewer","approvers.approver"],"title":"작업계획서","type":"WorkPlanEditorDraft","typeBindings":[]},{"component":"WorkPermitEditor","family":"existing-structured-permit","fieldNotes":{"approvers.completionChecker":"Display placeholder only.","approvers.requester":"Display placeholder only.","approvers.safetyManager":"Display placeholder only.","approvers.siteManager":"Display placeholder only.","basicInfo.approver":"Generated value is unverified display text.","basicInfo.requester":"Generated value is unverified display text.","conditions[].relatedRiskRowId":"Map stable ID to zero-based canonical risk row index; null remains absent."},"fields":[["applicability","\"required\"&#124;\"not_required\"&#124;\"undetermined\"","always","strictEnum",null],["notRequiredReason","string","when applicability is not_required","exactString",null],["basicInfo.permitNo","string","when applicability is required","exactString","deliverables.permitInspectionStructured.basicInfo.permitNo"],["basicInfo.permitType","PermitInspectionStructured.basicInfo.permitType","when applicability is required","strictEnum","deliverables.permitInspectionStructured.basicInfo.permitType"],["basicInfo.workName","string","when applicability is required","exactString","deliverables.permitInspectionStructured.basicInfo.workName"],["basicInfo.location","string","when applicability is required","exactString","deliverables.permitInspectionStructured.basicInfo.location"],["basicInfo.workDate","string","when applicability is required","localDate","deliverables.permitInspectionStructured.basicInfo.workDate"],["basicInfo.workerCount","integer","when applicability is required","strictInteger","deliverables.permitInspectionStructured.basicInfo.workerCount"],["basicInfo.requester","string","when applicability is required","exactString","deliverables.permitInspectionStructured.basicInfo.requester"],["basicInfo.approver","string","when applicability is required","exactString","deliverables.permitInspectionStructured.basicInfo.approver"],["conditions[].id","string","always","stableId",null],["conditions[].category","PermitInspectionStructured.conditions[].category","always","strictEnum","deliverables.permitInspectionStructured.conditions[].category"],["conditions[].requirement","string","always","exactString","deliverables.permitInspectionStructured.conditions[].requirement"],["conditions[].action","string","always","exactString","deliverables.permitInspectionStructured.conditions[].action"],["conditions[].owner","string","always","exactString","deliverables.permitInspectionStructured.conditions[].owner"],["conditions[].status","PermitInspectionStructured.conditions[].status","always","strictEnum","deliverables.permitInspectionStructured.conditions[].status"],["conditions[].relatedRiskRowId","string&#124;null","optional","nullableStableId","deliverables.permitInspectionStructured.conditions[].relatedRiskRowIndex"],["conditions[].evidenceRefs","string[]","zero or more","stableIdArrayAllowEmpty","deliverables.permitInspectionStructured.conditions[].evidenceRefs"],["conditions[].verification","string","always","exactString","deliverables.permitInspectionStructured.conditions[].verification"],["attachments[].id","string","always","stableId",null],["attachments[].name","string","always","exactString","deliverables.permitInspectionStructured.attachments[].name"],["attachments[].required","boolean","always","strictBoolean","deliverables.permitInspectionStructured.attachments[].required"],["attachments[].status","PermitInspectionStructured.attachments[].status","always","strictEnum","deliverables.permitInspectionStructured.attachments[].status"],["attachments[].note","string","always","exactString","deliverables.permitInspectionStructured.attachments[].note"],["completionChecks[].id","string","always","stableId",null],["completionChecks[].item","string","always","exactString","deliverables.permitInspectionStructured.completionChecks[].item"],["completionChecks[].method","string","always","exactString","deliverables.permitInspectionStructured.completionChecks[].method"],["completionChecks[].owner","string","always","exactString","deliverables.permitInspectionStructured.completionChecks[].owner"],["completionChecks[].status","PermitInspectionStructured.completionChecks[].status","always","strictEnum","deliverables.permitInspectionStructured.completionChecks[].status"],["approvers.requester","string","always","exactString","deliverables.permitInspectionStructured.approvers.requester"],["approvers.safetyManager","string","always","exactString","deliverables.permitInspectionStructured.approvers.safetyManager"],["approvers.siteManager","string","always","exactString","deliverables.permitInspectionStructured.approvers.siteManager"],["approvers.completionChecker","string","always","exactString","deliverables.permitInspectionStructured.approvers.completionChecker"]],"gates":["Required permits need complete basicInfo, at least one condition, and completion checks.","Not-required permits require an explicit reason and do not auto-generate structured permit data.","Resolve risk and evidence references.","Generated approver strings never satisfy HumanConfirmation."],"id":"DOC-04","interactions":["Selecting not_required preserves an intentional empty legacy permit and requires notRequiredReason.","Selecting required reveals the exact PermitInspectionStructured fields.","Bulk mark visible unchecked conditions as one undo transaction."],"key":"workPermitDraft","primaryAction":"허가조건 추가","primaryActionRule":"Shown as the only dominant action only when compatible with the global lifecycle action; otherwise rendered as a secondary row command.","schemaOrder":["applicability","notRequiredReason","basicInfo.permitNo","basicInfo.permitType","basicInfo.workName","basicInfo.location","basicInfo.workDate","basicInfo.workerCount","basicInfo.requester","basicInfo.approver","conditions[].id","conditions[].category","conditions[].requirement","conditions[].action","conditions[].owner","conditions[].status","conditions[].relatedRiskRowId","conditions[].evidenceRefs","conditions[].verification","attachments[].id","attachments[].name","attachments[].required","attachments[].status","attachments[].note","completionChecks[].id","completionChecks[].item","completionChecks[].method","completionChecks[].owner","completionChecks[].status","approvers.requester","approvers.safetyManager","approvers.siteManager","approvers.completionChecker"],"title":"안전작업허가 확인서","type":"WorkPermitEditorDraft","typeBindings":[]},{"component":"TbmBriefingEditor","family":"risk-linked-briefing","fieldNotes":{"hazards[].id":"Stable editor identity. Existing arrays hydrate deterministically from sourceRevision and array index.","hazards[].riskRowId":"Canonical stable ID is losslessly stored in editorV2; the compatibility adapter resolves it to the current risk-row index and rejects missing or ambiguous rows.","measures[].actionTaken":"Never infer from planned action; blank means no action has been recorded.","measures[].hazardId":"Canonical hazard ID is losslessly stored in editorV2; the compatibility projection writes the referenced hazard's one-based index.","measures[].id":"Stable editor identity. Existing arrays hydrate deterministically from sourceRevision and array index."},"fields":[["meta.dateTime","string","always","isoDateTime","deliverables.tbmBriefingStructured.meta.dateTime"],["meta.location","string","always","exactString","deliverables.tbmBriefingStructured.meta.location"],["meta.target","string","always","exactString","deliverables.tbmBriefingStructured.meta.target"],["meta.attendees","string","always","exactString","deliverables.tbmBriefingStructured.meta.attendees"],["todayWork.name","string","always","exactString","deliverables.tbmBriefingStructured.todayWork.name"],["todayWork.location","string","always","exactString","deliverables.tbmBriefingStructured.todayWork.location"],["todayWork.time","string","always","exactString","deliverables.tbmBriefingStructured.todayWork.time"],["todayWork.equipment","string[]","zero or more","orderedStringArray","deliverables.tbmBriefingStructured.todayWork.equipment"],["hazards[].id","string","always","stableId",null],["hazards[].category","\"Man\"&#124;\"Machine\"&#124;\"Media\"&#124;\"Management\"","always","strictEnum","deliverables.tbmBriefingStructured.hazards[].category"],["hazards[].description","string","always","exactString","deliverables.tbmBriefingStructured.hazards[].description"],["hazards[].riskRowId","string","always","stableId","deliverables.tbmRiskLinks[].riskRowIndex"],["hazards[].weatherSignal","string","when applicable","exactString","deliverables.tbmRiskLinks[].weatherSignal"],["hazards[].confirmQuestion","string","always","exactString","deliverables.tbmRiskLinks[].confirmQuestion"],["hazards[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty","deliverables.tbmRiskLinks[].evidenceRefs"],["measures[].id","string","always","stableId",null],["measures[].hazardId","string","always","stableId","deliverables.tbmBriefingStructured.measures[].hazardRef"],["measures[].action","string","always","exactString","deliverables.tbmBriefingStructured.measures[].action"],["measures[].owner","string","always","exactString","deliverables.tbmBriefingStructured.measures[].owner"],["measures[].verification","string","always","exactString","deliverables.tbmRiskLinks[].verification"],["measures[].actionTaken","string","after briefing","exactString",null],["measures[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty","deliverables.tbmRiskLinks[].evidenceRefs"],["stopCriteria","string[]","at least one","orderedStringArray","deliverables.tbmBriefingStructured.stopCriteria"],["confirmTopics","string[]","at least one","orderedStringArray","deliverables.tbmBriefingStructured.confirmTopics"],["photoEvidenceLocation","string","always","exactString","deliverables.tbmBriefingStructured.photoEvidenceLocation"]],"gates":["Every riskRowId resolves to exactly one riskAssessmentDraft row.","Every measure.hazardId resolves to exactly one hazard.","Every evidenceRefs ID resolves and obeys the evidence role matrix.","Generated planned actions never populate actionTaken."],"id":"DOC-05","interactions":["Import selected risk rows by stable row ID; show a mapping conflict instead of guessing when a source row no longer exists.","Edit hazards and measures independently while retaining explicit hazardId links.","Open evidence detail from the single header provenance trigger; do not render per-row provenance cards by default.","Record actionTaken only as a human-authored post-briefing observation."],"key":"tbmBriefing","primaryAction":"위험성평가에서 불러오기","primaryActionRule":"Shown as the only dominant action only when no global lifecycle action is active; editing and row commands remain secondary.","schemaOrder":["meta.dateTime","meta.location","meta.target","meta.attendees","todayWork.name","todayWork.location","todayWork.time","todayWork.equipment","hazards[].id","hazards[].category","hazards[].description","hazards[].riskRowId","hazards[].weatherSignal","hazards[].confirmQuestion","hazards[].evidenceRefs","measures[].id","measures[].hazardId","measures[].action","measures[].owner","measures[].verification","measures[].actionTaken","measures[].evidenceRefs","stopCriteria","confirmTopics","photoEvidenceLocation"],"title":"TBM/작업 전 안전점검회의","type":"TbmBriefingEditorDraft","typeBindings":[]},{"component":"TbmLogEditor","family":"attendance-and-risk-log","fieldNotes":{"attendance.actual":"Derived from workerAttendance present or late states on save; a mismatching imported value produces a validation error.","attendance.attendees":"Compatibility projection of workerAttendance.displayName for present or late workers; editorV2 remains authoritative for per-worker state.","hazardsDiscussed[].riskRowId":"Canonical stable ID maps to the current risk row index only after exact resolution.","photoEvidence.storagePath":"Descriptive legacy text only; it never proves a persisted photo asset.","workerAttendance[].actionTaken":"Human-authored follow-up only; generation leaves it blank.","workerAttendance[].displayName":"Legacy attendees hydrate one item per name with deterministic IDs and unconfirmed statuses.","workerAttendance[].signatureRef":"Opaque user-supplied reference only; it is not a share-read receipt."},"fields":[["meta.dateTime","string","always","isoDateTime","deliverables.tbmLogStructured.meta.dateTime"],["meta.location","string","always","exactString","deliverables.tbmLogStructured.meta.location"],["meta.workType","string","always","exactString","deliverables.tbmLogStructured.meta.workType"],["meta.instructor","string","always","exactString","deliverables.tbmLogStructured.meta.instructor"],["attendance.expected","integer","always","strictInteger","deliverables.tbmLogStructured.attendance.expected"],["attendance.actual","integer","always","strictInteger","deliverables.tbmLogStructured.attendance.actual"],["attendance.attendees","string[]","zero or more","orderedStringArray","deliverables.tbmLogStructured.attendance.attendees"],["attendance.absenceReason","string","when actual differs from expected","exactString","deliverables.tbmLogStructured.attendance.absenceReason"],["attendance.confirmationMethod","string","always","exactString","deliverables.tbmLogStructured.attendance.confirmationMethod"],["todayWork.name","string","always","exactString","deliverables.tbmLogStructured.todayWork.name"],["todayWork.location","string","always","exactString","deliverables.tbmLogStructured.todayWork.location"],["todayWork.time","string","always","exactString","deliverables.tbmLogStructured.todayWork.time"],["todayWork.equipment","string[]","zero or more","orderedStringArray","deliverables.tbmLogStructured.todayWork.equipment"],["workerConfirmations","string[]","at least one","orderedStringArray","deliverables.tbmLogStructured.workerConfirmations"],["hazardsDiscussed[].id","string","always","stableId",null],["hazardsDiscussed[].category","\"Man\"&#124;\"Machine\"&#124;\"Media\"&#124;\"Management\"","always","strictEnum","deliverables.tbmLogStructured.hazardsDiscussed[].category"],["hazardsDiscussed[].description","string","always","exactString","deliverables.tbmLogStructured.hazardsDiscussed[].description"],["hazardsDiscussed[].riskRowId","string","when linked","stableId","deliverables.tbmLogStructured.hazardsDiscussed[].relatedRiskRowIndex"],["hazardsDiscussed[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty","deliverables.tbmRiskLinks[].evidenceRefs"],["hazardsDiscussed[].verification","string","always","exactString","deliverables.tbmRiskLinks[].verification"],["hazardsDiscussed[].actionTaken","string","after TBM","exactString",null],["safetyEducation.topic","string","always","exactString","deliverables.tbmLogStructured.safetyEducation.topic"],["safetyEducation.keyPoints","string[]","at least one","orderedStringArray","deliverables.tbmLogStructured.safetyEducation.keyPoints"],["safetyEducation.materials","string","always","exactString","deliverables.tbmLogStructured.safetyEducation.materials"],["unaddressedItems[].id","string","always","stableId",null],["unaddressedItems[].item","string","always","exactString","deliverables.tbmLogStructured.unaddressedItems[].item"],["unaddressedItems[].plannedAction","string","always","exactString","deliverables.tbmLogStructured.unaddressedItems[].plannedAction"],["unaddressedItems[].owner","string","always","exactString","deliverables.tbmLogStructured.unaddressedItems[].owner"],["unaddressedItems[].dueDate","string","always","localDate","deliverables.tbmLogStructured.unaddressedItems[].dueDate"],["unaddressedItems[].actionTaken","string","when completed","exactString",null],["photoEvidence.captureLocations","string[]","zero or more","orderedStringArray","deliverables.tbmLogStructured.photoEvidence.captureLocations"],["photoEvidence.storagePath","string","always","exactString","deliverables.tbmLogStructured.photoEvidence.storagePath"],["signatures.author","string","human-only","exactString","deliverables.tbmLogStructured.signatures.author"],["signatures.reviewer","string","human-only","exactString","deliverables.tbmLogStructured.signatures.reviewer"],["signatures.approver","string","human-only","exactString","deliverables.tbmLogStructured.signatures.approver"]],"gates":["attendance.actual equals present plus late worker rows.","Understanding confirmation requires present or late attendance, confirmedAt, and a human actor.","Every riskRowId and evidenceRefs value resolves exactly.","A ShareReadConfirmation never satisfies attendance, understanding, signature, or TBM completion."],"id":"DOC-06","interactions":["Use WorkerAttendanceEditor for per-worker attendance, understanding, signature method, actor, and follow-up; do not reuse share-read controls.","Link discussed hazards to stable risk row IDs and reveal evidence in the single provenance drawer.","Derive actual attendance from worker rows and expose discrepancies before save.","Keep author, reviewer, and approver blank for generated content; identity can only be attached by an authenticated human action."],"key":"tbmLogDraft","primaryAction":"참석 확인","primaryActionRule":"The only dominant document command during editing; lifecycle Save/Revalidate/Confirm/Share supersedes it when present.","schemaOrder":["@WorkerAttendanceConfirmation:workerAttendance[]","meta.dateTime","meta.location","meta.workType","meta.instructor","attendance.expected","attendance.actual","attendance.attendees","attendance.absenceReason","attendance.confirmationMethod","todayWork.name","todayWork.location","todayWork.time","todayWork.equipment","workerConfirmations","hazardsDiscussed[].id","hazardsDiscussed[].category","hazardsDiscussed[].description","hazardsDiscussed[].riskRowId","hazardsDiscussed[].evidenceRefs","hazardsDiscussed[].verification","hazardsDiscussed[].actionTaken","safetyEducation.topic","safetyEducation.keyPoints","safetyEducation.materials","unaddressedItems[].id","unaddressedItems[].item","unaddressedItems[].plannedAction","unaddressedItems[].owner","unaddressedItems[].dueDate","unaddressedItems[].actionTaken","photoEvidence.captureLocations","photoEvidence.storagePath","signatures.author","signatures.reviewer","signatures.approver"],"title":"TBM 기록","type":"TbmLogEditorDraft","typeBindings":[{"currentOverrides":{"displayName":"deliverables.tbmLogStructured.attendance.attendees[]"},"prefix":"workerAttendance[]","type":"WorkerAttendanceConfirmation"}]},{"component":"EducationRecordEditor","family":"curriculum-and-attendance","fieldNotes":{},"fields":[["educationName","string","always","exactString","deliverables.educationRecordStructured.educationName"],["type","\"정기교육\"&#124;\"특별교육\"&#124;\"외국인교육\"&#124;\"신규자교육\"&#124;\"관리감독자교육\"&#124;\"기타\"","always","strictEnum","deliverables.educationRecordStructured.type"],["dateTime","string","always","isoDateTime","deliverables.educationRecordStructured.dateTime"],["location","string","always","exactString","deliverables.educationRecordStructured.location"],["target","string","always","exactString","deliverables.educationRecordStructured.target"],["instructor","string","human-only","exactString","deliverables.educationRecordStructured.instructor"],["confirmer","string","human-only","exactString","deliverables.educationRecordStructured.confirmer"],["curriculum[].id","string","always","stableId",null],["curriculum[].topic","string","always","exactString","deliverables.educationRecordStructured.curriculum[].topic"],["curriculum[].lawCitation","string","when applicable","exactString","deliverables.educationRecordStructured.curriculum[].lawCitation"],["curriculum[].keyPoints","string[]","at least one","orderedStringArray","deliverables.educationRecordStructured.curriculum[].keyPoints"],["curriculum[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty",null],["curriculum[].actionTaken","string","after education","exactString",null],["understandingCheck","string","always","exactString","deliverables.educationRecordStructured.understandingCheck"],["tbmLink","string","always","exactString","deliverables.educationRecordStructured.tbmLink"],["followupRecommendation","string","always","exactString","deliverables.educationRecordStructured.followupRecommendation"]],"gates":["Each curriculum row has a topic, key point, and valid evidence role for any lawCitation.","Understanding confirmation requires present or late attendance and human actor provenance.","Share-read receipts do not count as education attendance or signatures."],"id":"DOC-07","interactions":["Edit curriculum rows and attach evidence without exposing source links on the default document surface.","Reuse WorkerAttendanceEditor because the per-worker attendance and understanding semantics exactly match TBM records.","Keep generated instructor and confirmer identity empty until authenticated human input."],"key":"safetyEducationRecordDraft","primaryAction":"교육 대상 확인","primaryActionRule":"Secondary to the active global lifecycle action and never combined with save, confirmation, or share in one dominant button.","schemaOrder":["@WorkerAttendanceConfirmation:workerAttendance[]","educationName","type","dateTime","location","target","instructor","confirmer","curriculum[].id","curriculum[].topic","curriculum[].lawCitation","curriculum[].keyPoints","curriculum[].evidenceRefs","curriculum[].actionTaken","understandingCheck","tbmLink","followupRecommendation"],"title":"안전보건교육 기록","type":"EducationRecordEditorDraft","typeBindings":[{"currentOverrides":{},"prefix":"workerAttendance[]","type":"WorkerAttendanceConfirmation"}]},{"component":"EmergencyResponseEditor","family":"scenario-response-plan","fieldNotes":{},"fields":[["planTitle","string","always","exactString",null],["siteName","string","always","exactString",null],["effectiveDate","string","always","localDate",null],["emergencyCoordinator","string","always","exactString",null],["alarmMethods","string[]","at least one","orderedStringArray",null],["assemblyPoints[].id","string","always","stableId",null],["assemblyPoints[].name","string","always","exactString",null],["assemblyPoints[].location","string","always","exactString",null],["assemblyPoints[].capacity","integer","always","strictInteger",null],["assemblyPoints[].accessibilityNote","string","when applicable","exactString",null],["contacts[].id","string","always","stableId",null],["contacts[].role","string","always","exactString",null],["contacts[].name","string","human-only","exactString",null],["contacts[].phone","string","human-only","exactString",null],["contacts[].alternatePhone","string","when applicable","exactString",null],["scenarios[].id","string","always","stableId",null],["scenarios[].hazard","string","always","exactString",null],["scenarios[].riskRowIds","string[]","at least one","stableIdArrayNonEmpty",null],["scenarios[].trigger","string","always","exactString",null],["scenarios[].immediateActions","string[]","at least one","orderedStringArray",null],["scenarios[].evacuationRoute","string","always","exactString",null],["scenarios[].responsibleRole","string","always","exactString",null],["scenarios[].callOrder","string[]","at least one","orderedStringArray",null],["scenarios[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty",null],["scenarios[].verification","string","always","exactString",null],["scenarios[].actionTaken","string","after drill or incident","exactString",null],["workerAccountingMethod","string","always","exactString",null],["drillSchedule","string","always","exactString",null],["postIncidentReporting","string","always","exactString",null]],"gates":["Every scenario resolves at least one risk row and one eligible evidence reference.","Every scenario names a route, responsible role, verification method, and call order.","Generated output cannot set human names, phone numbers, completion, or approval."],"id":"DOC-08","interactions":["Edit contacts, assembly points, and scenarios as separate tables with stable IDs.","Link scenarios to risk rows and evidence; show provenance only through the header drawer.","Progressively disclose contact details and drill history."],"key":"emergencyResponseDraft","primaryAction":"비상 시나리오 추가","primaryActionRule":"A secondary document command whenever a global lifecycle action is available.","schemaOrder":["planTitle","siteName","effectiveDate","emergencyCoordinator","alarmMethods","assemblyPoints[].id","assemblyPoints[].name","assemblyPoints[].location","assemblyPoints[].capacity","assemblyPoints[].accessibilityNote","contacts[].id","contacts[].role","contacts[].name","contacts[].phone","contacts[].alternatePhone","scenarios[].id","scenarios[].hazard","scenarios[].riskRowIds","scenarios[].trigger","scenarios[].immediateActions","scenarios[].evacuationRoute","scenarios[].responsibleRole","scenarios[].callOrder","scenarios[].evidenceRefs","scenarios[].verification","scenarios[].actionTaken","workerAccountingMethod","drillSchedule","postIncidentReporting"],"title":"비상대응 절차","type":"EmergencyResponseEditorDraft","typeBindings":[]},{"component":"ImprovementEvidenceEditor","family":"before-after-improvement","fieldNotes":{"improvements[].actionTaken":"Never copied from a generated recommendation.","improvements[].photoState":"Exactly the common Phase A state. Wave 3 has no hydrated/stored pixel state because existing GET/POST responses expose no photo asset ID or storage path.","improvements[].reflectedDocumentKeys":"Adapter uses the exact 12-key title map in both directions and preserves unmapped legacy labels in unmapped; it never guesses.","improvements[].reviewDecision":"Remains null until PHOTO-002 authority is approved and returns an immutable authenticated event.","improvements[].reviewEventDigest":"Binds the immutable event but never copies the top-level generationEvidence seal into the document.","improvements[].serverImprovementId":"Non-null proves only an improvement candidate row response/reload, never a photo asset row, review event, evidence eligibility, or authorized pixel URL."},"fields":[["siteTimeZone","string","always","exactString",null],["improvements[].localId","string","always","stableId",null],["improvements[].taskLabel","string","always","exactString","GET /api/workpacks/[id]/improvements -&gt; improvements[].task_label or POST form.taskLabel"],["improvements[].hazardLabel","string","always","exactString","GET /api/workpacks/[id]/improvements -&gt; improvements[].hazard_label or POST form.hazardLabel"],["improvements[].improvementText","string","always","exactString","GET /api/workpacks/[id]/improvements -&gt; improvements[].improvement_text or POST form.improvementText"],["improvements[].reflectedDocumentKeys","DocumentKey[]","at least one","documentKeyArray","GET /api/workpacks/[id]/improvements -&gt; improvements[].reflected_documents or POST form.reflectedDocuments"],["improvements[].beforeFileName","string&#124;null","always","nullableExactString","GET /api/workpacks/[id]/improvements -&gt; improvements[].photo_summary.beforePhotoName or POST beforePhoto.name or null"],["improvements[].afterFileName","string&#124;null","always","nullableExactString","GET /api/workpacks/[id]/improvements -&gt; improvements[].photo_summary.afterPhotoName or POST afterPhoto.name or null"],["improvements[].beforeDigest","Sha256Digest&#124;null","when source bytes are locally available","nullableSha256HexDigest","editorV2/export manifest only; never fabricated from filename"],["improvements[].afterDigest","Sha256Digest&#124;null","when source bytes are locally available","nullableSha256HexDigest","editorV2/export manifest only; never fabricated from filename"],["improvements[].pairId","string&#124;null","when both source digests exist","nullableStableId","deterministic local pair identity until an authoritative confirmed event exists"],["improvements[].captureNote","string","always","exactString",null],["improvements[].actionTaken","string","human-only","exactString",null],["improvements[].evidenceRefs","string[]","zero or more","stableIdArrayAllowEmpty",null],["improvements[].photoState","\"not_selected\"&#124;\"local_display_only\"&#124;\"upload_in_flight\"&#124;\"server_metadata_only\"&#124;\"upload_failed\"","always","strictEnum","Total mapping from the common Phase A photo state machine; successful POST/GET can yield server_metadata_only only"],["improvements[].serverImprovementId","string&#124;null","always","nullableStableId","POST /api/workpacks/[id]/improvements -&gt; improvementId or GET improvements[].id or null"],["improvements[].reviewStatus","string","after successful response","exactString","POST /api/workpacks/[id]/improvements -&gt; reviewStatus or GET improvements[].review_status"],["improvements[].sourceType","\"manual\"&#124;\"photo_analysis\"&#124;\"operator_note\"","after successful response","strictEnum","POST /api/workpacks/[id]/improvements -&gt; sourceType or GET improvements[].source_type"],["improvements[].reviewDecision","\"confirmed\"&#124;\"rejected\"&#124;null","authoritative review event only","nullableStrictEnum","null in Wave 3; future authenticated review event"],["improvements[].reviewEventId","string&#124;null","authoritative review event only","nullableStableId","null until approved route returns immutable event identity"],["improvements[].acceptedControlText","string&#124;null","confirmed event only","nullableExactString","null until authenticated human confirmation"],["improvements[].rejectionReason","string&#124;null","rejected event only","nullableExactString","null until authenticated human rejection"],["improvements[].candidateRevision","integer&#124;null","authoritative review event only","nullableStrictInteger","null until approved transaction binds the candidate revision"],["improvements[].resultingRevision","integer&#124;null","authoritative review event only","nullableStrictInteger","null until approved transaction writes candidateRevision+1"],["improvements[].reviewEventDigest","Sha256Digest&#124;null","authoritative review event only","nullableSha256HexDigest","null until approved transaction returns canonical event digest"],["improvements[].verificationNote","string","human-only","exactString",null]],"gates":["Never serialize File, Blob, object URL, assetId, or storagePath into editorV2.","Before/After comparison requires both filenames and typed source digests; one-sided selections remain local_display_only.","server_metadata_only requires an actual successful POST response or matching GET row and a non-null serverImprovementId but remains candidate-only.","reviewDecision/reviewEventId/acceptedControlText/rejectionReason/candidateRevision/resultingRevision/reviewEventDigest stay null until PHOTO-002 authority is explicitly approved and atomically implemented.","No export may imply that server_metadata_only pixels were embedded or human-confirmed; manifests preserve all metadata and state."],"id":"DOC-09","interactions":["Select and compare Before/After files locally; use object URLs only in ephemeral component state and revoke them on replace, remove, or unmount.","Submit the existing improvements endpoint only when a stored workpack exists; record the returned improvementId as a candidate but never claim the photos are reloadable or reviewed.","After reload, show filenames with server_metadata_only and preview unavailable; never fabricate thumbnail, assetId, or storagePath.","A candidate cannot enter evidenceRefs or share until PHOTO-002 confirms matching before/after digests and accepted control text.","Defer hydratable stored photos and confirmed/rejected persistence until an authorized response/route exists."],"key":"photoEvidenceDraft","primaryAction":"Before/After 선택","primaryActionRule":"The only dominant document command while adding a local photo pair; lifecycle actions supersede it after any edit.","schemaOrder":["siteTimeZone","improvements[].localId","improvements[].taskLabel","improvements[].hazardLabel","improvements[].improvementText","improvements[].reflectedDocumentKeys","improvements[].beforeFileName","improvements[].afterFileName","improvements[].beforeDigest","improvements[].afterDigest","improvements[].pairId","improvements[].captureNote","improvements[].actionTaken","improvements[].evidenceRefs","improvements[].photoState","improvements[].serverImprovementId","improvements[].reviewStatus","improvements[].sourceType","improvements[].reviewDecision","improvements[].reviewEventId","improvements[].acceptedControlText","improvements[].rejectionReason","improvements[].candidateRevision","improvements[].resultingRevision","improvements[].reviewEventDigest","improvements[].verificationNote"],"title":"사진/증빙","type":"PhotoEvidenceEditorDraft","typeBindings":[]},{"component":"ForeignWorkerPrintEditor","family":"multilingual-print-packet","fieldNotes":{},"fields":[["packetTitle","string","always","exactString",null],["sourceDocumentKeys","DocumentKey[]","at least one","documentKeyArray",null],["sourceRevision","integer","always","strictInteger",null],["evidenceDigest","string","always","digest",null],["targetWorkerIds","string[]","at least one","stableIdArrayNonEmpty",null],["variants[].id","string","always","stableId",null],["variants[].code","string","always","exactString","deliverables.foreignWorkerLanguages[].code"],["variants[].label","string","always","exactString","deliverables.foreignWorkerLanguages[].label"],["variants[].nativeLabel","string","always","exactString","deliverables.foreignWorkerLanguages[].nativeLabel"],["variants[].rationale","string","always","exactString","deliverables.foreignWorkerLanguages[].rationale"],["variants[].lines","string[]","at least one","orderedStringArray","deliverables.foreignWorkerLanguages[].lines"],["variants[].evidenceRefs","string[]","at least one","stableIdArrayNonEmpty",null],["printFooter","string","always","exactString",null],["workerConfirmationRequired","boolean","always","strictBoolean",null]],"gates":["Each variant has unique code, native label, nonempty lines, and eligible evidence.","Source revision and evidence digest must match the current human-confirmed workpack before print/export.","Generated translation is review_pending and never counts as worker understanding."],"id":"DOC-10","interactions":["Generate print variants from current source documents, then edit each language independently.","Display source revision and evidence freshness in status, with full provenance in the one evidence drawer.","Print output can request later WorkerAttendance confirmation but cannot create it."],"key":"foreignWorkerBriefing","primaryAction":"언어 추가","primaryActionRule":"A secondary document command whenever the global lifecycle action is visible.","schemaOrder":["packetTitle","sourceDocumentKeys","sourceRevision","evidenceDigest","targetWorkerIds","variants[].id","variants[].code","variants[].label","variants[].nativeLabel","variants[].rationale","variants[].lines","variants[].evidenceRefs","printFooter","workerConfirmationRequired"],"title":"외국인 근로자 출력본","type":"ForeignWorkerPrintDraft","typeBindings":[]},{"component":"ForeignWorkerTransmissionEditor","family":"versioned-share-blocks","fieldNotes":{},"fields":[["shareBlocks[].recipientWorkerIds","string[]","at least one","stableIdArrayNonEmpty",null],["shareBlocks[].bodyLines","string[]","at least one","orderedStringArray","deliverables.foreignWorkerLanguages[].lines"]],"gates":["Every share block contains owning documentKey, stable id/blockId, sourceDocumentKeys, sourceRevision, and evidenceDigest.","Any source, evidence, language, audience, or confirmation change sets state=stale and clears shareSessionId.","ShareReadConfirmation must match the block and server session but has no WorkerAttendance authority."],"id":"DOC-11","interactions":["Rebuild stale local blocks from current sourceRevision and evidenceDigest, creating a new block ID while retaining intended recipients only.","Create share sessions and dispatch only after REVISION-001 plus blocked-server-share-authority confirm a human-confirmed workpack and matching freshness; current implementation stays disabled.","Show read receipts as share history; never promote them to attendance, signature, TBM completion, education completion, or understanding."],"key":"foreignWorkerTransmission","primaryAction":"공유 블록 다시 만들기","primaryActionRule":"Shown as the sole dominant action only for stale blocks; otherwise the global lifecycle action owns emphasis.","schemaOrder":["@ShareBlockBase:shareBlocks[]","@ShareReadConfirmation:shareReadConfirmations[]","shareBlocks[].recipientWorkerIds","shareBlocks[].bodyLines"],"title":"외국인 근로자 전송본","type":"ForeignWorkerTransmissionDraft","typeBindings":[{"currentOverrides":{"languageCode":"deliverables.foreignWorkerLanguages[].code"},"prefix":"shareBlocks[]","type":"ShareBlockBase"},{"currentOverrides":{},"prefix":"shareReadConfirmations[]","type":"ShareReadConfirmation"}]},{"component":"FieldShareMessageEditor","family":"versioned-share-blocks","fieldNotes":{},"fields":[["shareBlocks[].subject","string","always","exactString",null],["shareBlocks[].body","string","always","exactString","deliverables.kakaoMessage"],["shareBlocks[].recipientGroup","string","always","exactString",null]],"gates":["Every block has owning documentKey, stable id/blockId, current authoritative sourceRevision, and evidenceDigest.","Dispatch is blocked until REVISION-001 and blocked-server-share-authority pass; Wave 4 does not install server binding.","Read receipts remain share acknowledgments only."],"id":"DOC-12","interactions":["Build concise site messages from selected source documents without exposing provenance links on the default surface.","Rebuild stale blocks before session creation or dispatch.","Keep all provenance, audit, materialization, and review_required detail in the evidence drawer and export manifest."],"key":"kakaoMessage","primaryAction":"공유 블록 다시 만들기","primaryActionRule":"Shown as the sole dominant action only for stale blocks; otherwise the global lifecycle action owns emphasis.","schemaOrder":["@ShareBlockBase:shareBlocks[]","@ShareReadConfirmation:shareReadConfirmations[]","shareBlocks[].subject","shareBlocks[].body","shareBlocks[].recipientGroup"],"title":"현장 공유 메시지","type":"FieldShareMessageDraft","typeBindings":[{"currentOverrides":{},"prefix":"shareBlocks[]","type":"ShareBlockBase"},{"currentOverrides":{},"prefix":"shareReadConfirmations[]","type":"ShareReadConfirmation"}]}] |
| "evidencePresentation" | "object" | 6 | 75 | 3 | "sha256:9de6d06208dd08ca21a3c6589514a4ccd6aa3cd50f3dc23a341e7a6d46dbf049" | {"countSource":{"consumers":["the single header trigger","EvidenceDetailsDrawer section headings"],"derivation":["Deduplicate evidence IDs referenced by the selected document.","N is the number of distinct resolved or unresolved referenced IDs; no docpack/header/left-rail count is read.","M is the number of those IDs with unresolved resolution, review_required quality or obligation, non-current lifecycle, missing target, digest mismatch, or invalid external link when a link action is requested.","Partition the same IDs into directEvidence, supportingEvidence, lawActions, and reviewRequired for drawer sections.","On selector error render 근거 수치 확인 불가 and lock confirmation/share; never fall back to independently computed counts."],"forbiddenConsumers":["left document rail","preview badge","share readiness summary","below-editor panels"],"inputs":["document content evidenceRefs and inlineCitationRefs","deliverables.editorV2.evidence","current materializationDigest","current reviewArtifacts"],"plannedPath":"lib/workpack-editor-evidence-summary.ts","scope":"currently selected DocumentKey","selector":"selectDocumentEvidenceSummary"},"defaultForbidden":["yellow preview evidence badge","persistent right evidence rail","duplicate left evidence-readiness summary","directEvidence cards","DB harness cards","safety-control readiness cards","supporting-reference lists","law open-action lists","below-editor result summary","below-editor citation list","below-editor operation graph","unvalidated external safety links"],"defaultPriority":["document selector","document title and lifecycle status","edit and download secondary commands","preview or structured editor","share readiness"],"drawer":{"accessibility":["role=dialog and aria-modal=true","labelled by 근거 및 검수 heading","focus trapped while open","Escape closes","trigger focus restored on close","background inert while open"],"component":"EvidenceDetailsDrawer","desktop":"Fixed overlay on the inline end, width clamp(360px,42vw,480px); it overlays and never becomes a grid column or shrinks the preview.","mobile":"Full-width modal sheet, max-height 100dvh, one internal scrolling surface, sticky close/title row, no horizontal overflow.","owns":["full EditorEvidenceRef provenance","directEvidence","supportingEvidence","DB harness","safety-control readiness","ontology QA","qualityContract","generation evidence and materialization digests","review_required and unresolved work","law open actions","validated external safety links","audit history and raw legacy appendix","result summary","citation list","operation graph"],"title":"근거 및 검수"},"externalLinks":{"brokenUrlRegression":"https://www.kosha.or.kr/kosha/data/guidanceX.do must never appear in a rendered href unless a future runtime verification explicitly succeeds for that exact URL.","candidateCatalog":"lib/official-safety-resources.ts","clickableWhen":["reference.verified === true from the current runtime verification result","URL protocol is https","normalized URL exactly matches the verified URL","validation result belongs to the current evidence/materialization digest"],"currentValidationSeam":"lib/kosha.ts fetchKoshaReferences -&gt; verifyReference -&gt; reference.verified","defaultSurfaceRule":"No external safety-resource card or link is rendered on the default document surface.","renderLocation":"EvidenceDetailsDrawer only","trustRule":"Hardcoded candidate URLs are not trusted links.","unvalidatedBehavior":"Omit href and external-link action; a disabled text row may say 링크 확인 필요 inside the drawer only."},"trigger":{"accessibleBehavior":"button with aria-expanded and aria-controls; accessible name is the rendered text","component":"EvidenceSummaryTrigger","exactTemplate":"근거 N건 · 확인 필요 M건","visualStyle":"compact neutral secondary control; never yellow and never primary"}} |
| "export" | "object" | 11 | 84 | 3 | "sha256:9f7dc4c7bc8fc0c53e1f82f284aa288af1e3eac4e8fa13c70f14b2f3d5c33a91" | {"actualRoutes":[{"id":"EXPORT-XLSX","method":"POST","path":"app/api/export/xlsx/route.ts","roundTrip":"parse hidden _safeclaw_editor_v2!A1 manifest","url":"/api/export/xlsx"},{"id":"EXPORT-PDF","method":"POST","path":"app/api/export/pdf/route.ts","roundTrip":"extract deterministic field-path/value appendix plus manifest digest","url":"/api/export/pdf?format=html"},{"id":"EXPORT-HWP","method":"POST","path":"app/api/export/hwp/route.ts","roundTrip":"parse deterministic SafeClaw 편집 data from binary HWP","url":"/api/export/hwp"}],"actualSeamsAtTarget":[{"clientPath":"components/WorkpackEditor.tsx","clientSymbol":"downloadXlsx","id":"EXPORT-XLSX","kind":"server_post","serverPath":"app/api/export/xlsx/route.ts","serverSymbol":"POST","targetContract":"single or one of five structured modes","url":"/api/export/xlsx"},{"clientPath":"components/WorkpackEditor.tsx","clientSymbol":"printPdf","id":"EXPORT-PDF","kind":"server_post","serverPath":"app/api/export/pdf/route.ts","serverSymbol":"POST","targetContract":"returns printable HTML at the editor call site","url":"/api/export/pdf?format=html"},{"clientPath":"components/WorkpackEditor.tsx","clientSymbol":"downloadHwp","id":"EXPORT-HWP","kind":"server_binary_post","serverPath":"app/api/export/hwp/route.ts","serverSymbol":"POST","targetContract":"binary .hwp Blob response","url":"/api/export/hwp"},{"clientPath":"components/WorkpackEditor.tsx","clientSymbol":"buildHwpxWithRhwp -&gt; downloadHwpx","id":"EXPORT-HWPX-CLIENT","kind":"client_builder","serverPath":null,"serverSymbol":null,"targetContract":"@rhwp/core HwpDocument.exportHwpx; no editor export route","url":null}],"binaryByteEqualityRequired":false,"currentRouteCompatibility":{"editedRiskCorrection":"V2 must stop sending edited=true with structured rows removed; project edited canonical risk rows explicitly.","otherDocuments":"single legacy rows","riskAssessmentDraft":"single plus structuredRiskRows","safetyEducationRecordDraft":"educationRecordStructured","tbmBriefing":"tbmBriefingStructured","tbmLogDraft":"tbmLogStructured","workPermitDraft":"permitInspectionStructured","workPlanDraft":"workPlanStructured"},"excludedTargetSeam":{"method":"GET","path":"app/api/export/hwpx-template/route.ts","reason":"Exists at f98ae7d but WorkpackEditor does not call it; it is not an editor HWPX round-trip exit."},"manifest":{"content":"canonical documents, evidence refs, revision, materializationDigest, evidenceDigest, and human confirmation metadata","hwpBinaryLocation":"binary HWP table/record headed SafeClaw 편집 데이터 emitted by the POST route builder; a binary HWP parser reconstructs deterministic field-path/value rows and digest","hwpxLocation":"client-side @rhwp document text appendix between deterministic SafeClaw editor-v2 begin/end markers; HWPX text extraction reconstructs the canonical manifest","pdfLocation":"final appendix headed SafeClaw 편집 데이터 with deterministic field-path/value rows and manifest digest","schema":"safeclaw-workpack-editor-export/v2","visibleEvidenceRule":"Editable/visible submission bodies retain concise inline citation markers. Full provenance, DB harness, ontology QA, materialization, review_required, and audit appendices are generated from separate manifest roots and never become editable body text.","xlsxLocation":"hidden worksheet named _safeclaw_editor_v2, cell A1 canonical JSON"},"pureCodecLimit":"Wave 0 may eventually test canonical encode/decode fixtures in memory only. It owns no export route, WorkpackEditor call site, binary parser, browser, or round-trip exit and may not print export PASS.","roundTripDefinition":["Legacy mixed string -&gt; versioned body/appendix split -&gt; structured parse -&gt; serialize -&gt; split preserves editable fields and every raw appendix line without exposing appendix text to an editor.","draft -&gt; dual projection -&gt; JSON serialize -&gt; buildReopenData -&gt; adapter deep-equals normalized draft","XLSX unzip/load and parse _safeclaw_editor_v2 A1 deep-equals export manifest","PDF returned-HTML/text extraction contains every deterministic field-path/value record and matching digest","client-built HWPX text extraction parses the deterministic begin/end appendix and deep-equals the export manifest","binary HWP parser recovers every deterministic field-path/value record and matching digest","No parser may substitute defaults without emitting a blocking issue and preserving the raw value"],"roundTripOwner":{"entryGate":"BLOCKED_PENDING_USER_DB_APPROVAL and independent spec PASS","exitRule":"Only implementation-mode evidence may claim route/client round-trip PASS.","reason":"wave5 alone owns WorkpackEditor plus HWP/PDF/XLSX route call sites and export integration tests; it also owns the client-side buildHwpxWithRhwp integration hunk.","wave":"wave5"},"semanticDeterminism":"Same canonical envelope, revision, evidenceDigest, and stable row order produce the same legacy projection, structured projection, and embedded export manifest.","unknownFieldPolicy":{"invalidKnownType":"Fail closed; preserve original value in unmapped; never coerce/default silently.","knownOptionalMissing":"Omit and preserve absence; do not inject null.","nonReservedUnknown":"Move to extensions: JsonObject and merge back losslessly.","nullableNull":"Preserve explicit null only for nullable fields.","reservedUnknownOrCollision":"Fail closed and preserve original JSON in unmapped."}} |
| "humanParityContract" | "object" | 11 | 44 | 3 | "sha256:99c861ace8ae525b36b08d69a2feb60c1dab44a778506f6f8c37d6af8c2acfdf" | {"comparison":"SAFECLAW-NORMATIVE must byte-equal structural output for the complete immutable candidate JSON. SAFECLAW-HUMAN must byte-equal humanRequirements. Markdown outside both blocks is normalized and hash-bound below, so neither a generated block nor an embedded mirror can self-authorize or hide MD-only drift.","deliberateMismatch":["normative-parity","md-prose","json-model","json-document-primary-action","json-unknown-domain"],"humanEnd":"&lt;!-- SAFECLAW-HUMAN:END --&gt;","humanRequirements":[["HP-001","Hold","Status is HOLD_PENDING_FRESH_REVIEW and the entire implementation program, including Wave 0, remains BLOCKED_PENDING_USER_DB_APPROVAL until a fresh independent spec PASS and explicit user DB authority approval outside repository-authored evidence both exist."],["HP-002","Provenance","The target-ready candidate has source base, integration target, and direct parent f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5; its evidence-only commit must directly parent the candidate."],["HP-003","Exports","XLSX, PDF HTML, and binary HWP are server POST exits; HWPX is built client-side by buildHwpxWithRhwp. The template GET route is not the editor HWPX call site."],["HP-004","Workbench","The default surface has one compact evidence trigger and no yellow evidence badge, persistent right rail, duplicate provenance summaries, mixed provenance textarea, or below-editor audit panels; the drawer owns provenance and review detail."],["HP-005","Documents","Exactly 12 document-specific schemas remain, with risk assessment, TBM briefing, and TBM log first after approval; shared primitives never collapse them into one universal textarea or 12 copied implementations."],["HP-006","Trust","The current repository cannot authenticate a Codex/user approval event. Claims are closed zero-execution declarations, future approval/provider/CI/DOM requirements accept no result fields, evidence time is strict RFC3339 and no more than 300 seconds ahead of guarded validation time, and implementation mode always returns IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL."],["HP-007","Typography","Browser executions are 0. After approval, tests generated from the locator census must apply one root typography-token policy at devicePixelRatio 1 and visualViewport scale 1, then measure ratios, reflow, fixed/sticky containment, cross-parent overlap, clipping, transforms, zoom, nested scroll, and mobile editor start."],["HP-008","Photo","A photo review event binds analysis identity and canonical payload snapshot, model provenance, candidate control identities and text digests, before/after image SHA-256 values, reviewer confirmation, transaction/root operation identity, revision, seal, and event digest; raw photo bytes remain site memory only."],["HP-009","Conflicts","The timestamped conflict ledger is a captured snapshot. Unrelated parallel head or dirty changes do not block work; only target-source changes or intersections with the planned owned/read-only/test authority surface require amendment and fresh review."],["HP-010","Readiness","This artifact proves specification consistency only. It does not prove browser behavior, export round trips, server revision authority, photo persistence, share freshness, implementation readiness, independent PASS, or user DB approval."]],"humanStart":"&lt;!-- SAFECLAW-HUMAN:BEGIN --&gt;","markdownEnd":"&lt;!-- SAFECLAW-NORMATIVE:END --&gt;","markdownStart":"&lt;!-- SAFECLAW-NORMATIVE:BEGIN --&gt;","proseNormalization":"Replace the complete SAFECLAW-NORMATIVE and SAFECLAW-HUMAN blocks, including their contents, with their original marker pair and one fixed placeholder line; normalize CRLF to LF; preserve every other byte; hash UTF-8 with SHA-256.","proseSha256":"sha256:5bc49c258ddc1783f79fcc3500d7d6c1fdf1f9609841d5304974d21d426b5766","renderer":"validate-contract.mjs renderNormativeMarkdown","topLevelEnumeration":"Object.keys(spec).sort(); no allowlist. Render one row per top-level domain with path, kind, direct child count, recursive leaf count, max depth, typed SHA-256, and complete nested canonical normalized value. Render a separate root shape/digest row without duplicating the full value."} |
| "implementation" | "object" | 9 | 556 | 5 | "sha256:1ae1f5ddbafe1c8a6c04c1abd227d16a1e6df0abba862c8520f96111a1d97c61" | {"acceptance":[["PARITY-001","spec.json is canonical; SAFECLAW-NORMATIVE enumerates every top-level domain without an allowlist, each row includes its complete nested canonical value, and the independent root digest binds every model/document/field/primaryAction value."],["PARITY-002","SAFECLAW-HUMAN byte-equals canonical requirements and prose outside both generated blocks is bound by normalized typed SHA-256; MD-only prose and JSON-only model, document primaryAction, or unknown-domain mutations exit nonzero."],["RANGE-001","sourceBase=currentIntegrationTarget=remediationParent=f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5; the target-ready candidate is a single direct child of f98 and its evidence-only commit is a direct child of the candidate."],["SCOPE-001","The candidate commit changes spec.md/spec.json/validate-contract.mjs only; its child evidence commit adds review-evidence.json only. No product, product test, package, CSS, API, DB, schema, migration, lock, or data file changes."],["DOC-001","Exactly 12 DocumentKeys and titles occur in production order."],["COMPONENT-001","WorkpackSummaryEditor and WorkPermitEditor are both file basenames and named exports; SummaryEditor and PermitInspectionEditor aliases are forbidden."],["OWNERSHIP-001","Every planned component, primitive, type module, product path, and test path has exactly one wave write owner; blocked authority paths belong to no executable wave."],["RISK-001","Expanded RiskAssessmentEditorRow is id plus the exact 21 RiskAssessmentRow names; hazard4M, existingControls, dueDate, and reason aliases are absent."],["FIELD-001","Every expanded field resolves a codec and derives exact editorV2, legacy fallback, export manifest, and reload/XLSX/PDF/HWP/HWPX paths."],["FIELD-002","Zero-or-more ID arrays use stableIdArrayAllowEmpty, non-empty ID arrays use stableIdArrayNonEmpty, and nullable identifiers use nullableStableId."],["CODEC-001","Every one of 12 documents declares missing/empty/null/optional/unknown/legacy/export fixtures; Wave 0 owns pure in-memory cases only and Wave 5 owns reload plus three server exports and client HWPX integration."],["BODY-001","Legacy submission body and provenance/audit appendix split losslessly before field parsing."],["BODY-002","No editable value contains DB harness, ontology QA, quality contract, generation seal, KOSHA/law source metadata, management notes, operation graph, or raw appendix."],["BODY-003","The measured 5,221-character mixed risk string is a failing fixture and never becomes a v2 master textarea."],["FLOW-001","Any edit clears active review artifacts and the top-level generationEvidence/error, increments localDraftRevision only, clears human confirmation, and stales share blocks; no nested seal exists."],["FLOW-002","Revalidation verifies the untouched base seal, builds a seal-free final candidate, hashes all remaining AskResponse fields with existing buildResponseContentDigest, and attaches one top-level envelope."],["FLOW-003","Current POST /api/workpacks is insert-only and cannot stamp authoritative v2 human_confirmed/revision; that transition is blocked behind REVISION-001 transactional approval."],["FLOW-004","V2 share remains blocked until both REVISION-001 and blocked-server-share-authority pass; current share-session/dispatch routes provide no freshness authority."],["FLOW-005","Unedited generated content may validate to review_pending without document mutation, then requires explicit authenticated confirmation; edited content must revalidate first."],["REVISION-001","Future approved authority atomically resolves the logical root/latest parent, compares expectedRevision, allocates revisions, stamps actor/time, reseals, and rejects concurrent losers; current insert-only POST is not authority."],["IDEMPOTENCY-001","User approval selects exactly one transactionally unique root strategy: client stable logicalWorkpackId or organization+rootOperationKey with server ID allocation. Exact retries replay the original response; conflicting digest/identity returns the specified 409 without mutation."],["APPROVAL-001","The entire implementation program including Wave 0 is BLOCKED_PENDING_USER_DB_APPROVAL until both independent spec PASS and explicit user approval of the migration/transactional RPC authority exist."],["HUMAN-001","Generated/model output cannot approve, identify an approver, confirm legal/safety review, sign, record attendance, or confirm understanding."],["CONFIRM-001","WorkerAttendanceConfirmation and ShareReadConfirmation are non-substitutable."],["EVIDENCE-001","EditorEvidenceRef has no reviewed boolean and losslessly preserves the complete discriminated raw SafetyReferenceItem/ontology/photo/field record plus extensions; normalized display is separate."],["EVIDENCE-002","SIF is supporting hazard-priority evidence only; KOSHA guidance cannot establish a statutory mandate without eligible law."],["PROVENANCE-001","SafetyReference anchors/excerpt/referenceId/stableDocumentKey/version/evidenceRef/source metadata and ontology supportStatement/registryMapping/provenanceBridge round-trip; citedUid/resolution are never fabricated for non-ontology evidence."],["SHARE-001","Every expanded share block includes owning documentKey, stable block ID, sourceRevision, and evidenceDigest and becomes stale on source/evidence/review/audience/language change."],["SHARE-002","No implementation wave owns share-session/dispatch routes; a future separately approved owner must bind latest authoritative revision and reject stale/missing bindings before provider calls."],["PHOTO-001","Common photo state and DOC-09 photoState are identical with a total legacy mapping; current GET/POST never yields hydratable assetId/storagePath and Wave 3 owns no API/DB change."],["PHOTO-002","Candidate photos cannot become evidence/share; approved atomic review binds analysis_id plus canonical analysis_payload snapshot/digest, model/provider/version, candidate control IDs/text digests, non-null source before/after SHA-256 where applicable, authenticated reviewer/time, transaction/root operation, resulting revision/seal, and canonical event digest. Raw photo bytes remain site memory only."],["EXPORT-001","All expanded fields and separate appendices must round-trip semantically through reload, XLSX POST, PDF HTML POST, binary HWP POST, and client buildHwpxWithRhwp without silent defaults."],["EXPORT-002","At target f98ae7d HWPX is client-built in WorkpackEditor; GET /api/export/hwpx-template is not the editor call site. Only Wave 5 owns actual export round-trip exits."],["UI-001","Default surface priority is selector, title/status, edit/download, preview/editor, share readiness."],["UI-002","Default surface has zero yellow evidence badges, persistent right rails, duplicate left evidence summaries, and below-editor result/citation/operation graph blocks."],["UI-003","Default DOM has one evidence trigger and zero occurrences of 중처법 §4-3호 증빙; applicable detail appears at most once in the drawer."],["UI-004","The trigger is exactly 근거 N건 · 확인 필요 M건 and both numbers come only from selectDocumentEvidenceSummary."],["UI-005","At 1150x900 selector &lt;=220px, editor &gt;=700px, readable preview &gt;=560px, evidence rail=0px; at 1440x1000 editor &gt;=920px and preview &gt;=720px."],["UI-006","At 390x844 and 391x844 editor heading y&lt;=160px after Edit, no visible editor textarea internally scrolls, and audited sample page height &lt;=3600px."],["UI-007","BROWSER-001 through BROWSER-025 declare Day/Night geometry, targets/gaps, body/provenance separation, drawer ownership, photo eligibility, nested scroll, blocked authority, and 200% reflow requirements; spec review does not claim execution."],["UI-008","Body &gt;=15/23px, table &gt;=14/20px, label &gt;=13/18px, details-only caption &gt;=12/18px, no default 11px text, letter-spacing=0."],["UI-009","Exactly one lifecycle CTA is dominant; Download visible label and aria-label are both 다운로드; share readiness is status only."],["UI-010","The 준제출형 warning is role=alert/data-severity=warning with &gt;=4.5:1 text contrast, &gt;=3:1 leading-border contrast, and precedes the non-alert evidence trigger in DOM/accessibility order."],["UI-011","Drawer overlays without shrinking preview, traps focus, closes on Escape, restores trigger focus, and is a single full-width mobile scroller."],["TASK-001","TASK-001 through TASK-006 impose click, cumulative scroll, and y-position budgets for edit, first field, review/save, download, and share readiness at 1440x1000 and 391x844."],["ZOOM-001","The future 144-case implementation matrix must generate tests from a locator census, apply the test-only root typography token policy exactly once while deviceScaleFactor/devicePixelRatio/visualViewport remain 1, and independently reject bad ratios/reflow, cumulative or inner scaling, fixed/sticky escape, cross-parent overlap, clipping, overflow, nested scroll, textarea scroll, and late mobile editor start. Browser executions for this artifact are exactly 0."],["LINK-001","Only current runtime verified HTTPS safety URLs render, only in the drawer; unverified guidanceX.do has no href."],["STATE-001","Empty/loading/error/offline/conflict/read-only states preserve stable geometry and never silently claim authority."],["CONFLICT-001","The mechanically refreshed 2026-07-14T03:03:57.9752330+09:00 snapshot binds integration f98ae7d clean; ontology 9539f04 clean but unreviewed after rejected remediation; reports 6f7ee77 clean evidence head; web local 6d0b4dd two ahead of remote 2fb3cc8 with untracked evidence; editor-first image-only dirt; and share 8804e33 with another owner's evaluation-only dirt. Only target-source or planned ownership/read-only/test/authority intersections force amendment and fresh review."],["ROLLBACK-001","Feature flag off restores current editor/export rendering while preserving unknown editorV2 data; no data rollback."],["WAVE-001","Wave 1 document scope is exactly riskAssessmentDraft, tbmBriefing, tbmLogDraft."],["WAVE-002","Each wave declares exact owned/read-only files, tests, TDD gates, rollback, status BLOCKED_PENDING_USER_DB_APPROVAL, and an exact empty BLOCKED_NO_EXECUTABLE_COMMANDS token contract. Post-approval commands require a separately reviewed amendment."],["TRUST-001","The repository cannot authenticate a Codex/user DB approval event today. Current and evidence claims are exact closed zero-execution objects; future approval/provider/CI/DOM plans are exact normative-only schemas with no accepted result fields. No repository-authored manifest, boolean, hash, receipt, log, artifact, sidecar, actor string, or claimed gate is authoritative."],["VALIDATOR-001","Spec-review runs only through the canonical token command, rejects unknown/result-bearing future-plan fields, enforces strict RFC3339 and a 300-second future/injected-clock bound, reads immutable candidate/target blobs and an evidence-only child, proves exact identity, recursive schemas and relationships for all 19 domains, and full structural/human/outside-prose parity. Implementation mode always exits nonzero with IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL."],["PASS-001","Status remains HOLD_PENDING_FRESH_REVIEW and implementation remains BLOCKED_PENDING_USER_DB_APPROVAL after this evidence pair until fresh independent PASS and explicit user DB approval."]],"browserMatrix":[{"browser":"Chromium","themes":["day","night"],"viewportId":"desktop1440"},{"browser":"Chromium","themes":["day","night"],"viewportId":"measuredDesktop1150"},{"browser":"Chromium","themes":["day","night"],"viewportId":"compactDesktop1280"},{"browser":"Chromium","themes":["day","night"],"viewportId":"mobile390"},{"browser":"Chromium","themes":["day","night"],"viewportId":"auditMobile391"},{"browser":"Chromium","themes":["day","night"],"viewportId":"smallMobile320"},{"browser":"Firefox","themes":["day","night"],"viewportId":"desktop1440"},{"browser":"Firefox","themes":["day","night"],"viewportId":"measuredDesktop1150"},{"browser":"Firefox","themes":["day","night"],"viewportId":"mobile390"},{"browser":"WebKit","themes":["day","night"],"viewportId":"desktop1440"},{"browser":"WebKit","themes":["day","night"],"viewportId":"measuredDesktop1150"},{"browser":"WebKit","themes":["day","night"],"viewportId":"mobile390"}],"browserMatrixId":"BROWSER-MATRIX-001","codecFixtureMatrix":{"caseSet":{"empty":"Exercise empty string, empty ordered array, and empty stable-ID array. Empty stable-ID arrays pass only fields declared zero or more; at-least-one fields fail closed.","export":"Wave 5 only: for every expanded field and raw provenance member, reload plus three server export routes and the client HWPX builder recover the same semantic value, array order, null/absence, extension bag, evidence target, worker confirmation, actionTaken, and digest. Binary byte equality is not required.","legacy":"Hydrate the current string/structured path and exact [SafeClaw Editor v2 fields] fallback for every expanded field, serialize, reload, and deep-equal the normalized envelope plus raw appendix/unmapped values.","missing":"For each required field, omit it and expect blocking missing_field with raw envelope preserved; for each optional field, preserve absence and emit no synthesized value.","null":"Exercise explicit null for every field. Only string&#124;null, integer&#124;null, number&#124;null, enum&#124;null, and nullable object fields pass and round-trip null; all others fail closed.","optional":"Exercise every optional/conditional field absent and present; preserve absent versus null and exact values.","unknown":"Unknown non-reserved keys round-trip in extensions; reserved-name collisions and invalid known types fail closed into unmapped."},"id":"CODEC-MATRIX-001","ownership":{"rule":"Wave 0 may execute only in-memory codec/parser fixtures. Wave 5 owns all actual route/client, binary, browser, and export round-trip exits.","wave0PureCases":["missing","empty","null","optional","unknown","legacy"],"wave5IntegrationCases":["export","reload-through-current-call-sites"]},"rows":[["DOC-01","workpackSummaryDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields"],["DOC-02","riskAssessmentDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all 21 RiskAssessmentRow fields plus stable id/evidence"],["DOC-03","workPlanDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields and risk-row links"],["DOC-04","workPermitDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields and nullable risk-row link"],["DOC-05","tbmBriefing","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields, riskRowId, evidence, verification"],["DOC-06","tbmLogDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields, attendance, understanding, actionTaken"],["DOC-07","safetyEducationRecordDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields and WorkerAttendance"],["DOC-08","emergencyResponseDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded fields and scenario links"],["DOC-09","photoEvidenceDraft","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all expanded metadata/candidate/review fields without fake assets"],["DOC-10","foreignWorkerBriefing","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all variants/source revision/evidence fields"],["DOC-11","foreignWorkerTransmission","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all share block/read-confirmation fields"],["DOC-12","kakaoMessage","missing&#124;empty&#124;null&#124;optional&#124;unknown&#124;legacy&#124;export","all share block/read-confirmation fields"]],"targets":["reload","EXPORT-XLSX","EXPORT-PDF","EXPORT-HWP","EXPORT-HWPX-CLIENT"]},"fileOwnership":{"blockedOwners":[{"owner":"blocked-server-revision-authority","paths":["app/api/workpacks/route.ts","lib/workpack-store.ts","lib/workpack-revision-authority.ts","tests/workpack-revision-authority.test.ts","tests/workpack-route-revision-authority.test.ts","supabase/migrations/&lt;approved&gt;_workpack_revision_authority.sql"],"status":"not a wave; no file may be edited before approval"},{"owner":"blocked-server-share-authority","paths":["app/api/workpacks/[id]/share-sessions/route.ts","app/api/workflow/dispatch/route.ts","lib/workpack-commercial-store.ts","tests/workpack-share-authority-routes.test.ts","tests/workflow-dispatch-freshness.test.ts"],"status":"not a wave; coordinate with feature/share-session-ui-v2@76a67c5 after revision authority approval"},{"owner":"blocked-photo-review-authority","paths":["app/api/workpacks/[id]/improvements/[improvementId]/review/route.ts","lib/workpack-improvement-review.ts","tests/workpack-improvement-review-route.test.ts","supabase/migrations/&lt;approved&gt;_workpack_improvement_review_events.sql"],"status":"not a wave; no route/history/migration work before approval"}],"highRiskDeferrals":["WorkpackEditor/export files wait for integration target plus editor-first/report conflict resolution in Wave 5.","Share routes are absent from Waves 0-5 and stay disabled.","Workpack save/store and all migration placeholders are absent from Waves 0-5.","Improvement review route/history is absent from Waves 0-5."],"rule":"The union of each wave's ownedFiles and testFiles is the complete write set for that wave and is globally disjoint. Read-only dependencies may repeat. Later waves consume public exports/APIs and never edit an earlier owner's file.","validator":"validate-contract.mjs rejects duplicate write paths, component/fileMap mismatches, document component owner mismatches, test reuse, or an owned path absent from its declared owner."},"programStatus":"BLOCKED_PENDING_USER_DB_APPROVAL","startGate":{"explicitUserDbApprovalRequired":true,"forbiddenBeforeGate":["product code","product tests","codec implementation","UI implementation","API/store work","DB/schema/migration/RPC work","data changes","Wave branch creation or execution"],"independentSpecPassRequired":true,"logic":"AND","permittedBeforeGate":["spec review","validator review","evidence-manifest review"],"scope":"Every product/test/API/UI/codec wave including Wave 0"},"viewports":[{"containment":"two tracks only; main editor &gt;=920px, readable preview &gt;=720px, no right rail, no horizontal overflow","height":1000,"id":"desktop1440","requiredThemes":["day","night"],"width":1440},{"containment":"selector &lt;=220px, main editor &gt;=700px, readable preview &gt;=560px, evidence rail 0px; drawer overlays without reflow","height":900,"id":"measuredDesktop1150","requiredThemes":["day","night"],"width":1150},{"containment":"two tracks only; selector may collapse; primary action and warning remain visible","height":720,"id":"compactDesktop1280","requiredThemes":["day","night"],"width":1280},{"containment":"single column; editor heading &lt;=160px after Edit focus; no nested editor scroll; no horizontal overflow","height":844,"id":"mobile390","requiredThemes":["day","night"],"width":390},{"containment":"failing 252x460 mixed textarea and 9120px page are absent; default sample page &lt;=3600px; drawer is full-width","height":844,"id":"auditMobile391","requiredThemes":["day","night"],"width":391},{"containment":"labels wrap; 44px controls; no clipped actions, nested editor scroll, or horizontal overflow","height":568,"id":"smallMobile320","requiredThemes":["day","night"],"width":320}],"waves":[{"apiChange":null,"browserAssertions":[],"browserMatrixRef":null,"commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":[],"entryGate":"Both an independent reviewer PASSes the immutable candidate/evidence pair and the user explicitly approves the DB migration/transactional RPC authority. Until both, do not create or edit any owned/test file.","exitGate":"Local codecs/adapters/draft/review inputs are green; server save, human confirmation, photo authority, and v2 share remain blocked.","featureFlagRef":"FLAG-001","id":"wave0","name":"Local codecs and draft after authority approval","objective":"Implement strict types/codecs, all 12 lossless adapters, body/appendix separation, deterministic local digests, localDraftRevision, and recovery checkpoints only. Do not implement server revision, confirmation, persistence, or share authority.","ownedFiles":["lib/workpack-editor-types.ts","lib/workpack-editor-codecs.ts","lib/workpack-editor-adapter.ts","lib/workpack-editor-legacy-boundary.ts","lib/workpack-editor-document-specs.ts","lib/workpack-editor-local-draft.ts","lib/workpack-editor-review.ts"],"owner":"workpack-editor-local-contract","productionFixBoundary":"Only the seven owned lib files and seven owned tests; all routes, stores, readiness, generation evidence, DB, CSS, packages, and exports are read-only.","readOnlyDependencies":["lib/risk-assessment-schema.ts","lib/types.ts","lib/generation-evidence.ts","lib/db-harness.ts","lib/workpack-ontology-qa.ts","lib/quality-contract.ts","lib/search.ts"],"rollback":"Disable the flag and stop reading local v2 checkpoints. Preserve unknown editorV2 data; no server/data/schema rollback.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: mixed 5221-character risk fixture fails until body and every known appendix section are separated and preserved.","RED: every missing/empty/null/optional/unknown/legacy pure codec fixture fails before codecs exist; no export route/client fixture runs in this wave.","GREEN: all 12 adapters preserve exact fields, null/absence, raw provenance, extension bags, appendix, and unmapped values in memory.","GREEN: generated validates locally to review_pending without content mutation; edited requires deterministic revalidation inputs.","GREEN: logicalWorkpackId/parentWorkpackId/revision/humanConfirmation remain null and v2 share remains locked.","REFACTOR: no any, API, DB, schema, migration, package, CSS, current store/readiness, export, or browser change."],"testFiles":["tests/workpack-editor-types.test.ts","tests/workpack-editor-codecs.test.ts","tests/workpack-editor-adapter.test.ts","tests/workpack-editor-legacy-boundary.test.ts","tests/workpack-editor-local-draft.test.ts","tests/workpack-editor-review-lifecycle.test.ts","tests/workpack-editor-codec-matrix.test.ts"]},{"apiChange":null,"browserAssertions":[],"browserMatrixRef":"BROWSER-MATRIX-001","commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":["riskAssessmentDraft","tbmBriefing","tbmLogDraft"],"entryGate":"Program startGate satisfied and Wave 0 green; otherwise blocked.","exitGate":"The core three components and domain tests are green; they are not mounted in production until Wave 5.","featureFlagRef":"FLAG-001","id":"wave1","name":"Core structured editors and simplified review surface","objective":"Build genuine structured risk assessment, TBM briefing, and TBM record domain editors plus only the shared field/table/attendance primitives their matching structures require.","ownedFiles":["components/workpack-editor/FieldGroup.tsx","components/workpack-editor/ExactTextField.tsx","components/workpack-editor/AutoGrowTextField.tsx","components/workpack-editor/EnumSelect.tsx","components/workpack-editor/DateTimeField.tsx","components/workpack-editor/ChecklistField.tsx","components/workpack-editor/EditableRowList.tsx","components/workpack-editor/ResponsiveDataGrid.tsx","components/workpack-editor/EvidenceReferencePicker.tsx","components/workpack-editor/WorkerAttendanceEditor.tsx","components/workpack-editor/ValidationSummary.tsx","components/workpack-editor/RiskAssessmentEditor.tsx","components/workpack-editor/TbmBriefingEditor.tsx","components/workpack-editor/TbmLogEditor.tsx"],"owner":"workpack-editor-core-components","productionFixBoundary":null,"readOnlyDependencies":["lib/workpack-editor-types.ts","lib/workpack-editor-codecs.ts","lib/workpack-editor-adapter.ts","lib/workpack-editor-document-specs.ts","lib/risk-assessment-schema.ts","lib/types.ts"],"rollback":"Remove only unmounted Wave 1 components/tests or leave flag off; no stored data or API change.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: the core documents cannot be edited as typed rows/sections and riskRowId/evidence/verification/attendance/actionTaken fixtures fail.","GREEN: all three editors consume Wave 0 codecs and preserve stable RiskAssessmentRow names/IDs.","GREEN: WorkerAttendance/understanding is event-specific and cannot consume ShareReadConfirmation.","REFACTOR: thin domain wrappers share only matching primitives; no universal renderer and no copied editor bodies."],"testFiles":["tests/workpack-editor-wave1.test.ts","tests/workpack-editor-worker-attendance.test.ts","tests/tbm-deterministic-structures.test.ts"]},{"apiChange":null,"browserAssertions":[],"browserMatrixRef":"BROWSER-MATRIX-001","commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":["workPlanDraft","workPermitDraft","safetyEducationRecordDraft"],"entryGate":"Program startGate satisfied and Wave 1 green; otherwise blocked. No export gate is owned here.","exitGate":"Three additional domain components pass their tests and Wave 1 regressions; they remain unmounted until Wave 5.","featureFlagRef":"FLAG-001","id":"wave2","name":"Plans, permit, and education","objective":"Add structured plan, permit, and education editors using risk links, approval boundaries, curriculum rows, and the genuine shared WorkerAttendance primitive.","ownedFiles":["components/workpack-editor/WorkPlanEditor.tsx","components/workpack-editor/WorkPermitEditor.tsx","components/workpack-editor/EducationRecordEditor.tsx","components/workpack-editor/PeoplePicker.tsx"],"owner":"workpack-editor-plan-components","productionFixBoundary":null,"readOnlyDependencies":["lib/workpack-editor-document-specs.ts","lib/workpack-editor-adapter.ts","components/workpack-editor/EvidenceReferencePicker.tsx","components/workpack-editor/WorkerAttendanceEditor.tsx","lib/types.ts","lib/risk-assessment-schema.ts"],"rollback":"Remove only unmounted Wave 2 components/test or leave flag off; no schema/data rollback.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: current structured fixtures lose v2-only IDs/evidence/actionTaken until adapter and manifests are extended.","GREEN: current WorkPlanStructured, PermitInspectionStructured, and EducationRecordStructured paths round-trip with all richer v2 fields.","GREEN: generated approver/instructor/confirmer placeholders cannot become human confirmation.","REFACTOR: reuse tables/attendance only where field semantics match."],"testFiles":["tests/workpack-editor-wave2.test.ts"]},{"apiChange":false,"browserAssertions":[],"browserMatrixRef":"BROWSER-MATRIX-001","commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":["workpackSummaryDraft","emergencyResponseDraft","photoEvidenceDraft"],"entryGate":"Program startGate satisfied, Wave 2 green, and current improvements endpoint contract fixtures pinned; otherwise blocked.","exitGate":"Three domain components pass; local photo candidate handling is honest and PHOTO-002 remains blocked.","featureFlagRef":"FLAG-001","id":"wave3","name":"Summary, emergency, and honest photo evidence","objective":"Add summary/scenario editors and honest local/display-only Before/After handling without claiming photo asset hydration.","ownedFiles":["components/workpack-editor/WorkpackSummaryEditor.tsx","components/workpack-editor/EmergencyResponseEditor.tsx","components/workpack-editor/ImprovementEvidenceEditor.tsx","components/workpack-editor/LocalPhotoPair.tsx"],"owner":"workpack-editor-evidence-components","productionFixBoundary":null,"readOnlyDependencies":["app/api/workpacks/[id]/improvements/route.ts","lib/workpack-commercial.ts","lib/photo-vision-analysis.ts"],"rollback":"Disable the feature flag and revoke local object URLs. Existing improvement records remain untouched; no endpoint or DB rollback exists because Wave 3 owns neither.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: tests reject stored/hydrated photo pixels and evidence eligibility from current GET/POST.","GREEN: common Phase A states map totally to DOC-09 and object URLs remain ephemeral.","GREEN: candidate/metadata-only rows keep reviewDecision/event/control null and cannot enter evidence/share.","GREEN: no app/api, DB, schema, migration, package, Supabase type, adapter, or export file changes occur.","REFACTOR: PHOTO-002 remains an explicit approval gate."],"testFiles":["tests/workpack-editor-wave3.test.ts","tests/workpack-editor-photo-state.test.ts"]},{"apiChange":false,"browserAssertions":[],"browserMatrixRef":"BROWSER-MATRIX-001","commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":["foreignWorkerBriefing","foreignWorkerTransmission","kakaoMessage"],"entryGate":"Program startGate satisfied and Wave 3 green; server share actions remain separately blocked until approved authority is implemented.","exitGate":"Three drafting components pass and no server authority claim or route edit exists.","featureFlagRef":"FLAG-001","id":"wave4","name":"Multilingual and share-block drafting","objective":"Build multilingual print/transmission/message editors and local versioned share blocks. Do not alter share-session or dispatch authority; all v2 network share actions remain disabled.","ownedFiles":["components/workpack-editor/ForeignWorkerPrintEditor.tsx","components/workpack-editor/ForeignWorkerTransmissionEditor.tsx","components/workpack-editor/FieldShareMessageEditor.tsx","components/workpack-editor/LanguageVariantEditor.tsx","components/workpack-editor/ShareBlockEditor.tsx"],"owner":"workpack-editor-multilingual-components","productionFixBoundary":"Only five owned components and two owned tests. Share/read routes and commercial stores are read-only; network share remains blocked.","readOnlyDependencies":["lib/workpack-editor-document-specs.ts","lib/workpack-editor-adapter.ts","app/api/workpacks/[id]/read-confirmations/route.ts","app/api/workpacks/[id]/share-sessions/route.ts","app/api/workflow/dispatch/route.ts","lib/workpack-commercial.ts","lib/workpack-commercial-store.ts","lib/types.ts"],"rollback":"Disable the feature flag; current foreignWorker strings and kakaoMessage remain available. Existing share sessions/read confirmations remain historical and untouched.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: local share blocks omit documentKey/blockId/sourceRevision/evidenceDigest or mix share-read with attendance.","GREEN: rebuild creates a new local block identity/digest and clears session/dispatch/current-read display.","GREEN: all network share controls stay disabled with freshness_server_contract_missing.","REFACTOR: transmission/message share block structure is shared while document fields/interactions remain distinct."],"testFiles":["tests/workpack-editor-wave4.test.ts","tests/workpack-editor-confirmation-boundaries.test.ts"]},{"apiChange":null,"browserAssertions":["Implementation evidence only: BROWSER-001 through BROWSER-025, ZOOM-001, and TASK-001 through TASK-006 execute for every declared browser/viewport/theme/document row. Spec mode must not report these as behavior PASS."],"browserMatrixRef":"BROWSER-MATRIX-001","commands":{"executionCount":0,"status":"BLOCKED_NO_EXECUTABLE_COMMANDS","tokens":[]},"databaseMigration":false,"documents":[],"entryGate":"Program startGate satisfied, Waves 0-4 green, currentIntegrationTarget successor selected, and conflict snapshot freshly rechecked/resolved symbol by symbol; otherwise blocked.","exitGate":"All owned tests and regressions pass, ownership/range remain clean, flag stays off by default, and server authority features remain disabled pending separate approval and independent implementation review.","featureFlagRef":"FLAG-001","id":"wave5","name":"Workbench, review, export integration and release hold","objective":"After approval gates, mount all 12 editors behind the fallback flag, add one evidence drawer and non-authoritative review endpoint, integrate deterministic manifests at the three server export routes plus client buildHwpxWithRhwp call site, and run measurable browser/regression gates. Server save/share/photo review remain blocked until their approved authority implementation is independently green.","ownedFiles":["components/WorkpackEditor.tsx","components/WorkpackEditor.module.css","components/CurrentWorkpackModules.tsx","components/workpack-editor/DocumentEditorRegistry.tsx","components/workpack-editor/DocumentEditorShell.tsx","components/workpack-editor/DocumentActionBar.tsx","components/workpack-editor/EvidenceSummaryTrigger.tsx","components/workpack-editor/EvidenceDetailsDrawer.tsx","components/workpack-editor/SourceConfirmationWarning.tsx","lib/workpack-editor-evidence-summary.ts","lib/workpack-editor-export-manifest.ts","lib/workpack-editor-review-client.ts","app/api/workpacks/revalidate/route.ts","lib/official-safety-resources.ts","lib/kosha.ts","app/api/export/xlsx/route.ts","app/api/export/pdf/route.ts","app/api/export/hwp/route.ts","lib/xlsx-builder.ts","lib/hwp-table-builder.ts"],"owner":"workpack-editor-integration","productionFixBoundary":"Only Wave 5 owned files may change here. Generation evidence, workpack save/store/readiness, share routes, improvement routes, DB/schema/package/lock files are read-only.","readOnlyDependencies":["all Wave 0-4 owned files","lib/generation-evidence.ts","lib/workpack-readiness.ts","lib/workpack-store.ts","app/api/workpacks/route.ts","app/api/workpacks/[id]/share-sessions/route.ts","app/api/workflow/dispatch/route.ts","app/api/workpacks/[id]/improvements/route.ts","app/api/export/hwpx-template/route.ts","lib/hwpx-template.ts"],"rollback":"Keep the flag off; current editor/export routes remain active and optional editorV2 data is preserved. Revert only Wave 5 owned hunks after hand-merge review; no DB rollback.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","tddGates":["RED: d3ad865 fixtures show four-way provenance repetition, 5,221-character mixed textarea, narrow preview, nested mobile scroll, and missing 12-document round trips.","GREEN after approval only: all canonical fields/raw provenance/appendices round-trip through reload, three server export routes, and client buildHwpxWithRhwp.","GREEN after approval only: review endpoint supports no-edit and edited review_pending reseal but cannot stamp human confirmation or authoritative revision.","GREEN after approval only: future locator-census tests execute every measurable task-distance/browser/theme/action gate, including the 200 percent matrix, and flag-off fallback.","GREEN after approval only: v2 save/share/photo confirmation controls remain unavailable until their blocked authority gates pass."],"testFiles":["tests/workpack-editor-review-route.test.ts","tests/workpack-editor-evidence-drawer.test.ts","tests/workpack-editor-browser-matrix.test.ts","tests/workpack-editor-export-roundtrip.test.ts","tests/documents-editor-layout.test.ts","tests/editor-export-integrity.test.ts","tests/official-safety-resources-validation.test.ts","tests/xlsx-export-route.test.ts"]}]} |
| "independentGate" | "object" | 4 | 4 | 1 | "sha256:fcfd90b32dc28fd65d1fb869368acdef4a81ab2d5be38049f6c5b76635f5c1f7" | {"holdState":"HOLD_PENDING_FRESH_REVIEW","implementationState":"BLOCKED_PENDING_USER_DB_APPROVAL","required":true,"rule":"Do not start Wave 0 or any later implementation until another independent reviewer PASSes the immutable candidate/evidence commit pair and the user separately gives explicit approval for DB migration/transactional RPC authority. The gate is AND, not either/or."} |
| "integrationLedger" | "object" | 10 | 178 | 4 | "sha256:730193d441cc7fd48bb6ca94d662d0c16590a35a0bbf4073768c6d4d419ca7c7" | {"amendmentPolicy":{"amendmentAndFreshReview":["currentIntegrationTarget changes","any targetBlobPaths blob changes","a competing changed/dirty path begins intersecting a planned write or authority path","write ownership or integration order changes","approval proposal digest, approval event, or authority boundary changes"],"localResolution":"Intersecting work pauses only the affected file/wave for owner coordination. It does not globally block unrelated work; the global program is already blocked by approval gates.","noAmendment":["head or dirty changes whose recomputed intersection with planned owned/readOnly/test/blocked-authority paths is empty","generated logs, caches, screenshots, or evaluation evidence outside this contract","normal parallel commits that leave currentIntegrationTarget and target source blob hashes unchanged"]},"binding":"This is a mechanically captured, timestamped local+remote ref/worktree snapshot, not a perpetual live-state claim. review-evidence.json copies the exact facts and binds candidate/target blobs.","captureMethod":[["git","fetch","origin","--prune"],["git","worktree","list","--porcelain"],["git","-C","&lt;worktree&gt;","status","--short","--branch"],["git","-C","&lt;worktree&gt;","rev-parse","HEAD"],["git","-C","&lt;worktree&gt;","rev-parse","@{u}"],["git","-C","&lt;worktree&gt;","rev-list","--left-right","--count","@{u}...HEAD"],["git","diff","--name-only","&lt;merge-base&gt;...&lt;head&gt;","--","&lt;planned ownership paths&gt;"]],"capturedAt":"2026-07-14T03:03:57.9752330+09:00","currentIntegrationTarget":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","freshRecheck":["FETCH_REMOTE_REFS","RESOLVE_WATCHED_REFS_TO_FULL_SHA","ENUMERATE_WORKTREES","CAPTURE_WATCHED_WORKTREE_STATUS","RECOMPUTE_DECLARED_PATH_INTERSECTIONS","REBIND_TARGET_BLOBS","RECORD_POST_APPROVAL_SNAPSHOT_ONLY_AFTER_SEPARATE_REVIEW"],"heads":[{"aheadBehind":[0,0],"committedPlannedOverlap":["app/api/export/hwp/route.ts","app/api/export/hwpx-template/route.ts","app/api/export/pdf/route.ts","lib/hwpx-template.ts"],"decision":"Bound integration target. Any target source blob change requires a new candidate/evidence pair.","dirtyPaths":[],"id":"integration","localHead":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","localRef":"feat/phase-a-evidence-integration","overlapHunks":["components/WorkpackEditor.tsx: downloadXlsx, printPdf, downloadHwp, buildHwpxWithRhwp, downloadHwpx current call sites","app/api/export/hwp/route.ts: binary POST","app/api/export/pdf/route.ts: HTML POST path","app/api/export/xlsx/route.ts: structured POST modes"],"relevantDirtyPaths":[],"remoteHead":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","remoteRef":"origin/feat/phase-a-evidence-integration","targetSourceDeltaFrom77d":[],"worktreeState":"clean"},{"aheadBehind":[0,0],"committedPlannedOverlap":["components/CurrentWorkpackModules.tsx","components/WorkpackEditor.tsx","app/api/export/hwp/route.ts","app/api/export/pdf/route.ts","app/api/export/xlsx/route.ts","lib/quality-contract.ts","lib/search.ts","lib/types.ts","lib/workpack-ontology-qa.ts","lib/workpack-readiness.ts","lib/workpack-store.ts"],"decision":"The prior rejected/remediating head advanced to a clean unreviewed remediation commit. Do not consume intersecting committed hunks; this pauses only affected future files until owner resolution.","dirtyPaths":[],"id":"ontology","localHead":"9539f04896698f548bd01e33ff24ab70415bc68e","localRef":"fix/phase-a-ontology-review","relevantDirtyPaths":[],"remoteHead":"9539f04896698f548bd01e33ff24ab70415bc68e","remoteRef":"origin/fix/phase-a-ontology-review","reviewState":"rejected_candidate_remediated_to_unreviewed_clean_head","worktreeState":"clean"},{"aheadBehind":[0,0],"committedPlannedOverlap":["app/api/export/hwp/route.ts","app/api/export/hwpx-template/route.ts","app/api/export/pdf/route.ts","lib/hwpx-template.ts"],"decision":"The current head is evidence-only over the product commit. Inherited export overlap is resolved symbol-by-symbol only if Wave 5 starts; report CSS/tests remain another owner's files.","dirtyPaths":[],"evidenceCommit":"6f7ee770d5f764fd408b5eb3d3c19b6ce63c5c57","id":"reports","localHead":"6f7ee770d5f764fd408b5eb3d3c19b6ce63c5c57","localRef":"fix/reports-mobile-task-distance","productCommit":"986b7fbd5067da25eb4a5fd5997803675a8df541","productHunks":["app/globals.css","components/ReportsDownloadCenter.tsx","tests/reports-design-remediation.test.ts"],"relevantDirtyPaths":[],"remoteHead":"6f7ee770d5f764fd408b5eb3d3c19b6ce63c5c57","remoteRef":"origin/fix/reports-mobile-task-distance","reviewState":"remediation_evidence_head_unreviewed","worktreeState":"clean"},{"aheadBehind":[0,2],"committedPlannedOverlap":[],"decision":"Two local remediation commits and untracked evidence are disjoint from declared editor ownership and do not block. Recheck only if their changed-path intersection becomes non-empty.","dirtyPaths":["evaluation/web-localization-current-target-2026-07-14-v5/"],"id":"web","localHead":"6d0b4dd8c0a54b235169217f9d0d2fcd170636c3","localRef":"fix/web-localization-current-target","relevantDirtyPaths":[],"remoteHead":"2fb3cc8c6b8f3610a8bfccf1859717a848cc17df","remoteRef":"origin/fix/web-localization-current-target","reviewState":"active_remediation","worktreeState":"ahead_two_with_untracked_evidence_only"},{"aheadBehind":[0,0],"committedPlannedOverlap":["app/api/export/hwp/route.ts","app/api/export/xlsx/route.ts","components/CurrentWorkpackModules.tsx","components/WorkpackEditor.module.css","components/WorkpackEditor.tsx","lib/types.ts","lib/xlsx-builder.ts","tests/documents-editor-layout.test.ts","tests/editor-export-integrity.test.ts","tests/xlsx-export-route.test.ts"],"decision":"Images do not block. Committed overlapping symbols require owner-level comparison; no wholesale merge or file copy.","dirtyPaths":["output/playwright/2026-07-10/module-shell-hardening/desktop-tbm-night.png","output/playwright/2026-07-10/module-shell-hardening/desktop-workers-night.png"],"id":"editor-first-ui","localHead":"57b778e8dfa2c7ef896ba19911b79f537354439a","localRef":"feature/editor-first-ui-v2","relevantDirtyPaths":[],"remoteHead":"57b778e8dfa2c7ef896ba19911b79f537354439a","remoteRef":"origin/feature/editor-first-ui-v2","worktreeState":"dirty_image_only"},{"committedPlannedOverlap":["app/api/workflow/dispatch/route.ts","app/api/workpacks/[id]/share-sessions/route.ts","tests/workpack-share-authority-routes.test.ts"],"decision":"Local-only stale candidate; server share work remains blocked and cannot be integrated.","dirtyPaths":[],"id":"share-session-ui","localHead":"76a67c55cff0f50cb0f230a5ca49a260a7989055","localRef":"feature/share-session-ui-v2","relevantDirtyPaths":[],"remoteHead":null,"remoteRef":null,"worktreeState":"clean_local_only"},{"aheadBehind":[0,0],"committedPlannedOverlap":["app/api/export/hwp/route.ts","app/api/export/hwpx-template/route.ts","app/api/export/pdf/route.ts","lib/hwpx-template.ts"],"decision":"Remote is current; another owner has dirty evaluation-only remediation. Do not copy it. Recheck inherited export lineage only if Wave 5 starts; share routes remain approval-blocked.","dirtyPaths":["evaluation/workpack-share-v2-2026-07-13/spec.json","evaluation/workpack-share-v2-2026-07-13/spec.md","evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs"],"id":"workpack-share-v2","localHead":"8804e33421d4b7ea75dd32022acf728f7adb5c43","localRef":"feat/workpack-share-v2","relevantDirtyPaths":[],"remoteHead":"8804e33421d4b7ea75dd32022acf728f7adb5c43","remoteRef":"origin/feat/workpack-share-v2","worktreeState":"dirty_evaluation_spec_only"}],"integrationOrder":["Obtain fresh independent spec PASS and explicit user DB authority approval outside repository-authored evidence; otherwise stop before Wave 0.","After explicit user approval outside repository-authored evidence, design and independently review a post-approval authority/verifier contract bound to the then-current target and proposal.","Refresh intersections and resolve only affected symbols with their owners.","Never copy whole files, directories, worktree outputs, caches, screenshots, or another task's evidence.","Until that later verifier exists, run the current implementation mode only as a fail-closed assertion and expect IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL."],"snapshotId":"CONFLICT-SNAPSHOT-2026-07-14T03:03:57.9752330+09:00","sourceBase":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5"} |
| "meta" | "object" | 14 | 28 | 4 | "sha256:35dc256bd9a2412775c6001cb6bc68088a4d5d4270a03c4101a81e6fed88226f" | {"allowedFiles":["evaluation/workpack-document-editors-v2-2026-07-13/spec.md","evaluation/workpack-document-editors-v2-2026-07-13/spec.json","evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs","evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json"],"artifact":"SafeClaw Workpack Document Editors v2","branch":"feat/workpack-document-editors-v2-target-ready","canonicalRule":"spec.json is canonical. SAFECLAW-NORMATIVE enumerates every top-level key without an allowlist; each domain row carries its complete nested canonical value and digest while the root independently binds the whole contract. SAFECLAW-HUMAN and normalized outside prose are independently checked. Neither generated content nor hashes self-authorize: commit scopes, target blobs, external events, raw logs/artifacts, and browser recomputation remain separate gates.","currentIntegrationTarget":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","date":"2026-07-13","implementationProgramStatus":"BLOCKED_PENDING_USER_DB_APPROVAL","implementationStarted":false,"lineBudgets":{"json":[1200,2400],"markdown":[1400,2200]},"remediationDate":"2026-07-14","remediationParent":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","reviewScope":{"candidateCommit":{"allowedPaths":["evaluation/workpack-document-editors-v2-2026-07-13/spec.md","evaluation/workpack-document-editors-v2-2026-07-13/spec.json","evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs"],"parent":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5"},"evidenceCommit":{"allowedPaths":["evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json"],"parentMustEqualCandidate":true},"forbidTwoDot":true,"historicalReview":"Use sourceBase...candidateCommit only for historical context; do not assert that this accumulated range contains only current remediation files. Candidate and evidence commit scopes are checked independently with git diff-tree.","mergeBase":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5"},"sourceBase":"f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","status":"HOLD_PENDING_FRESH_REVIEW"} |
| "model" | "object" | 4 | 75 | 4 | "sha256:c4b54e2dbdc22c819bb074e7fff9b402d20550ada588f0f58dcfcea547a86ead" | {"boundary":{"appendixSentinels":["연결 상태","KOSHA 기술지침/기술지원규정 직접 인용","KOSHA 기술지침/기술지원규정 검토 필요","내부 안전지식 DB 반영","근거 요약","반영 근거","법령 근거 요약","KOSHA 보강","확인 근거 첨부","중대재해 예방 관리체계 점검","교육 적합성 확인","유사 재해사례","KOSHA 교육포털 연계","TBM 필수 반영 체크"],"editableForbidden":["DB harness summaries","ontology QA payloads","qualityContract payloads","generation evidence seals","KOSHA/law source metadata","internal safety DB metadata","management notes","operation graph","raw provenance appendix"],"id":"BODY-001","invariant":"parse(serialize(envelope)) deep-equals the normalized envelope including raw legacy appendix sections, unknown lines, inline citation refs, and audit history.","parse":["Prefer verified editorV2 content.","Otherwise prefer current production structured payload.","Tokenize the exact legacy deliverables.&lt;DocumentKey&gt; string while retaining original line endings and section order.","Classify versioned META_SECTION_PATTERNS and META_KEY_PATTERNS into legacyAppendix; classify known form sections into legacySubmissionBody.","Parse only legacySubmissionBody into document fields.","Normalize recognized appendix provenance into evidence and non-seal reviewArtifacts while preserving the raw section verbatim in legacyAppendix.","Put unknown lines in unmappedLegacyLines and block authoritative revalidation instead of guessing."],"plannedModule":"lib/workpack-editor-legacy-boundary.ts","serialize":["Serialize document content to deterministic submission-body prose or structured payload.","Serialize field-path fallback lines in the non-editable [SafeClaw Editor v2 fields] section.","Materialize a fresh non-editable provenance/review appendix from current evidence and reviewArtifacts only when a legacy/export consumer requires it.","Never bind the combined legacy string back to an editable control."],"sourcePatterns":"Move META_SECTION_PATTERNS and META_KEY_PATTERNS from WorkpackEditor.tsx."},"documentEnvelope":{"fields":[["content","DocumentDraftByKey[K]","editable document-specific fields only"],["legacySubmissionBody","LegacyBody","read-only lossless legacy body"],["legacyAppendix","LegacyAppendix","read-only raw provenance/review sections"],["inlineCitationRefs","string[]","editable through evidence picker only"],["unmappedLegacyLines","string[]","read-only and blocking until classified"]],"globalRoots":[["evidence","Record&lt;string,EditorEvidenceRef&gt;"],["reviewArtifacts","dbHarness + ontologyQa + qualityContract only"],["auditHistory","prior invalidated appendices/digests"]]},"generationSeal":{"digestBoundary":"Use existing buildResponseContentDigest unchanged: shallow-clone the final AskResponse candidate, delete only top-level generationEvidence and generationEvidenceError, canonicalize every remaining top-level field including deliverables.editorV2, dbHarness, ontologyQa, and qualityContract, then SHA-256 base64url.","editorV2Forbidden":["reviewArtifacts.generationEvidence","reviewArtifacts.generationEvidenceError","any copied signature or snapshot"],"location":"AskResponse.generationEvidence and AskResponse.generationEvidenceError at top level only","moduleOwnership":"lib/generation-evidence.ts remains read-only in Waves 0 and 1; no digest algorithm or envelope change is required.","resealSequence":["verify the untouched base response top-level envelope","recover trusted generationEvidenceReferences from the verified snapshot","build the final candidate response with fresh review metadata and no top-level seal/error","assert editorV2 contains no seal copy","call existing attachGenerationEvidence(candidate,{secret,generatedAt})","verifyAskResponseGenerationEvidence on the returned response"]},"strictTypeScript":{"anyForbidden":true,"externalJson":"unknown then strict narrowing","registry":"satisfies Record&lt;DocumentKey,DocumentEditorDefinition&lt;DocumentKey&gt;&gt;; default branches assign never","strict":true}} |
| "persistence" | "object" | 11 | 342 | 7 | "sha256:9664ea36720d21fec9de2a1f6d1a9ac5b101c6f47fb889b7cd8dbae783c82881" | {"authorityMigrationApprovalRequired":true,"digestDefinitions":{"evidenceDigest":"sha256:base64url over canonical EditorEvidenceRef records sorted by id using EditorEvidenceRef.digestRule.","materializationDigest":"sha256:base64url over canonical {version,logicalWorkpackId,parentWorkpackId,revision,localDraftRevision,documents,evidenceDigest,reviewArtifacts,auditHead,unmapped}; exclude materializationDigest itself, humanConfirmation, and top-level generationEvidence/generationEvidenceError.","order":["compute evidenceDigest","compute materializationDigest","stamp review state/human confirmation as applicable","call attachGenerationEvidence to compute responseContentDigest and top-level envelope"],"responseContentDigest":"Existing buildResponseContentDigest over the complete final AskResponse candidate after deleting only top-level generationEvidence/generationEvidenceError; it includes the already-computed materializationDigest and humanConfirmation when present."},"envelopeFields":[["version","\"safeclaw-workpack-editor/v2\"","code_constant","strictEnum",null],["baseGenerationDigest","string","verified_generation_evidence","digest","generationEvidence.snapshot.responseContentDigest"],["logicalWorkpackId","string&#124;null","null until authoritative server chain exists","nullableStableId","future server authority; never synthesized from a local key"],["parentWorkpackId","string&#124;null","null for root or until authoritative server save","nullableStableId","future immediate immutable parent row id"],["revision","integer&#124;null","null until server validates a monotonic chain","nullableStrictInteger","future authoritative server revision"],["localDraftRevision","integer","local non-authoritative counter","strictInteger","local draft only; never accepted as server revision"],["materializationDigest","string","deterministic local review then server rechecked","digest","sha256 over canonical materialization input defined below; never derived from responseContentDigest"],["evidenceDigest","string","deterministic local review then server rechecked","digest","complete raw provenance plus derived display/materialization"],["reviewState","\"generated\"&#124;\"edited\"&#124;\"review_pending\"&#124;\"human_confirmed\"","state_machine","strictEnum",null],["documents","Record&lt;DocumentKey,DocumentEnvelope&gt;","adapter_and_editor","canonicalObject","deliverables strings plus deliverables.*Structured and structured riskAssessmentRows/tbmRiskLinks"],["reviewArtifacts","ReviewArtifacts","server_recomputed","canonicalObject","dbHarness + ontologyQa + qualityContract only; generationEvidence forbidden"],["auditHistory","AuditHistoryEntry[]","adapter_and_server","canonicalArray",null],["evidence","Record&lt;string,EditorEvidenceRef&gt;","verified_base_plus_human_selection","canonicalObject","dbHarness.packet plus ontologyQa.result plus evidenceLabels"],["humanConfirmation","HumanConfirmation&#124;null","authenticated_server_only","nullableCanonicalObject",null],["unmapped","Record&lt;string,unknown&gt;","lossless_parser","canonicalObject","unrecognized current deliverables and legacy lines"]],"featureFlag":{"default":"off","enabledValue":"1","id":"FLAG-001","name":"NEXT_PUBLIC_SAFECLAW_WORKPACK_EDITORS_V2","off":"Render the current shared textarea editor and existing export behavior; preserve unknown deliverables.editorV2 JSON.","rollback":"Set flag to 0 and redeploy; do not delete editorV2 data or rewrite workpack rows."},"localDraftKey":"safeclaw:workpack-editor:v2:&lt;generationFingerprint&gt;","migrationPerformedByThisArtifact":false,"photo":{"beforeAfter":"Before and After metadata remain paired by local IDs and server improvementId; human verification is required before claiming improvement completion.","canonicalField":"documents.photoEvidenceDraft.content.improvements[].photoState","get":{"available":["improvement row id","task/hazard/improvement text","reflected_documents","review_status","source_type","photo_summary file names","analysis_payload"],"displayRule":"Hydrate metadata-only rows and show file names with preview unavailable; never synthesize assetId or storagePath.","endpoint":"GET /api/workpacks/[id]/improvements","unavailable":["photo row id","storage path","binary asset","signed URL"]},"legacyTwoFieldMap":[{"photoAssetState":["not_selected","local_display_only"],"recordState":["local_pending","display_only"],"to":"not_selected when no file metadata exists, otherwise local_display_only"},{"photoAssetState":["persistence_unverified"],"recordState":["server_improvement_recorded"],"to":"server_metadata_only only when serverImprovementId is present"},{"photoAssetState":["not_selected","local_display_only","persistence_unverified"],"recordState":["error"],"to":"upload_failed"},{"photoAssetState":["unknown/conflicting"],"recordState":["unknown/conflicting"],"to":"preserve both raw values in unmapped and emit a blocking issue"}],"local":{"contains":["File object in ephemeral component state","object URL for current-session preview","file name","mime type","size","caption and pairing metadata"],"persistence":"File and object URL are never serialized to editorV2 or localStorage; metadata may be serialized.","reload":"preview is unavailable after reload unless the user reselects the file"},"mapping":{"local_display_only":"photoState=local_display_only; one or two local File objects may exist only in component memory","not_selected":"photoState=not_selected; no selected file names or object URLs","server_metadata_only":"photoState=server_metadata_only only with an actual POST improvementId or matching GET improvement row; file names may reload but pixels cannot","upload_failed":"photoState=upload_failed after a failed/interrupted POST; local preview remains only for the current session","upload_in_flight":"photoState=upload_in_flight while POST is pending; reload converts it to upload_failed with an interruption issue and preserves the raw prior state in auditHistory"},"phaseAStates":["not_selected","local_display_only","upload_in_flight","server_metadata_only","upload_failed"],"post":{"endpoint":"POST /api/workpacks/[id]/improvements","responseAvailable":["improvementId","reviewStatus","sourceType","vision summary fields"],"responseUnavailable":["workpack_improvement_photos.id","storagePath","storageBucket","signed URL"],"storedGate":"Only ok=true plus non-empty improvementId permits transition to server_metadata_only."},"reviewAuthority":{"atomicWrite":"The approved transaction/RPC locks the candidate revision and analysis record; validates authenticated reviewer, action, root operation/idempotency, analysis snapshot/digest/model provenance, candidate control IDs/text digests, and source image digests; creates resultingRevision; recomputes document/evidence/materialization digests; reseals; computes canonicalEventDigest; and atomically writes immutable event, analysis snapshot, resulting revision, seal, audit history, and replay response.","canonicalAnalysisPayload":"Sort object keys recursively, preserve array order and null/absence, reject non-JSON values, serialize UTF-8 once, and compute sha256:&lt;64 lowercase hex&gt;. Persist the exact snapshot and digest together; later model output cannot replace it.","canonicalEventDigest":"sha256 over canonical {eventId,improvementId,pairId,action,transactionId,rootOperationId,analysis_id,analysis_payload,analysisPayloadDigest,modelProvider,modelName,modelVersion,candidateControlIds,candidateControlTextDigests,acceptedControlIds,acceptedControlTextDigests,rejectionReason,beforeImageSha256,afterImageSha256,reviewerId,reviewerDisplayName,confirmedAt,rejectedAt,occurredAt,candidateRevision,resultingRevision,priorMaterializationDigest,priorEvidenceDigest,resultingMaterializationDigest,resultingEvidenceDigest,resultingGenerationEvidenceSnapshotDigest}; exclude canonicalEventDigest itself.","currentReality":"The authenticated improvements route supports GET/POST only. POST creates review_status=candidate; no current route performs confirmed/rejected transition or records an immutable review event. Existing approved_by/approved_at columns do not supply analysis snapshot binding, model provenance, control/image digests, transaction identity, or concurrency guarantees.","digestType":"Sha256Digest = `sha256:${LowercaseHex64}`; parser requires exactly 64 lowercase hexadecimal characters after the prefix and serialization is byte-identical lowercase.","events":["HUMAN_CONFIRM_IMPROVEMENT","HUMAN_REJECT_IMPROVEMENT"],"evidenceGate":"A candidate, local preview, POST success, server_metadata_only state, model analysis, or unconfirmed control is never document/share evidence. Only a persisted confirmed event whose analysis/control/image digests match its immutable snapshots may derive a photo EditorEvidenceRef. Rejected candidates remain audit-only.","futureEvent":{"fields":{"acceptedControlIds":"stableIdArrayAllowEmpty","acceptedControlTextDigests":"canonicalObject","action":"HUMAN_CONFIRM_IMPROVEMENT&#124;HUMAN_REJECT_IMPROVEMENT","afterImageSha256":"nullableSha256HexDigest","analysisPayloadDigest":"sha256HexDigest","analysis_id":"stableId","analysis_payload":"canonicalObject","beforeImageSha256":"sha256HexDigest","candidateControlIds":"stableIdArrayNonEmpty","candidateControlTextDigests":"canonicalObject","candidateRevision":"strictInteger","canonicalEventDigest":"sha256HexDigest","confirmedAt":"nullableRfc3339","eventId":"stableId","improvementId":"stableId","modelName":"exactString","modelProvider":"exactString","modelVersion":"exactString","occurredAt":"isoDateTime","pairId":"stableId","priorEvidenceDigest":"digest","priorMaterializationDigest":"digest","rejectedAt":"nullableRfc3339","rejectionReason":"nullableExactString","resultingEvidenceDigest":"digest","resultingGenerationEvidenceSnapshotDigest":"digest","resultingMaterializationDigest":"digest","resultingRevision":"strictInteger","reviewerDisplayName":"exactString","reviewerId":"stableId","rootOperationId":"stableId","transactionId":"stableId"},"relationships":{"always":{"requires":["eventId","improvementId","pairId","action","transactionId","rootOperationId","analysis_id","analysis_payload","analysisPayloadDigest","modelProvider","modelName","modelVersion","candidateControlIds","candidateControlTextDigests","beforeImageSha256","reviewerId","reviewerDisplayName","occurredAt","candidateRevision","resultingRevision","priorMaterializationDigest","priorEvidenceDigest","resultingMaterializationDigest","resultingEvidenceDigest","resultingGenerationEvidenceSnapshotDigest","canonicalEventDigest"]},"analysisBinding":"analysisPayloadDigest is recomputed from the exact canonical analysis_payload snapshot and model fields come from its authenticated analysis record","confirm":{"forbidsNonNull":["rejectedAt","rejectionReason"],"requiresNonNull":["afterImageSha256","confirmedAt","acceptedControlIds","acceptedControlTextDigests"],"timestampEquality":"occurredAt=confirmedAt","when":"action=HUMAN_CONFIRM_IMPROVEMENT"},"controlBinding":"candidateControlTextDigests keys equal candidateControlIds; acceptedControlIds are a subset and acceptedControlTextDigests keys equal acceptedControlIds","eventBinding":"canonicalEventDigest covers every listed event field except itself","rejectCompletedPair":{"forbidsNonNull":["confirmedAt"],"requiresNonNull":["afterImageSha256","rejectedAt","rejectionReason"],"timestampEquality":"occurredAt=rejectedAt","when":"action=HUMAN_REJECT_IMPROVEMENT and rejectionReason!=missing_after_photo"},"rejectMissingAfter":{"forbidsNonNull":["confirmedAt"],"requiresNonNull":["rejectedAt","rejectionReason"],"requiresNull":["afterImageSha256"],"timestampEquality":"occurredAt=rejectedAt","when":"action=HUMAN_REJECT_IMPROVEMENT and rejectionReason=missing_after_photo"},"revision":"resultingRevision=candidateRevision+1"},"status":"FUTURE_NORMATIVE_ONLY_PENDING_APPROVED_TRANSACTION"},"id":"PHOTO-002","persistenceGate":"Confirmed/rejected persistence cannot exist before explicit user approval of immutable event/history plus transactional revision authority. The repository cannot authenticate that approval today; the entire Wave program, including local candidate UI, remains blocked until the user approves outside repository-authored evidence and a fresh independent spec PASS exists.","plannedFiles":["app/api/workpacks/[id]/improvements/[improvementId]/review/route.ts","lib/workpack-improvement-review.ts","tests/workpack-improvement-review-route.test.ts","supabase/migrations/&lt;approved&gt;_workpack_improvement_review_events.sql"],"plannedOwner":"blocked-photo-review-authority","privacy":"Raw before/after photo bytes, File objects, Blobs, object URLs, EXIF not explicitly retained, and local previews remain site-memory/session only and are never serialized to editorV2, future approval/provider/CI/DOM requirements, or the review event. Only typed source image digests and approved metadata may cross the boundary after authority approval.","revisionSealImpact":"Confirmation/rejection creates the next authoritative document revision, invalidates prior review/share blocks, recomputes final digests, and reseals before any share eligibility. Candidate/resulting revision, transactionId, rootOperationId, and event digest remain immutable history.","states":["candidate","confirmed","rejected"],"status":"BLOCKED_PENDING_USER_DB_APPROVAL","transition":"candidate -&gt; confirmed or candidate -&gt; rejected exactly once per authoritative review event; later changes append a superseding event and create a new document revision, never rewrite history."},"storedAssetDeferred":{"activationRequirement":"A future existing-response change must return owned photo rows and authorized display URLs.","databaseOrApiChangeInWaveThree":false,"rule":"Hydratable stored pixels are a deferred capability, not a Phase A photoState.","runtimeState":null,"waveThreeAllowed":false},"transitions":["not_selected -&gt; local_display_only on file selection","local_display_only -&gt; upload_in_flight on POST start","upload_in_flight -&gt; server_metadata_only only on ok=true plus non-empty improvementId","upload_in_flight -&gt; upload_failed on failure or interrupted reload","upload_failed -&gt; upload_in_flight on explicit retry","server_metadata_only -&gt; local_display_only when replacement files are selected"]},"primaryPath":"deliverables.editorV2","serverRevisionAuthority":{"approvalGate":"User must explicitly approve one root identity/idempotency strategy plus its migration, unique constraints, immutable event storage, and transactional RPC. An independent spec PASS is also required. This artifact authorizes none of that work.","conflict":{"concurrentRoot":"Unique root identity permits one root commit; exact retry replays, conflicting digest returns 409.","concurrentSameParent":"Exactly one transaction commits nextRevision; every loser receives 409 or exact replay. Duplicate logicalWorkpackId/revision is impossible.","staleExpectedRevision":"409 revision_conflict with latest workpackId/revision/materializationDigest/evidenceDigest and no mutation.","wrongParent":"409 revision_conflict and no mutation."},"currentLimitation":"POST /api/workpacks performs an insert after seal verification. Neither the route, current schema, nor buildWorkpackInsertPayload provides a unique logical chain, monotonic revision, idempotency replay, or concurrent-writer exclusion. An app-level select-latest then insert is race-prone and forbidden.","futureRequest":{"commonFields":["sealedReviewPendingResponse","parentWorkpackId&#124;null","expectedRevision","idempotencyKey","materializationDigest","evidenceDigest","confirmMaterialization=true"],"endpoint":"POST /api/workpacks","idempotencyKey":"non-empty opaque operation ID scoped by authenticated organization and logical chain/root operation","rootStrategyAFields":["client-generated stable logicalWorkpackId"],"rootStrategyBFields":["rootOperationKey; server allocates logicalWorkpackId"],"successorFields":["logicalWorkpackId","parentWorkpackId","expectedRevision&gt;=1"]},"id":"REVISION-001","plannedFiles":["app/api/workpacks/route.ts","lib/workpack-store.ts","lib/workpack-revision-authority.ts","tests/workpack-revision-authority.test.ts","tests/workpack-route-revision-authority.test.ts","supabase/migrations/&lt;approved&gt;_workpack_revision_authority.sql"],"plannedOwner":"blocked-server-revision-authority","replay":{"missingKey":"400 idempotency_key_required; no best-effort duplicate handling.","sameKeyDifferentRequestDigest":"409 idempotency_mismatch; no mutation.","sameKeySameRequestDigest":"200 original response byte-for-semantic-value with original actor/time/seal and replayed=true; no row/event is added.","sameRootIdentityDifferentKey":"409 logical_root_conflict or root_operation_mismatch unless it is a successor request with the exact committed parent/revision.","sameRootIdentitySameKey":"Apply the same replay rules.","transportRetry":"Repeat the same key and body; return the original response."},"rootIdempotency":{"selectionRule":"The approval chooses exactly one strategy. App-level preflight is forbidden for both.","strategyA":{"identityConflict":"A different root operation using the same organization/logicalWorkpackId returns 409 logical_root_conflict; it never creates another chain.","name":"client_logical_id","request":"Client generates one stable UUID logicalWorkpackId before first attempt; root requires parentWorkpackId=null and expectedRevision=0.","requiredUniqueConstraints":["UNIQUE(organization_id, logical_workpack_id, revision)","UNIQUE(organization_id, logical_workpack_id) WHERE revision=1","UNIQUE(organization_id, logical_workpack_id, idempotency_key)"]},"strategyB":{"identityConflict":"Same organization/rootOperationKey with a different request digest returns 409 root_operation_mismatch; no second logical chain is allocated.","name":"server_logical_id_from_root_operation","request":"Client supplies stable rootOperationKey; root requires parentWorkpackId=null and expectedRevision=0; server allocates logicalWorkpackId.","requiredUniqueConstraints":["UNIQUE(organization_id, root_operation_key)","UNIQUE(organization_id, logical_workpack_id, revision)","UNIQUE(organization_id, logical_workpack_id, idempotency_key)"]}},"shareEffect":"V2 share-session creation and dispatch remain disabled until this gate and the share freshness gate both pass.","status":"BLOCKED_PENDING_USER_DB_APPROVAL","testsAfterApproval":["both root strategies have isolated migration/RPC tests before one is selected","root save allocates exactly revision 1","same root key/logical ID exact retry replays original response","same root identity different digest/key returns the defined 409","successor uses exact parent/latest expectedRevision","stale revision and wrong parent return 409","parallel roots and successors yield one commit","client actor/time/approved fields are ignored","review_pending seal is verified and final human_confirmed response is resealed","no-edit confirmation does not mutate documents","edited confirmation requires revalidation/reseal"],"transaction":["Authenticate; derive organization, actor ID/display name, and server time from server context only.","Verify the incoming review_pending top-level generation seal and recompute the pre-authority materialization/evidence/request digests without content mutation.","Inside the approved RPC, look up the scoped idempotency record first. Same key+same request digest returns the original committed response; same key+different digest returns 409 idempotency_mismatch.","For root Strategy A, insert/lock the organization+logicalWorkpackId root identity under its unique constraint. For Strategy B, insert/lock organization+rootOperationKey and allocate logicalWorkpackId exactly once.","For a successor, lock the logical chain and latest row; require exact parentWorkpackId and expectedRevision, then allocate latest+1 under UNIQUE(organization_id,logical_workpack_id,revision).","Put authoritative chain values into the final candidate, recompute evidenceDigest and materializationDigest, then stamp authenticated HumanConfirmation and server time with final revision/digests.","Set human_confirmed without document mutation, delete only top-level generationEvidence/error, and call existing attachGenerationEvidence over the complete response.","Atomically insert the immutable revision and idempotency response record, then commit and return identifiers/revision/digests/actor/time/seal/replayed."],"wave0":"Blocked. No codec, adapter, local draft, test, UI, or other product file starts before both independent spec PASS and explicit user approval for the DB migration/transactional RPC authority. Spec and validator review are the only permitted work."},"storage":"existing workpacks.deliverables JSONB","topLevelSeal":{"copiedIntoEditorV2":false,"digestImplementation":"existing lib/generation-evidence.ts buildResponseContentDigest/attachGenerationEvidence/verifyAskResponseGenerationEvidence unchanged","errorPath":"AskResponse.generationEvidenceError","path":"AskResponse.generationEvidence","storedWithResponse":true}} |
| "schemaVersion" | "string" | 0 | 1 | 0 | "sha256:71bd01d9011f8e098a8bde9078e9f578d16d443a5d3f08708743dabb845a487f" | "2.8.0" |
| "sourceSeams" | "array" | 28 | 112 | 2 | "sha256:02befb5e7c221612783194a9081db6c368356c6c53dd7f4f5786a7571e1db511" | [["SRC-01","lib/risk-assessment-schema.ts","RiskAssessmentRow","All 21 production field names and enum/range validation are canonical; editor rows add only stable id in editorV2."],["SRC-02","lib/types.ts","WorkPlanStructured &#124; PermitInspectionStructured &#124; TbmBriefingStructured &#124; TbmLogStructured &#124; EducationRecordStructured &#124; TbmRiskLink","Known fields project to these existing structured payloads; richer v2-only fields remain in editorV2 and export manifests."],["SRC-03","lib/workpack-readiness.ts","applyWorkpackDeliverablesChange &#124; assessWorkpackReadiness","Current edit invalidates ontologyQa, qualityContract, and dbHarness; v2 extends invalidation to generationEvidence and generationEvidenceError."],["SRC-04","app/api/ask/route.ts","POST","Current full regeneration seam calls runAsk then attachGenerationEvidence; it is the fallback when no verified base exists, not an edit-preserving revalidator."],["SRC-05","lib/generation-evidence.ts","verifyAskResponseGenerationEvidence &#124; generationEvidenceReferences &#124; attachGenerationEvidence &#124; buildResponseContentDigest","The seal exists only at top-level AskResponse.generationEvidence. buildResponseContentDigest deletes only top-level generationEvidence/generationEvidenceError before hashing the remaining canonical response; editorV2 never nests either field."],["SRC-06","lib/workpack-ontology-qa.ts","attachWebOntologyQa &#124; buildOntologyQaSource","V2 review mode must attach a verdict without auto-mutating structured editor content; failed review returns blocking issues."],["SRC-07","lib/quality-contract.ts","attachQualityContract","Quality is recomputed only after deterministic editor projection and ontology review."],["SRC-08","app/api/workpacks/route.ts","POST","Current persistence verifies a top-level generation seal and performs one insert. It has no logical chain lookup, expectedRevision comparison, idempotency replay, transaction, or concurrent-writer exclusion; it cannot be v2 revision authority."],["SRC-09","lib/workpack-store.ts","buildWorkpackEvidenceSummary &#124; buildWorkpackInsertPayload &#124; buildReopenData","Existing JSONB can preserve optional editorV2 data losslessly, but JSONB alone cannot guarantee a unique monotonic revision chain or idempotent insert."],["SRC-10","lib/workpack-commercial-store.ts","assessStoredWorkpackShareAuthority","Current authority derives legacy readiness but does not verify editor block identity/revision/digest. No Wave owns that extension while DB authority is unapproved; v2 share remains blocked."],["SRC-11","app/api/workpacks/[id]/read-confirmations/route.ts","GET &#124; POST","Stores share-session read acknowledgment only; it cannot satisfy TBM attendance, understanding, signature, or safety confirmation."],["SRC-12","app/api/workpacks/[id]/improvements/route.ts","GET &#124; POST","POST returns improvementId but not photo row id/storagePath; GET returns improvements and photo_summary but not workpack_improvement_photos."],["SRC-13","components/WorkpackEditor.tsx","META_SECTION_PATTERNS &#124; META_KEY_PATTERNS &#124; parseSheetRows","Existing patterns prove body/metadata separation is already recognized for export; v2 moves the boundary into a shared lossless adapter used before editing."],["SRC-14","lib/search.ts","formatSafetyReferenceAppendix and deliverable appendix concatenation","Current generation concatenates provenance into strings; v2 projects those appendices into separate evidence/review roots and never binds the combined string to an editor."],["SRC-15","lib/official-safety-resources.ts","OFFICIAL_SAFETY_RESOURCES candidates","Hardcoded URLs are untrusted candidates, including guidanceX.do."],["SRC-16","lib/kosha.ts","fetchKoshaReferences &#124; verifyReference &#124; verified","Only current runtime verified=true HTTPS results may become drawer links."],["SRC-17","components/CurrentWorkpackModules.tsx","WorkpackEditor onChange -&gt; applyWorkpackDeliverablesChange","Current user edits propagate to workpack readiness; v2 passes canonical envelope changes and explicit revalidation invalidation through this call site."],["SRC-18","app/api/workpacks/[id]/route.ts","GET","Current reopen seam hydrates stored deliverables/evidence_summary/status; adapter precedence begins from the authoritative stored JSON."],["SRC-19","components/WorkpackEditor.tsx -&gt; app/api/export/xlsx/route.ts","downloadXlsx -&gt; POST","At target f98ae7d the editor posts single or one of five structured modes to /api/export/xlsx. Round-trip integration belongs only to the later owner of both WorkpackEditor and the route."],["SRC-20","components/WorkpackEditor.tsx -&gt; app/api/export/pdf/route.ts","printPdf -&gt; POST ?format=html","At target f98ae7d the editor posts title/scenario/rows/riskRows/documentText/risk summary and prints returned HTML. PDF round-trip integration belongs only to the later owner of both call site and route."],["SRC-21","components/WorkpackEditor.tsx -&gt; app/api/export/hwp/route.ts","downloadHwp -&gt; binary POST","At target f98ae7d the editor posts document rows/profile/scenario/risk rows and downloads the binary .hwp response. It is not an HTML-only seam."],["SRC-22","components/WorkpackEditor.tsx","buildHwpxWithRhwp -&gt; downloadHwpx","At target f98ae7d HWPX is built client-side with @rhwp/core HwpDocument.exportHwpx. The separate GET /api/export/hwpx-template route is not the document editor HWPX call site and is excluded from editor round-trip exits."],["SRC-23","app/api/workpacks/[id]/share-sessions/route.ts","GET &#124; POST","Current POST accepts recipients only and persists no editor document/block/revision/digest binding. V2 session creation remains disabled until server revision authority and a reviewed route contract land together."],["SRC-24","app/api/workflow/dispatch/route.ts","POST","Current request parsing and session load do not enforce editor block freshness. V2 dispatch remains disabled; client assertions or app-level preflight cannot substitute for transactional server authority."],["SRC-25","supabase/migrations/002_workspace_productization.sql","workpacks","Current columns have no logical_workpack_id, parent_workpack_id, revision, idempotency_key, or unique chain constraint. Authoritative revision work therefore requires separately approved migration/RPC or proof of an equivalent existing transactional facility."],["SRC-26","app/api/workpacks/[id]/improvements/route.ts","GET &#124; POST","The authenticated route creates candidate rows and reads metadata. It exposes no confirm/reject transition, immutable review event, photo-row identity, storage path, or authorized asset URL."],["SRC-27","lib/safety-reference-catalog.ts","SafetyReferenceItem","Raw catalog provenance includes all required fields, optional display/source fields, and the complete kosha_guide object with anchors, referenceId, stableDocumentKey, version, evidenceRef, lifecycle, quality, bodyKind, and directEligible."],["SRC-28","lib/ontology/evidence-chain-registry.ts","LawEvidenceRecord &#124; SifEvidenceRecord &#124; KoshaGuidanceRecord","Raw ontology provenance preserves its discriminator and complete record. KOSHA guidance additionally preserves chunk.supportStatement, registryMapping, and provenanceBridge; resolution is ontology-only."]] |
| "tupleSchemas" | "object" | 5 | 18 | 2 | "sha256:bc62b3bc80c113796d0e35be1382a3ae9aa3e19be618c0721122173cd70646d8" | {"acceptance":["id","assertion"],"browserAssertion":["id","fixture","measurableAssertion"],"field":["path","type","required","codec","currentStructuredPath&#124;null"],"source":["id","path","symbol","contract"],"transition":["from","event","to","effectsId"]} |
| "ui" | "object" | 13 | 269 | 4 | "sha256:cfd06046353122545ef16f4cf782a782f69c15643b679780eb6d31123e3cb44b" | {"accessibility":{"requirements":["One active tabpanel with matching accessible name.","Native select document navigation on mobile.","Programmatic labels, descriptions, and error associations for every control.","Polite live regions for save/review status and focused validation summary links.","Move up and Move down controls for every reorder operation.","Predictable focus after add, remove, undo, cancel, and conflict resolution.","Color is never the only state indicator.","Day and Night normal text contrast is &gt;=4.5:1 and non-text state boundary contrast is &gt;=3:1.","Reduced-motion support.","Minimum 44 by 44 CSS pixel interactive targets.","Evidence trigger rendered text and accessible name match; drawer uses dialog semantics, focus trap, Escape close, and trigger focus restoration.","Download visible label and aria-label are both exactly 다운로드.","The 준제출형 source-confirmation caveat uses role=alert and is announced before provenance controls.","On mobile the document page is the sole editor scrolling surface; drawer scrolling is isolated while the background is inert."],"standard":"WCAG 2.2 AA"},"actions":{"download":{"ariaLabel":"다운로드","rule":"Rendered label and aria-label are byte-identical. It is neutral secondary styling and cannot compete with the lifecycle primary CTA.","visibleLabel":"다운로드"},"generatedSecondary":"편집 is a neutral secondary command that triggers generated -&gt; edited without forcing content mutation for confirmation.","oneDominantAction":true,"secondary":["문서 선택","편집 when not the current primary","다운로드","근거 trigger"],"shareReadiness":"Read-only status text or compact status row; it is never a second CTA. With REVISION-001 blocked, review_pending shows one blocker and no enabled confirm/save/share action.","statePrimary":{"edited":"재검수 요청","generated":"검토 시작","human_confirmed":"공유로 이동","review_pending_authority_blocked":null,"review_pending_authority_ready":"확인하고 저장","share_block_stale":"공유본 다시 만들기","stored_fresh":"공유로 이동"}},"browserAssertions":[["BROWSER-001","all","document.documentElement.scrollWidth === document.documentElement.clientWidth"],["BROWSER-002","coreGenerated/default","exactly one [data-testid=evidence-summary-trigger], zero yellow evidence badges, zero persistent evidence rails, zero duplicate left evidence summaries, and zero default result/citation/operation-graph panels"],["BROWSER-003","coreGenerated/default","document.body.innerText has zero occurrences of 중처법 §4-3호 증빙; open drawer has at most one"],["BROWSER-004","coreGenerated/default","trigger text and accessible name both equal 근거 3건 · 확인 필요 1건 and drawer section totals use the same selectDocumentEvidenceSummary result object"],["BROWSER-005","1150x900","selector width &lt;=220px, main editor width &gt;=700px, readable body width &gt;=560px, evidence rail width=0px"],["BROWSER-006","1440x1000","main editor width &gt;=920px, readable body width &gt;=720px, evidence rail width=0px"],["BROWSER-007","mixedLegacyRisk","no input/textarea/contenteditable value contains any appendixSentinel, dbHarness, ontologyQa, qualityContract, generationEvidence, management note, or operation graph token"],["BROWSER-008","390x844 and 391x844","after activating 편집, selected editor heading getBoundingClientRect().top &lt;=160px"],["BROWSER-009","390x844 and 391x844","every visible editor textarea has scrollHeight &lt;= clientHeight+1, page scrollHeight &lt;=3600px for mixedLegacyRisk collapsed fixture, and only an open drawer may have overflow-y auto/scroll"],["BROWSER-010","all/default","computed body font-size&gt;=15px and line-height&gt;=23px; table&gt;=14/20; label&gt;=13/18; no default text=11px; letter-spacing=0px"],["BROWSER-011","each lifecycle fixture","enabled visible [data-cta-priority=primary] count is exactly one when an action is available and zero in loading/offline; all other commands lack primary styling"],["BROWSER-012","all/default","each Download control has textContent=다운로드 and aria-label=다운로드 byte-for-byte"],["BROWSER-013","sourceWarning/day+night","warning has role=alert, data-severity=warning, font-size&gt;=14px, line-height&gt;=20px, font-weight&gt;=600, leading border width=2px, text contrast&gt;=4.5:1, border contrast&gt;=3:1; evidence trigger lacks alert role/severity"],["BROWSER-014","drawer/day+night","opening drawer changes main editor width by &lt;=1px; focus remains inside, Escape closes, trigger regains focus, and mobile background is inert"],["BROWSER-015","coreGenerated","direct/supporting evidence, DB harness, safety readiness, law actions, provenance, materialization, and review_required nodes are absent when drawer closed and present only under the open drawer"],["BROWSER-016","unverified guidanceX.do","zero rendered anchors have href containing guidanceX.do; only verified=true HTTPS URLs tied to current digest render anchors inside drawer"],["BROWSER-017","each viewport day vs night","selector, title, warning, command row, evidence trigger, editor, primary action, and share-readiness bounding x/y/width/height differ by &lt;=1px and DOM/accessibility order is identical"],["BROWSER-018","all/default","every visible interactive target is &gt;=44x44 CSS px; [data-editor-stack] computed gap=8px; non-overlay selector/title/commands/editor/share-readiness rectangles have zero intersection area"],["BROWSER-019","mixedLegacyRisk/edit","no element matching [data-editable-submission-body] contains [data-provenance-appendix], [data-review-artifact], [data-operation-graph], KOSHA/law/internal-DB/ontology-QA tokens, or a value length &gt;2000; all such detail appears only after the single drawer opens"],["BROWSER-020","drawer","closed default has zero directEvidence/dbHarness/safety-control/supporting-ref/law-open-action nodes; open drawer has exactly one section root for each available category and closing removes or hides all from the accessibility tree"],["BROWSER-021","photo candidate","candidate and server_metadata_only fixtures render data-evidence-eligible=false, reviewDecision/event/control empty, zero enabled share controls, zero assetId/storagePath nodes, and no img for reloaded pixels"],["BROWSER-022","all editors at 391x844","every auto-grow textarea has overflow-y=hidden, max-height=none, scrollHeight&lt;=clientHeight+1; section editors use page scroll only and no ancestor between field and document surface has overflow-y auto/scroll"],["BROWSER-023","blocked server authority","logicalWorkpackId/parentWorkpackId/revision absent or null yields zero enabled human-confirm/save/share/dispatch controls and exactly one data-blocker=revision-authority-required message"],["BROWSER-024","200% root typography policy","all 144 cases keep devicePixelRatio=visualViewportScale=deviceScaleFactor=1, apply data-safeclaw-text-policy=double and root type scale=2 exactly once, independently compute font/line ratios 1.9..2.1, and prove designated long-text reflow"],["BROWSER-025","200% independent containment","future tests generated from the locator census measure zero cross-parent overlap, fixed/sticky escape, clipping, inner transform/zoom, document overflow, nested editor/textarea scroll, or mobile editor-start failure and preserve the simplified cockpit; current browser executions=0"]],"browserFixtures":{"coreGenerated":"riskAssessmentDraft with three referenced evidence IDs: eligible-law, eligible-kosha, unresolved-future; expected trigger 근거 3건 · 확인 필요 1건","lifecycle":["generated","edited","review_pending","human_confirmed","share_block_stale"],"mixedLegacyRisk":"the audited 5,221-character string containing editable body plus every known appendix sentinel","sourceWarning":"준제출형 response with source confirmation caveat present","themes":["day","night"]},"direction":"restrained Linear/Codex-like workbench","invariant":{"controlMinPx":44,"horizontalOverflow":false,"nestedDecorativeCards":false,"progressiveDisclosure":true,"spacingPx":8},"layout":{"containment":"At every required viewport documentElement.scrollWidth equals clientWidth and no editor descendant exceeds its containing block.","desktop1150Targets":{"documentSelectorWidthMaxPx":220,"mainEditorWidthMinPx":700,"persistentEvidenceRailWidthPx":0,"readablePreviewTextWidthMinPx":560},"desktop1440Targets":{"mainEditorWidthMinPx":920,"persistentEvidenceRailWidthPx":0,"readablePreviewTextWidthMinPx":720},"desktopMin1024":"Two tracks only: minmax(176px,220px) document selector plus minmax(0,1fr) main, 16px gap; no evidence track.","mobileMax767":"One main track. Document navigation is a native 44px select above the title; no left or right rail. Structured sections use progressive disclosure."},"measuredFailingBaseline":{"appWorkbenchClampPx":968,"clampedColumnsPx":{"documentRail":194,"evidenceRail":260,"preview":453},"evidenceLabelTypographyPx":{"fontSize":11,"lineHeight":16},"literalSmsaEvidenceLabel":"중처법 §4-3호 증빙","literalSmsaEvidenceRepeatCount":5,"mobile391x844":{"editorY":1655,"pageScrollHeight":9120,"textareaPx":{"height":460,"width":252},"textareaScroll":{"clientHeight":455,"scrollHeight":11511},"workpackY":1456},"riskEdit":{"belowEditorDuplicates":["result summary","citation list","operation graph"],"combinedTextareaCharacters":5221,"desktopBodyScrollHeight":4927,"desktopTextareaPx":{"height":460,"width":563},"desktopTextareaScroll":{"clientHeight":455,"scrollHeight":4975},"mixedContent":["editable document body","provenance appendix","KOSHA technical rules","internal safety DB","ontology QA","management notes"]},"sameProvenanceRepeatCountUpTo":6,"viewport1150ColumnsPx":{"documentRail":194,"evidenceRail":260,"preview":507},"viewport1150UsablePreviewTextWidthApproxPx":250},"mobileScroll":{"activationFocus":"After Edit, scroll and focus the selected document heading so getBoundingClientRect().top is at most 160px.","defaultOpenSections":1,"masterTextarea":"forbidden","multilineDesktop":"auto-grow from 96px to 320px; after 320px only the focused field may scroll internally","multilineMobile":"auto-grow with overflow-y:hidden and no max-height; the page is the sole editor scroll container","nestedScrollAssertion":"At 390x844 and 391x844, no visible editor textarea has scrollHeight greater than clientHeight by more than 1px; only the evidence drawer may own an internal vertical scroller.","samplePageHeightTargetPx":3600,"sampleRule":"For the audited generated risk sample, default collapsed editor documentElement.scrollHeight is at most 3600px and no known appendix sentinel appears in an editable value.","shortControls":"44px minimum, no internal scrolling","structuredRowsMobile":"Show one expanded row or section at a time; collapsed summaries remain 44px minimum."},"states":{"conflict":"Explicit Keep mine or Load newer decision.","empty":"Document-specific structured empty state with one create action; no empty state exposes a mixed master textarea.","error":"Last recoverable structured local draft remains visible with Retry and Restore generated source; provenance parse failures remain in audit/unmapped and block authority.","loading":"Stable editor geometry skeleton near the top; stale values and appendices are not editable during hydration.","offline":"Local structured editing and local checkpoint allowed; evidence drawer shows last verified snapshot as stale. Revalidate, confirm, server save, authoritative export, and share are disabled.","readOnly":"Selection, copy, evidence navigation, and blockers remain available; edit actions hidden."},"textZoom200":{"browserExecutions":0,"evidenceGate":"Browser execution count is exactly 0 for this artifact. Neither spec-review nor implementation mode can emit typography/browser PASS; implementation mode is unconditionally blocked.","futureImplementationChecks":{"clipping":"For each visible node, walk every declared ancestor. Reject horizontal or vertical rect escape when ancestor overflow is hidden, clip, auto, or scroll; reject document scrollWidth&gt;clientWidth+1 and clipped controls/text.","controls":"Every visible interactive rect is at least 44x44 CSS px and the structured stack gap is 8px.","fixedSticky":"Every visible fixed or sticky node rect is wholly within the viewport and does not cover another priority region.","mobileStart":"At mobile390 after Edit, editor root top&lt;=200px and selected editor heading top&lt;=160px.","noTrust":"Do not read pass/result booleans. A sidecar containing any forbidden field fails before metrics are computed.","overlap":"Compute cross-parent positive-area intersections for every pair of visible priority regions regardless of parent. Only the open drawer/backdrop allowlist may overlap.","reflow":"Every designated long-title/warning/table-label/action probe increases lineCount; a raw claimed reflow value is ignored.","scroll":"The page is the sole editor scroller. Reject non-drawer overflow auto/scroll with scrollHeight&gt;clientHeight+1; require every textarea overflow-y:hidden and scrollHeight&lt;=clientHeight+1.","textScale":"For every text-role node, scaled/baseline fontSize and lineHeight ratios are independently calculated and each must be 1.9..2.1.","transforms":"Every measured node and ancestor has transform=none and numeric zoom=1; inner transform/zoom scaling is forbidden."},"futureLocatorCensus":{"fixtureSets":["priorityRegionIds","reflowProbeIds","textareaIds","drawerIds","editorRootId","mobileEditorHeadingId"],"forbiddenFields":["pass","passed","result","outputSha256","claimedMetrics"],"identity":["fixtureId","sourceSha","buildId","browser","viewportId/width/height","theme","documentKey"],"invariant":["deviceScaleFactor=1","devicePixelRatio=1","visualViewportScale=1","applicationCount=1","baselineRootScale=1","scaledRootScale=2","baselinePolicy=baseline","scaledPolicy=double","structuredGapPx=8"],"kind":"future safeclaw-browser-typography-census","snapshots":"baseline and scaled each contain page metrics and every measured node: id, parentId, semantic role, text role, visible, DOMRect, client/scroll dimensions, lineCount, computed fontSize/lineHeight, overflowX/Y, position, transform, zoom, text-size-adjust, maxHeight, and clipping ancestor IDs.","status":"IMPLEMENTATION_REQUIREMENT_UNEXECUTED"},"futureTestGeneration":"After explicit DB authority approval and a separate post-approval verifier design, implementation tests must be generated from the locator census for every declared browser/viewport/theme/document row. The tests, not this spec validator, must capture measurements and exercise negative geometry states.","harness":{"applyExactlyOnce":"Set documentElement.dataset.safeclawTextPolicy=double (data-safeclaw-text-policy=double) and root --safeclaw-type-scale=2 in one evaluate transaction; increment a harness-owned applicationCount from 0 to 1. Typography tokens consume that root scale. Do not call the policy twice.","baseline":"Future implementation harness: start a fresh context with deviceScaleFactor=1, devicePixelRatio=1, visualViewport.scale=1, data-safeclaw-text-policy=baseline, --safeclaw-type-scale=1, and text-size-adjust=100%, then capture the locator census before mutation.","cumulativeGuard":"applicationCount must equal 1; baseline root scale=1 and scaled root scale=2; no ancestor or descendant may contribute transform/zoom/text-size multiplier. Computed text ratios outside 1.9..2.1 fail.","policy":"The test-only root policy scales font-size and line-height tokens only. Browser/native zoom, CSS zoom, transforms, deviceScaleFactor changes, screenshot scaling, nested font multipliers, and visualViewport changes are forbidden."},"id":"ZOOM-001","matrix":{"browsers":["Chromium","Firefox","WebKit"],"caseCountPerBrowser":48,"documentKeys":"all 12 in exact registry order","themes":["day","night"],"totalCaseCount":144,"viewports":["desktop1440","mobile390"]},"status":"DECLARED_NOT_EXECUTED","validatorCoverage":"NORMATIVE_STRUCTURE_ONLY; spec-review executes no browser and reports no geometry, typography, reflow, or DOM PASS"},"typography":{"body":{"letterSpacing":0,"minimumFontSizePx":15,"minimumLineHeightPx":23},"caption":{"minimumFontSizePx":12,"minimumLineHeightPx":18,"use":"drawer metadata and timestamps only"},"forbidden":["11px text on the default workbench","stacking hud11, caption12, and table13 muted/subtle tiers in a narrow column","more than one muted hierarchy level in the default document column"],"label":{"fontWeight":600,"letterSpacing":0,"minimumFontSizePx":13,"minimumLineHeightPx":18},"table":{"letterSpacing":0,"minimumFontSizePx":14,"minimumLineHeightPx":20},"title":{"fontSizePx":20,"fontWeight":650,"letterSpacing":0,"lineHeightPx":28}},"warning":{"contrast":"In Day and Night fixtures, warning text/background contrast is &gt;=4.5:1 and the leading-border/background contrast is &gt;=3:1 using computed RGB values. EvidenceSummaryTrigger has no role=alert or data-severity=warning.","distinction":"This warning is not an evidence badge and must not use the removed yellow badge composition.","precedence":"DOM order is title/status, warning, commands, evidence trigger. Screen-reader order matches DOM order; this measurable order and role distinction establish warning priority.","presentation":"Persistent inline AlertTriangle warning directly below title/status with role=alert, data-severity=warning, font-size&gt;=14px, line-height&gt;=20px, font-weight&gt;=600, and a 2px leading border.","warning":"준제출형 source-confirmation caveat"}} |
| "validation" | "object" | 14 | 115 | 4 | "sha256:763a308354e2e331a81f4d76a396d52f967d9219e068a9d5999836222368b8fa" | {"candidateArtifacts":["evaluation/workpack-document-editors-v2-2026-07-13/spec.md","evaluation/workpack-document-editors-v2-2026-07-13/spec.json","evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs"],"commandContracts":{"authoringCheck":{"status":"LOCAL_STRUCTURE_PARITY_ONLY","tokens":["node","evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs","authoring-check"]},"implementation":{"executionCount":0,"status":"BLOCKED_NO_SUCCESS_COMMAND","tokens":[]},"specReview":{"optionalDeliberateSuffix":["--deliberate","&lt;ALLOWLISTED_CASE&gt;"],"status":"SPEC_REVIEW_ONLY","tokens":["node","evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs","spec-review","--evidence","&lt;FULL_EVIDENCE_SHA&gt;","--manifest","evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json","--candidate","&lt;FULL_CANDIDATE_SHA&gt;","--source-base","f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","--target","f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5","--validation-time","&lt;STRICT_RFC3339_CURRENT_TIME&gt;"]}},"currentClaims":{"browserExecutionCount":0,"executionCount":0,"facts":["CANDIDATE_JSON_PARSE_DECLARED","STRUCTURAL_19_DOMAIN_SCHEMA_DECLARED","MARKDOWN_PARITY_DECLARED","IMMUTABLE_IDENTITY_DECLARED","SIX_WAVES_BLOCKED_DECLARED"],"implementationExecutionCount":0,"kind":"safeclaw-spec-review-declarations/v1","scope":"SPEC_STRUCTURE_IDENTITY_PARITY_ONLY"},"currentGate":"STAGE_AWARE_SPEC_REVIEW_ONLY","evidenceManifest":"evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json","futurePostApprovalVerifierRequirements":{"activation":"Only after an explicit user DB migration/transactional-RPC approval outside this repository and a fresh independent spec PASS may a separate post-approval verifier be designed, implemented, reviewed, and bound to the then-current provider and CI trust surfaces.","approval":{"currentExecutableAcceptance":"none","futureRequirement":"Bind an externally authenticated approval event identity, actor, strict RFC3339 timestamp, target SHA, immutable spec SHA, and exact migration/RPC proposal digest. No repository-authored JSON, boolean, hash, commit message, Codex prose, or current validator output is authoritative approval."},"domAndBrowser":{"browserExecutions":0,"currentExecutableAcceptance":"none","futureRequirement":"Generate implementation tests from the declared locator census, execute the 144-case 200 percent matrix, and independently recompute typography, reflow, fixed/sticky, cross-parent, clipping, transform/zoom, overflow, nested-scroll, textarea, control-size, gap, and mobile-start metrics from raw measurements."},"postApprovalVerifier":"not implemented; this candidate intentionally contains no implementation PASS path","providerAndCi":{"currentExecutableAcceptance":"none","futureRequirement":"Bind provider run/build identity, exact argv, source SHA, exit status, logs, and artifact bytes through a provider-verifiable trust root selected after approval. The present repository cannot establish that trust root."},"repositoryAuthoredManifestAuthoritative":false,"repositoryCanAuthenticateUserApprovalEvent":false,"status":"FUTURE_NORMATIVE_ONLY_UNAUTHENTICATED_UNEXECUTED"},"implementationProgramGate":"Both independent PASS of the candidate/evidence pair and explicit user DB approval are required. Neither alone starts Wave 0.","modes":{"implementation":"Always exits nonzero with IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL before reading or accepting claimed gates, approvals, manifests, receipts, hashes, logs, artifacts, sidecars, base/head ranges, or browser metrics. A separate post-approval verifier may be designed only after explicit user DB approval and fresh review.","spec-review":"Runs only through the exact canonical token command, reads the immutable candidate and evidence-only child with git show, verifies exact candidate/source/target/evidence identity and blob hashes, enforces strict RFC3339 with a 300-second future and injected-clock bound, validates all 19 JSON domains recursively plus cross-domain relationships, and proves generated structural, generated human, and outside-prose Markdown parity. It executes no product, browser, export, DB, approval, provider, or CI behavior."},"notCurrentlyProved":{"executionCount":0,"facts":["BROWSER_BEHAVIOR_UNEXECUTED","EXPORT_ROUND_TRIP_UNEXECUTED","IMPLEMENTATION_TESTS_UNEXECUTED","SERVER_REVISION_AUTHORITY_BLOCKED","PHOTO_CONFIRMATION_PERSISTENCE_BLOCKED","SHARE_FRESHNESS_ENFORCEMENT_BLOCKED","INDEPENDENT_REVIEW_OUTSIDE_ARTIFACT","USER_DB_APPROVAL_OUTSIDE_REPOSITORY"],"kind":"safeclaw-unexecuted-scope/v1"},"redCases":["normative-parity","md-prose","json-model","json-document-primary-action","json-unknown-domain","domain-missing","domain-empty","document-fields-empty","document-primary-action-empty","photo-object-empty","photo-analysis-missing","photo-confirm-after-missing","conflict-heads-empty","conflict-local-ref-empty","wave-unblocked","forged-spec-claims","forged-evidence-claims","synthetic-geometry-pass","future-evidence-time","wave-command-echo-pass","candidate-ref","source-base-ref","target-ref","evidence-parent","implementation-empty","implementation-forged","implementation-complete-looking"],"semanticParity":"STRUCTURAL_ALL_DOMAIN_AND_HUMAN_PROSE_PARITY","targetBlobPaths":["components/WorkpackEditor.tsx","lib/risk-assessment-schema.ts","lib/safety-reference-catalog.ts","lib/ontology/evidence-chain-registry.ts","lib/generation-evidence.ts","app/api/workpacks/route.ts","supabase/migrations/002_workspace_productization.sql","app/api/workpacks/[id]/improvements/route.ts","app/api/workpacks/[id]/share-sessions/route.ts","app/api/workflow/dispatch/route.ts","app/api/export/hwp/route.ts","app/api/export/pdf/route.ts","app/api/export/xlsx/route.ts","app/api/export/hwpx-template/route.ts"],"timestampPolicy":{"futureSkewSeconds":300,"injectedTimeMaxClockDeltaSeconds":300,"kind":"strict-rfc3339-bounded/v1","rules":["CALENDAR_AND_OFFSET_VALIDATION","NO_DATE_PARSE","EVIDENCE_NOT_AFTER_VALIDATION_TIME_PLUS_SKEW","INJECTED_TIME_WITHIN_SYSTEM_CLOCK_SKEW"],"validationTimeSource":"EXPLICIT_STRICT_RFC3339_WITH_SYSTEM_CLOCK_GUARD"},"validator":"evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs"} |
| "workflow" | "object" | 9 | 204 | 4 | "sha256:b0a87122e9f66ef9e1cba0a74412fa13dc811b383f863eeecf709fc49e2dde74" | {"commands":{"autosave":"local draft recovery only; it is never authoritative server save","cancel":"Before revalidation, Cancel restores the selected document to its last explicit local checkpoint after confirmation. During a network request it requests abort where safe, retains the checkpoint, and never rolls back a completed server insert.","conflict":"pause autosave and require Keep mine or Load newer; never merge free text automatically","offline":"local editing and local checkpoint allowed; revalidate, confirm, server save, export authority, and share disabled","save":"The only authoritative save is the authenticated review_pending -&gt; human_confirmed POST /api/workpacks transition; local autosave/checkpoints are recovery only.","shortcuts":["Ctrl+S requests the current permitted primary save/review action","Ctrl+Z undo","Ctrl+Y redo","Ctrl+Shift+Z redo"],"undo":{"historyLimit":50,"preserves":["stable row IDs","legacy appendix audit history","unknown values"],"resetOn":["successful authoritative save","Load newer conflict resolution"],"scope":"selected document content transaction only; evidence/review artifacts and server confirmations are never undoable client-side","textCoalescingMs":750}},"disclaimer":"자동 생성 문서와 자동 검수 결과는 현장 조건 확인, 법적 판단, 작업 승인 또는 안전 책임자의 확인을 대신하지 않습니다. 실제 작업 전 담당자가 내용·근거·작업자 이해 여부를 직접 확인해야 합니다.","effects":{"EDIT_INVALIDATE":{"clear":["AskResponse.dbHarness","AskResponse.ontologyQa","AskResponse.qualityContract","AskResponse.generationEvidence","AskResponse.generationEvidenceError","editorV2.reviewArtifacts.dbHarness","editorV2.reviewArtifacts.ontologyQa","editorV2.reviewArtifacts.qualityContract","editorV2.humanConfirmation"],"increment":"localDraftRevision only; authoritative revision is unchanged until the approved transactional save succeeds","preserveAuditOnly":["baseGenerationDigest","previous materializationDigest","previous evidenceDigest","raw legacy appendix"],"stale":"all dependent share blocks"},"REVALIDATE_FAIL":["retain local draft","surface blocking issues","keep share locked"],"REVALIDATE_PASS":["verify untouched base top-level generationEvidence","recover trusted generationEvidenceReferences","project editable content without audit appendix","validate RiskAssessmentRow fields and all references","buildDbHarnessPacket","attach ontology QA in review-only/no-mutation mode","attachQualityContract","compute evidenceDigest and materializationDigest","set review_pending","clear top-level generationEvidence/generationEvidenceError on final candidate","reseal with existing attachGenerationEvidence; never copy the seal into editorV2"],"SERVER_CONFIRM_SAVE":["blocked until REVISION-001 approval gate","authenticate and ignore client identity","verify the incoming top-level review_pending seal and its claimed pre-authority materialization/evidence digests","require explicit confirmMaterialization=true","inside one transaction/RPC resolve logicalWorkpackId latest revision and compare expectedRevision/parentWorkpackId","apply idempotency replay rules","allocate the authoritative logicalWorkpackId/parentWorkpackId/revision","recompute evidenceDigest and materializationDigest after inserting those authoritative chain values into the final candidate","stamp ActorProvenance and HumanConfirmation with server actor/time and those final digests/revision","set human_confirmed without changing document content","clear top-level seal/error on the final candidate and reseal with existing attachGenerationEvidence","insert exactly one immutable next revision","return authoritative identifiers/revision/digests/replay flag"],"VALIDATE_UNEDITED_FAIL":["leave generated document content unchanged","surface blocking issues","keep human confirmation and share locked"],"VALIDATE_UNEDITED_PASS":["verify the existing top-level generationEvidence","assert all document content and legacy submission body bytes are unchanged","validate current risk/evidence/review artifacts","compute local draft digests and set review_pending metadata without changing document content","clear only top-level generationEvidence/generationEvidenceError on the candidate","reseal with existing attachGenerationEvidence","leave human identity/approval/legal or safety confirmation empty"]},"forbiddenTransitions":["generated -&gt; human_confirmed without validation and explicit authenticated confirmation","edited -&gt; human_confirmed without revalidation/reseal and explicit authenticated confirmation","raw model output -&gt; review_pending","model output -&gt; approved","model output -&gt; approver identity","model output -&gt; legal or safety confirmation","local draft -&gt; authoritative revision","app-level latest-row preflight -&gt; race-safe authority"],"revalidation":{"authority":"May return a sealed review_pending candidate but cannot allocate an authoritative server revision or unlock share.","endpoint":"planned POST /api/workpacks/revalidate; absent at this spec commit","failClosed":true,"fallback":"POST /api/ask only when base is absent/unsealed/invalid; full regeneration never claims edit preservation","modes":["validate_unedited","revalidate_edited"],"pass":["risk valid","evidence resolves","dbHarness ready","ontology QA pass","quality ready","zero dropped/unmapped fields"],"request":["mode","sealed baseResponse","editorV2 candidate","expectedBaseGenerationDigest","localDraftRevision"]},"reviewStates":["generated","edited","review_pending","human_confirmed"],"save":{"authority":"authenticated server actor and server time inside one transaction/RPC only","commonRequest":["sealed review_pending response","parentWorkpackId&#124;null","expectedRevision","idempotencyKey","expected materializationDigest","expected evidenceDigest","confirmMaterialization=true"],"currentEndpoint":"POST /api/workpacks is insert-only and is not v2 revision authority","databaseMigrationOrRpcApprovalRequired":true,"futureEndpoint":"POST /api/workpacks after REVISION-001 approval and transactional implementation","futureLocalDraftBehaviorAfterProgramStartGate":"Only after independent spec PASS and explicit user DB approval may Wave 0 implement a local checkpoint; it is never a server-authoritative save, human_confirmed persistence, or share unlock.","rootRequest":{"selection":"Exactly one user-approved strategy; never both.","strategyA":["client-generated stable logicalWorkpackId","parentWorkpackId=null","expectedRevision=0"],"strategyB":["stable rootOperationKey","parentWorkpackId=null","expectedRevision=0","server allocates logicalWorkpackId"]},"successorRequest":["logicalWorkpackId","exact parentWorkpackId","expectedRevision&gt;=1"]},"share":{"blockedUntil":"REVISION-001 transactional authority is approved and green, then the separately owned share-session/dispatch routes bind and recheck that authority. Before both gates, v2 session creation and dispatch are disabled with freshness_server_contract_missing; legacy flag-off behavior is unchanged.","currentServerEnforcement":false,"dispatchContract":{"authority":"The server must load the stored binding and query the latest authoritative logicalWorkpackId revision immediately before provider preflight; compare documentKey, blockId, sourceRevision, evidenceDigest, state, and human confirmation. A client preflight or latest-row query outside the approved transaction is insufficient.","implementationState":"blocked; current route has no editor freshness authority","owner":"blocked-server-share-authority","providerRule":"No fixture or live provider call occurs before the freshness comparison passes.","reject409":["binding missing/invalid","block missing","block stale","revision mismatch","digest mismatch","confirmation/readiness changed"],"requestShape":"Keep current workpackId/shareSessionId/idempotencyKey/channels/operatorNote; do not trust or accept client freshness overrides.","route":"app/api/workflow/dispatch/route.ts"},"everyBlock":["documentKey","id as blockId","sourceRevision","evidenceDigest"],"shareSessionContract":{"authority":"Treat client values as assertions. Inside the approved authority seam, resolve latest logicalWorkpackId revision, then load the block by documentKey+blockId and compare sourceRevision/evidenceDigest/state=ready/human_confirmed before session insert.","implementationState":"blocked; current route does not accept or enforce these fields","owner":"blocked-server-share-authority","persist":"Persist a server-derived binding only after route ownership review proves the existing access_policy JSONB and session insert are transactionally coupled to the latest revision lookup; otherwise this requires the approved RPC/migration and remains blocked.","postRequest":["recipients","documentKey","blockId","sourceRevision","evidenceDigest"],"reject409":["missing block","stale block","revision mismatch","digest mismatch","not human_confirmed","readiness blocked"],"response":["shareSessionId","expiresAt","authoritative editorV2Binding"],"route":"app/api/workpacks/[id]/share-sessions/route.ts"},"staleBehavior":["set block state=stale","disable session creation and dispatch","retain old read confirmations as historical records only","show one primary action: rebuild share block"],"unlock":["load authoritative stored workpack","verify top-level generationEvidence","require editorV2.reviewState=human_confirmed","require authenticated HumanConfirmation digest/revision match","require assessWorkpackReadiness.canShare","resolve owning documentKey and blockId","require block sourceRevision/evidenceDigest match stored authority","create bound share session","dispatch only after rechecking the stored session binding"]},"transitions":[["generated","USER_EDIT","edited","EDIT_INVALIDATE"],["generated","VALIDATE_UNEDITED_PASS","review_pending","VALIDATE_UNEDITED_PASS"],["generated","VALIDATE_UNEDITED_FAIL","generated","VALIDATE_UNEDITED_FAIL"],["human_confirmed","USER_EDIT","edited","EDIT_INVALIDATE"],["edited","REVALIDATION_PASS","review_pending","REVALIDATE_PASS"],["edited","REVALIDATION_FAIL","edited","REVALIDATE_FAIL"],["review_pending","USER_EDIT","edited","EDIT_INVALIDATE"],["review_pending","AUTHENTICATED_CONFIRM_AND_SAVE","human_confirmed","SERVER_CONFIRM_SAVE"]]} |

<!-- SAFECLAW-NORMATIVE:END -->

<!-- SAFECLAW-HUMAN:BEGIN -->

### Human Normative Requirements

- **HP-001 Hold:** Status is HOLD_PENDING_FRESH_REVIEW and the entire implementation program, including Wave 0, remains BLOCKED_PENDING_USER_DB_APPROVAL until a fresh independent spec PASS and explicit user DB authority approval outside repository-authored evidence both exist.
- **HP-002 Provenance:** The target-ready candidate has source base, integration target, and direct parent f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5; its evidence-only commit must directly parent the candidate.
- **HP-003 Exports:** XLSX, PDF HTML, and binary HWP are server POST exits; HWPX is built client-side by buildHwpxWithRhwp. The template GET route is not the editor HWPX call site.
- **HP-004 Workbench:** The default surface has one compact evidence trigger and no yellow evidence badge, persistent right rail, duplicate provenance summaries, mixed provenance textarea, or below-editor audit panels; the drawer owns provenance and review detail.
- **HP-005 Documents:** Exactly 12 document-specific schemas remain, with risk assessment, TBM briefing, and TBM log first after approval; shared primitives never collapse them into one universal textarea or 12 copied implementations.
- **HP-006 Trust:** The current repository cannot authenticate a Codex/user approval event. Claims are closed zero-execution declarations, future approval/provider/CI/DOM requirements accept no result fields, evidence time is strict RFC3339 and no more than 300 seconds ahead of guarded validation time, and implementation mode always returns IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL.
- **HP-007 Typography:** Browser executions are 0. After approval, tests generated from the locator census must apply one root typography-token policy at devicePixelRatio 1 and visualViewport scale 1, then measure ratios, reflow, fixed/sticky containment, cross-parent overlap, clipping, transforms, zoom, nested scroll, and mobile editor start.
- **HP-008 Photo:** A photo review event binds analysis identity and canonical payload snapshot, model provenance, candidate control identities and text digests, before/after image SHA-256 values, reviewer confirmation, transaction/root operation identity, revision, seal, and event digest; raw photo bytes remain site memory only.
- **HP-009 Conflicts:** The timestamped conflict ledger is a captured snapshot. Unrelated parallel head or dirty changes do not block work; only target-source changes or intersections with the planned owned/read-only/test authority surface require amendment and fresh review.
- **HP-010 Readiness:** This artifact proves specification consistency only. It does not prove browser behavior, export round trips, server revision authority, photo persistence, share freshness, implementation readiness, independent PASS, or user DB approval.

<!-- SAFECLAW-HUMAN:END -->

## Stage-Aware Mechanical Validation

The current validator deliberately has one review path and no implementation success path:

- `spec-review` accepts only the ordered canonical token contract below. It reads `spec.md`, `spec.json`, and the validator from the immutable candidate commit; reads the separate evidence-only child; and reads each bound target blob with `git show <target>:<path>`. It proves exact candidate/evidence/source/target identity, blob hashes, recursive object/array/scalar schemas and relationships for all 19 domains, and full generated-structural/generated-human/outside-prose Markdown parity.
- `implementation` always exits nonzero with `IMPLEMENTATION_BLOCKED_PENDING_USER_DB_APPROVAL` before it reads or accepts any claimed gate, approval, manifest, receipt, hash, log, artifact, sidecar, range, or metric. Empty, forged, and complete-looking evidence cannot produce PASS.

This repository cannot authenticate a Codex/user approval event today. `currentClaims`, `reviewClaims`, and unexecuted scope use exact closed objects with zero execution counts and allowlisted fact IDs; arbitrary strings are invalid. Future approval/provider/CI/DOM definitions are closed normative-only objects with no accepted result, pass, measurement, actor, receipt, or authority fields. A repository-authored manifest, JSON boolean, hash, commit message, validator output, or agent statement is therefore not authoritative approval. A separate post-approval verifier may be designed and reviewed only after the user explicitly approves the DB migration/transactional RPC authority outside this repository.

Every timestamp that this document contract treats as a timestamp uses strict RFC3339 calendar/time/offset validation without permissive `Date.parse`. Evidence and ledger timestamps may be at most 300 seconds ahead of the injected validation time, and that injected time must itself be within 300 seconds of the process system clock. A 2099 timestamp fails. Implementation mode accepts no receipt timestamp because it accepts no receipt at all.

The validator compares this machine-addressable block byte-for-byte with `validation.commandContracts.specReview.tokens`:

<!-- SAFECLAW-SPEC-REVIEW-COMMAND:BEGIN -->
```text
node evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs spec-review --evidence <FULL_EVIDENCE_SHA> --manifest evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json --candidate <FULL_CANDIDATE_SHA> --source-base f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5 --target f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5 --validation-time <STRICT_RFC3339_CURRENT_TIME>
```
<!-- SAFECLAW-SPEC-REVIEW-COMMAND:END -->

After the candidate and evidence-only commits exist, run:

```powershell
$validator = '.\evaluation\workpack-document-editors-v2-2026-07-13\validate-contract.mjs'
$manifest = 'evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json'
$candidate = '<exact candidate SHA>'
$evidence = '<exact evidence-only child SHA>'
$sourceBase = 'f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5'
$target = 'f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5'

1..2 | ForEach-Object {
  $validationTime = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
  node $validator spec-review --evidence $evidence --manifest $manifest --candidate $candidate --source-base $sourceBase --target $target --validation-time $validationTime
  if ($LASTEXITCODE -ne 0) { throw 'spec-review failed' }
}

git diff-tree --no-commit-id --name-only -r $candidate --
git diff-tree --no-commit-id --name-only -r $evidence --
git merge-base $candidate $target
git diff --check "${candidate}^!" --
git diff --check "${evidence}^!" --
git status --short
```

Every deliberate RED case must exit nonzero twice. Spec-review mutations cover Markdown-only prose, JSON-only model and `primaryAction`, an unknown domain, missing/empty domains, empty document fields/actions, broken photo relationships, empty conflict heads/refs, an unblocked wave, forged spec/evidence claims, synthetic geometry results, 2099 evidence, arbitrary wave commands, and candidate/source/target/evidence-parent identity. Implementation attacks prove empty, forged, and complete-looking evidence all hit the same unconditional block:

```powershell
1..2 | ForEach-Object {
  foreach ($case in @(
    'normative-parity','md-prose','json-model','json-document-primary-action','json-unknown-domain',
    'domain-missing','domain-empty','document-fields-empty','document-primary-action-empty',
    'photo-object-empty','photo-analysis-missing','photo-confirm-after-missing',
    'conflict-heads-empty','conflict-local-ref-empty','wave-unblocked',
    'forged-spec-claims','forged-evidence-claims','synthetic-geometry-pass',
    'future-evidence-time','wave-command-echo-pass',
    'candidate-ref','source-base-ref','target-ref','evidence-parent'
  )) {
    $validationTime = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    node $validator spec-review --evidence $evidence --manifest $manifest --candidate $candidate --source-base $sourceBase --target $target --validation-time $validationTime --deliberate $case
    if ($LASTEXITCODE -eq 0) { throw "deliberate $case unexpectedly passed" }
  }
  foreach ($attack in @('implementation-empty','implementation-forged','implementation-complete-looking')) {
    node $validator implementation --deliberate $attack --claimedGates 'all' --approved $true --receipts 'complete-looking' --sidecars 'complete-looking'
    if ($LASTEXITCODE -eq 0) { throw "deliberate $attack unexpectedly passed" }
  }
}
```

No present command can validate future implementation readiness. After explicit approval, the post-approval verifier must be a new reviewed artifact rather than a hidden success branch in this validator. No unqualified `git diff --name-only`, two-dot range, worktree copy of target files, or future-file claim is valid evidence.

## Review And Approval Hold

Current spec state: **HOLD_PENDING_FRESH_REVIEW**.

Implementation state: **BLOCKED_PENDING_USER_DB_APPROVAL**.

Do not start Wave 0 or any later wave until a fresh independent reviewer PASSes the exact immutable candidate/evidence pair and the user separately gives explicit DB migration/transactional RPC approval. This remediation authorizes evaluation spec/validator evidence only.
