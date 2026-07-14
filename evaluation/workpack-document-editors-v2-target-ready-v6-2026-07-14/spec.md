# SafeClaw Workpack Document Editors v2 target-ready v6

> This entire normative document is deterministically derived from `spec.json`. Manual prose is not authoritative.

## Status

- Contract: HOLD_PENDING_FRESH_INDEPENDENT_REVIEW
- Implementation: BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL
- Browser executions: 0
- Immutable source base: f45bba17bcce0d8ebb2690f82d014dbe42ae8191
- Current fetched integration authority: 67d2c9e28e7278c58f46b46c2512c7133d88d1d3 (refs/remotes/origin/feat/phase-a-evidence-integration)
- Remediation candidate parent: 82ff4a11b664b55c5ea9d7f6bdd815c72f6f460c

## Product Contract

Exactly 12 document-specific editors and 1 EvidenceDetailsDrawer are normative.

Body/provenance: Editable document body and provenance/audit data are separate lossless roots. Provenance never becomes editable body text.

Forbidden default surfaces:
- yellow evidence badge
- persistent right evidence rail
- duplicate left evidence summary
- below-editor provenance block
- below-editor operation graph
- duplicate evidence drawer

## Evidence Role States

| Source class | Role | Eligible review states | Hazard priority | Control | Mandate | Obligation |
| --- | --- | --- | --- | --- | --- | --- |
| sif_case | hazard_priority_only | [] | true | false | false | review_required |
| kosha_guidance | guidance | ["verified","published"] | false | true | false | technical_guidance_only |
| law | mandate | ["published"] | false | false | true | statutory_mandate |

SIF hazard priority, KOSHA technical guidance, and law mandate are stored and rendered as separate typed evidence roles.

Reachable review states: draft, verified, published, unknown.

## Photo Confirmation Fields

| Name | Type | Codec | Required on | Digest covered |
| --- | --- | --- | --- | --- |
| snapshotId | string | stableId | always | true |
| acceptedControlIds | string[] | stableIdArrayNonEmpty | confirmation | true |
| humanReceipt | object | humanReceiptExact | confirmation | true |
| humanReceipt.receiptId | string | stableId | confirmation | true |
| humanReceipt.workpackId | string | stableId | confirmation | true |
| humanReceipt.logicalRootId | string | stableId | confirmation | true |
| humanReceipt.action | enum | photoReviewAction | confirmation | true |
| humanReceipt.snapshotId | string | stableId | confirmation | true |
| humanReceipt.snapshotRevision | integer | strictPositiveInteger | confirmation | true |
| humanReceipt.reviewRevision | integer | strictPositiveInteger | confirmation | true |
| humanReceipt.beforeImageId | string | stableId | confirmation | true |
| humanReceipt.beforeImageSha256 | digest | sha256HexDigest | confirmation | true |
| humanReceipt.afterImageId | string | stableId | confirmation | true |
| humanReceipt.afterImageSha256 | digest&#124;null | nullableSha256HexDigest | confirmation_or_completed_rejection | true |
| humanReceipt.acceptedControlIds | string[] | stableIdArrayNonEmpty | confirmation | true |
| humanReceipt.actorId | string | stableId | confirmation | true |
| humanReceipt.actorDisplayName | string | nonEmptyString | confirmation | true |
| humanReceipt.actorRole | string | nonEmptyString | confirmation | true |
| humanReceipt.occurredAt | datetime | strictRfc3339 | confirmation | true |
| humanReceipt.confirmedAt | datetime&#124;null | nullableStrictRfc3339 | confirmation | true |
| humanReceipt.expiresAt | datetime | strictRfc3339 | confirmation | true |
| humanReceipt.candidateRevision | integer | strictPositiveInteger | confirmation | true |
| humanReceipt.resultingRevision | integer | strictPositiveInteger | confirmation | true |
| humanReceipt.priorMaterializationDigest | digest | sha256HexDigest | confirmation | true |
| humanReceipt.resultingMaterializationDigest | digest | sha256HexDigest | confirmation | true |
| humanReceipt.priorEvidenceDigest | digest | sha256HexDigest | confirmation | true |
| humanReceipt.resultingEvidenceDigest | digest | sha256HexDigest | confirmation | true |
| humanReceipt.resultingGenerationEvidenceDigest | digest | sha256HexDigest | confirmation | true |
| humanReceipt.receiptNonce | string | stableId | confirmation | true |
| humanReceipt.confirmationPurpose | enum | photoConfirmationPurpose | confirmation | true |

Authoritative snapshot kind: safeclaw-photo-analysis-snapshot/v2

Snapshot fields: authorityIdentity, canonicalControlMap, snapshotDigest, authorityVersion

Control digest kind: safeclaw-photo-control-acceptance/v3

Control digest inputs: kind, authorityBinding, snapshotRevision, snapshotDigest, selectedControls

External nonce authority kind: safeclaw-external-photo-receipt-nonce-authority/v1

External nonce authority implementation: UNIMPLEMENTED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL

A trusted external authority must perform one atomic compare-and-consume from issued to consumed while binding the exact receipt ID, nonce, authority digest, workpack, logical root, snapshot, and revisions. The same receipt replay and any coherent whole-context forgery absent from that authority must reject. The evaluation-only model tests these semantics but is not product implementation.

The validator resolves acceptedControlIds only through the server-owned full canonicalControlMap and preserves canonicalOrder. The server context owns workpackId, logicalRootId, snapshot identity/revision, image identity/hashes, and every derived digest.

The exact humanReceipt must match server receiptAuthority and bind workpack, logical root, snapshot/revision, before/after image IDs and hashes, accepted control IDs, actor, expiry, and one-time nonce. Local fields never establish consumption. Without the approved external atomic authority, confirmation fails closed and product readiness remains false.

Reject forged, additional, missing, duplicated, or reordered controls; stale snapshot or receipt revision; consumed/expired nonce; same-receipt replay; coherent whole-context forgery; cross-workpack/root binding; receipt mismatch; missing external authority; and every client-submitted digest/control object/status/model/analysis surface.

## Photo State Transitions

| From | Event | To | Confirmation blocked | Share blocked | Precondition |
| --- | --- | --- | --- | --- | --- |
| candidate | ANALYSIS_REVIEW_REQUESTED | review_required | true | true | A server-authoritative photo-analysis snapshot owns workpack/root/image identity, current revision, canonical full control map, and derived digests; an unconsumed expiring receipt exists in validationContext. |
| review_required | VALID_HUMAN_CONFIRMATION | human_confirmed | false | false | Future normative transition only: the event submits only snapshotId, acceptedControlIds, and the exact server-issued humanReceipt without snapshot/control/event digests; all bindings match and an approved external authority atomically compare-and-consumes the issued nonce. This authority is currently unimplemented and the transition remains product-blocked. |
| review_required | VALID_HUMAN_REJECTION | rejected | true | true | The rejection event passes exact-key, codec, reviewer, reason, timestamp, and current revision validation. |

Before confirmation: confirmation and share remain blocked in candidate and review_required

After confirmation: Future normative only: human_confirmed can clear the photo confirmation blocker after approved atomic external authority consumption; current product state remains blocked

External authority: The atomic nonce authority, persistence, and share freshness authorities are explicitly unimplemented pending user DB authority approval. Evaluation test doubles do not make the product ready.

## HWPX Representation

- Representation: client_builder
- Builder: @rhwp/core HwpDocument.exportHwpx
- Server route: null
- Manifest: canonical editor-v3 JSON appendix between deterministic SafeClaw begin/end markers
- Template route: GET /api/export/hwpx-template is not an editor HWPX export path.

## Scroll Contract

- Rule: auto_size_page_scroll
- Desktop: Auto-size to content with overflow-y hidden; section or page owns vertical scrolling.
- Mobile: Auto-size to content with overflow-y hidden; section or page owns vertical scrolling.
- Editor internal scroll allowed: false
- Page/editor double scroll allowed: false
- Internal scroll owner: evidence_drawer_only
- Mobile editor start maximum Y: 160

## Text Scaling Contract

- Profile: BROWSER-PAGE-ZOOM-200
- Percent: 200
- Mechanism: native_browser_page_zoom
- Owning root: browser_page
- Executor: user_or_browser_zoom_control
- Per-node inline fontSize mutations: 0
- Per-node inline lineHeight mutations: 0
- Status: FUTURE_UNEXECUTED
- Browser executions: 0

Apply 200 percent once at the owning browser page before assertions and restore browser zoom after the row.

Every FUTURE_UNEXECUTED browser matrix row references this one profile; no row may substitute synthetic descendant or leaf style rewriting.

Per-node or leaf inline fontSize and lineHeight mutation is forbidden; both mutation counts must remain zero.

## Document-Specific Editors

| ID | Document key | Editor | Primary action | Field count | Body root | Provenance root |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | workpackSummaryDraft | WorkpackSummaryEditor | Edit summary | 8 | documents.workpackSummaryDraft.content | evidence.byDocument.workpackSummaryDraft |
| DOC-02 | riskAssessmentDraft | RiskAssessmentEditor | Edit risk rows | 12 | documents.riskAssessmentDraft.content | evidence.byDocument.riskAssessmentDraft |
| DOC-03 | workPlanDraft | WorkPlanEditor | Edit work sequence | 10 | documents.workPlanDraft.content | evidence.byDocument.workPlanDraft |
| DOC-04 | workPermitDraft | WorkPermitEditor | Edit permit | 10 | documents.workPermitDraft.content | evidence.byDocument.workPermitDraft |
| DOC-05 | tbmBriefing | TbmBriefingEditor | Edit briefing | 9 | documents.tbmBriefing.content | evidence.byDocument.tbmBriefing |
| DOC-06 | tbmLogDraft | TbmLogEditor | Record TBM | 9 | documents.tbmLogDraft.content | evidence.byDocument.tbmLogDraft |
| DOC-07 | safetyEducationRecordDraft | SafetyEducationRecordEditor | Record education | 9 | documents.safetyEducationRecordDraft.content | evidence.byDocument.safetyEducationRecordDraft |
| DOC-08 | emergencyResponseDraft | EmergencyResponseEditor | Edit response plan | 8 | documents.emergencyResponseDraft.content | evidence.byDocument.emergencyResponseDraft |
| DOC-09 | photoEvidenceDraft | ImprovementEvidenceEditor | Select before and after | 10 | documents.photoEvidenceDraft.content | evidence.byDocument.photoEvidenceDraft |
| DOC-10 | foreignWorkerBriefing | ForeignWorkerBriefingEditor | Edit language variants | 8 | documents.foreignWorkerBriefing.content | evidence.byDocument.foreignWorkerBriefing |
| DOC-11 | foreignWorkerTransmission | ForeignWorkerTransmissionEditor | Prepare transmission | 8 | documents.foreignWorkerTransmission.content | evidence.byDocument.foreignWorkerTransmission |
| DOC-12 | kakaoMessage | KakaoMessageEditor | Prepare message | 8 | documents.kakaoMessage.content | evidence.byDocument.kakaoMessage |

## Freshness and Regeneration

| Policy | Value |
| --- | --- |
| Evidence max age seconds | 86400 |
| Ledger max age seconds | 86400 |
| Future skew seconds | 300 |
| Future mtime skew seconds | 1 |
| Validation clock skew seconds | 300 |
| Replay clock mode | fresh_self_check_validation_time |
| Replay clock rule | Recorded command args remain evidence, but a replay within the declared evidence window replaces only the recorded --validation-time value with the fresh self-check validation time. Every other ordered token and all expected output digests remain bound. |
| Perpetual | false |
| Regeneration action | Fetch the authoritative integration ref, recapture the ledger and blob identities, create a new candidate/evidence pair, and rerun independent review. Never refresh timestamps in place. |

## Schema Closure

- Minimum closed objects: 331
- Legacy permissive objects closed: 86
- Unknown-key passes per matrix: 2
- Root included: true
- Object graph SHA-256: sha256:4d11dab6df464187edea83ed945a408c20d59b2e5824ac52a2aba35b84308709
- Normative contract SHA-256: sha256:c310cc261c89abc1c620c0d323ae81188d41ecb5605b280109977dc6a51e1461

## Structured Execution Evidence

- authority-fetch=1
- authoring-check=2
- unknown-key-matrix=2
- deliberate-attack=58
- focused-remediation-test=2
- json-parse-check=1
- object-census=1
- diff-contract=1
- merge-tree-proof=1
- implementation-block=1

Author evidence records one actual spawned process per exact command, dynamic unknown-key matrix twice, all 29 deliberate negative attacks twice, and two focused v6 harness processes. Each focused process contains multiple hostile cases; those cases are not claimed as separate or independent processes. Author runs remain untrusted and require fresh independent rerun.

Each run record is emitted only from an actual spawned process and binds exact command, ordered args, cwd, start/end, exit, stdout/stderr hashes, and its raw JSONL row. The manifest additionally binds the complete LF-only JSONL byte digest, ordered record IDs, and record count to the exact run-record order. Reversed rows, synthetic/fabricated records, marker-only fallback, zero-spawn claims, missing/duplicate records, wrong args/digests/logs, or full-log drift fail closed. Focused hostile cases run inside one process per focused pass and are not called independent processes. Author evidence is UNTRUSTED_REPRODUCIBLE_REQUIRES_FRESH_INDEPENDENT_RERUN.

## Authority Gates

| ID | Status | DB approval required | Executable commands | Blocked capability |
| --- | --- | --- | --- | --- |
| server_revision_authority | BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL | true | 0 | Transactional logical root, expected revision, idempotency replay, conflict rejection, and reseal. |
| photo_confirmation_persistence | BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL | true | 0 | Authority-backed atomic compare-and-consume of receipt nonces, same-receipt replay rejection, coherent-forgery rejection, immutable photo review events, and atomic resulting revision persistence. |
| share_freshness_authority | BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL | true | 0 | Server-side latest revision, document block, evidence digest, audience, and language freshness enforcement. |

## Browser Matrix

The 200% browser matrix is FUTURE_UNEXECUTED. Browser executions: 0. Product executions: 0.

| ID | Browser | Viewport | Zoom percent | Text-scaling profile | Status |
| --- | --- | --- | --- | --- | --- |
| CH-DESKTOP-1440 | chromium | 1440x1000 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| CH-DESKTOP-1150 | chromium | 1150x900 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| CH-MOBILE-390 | chromium | 390x844 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| FF-DESKTOP-1440 | firefox | 1440x1000 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| FF-DESKTOP-1150 | firefox | 1150x900 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| FF-MOBILE-390 | firefox | 390x844 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| WK-DESKTOP-1440 | webkit | 1440x1000 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| WK-DESKTOP-1150 | webkit | 1150x900 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |
| WK-MOBILE-390 | webkit | 390x844 | 200 | BROWSER-PAGE-ZOOM-200 | FUTURE_UNEXECUTED |

## Canonical JSON

The complete canonical contract follows. It is parsed and rendered from the same in-memory object used for every table above.

```json
{
  "kind": "safeclaw_workpack_document_editors_contract",
  "schemaVersion": "6.0.0",
  "meta": {
    "kind": "meta",
    "artifact": "SafeClaw Workpack Document Editors v2 target-ready v6",
    "contractDate": "2026-07-14",
    "branch": "feat/workpack-document-editors-v2-target-ready-v5",
    "sourceBase": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "currentIntegrationTarget": "67d2c9e28e7278c58f46b46c2512c7133d88d1d3",
    "candidateParent": "82ff4a11b664b55c5ea9d7f6bdd815c72f6f460c",
    "status": "HOLD_PENDING_FRESH_INDEPENDENT_REVIEW",
    "implementationStatus": "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
    "browserExecutions": 0
  },
  "reviewScope": {
    "kind": "review_scope",
    "candidateAllowedPaths": [
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/.gitattributes",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/contract-remediation-attacks.mjs",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/remediation-report.md",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/spec.json",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/spec.md",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/tdd-green-v6-contract-remediation.log",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/tdd-red-v6-contract-remediation.log",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/validate-contract.mjs"
    ],
    "evidenceAllowedPaths": [
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/execution-log.jsonl",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/review-evidence.json"
    ],
    "targetBlobPaths": [
      "components/WorkpackEditor.tsx",
      "lib/risk-assessment-schema.ts",
      "lib/safety-reference-catalog.ts",
      "lib/ontology/evidence-chain-registry.ts",
      "lib/generation-evidence.ts",
      "app/api/workpacks/route.ts",
      "supabase/migrations/002_workspace_productization.sql",
      "app/api/workpacks/[id]/improvements/route.ts",
      "app/api/workpacks/[id]/share-sessions/route.ts",
      "app/api/workflow/dispatch/route.ts",
      "app/api/export/hwp/route.ts",
      "app/api/export/pdf/route.ts",
      "app/api/export/xlsx/route.ts",
      "app/api/export/hwpx-template/route.ts"
    ],
    "sourceCandidate": "af8d343c65445497da2f804bcdde2eb533390ee8",
    "sourceCandidateBranch": "feat/workpack-document-editors-v2-target-ready-v5",
    "sourceCandidateUse": "REVIEWED_V5_ANCESTRY_PREFIX_NO_RANGE_IMPORT",
    "rejectedCandidate": "2ec14aaf92e7c03376e6086b889b254e77a6c412",
    "rejectedEvidence": "cc9f5af297950b73b53a9ab4018bdc143830c499",
    "rejectedV6Candidate": "106eef7c609e937dbebfe06c3affb89d63f550d5",
    "rejectedV6Evidence": "82ff4a11b664b55c5ea9d7f6bdd815c72f6f460c",
    "rejectedV6Verdict": "INDEPENDENT_REJECT_REMEDIATION_SOURCE",
    "ancestryRule": "The remediated v6 candidate is an exact child of rejected v6 evidence 82ff4a1, preserving the reviewed v5 prefix and rejected-v6 audit trail. Immutable sourceBase remains f45 while the separately fetched moving integration authority is 67d2c9e. Rejected v4 remains absent from ancestry.",
    "selfHashRule": "The evidence manifest binds candidate, current fetched target, RED log, and the full ordered execution JSONL digest/count without containing the evidence commit SHA, own blob OID, or own SHA-256."
  },
  "freshnessPolicy": {
    "kind": "freshness_policy",
    "validationTimeArgument": "--validation-time",
    "evidenceMaxAgeSeconds": 86400,
    "ledgerMaxAgeSeconds": 86400,
    "futureSkewSeconds": 300,
    "futureMtimeSkewSeconds": 1,
    "validationTimeSystemClockSkewSeconds": 300,
    "replayClockMode": "fresh_self_check_validation_time",
    "replayClockRule": "Recorded command args remain evidence, but a replay within the declared evidence window replaces only the recorded --validation-time value with the fresh self-check validation time. Every other ordered token and all expected output digests remain bound.",
    "notPerpetual": true,
    "regenerationAction": "Fetch the authoritative integration ref, recapture the ledger and blob identities, create a new candidate/evidence pair, and rerun independent review. Never refresh timestamps in place."
  },
  "schemaClosure": {
    "kind": "schema_closure",
    "objectGraphSha256": "sha256:4d11dab6df464187edea83ed945a408c20d59b2e5824ac52a2aba35b84308709",
    "normativeContractSha256": "sha256:c310cc261c89abc1c620c0d323ae81188d41ecb5605b280109977dc6a51e1461",
    "minimumClosedObjects": 331,
    "legacyPermissiveObjectsClosed": 86,
    "unknownKeyPasses": 2,
    "rootIncluded": true,
    "openMapFamilies": [
      {
        "kind": "open_map_family",
        "pathPattern": "$.documents[].fieldNotes",
        "keyCodec": "fieldPath",
        "valueCodec": "nonEmptyString",
        "purpose": "Human field notes keyed by canonical document field path."
      },
      {
        "kind": "open_map_family",
        "pathPattern": "$.documents[].legacyOverrides",
        "keyCodec": "fieldPath",
        "valueCodec": "nonEmptyString",
        "purpose": "Lossless legacy source-path overrides keyed by canonical document field path."
      }
    ],
    "exactKeyOrder": "requireExactKeys is called for root and every closed nested object before any shape fingerprint comparison.",
    "shapeBypassRule": "Unknown-key tests must still reject by EXACT_KEYS when shape checking is skipped or the attacker recomputes a matching shape digest."
  },
  "productContract": {
    "kind": "product_contract",
    "documentEditorCount": 12,
    "evidenceDrawerCount": 1,
    "evidenceDrawerName": "EvidenceDetailsDrawer",
    "forbiddenDefaultSurfaces": [
      "yellow evidence badge",
      "persistent right evidence rail",
      "duplicate left evidence summary",
      "below-editor provenance block",
      "below-editor operation graph",
      "duplicate evidence drawer"
    ],
    "bodyProvenanceRule": "Editable document body and provenance/audit data are separate lossless roots. Provenance never becomes editable body text.",
    "mobileEarlyStartMaxY": 160,
    "mobileScrollOwner": "section_or_page",
    "primaryExperience": "Exactly one selected document-specific editor with one compact evidence trigger and one evidence drawer."
  },
  "evidenceContract": {
    "kind": "evidence_contract",
    "reviewStateEnum": [
      "draft",
      "verified",
      "published",
      "unknown"
    ],
    "roles": [
      {
        "kind": "evidence_role",
        "sourceClass": "sif_case",
        "role": "hazard_priority_only",
        "eligibleReviewStates": [],
        "canPrioritizeHazard": true,
        "canSupplyControl": false,
        "canEstablishMandate": false,
        "directEligibility": false,
        "obligationClass": "review_required",
        "rule": "SIF can prioritize a hazard only. It never becomes a control, guidance, legal mandate, or confirmation."
      },
      {
        "kind": "evidence_role",
        "sourceClass": "kosha_guidance",
        "role": "guidance",
        "eligibleReviewStates": [
          "verified",
          "published"
        ],
        "canPrioritizeHazard": false,
        "canSupplyControl": true,
        "canEstablishMandate": false,
        "directEligibility": true,
        "obligationClass": "technical_guidance_only",
        "rule": "KOSHA guidance may support a technical control only when current, resolved, accepted, anchored, and explicitly verified or published. It never establishes a statutory mandate by itself."
      },
      {
        "kind": "evidence_role",
        "sourceClass": "law",
        "role": "mandate",
        "eligibleReviewStates": [
          "published"
        ],
        "canPrioritizeHazard": false,
        "canSupplyControl": false,
        "canEstablishMandate": true,
        "directEligibility": true,
        "obligationClass": "statutory_mandate",
        "rule": "Only eligible published law evidence establishes a statutory mandate. Guidance remains separately attributed."
      }
    ],
    "separationRule": "SIF hazard priority, KOSHA technical guidance, and law mandate are stored and rendered as separate typed evidence roles.",
    "unknownStateRule": "Unknown or unreachable review states are review-required and share-blocking."
  },
  "photoConfirmation": {
    "kind": "photo_confirmation_contract",
    "status": "FUTURE_NORMATIVE_ONLY_BLOCKED_PENDING_DB_AUTHORITY",
    "states": [
      "candidate",
      "review_required",
      "human_confirmed",
      "rejected"
    ],
    "eventSchema": {
      "kind": "photo_event_schema",
      "schemaId": "safeclaw-photo-confirmation-event/v6",
      "fields": [
        {
          "kind": "photo_field",
          "name": "snapshotId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "acceptedControlIds",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt",
          "type": "object",
          "codec": "humanReceiptExact",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.receiptId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.workpackId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.logicalRootId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.action",
          "type": "enum",
          "codec": "photoReviewAction",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.snapshotId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.snapshotRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.reviewRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.beforeImageId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.beforeImageSha256",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.afterImageId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.afterImageSha256",
          "type": "digest|null",
          "codec": "nullableSha256HexDigest",
          "requiredOn": "confirmation_or_completed_rejection",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.acceptedControlIds",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.actorId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.actorDisplayName",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.actorRole",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.occurredAt",
          "type": "datetime",
          "codec": "strictRfc3339",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.confirmedAt",
          "type": "datetime|null",
          "codec": "nullableStrictRfc3339",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.expiresAt",
          "type": "datetime",
          "codec": "strictRfc3339",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.candidateRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.resultingRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.priorMaterializationDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.resultingMaterializationDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.priorEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.resultingEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.resultingGenerationEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.receiptNonce",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "humanReceipt.confirmationPurpose",
          "type": "enum",
          "codec": "photoConfirmationPurpose",
          "requiredOn": "confirmation",
          "digestCovered": true
        }
      ],
      "eventDigestRule": "The server computes eventDigest over canonical UTF-8 JSON for snapshotId, acceptedControlIds, and the exact authority-matched humanReceipt. The client never submits snapshotDigest, controlDigest, or eventDigest.",
      "unknownKeyRule": "The event and humanReceipt reject unknown keys before server authority comparison. Client-submitted snapshotDigest, controlDigest, eventDigest, control objects, statuses, model metadata, and arbitrary analysis results are forbidden surfaces."
    },
    "validationContext": {
      "kind": "photo_validation_context_contract",
      "snapshotKind": "safeclaw-photo-analysis-snapshot/v2",
      "snapshotFields": [
        "authorityIdentity",
        "canonicalControlMap",
        "snapshotDigest",
        "authorityVersion"
      ],
      "canonicalControlFields": [
        "controlId",
        "controlTextSha256",
        "canonicalOrder"
      ],
      "receiptAuthorityFields": [
        "receiptId",
        "binding.workpackId|logicalRootId|snapshotId|snapshotRevision|reviewRevision",
        "binding.beforeImageId|beforeImageSha256|afterImageId|afterImageSha256",
        "binding.acceptedControlIds",
        "actor.actorId|actorDisplayName|actorRole",
        "action",
        "occurredAt",
        "confirmedAt",
        "expiresAt",
        "candidateRevision",
        "resultingRevision",
        "priorMaterializationDigest",
        "resultingMaterializationDigest",
        "priorEvidenceDigest",
        "resultingEvidenceDigest",
        "resultingGenerationEvidenceDigest",
        "receiptNonce",
        "confirmationPurpose",
        "snapshotDigest",
        "controlDigest",
        "eventDigest",
        "receiptAuthorityDigest",
        "nonceState",
        "consumedAt|oneTimeConsumeRule"
      ],
      "controlDigestKind": "safeclaw-photo-control-acceptance/v3",
      "controlDigestInputFields": [
        "kind",
        "authorityBinding",
        "snapshotRevision",
        "snapshotDigest",
        "selectedControls"
      ],
      "nonceAuthorityKind": "safeclaw-external-photo-receipt-nonce-authority/v1",
      "nonceAuthorityImplementationStatus": "UNIMPLEMENTED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
      "nonceConsumeRule": "A trusted external authority must perform one atomic compare-and-consume from issued to consumed while binding the exact receipt ID, nonce, authority digest, workpack, logical root, snapshot, and revisions. The same receipt replay and any coherent whole-context forgery absent from that authority must reject. The evaluation-only model tests these semantics but is not product implementation.",
      "canonicalization": "Recursively sort object keys, preserve array order, serialize JSON once as UTF-8, and hash with SHA-256.",
      "resolutionRule": "The validator resolves acceptedControlIds only through the server-owned full canonicalControlMap and preserves canonicalOrder. The server context owns workpackId, logicalRootId, snapshot identity/revision, image identity/hashes, and every derived digest.",
      "receiptRule": "The exact humanReceipt must match server receiptAuthority and bind workpack, logical root, snapshot/revision, before/after image IDs and hashes, accepted control IDs, actor, expiry, and one-time nonce. Local fields never establish consumption. Without the approved external atomic authority, confirmation fails closed and product readiness remains false.",
      "failClosedRule": "Reject forged, additional, missing, duplicated, or reordered controls; stale snapshot or receipt revision; consumed/expired nonce; same-receipt replay; coherent whole-context forgery; cross-workpack/root binding; receipt mismatch; missing external authority; and every client-submitted digest/control object/status/model/analysis surface."
    },
    "transitions": [
      {
        "kind": "photo_transition",
        "from": "candidate",
        "event": "ANALYSIS_REVIEW_REQUESTED",
        "to": "review_required",
        "precondition": "A server-authoritative photo-analysis snapshot owns workpack/root/image identity, current revision, canonical full control map, and derived digests; an unconsumed expiring receipt exists in validationContext.",
        "confirmationBlocked": true,
        "shareBlocked": true
      },
      {
        "kind": "photo_transition",
        "from": "review_required",
        "event": "VALID_HUMAN_CONFIRMATION",
        "to": "human_confirmed",
        "precondition": "Future normative transition only: the event submits only snapshotId, acceptedControlIds, and the exact server-issued humanReceipt without snapshot/control/event digests; all bindings match and an approved external authority atomically compare-and-consumes the issued nonce. This authority is currently unimplemented and the transition remains product-blocked.",
        "confirmationBlocked": false,
        "shareBlocked": false
      },
      {
        "kind": "photo_transition",
        "from": "review_required",
        "event": "VALID_HUMAN_REJECTION",
        "to": "rejected",
        "precondition": "The rejection event passes exact-key, codec, reviewer, reason, timestamp, and current revision validation.",
        "confirmationBlocked": true,
        "shareBlocked": true
      }
    ],
    "shareGate": {
      "kind": "photo_share_gate",
      "beforeConfirmation": "confirmation and share remain blocked in candidate and review_required",
      "afterConfirmation": "Future normative only: human_confirmed can clear the photo confirmation blocker after approved atomic external authority consumption; current product state remains blocked",
      "externalAuthority": "The atomic nonce authority, persistence, and share freshness authorities are explicitly unimplemented pending user DB authority approval. Evaluation test doubles do not make the product ready.",
      "staleEvent": "Any analysis, review, document, evidence, image, or accepted-control revision change returns the item to review_required.",
      "candidateEvidenceRule": "Candidate, model analysis, local preview, upload success, and server metadata are never confirmed evidence."
    },
    "privacyRule": "Raw photo bytes, File, Blob, object URL, and unapproved EXIF remain local/session data and never enter this review contract.",
    "authorityGateId": "photo_confirmation_persistence"
  },
  "markdownContract": {
    "kind": "markdown_contract",
    "canonicalSource": "spec.json",
    "renderer": "validate-contract.mjs renderMarkdown",
    "comparison": "spec.md must byte-equal the complete deterministic Markdown rendered from parsed spec.json.",
    "requiredDerivedSections": [
      "Product Contract",
      "Evidence Role States",
      "Photo Confirmation Fields",
      "Photo State Transitions",
      "HWPX Representation",
      "Scroll Contract",
      "Text Scaling Contract",
      "Document-Specific Editors",
      "Freshness and Regeneration",
      "Structured Execution Evidence",
      "Canonical JSON"
    ],
    "photoTableRule": "The Photo Confirmation Fields table is generated from every top-level and nested humanReceipt eventSchema.fields row with exact name, type, codec, requiredOn, and digestCovered values; no manual count or second field list exists.",
    "driftAttacks": [
      "markdown-photo-drift",
      "markdown-hwpx-drift",
      "markdown-scroll-drift"
    ]
  },
  "exportContract": {
    "kind": "export_contract",
    "hwpxRepresentation": "client_builder",
    "hwpxBuilder": "@rhwp/core HwpDocument.exportHwpx",
    "hwpxServerRoute": null,
    "hwpxManifestRepresentation": "canonical editor-v3 JSON appendix between deterministic SafeClaw begin/end markers",
    "templateRouteRule": "GET /api/export/hwpx-template is not an editor HWPX export path.",
    "channels": [
      {
        "kind": "export_channel",
        "id": "XLSX",
        "representation": "server_post",
        "path": "app/api/export/xlsx/route.ts",
        "roundTrip": "hidden _safeclaw_editor_v3 worksheet A1 canonical JSON"
      },
      {
        "kind": "export_channel",
        "id": "PDF",
        "representation": "server_post_html",
        "path": "app/api/export/pdf/route.ts",
        "roundTrip": "deterministic appendix plus manifest digest"
      },
      {
        "kind": "export_channel",
        "id": "HWP",
        "representation": "server_binary_post",
        "path": "app/api/export/hwp/route.ts",
        "roundTrip": "deterministic binary HWP table plus manifest digest"
      },
      {
        "kind": "export_channel",
        "id": "HWPX",
        "representation": "client_builder",
        "path": "components/WorkpackEditor.tsx",
        "roundTrip": "client-built @rhwp/core canonical editor-v3 JSON appendix"
      }
    ],
    "executionStatus": "FUTURE_UNEXECUTED",
    "browserExecutions": 0
  },
  "scrollContract": {
    "kind": "scroll_contract",
    "multilineRule": "auto_size_page_scroll",
    "desktopMultiline": "Auto-size to content with overflow-y hidden; section or page owns vertical scrolling.",
    "mobileMultiline": "Auto-size to content with overflow-y hidden; section or page owns vertical scrolling.",
    "editorInternalScrollAllowed": false,
    "pageAndEditorDoubleScrollAllowed": false,
    "allowedInternalScrollOwner": "evidence_drawer_only",
    "mobileEditorStartMaxY": 160,
    "sectionStrategy": "Progressively disclose sections and structured rows without a fixed-height master textarea.",
    "forbiddenRule": "No fixed-height internal-scroll exception and no editor/page double nested scroll."
  },
  "textScalingContract": {
    "kind": "text_scaling_contract",
    "profileId": "BROWSER-PAGE-ZOOM-200",
    "percent": 200,
    "mechanism": "native_browser_page_zoom",
    "owningRoot": "browser_page",
    "executor": "user_or_browser_zoom_control",
    "applicationRule": "Apply 200 percent once at the owning browser page before assertions and restore browser zoom after the row.",
    "caseBindingRule": "Every FUTURE_UNEXECUTED browser matrix row references this one profile; no row may substitute synthetic descendant or leaf style rewriting.",
    "perNodeInlineFontSizeMutationCount": 0,
    "perNodeInlineLineHeightMutationCount": 0,
    "forbiddenLeafMutationRule": "Per-node or leaf inline fontSize and lineHeight mutation is forbidden; both mutation counts must remain zero.",
    "status": "FUTURE_UNEXECUTED",
    "browserExecutions": 0
  },
  "documents": [
    {
      "kind": "document_editor",
      "id": "DOC-01",
      "key": "workpackSummaryDraft",
      "title": "Workpack Summary",
      "component": "WorkpackSummaryEditor",
      "primaryAction": "Edit summary",
      "bodyRoot": "documents.workpackSummaryDraft.content",
      "provenanceRoot": "evidence.byDocument.workpackSummaryDraft",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "editorV3",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "siteName",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "profile",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "workDate",
          "type": "date",
          "codec": "localDate",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "taskSummary",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "hazards",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "risk",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "selectedDocumentKeys",
          "type": "DocumentKey[]",
          "codec": "documentKeyArrayNonEmpty",
          "required": "at_least_one",
          "source": "documents",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "revision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "authority",
          "source": "revision",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        }
      ],
      "fieldNotes": {
        "revision": "Server authority only; generated content cannot stamp it."
      },
      "legacyOverrides": {}
    },
    {
      "kind": "document_editor",
      "id": "DOC-02",
      "key": "riskAssessmentDraft",
      "title": "Risk Assessment",
      "component": "RiskAssessmentEditor",
      "primaryAction": "Edit risk rows",
      "bodyRoot": "documents.riskAssessmentDraft.content",
      "provenanceRoot": "evidence.byDocument.riskAssessmentDraft",
      "fields": [
        {
          "kind": "field",
          "name": "rows[].id",
          "type": "string",
          "codec": "stableId",
          "required": "always",
          "source": "editorV3",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].task",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].hazard",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].hazardFactors",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].existingControls",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].likelihood",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].severity",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].riskLevel",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "always",
          "source": "derived",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "rows[].improvement",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "rows[].responsibleRole",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "rows[].dueDate",
          "type": "date|null",
          "codec": "nullableLocalDate",
          "required": "conditional",
          "source": "RiskAssessmentRow",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "rows[].evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "rows[].responsibleRole": "A generated recommendation cannot assign a human.",
        "rows[].dueDate": "A generated recommendation cannot claim a committed date."
      },
      "legacyOverrides": {
        "rows[].task": "structuredRiskRows[].task"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-03",
      "key": "workPlanDraft",
      "title": "Work Plan",
      "component": "WorkPlanEditor",
      "primaryAction": "Edit work sequence",
      "bodyRoot": "documents.workPlanDraft.content",
      "provenanceRoot": "evidence.byDocument.workPlanDraft",
      "fields": [
        {
          "kind": "field",
          "name": "planTitle",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "siteName",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "profile",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "workDate",
          "type": "date",
          "codec": "localDate",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "tasks",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "workSequence",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "equipment",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "roles",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "emergencySteps",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "actionTaken",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        }
      ],
      "fieldNotes": {
        "actionTaken": "Null until a human records completed field action."
      },
      "legacyOverrides": {
        "workSequence": "workPlanStructured.steps"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-04",
      "key": "workPermitDraft",
      "title": "Work Permit",
      "component": "WorkPermitEditor",
      "primaryAction": "Edit permit",
      "bodyRoot": "documents.workPermitDraft.content",
      "provenanceRoot": "evidence.byDocument.workPermitDraft",
      "fields": [
        {
          "kind": "field",
          "name": "permitTitle",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "permitType",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "location",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "validFrom",
          "type": "datetime",
          "codec": "strictRfc3339",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "validUntil",
          "type": "datetime",
          "codec": "strictRfc3339",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "issuer",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "receiver",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "precautions",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "riskRowIds",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "risk",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "issuer": "Generated content cannot issue a permit.",
        "receiver": "Generated content cannot accept a permit."
      },
      "legacyOverrides": {
        "precautions": "permitInspectionStructured.precautions"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-05",
      "key": "tbmBriefing",
      "title": "TBM Briefing",
      "component": "TbmBriefingEditor",
      "primaryAction": "Edit briefing",
      "bodyRoot": "documents.tbmBriefing.content",
      "provenanceRoot": "evidence.byDocument.tbmBriefing",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "briefingDate",
          "type": "date",
          "codec": "localDate",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "leader",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "taskSummary",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "hazardItems",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "risk",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "controlItems",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "guidance",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "attendees",
          "type": "Attendance[]",
          "codec": "attendanceArray",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "actionTaken",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        }
      ],
      "fieldNotes": {
        "attendees": "Attendance is a human record and cannot be inferred from share reads."
      },
      "legacyOverrides": {
        "hazardItems": "tbmBriefingStructured.hazards"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-06",
      "key": "tbmLogDraft",
      "title": "TBM Log",
      "component": "TbmLogEditor",
      "primaryAction": "Record TBM",
      "bodyRoot": "documents.tbmLogDraft.content",
      "provenanceRoot": "evidence.byDocument.tbmLogDraft",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "date",
          "type": "date",
          "codec": "localDate",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "leader",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "attendance",
          "type": "Attendance[]",
          "codec": "attendanceArray",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "understanding",
          "type": "Understanding[]",
          "codec": "understandingArray",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "questions",
          "type": "string[]",
          "codec": "stringArrayAllowEmpty",
          "required": "zero_or_more",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 0,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "correctiveActions",
          "type": "string[]",
          "codec": "stringArrayAllowEmpty",
          "required": "zero_or_more",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 0,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "actionTaken",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        }
      ],
      "fieldNotes": {
        "understanding": "Understanding confirmation is distinct from delivery/read confirmation."
      },
      "legacyOverrides": {
        "attendance": "tbmLogStructured.attendees"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-07",
      "key": "safetyEducationRecordDraft",
      "title": "Safety Education Record",
      "component": "SafetyEducationRecordEditor",
      "primaryAction": "Record education",
      "bodyRoot": "documents.safetyEducationRecordDraft.content",
      "provenanceRoot": "evidence.byDocument.safetyEducationRecordDraft",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "date",
          "type": "date",
          "codec": "localDate",
          "required": "always",
          "source": "scenario",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "instructor",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "topic",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "content",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "attendees",
          "type": "Attendance[]",
          "codec": "attendanceArray",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "assessment",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "signatures",
          "type": "Signature[]",
          "codec": "signatureArray",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "signatures": "Generated content never signs or marks attendance."
      },
      "legacyOverrides": {
        "attendees": "educationRecordStructured.attendees"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-08",
      "key": "emergencyResponseDraft",
      "title": "Emergency Response",
      "component": "EmergencyResponseEditor",
      "primaryAction": "Edit response plan",
      "bodyRoot": "documents.emergencyResponseDraft.content",
      "provenanceRoot": "evidence.byDocument.emergencyResponseDraft",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "coordinator",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "alarmMethods",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "assemblyPoints",
          "type": "AssemblyPoint[]",
          "codec": "assemblyPointArray",
          "required": "at_least_one",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "contacts",
          "type": "EmergencyContact[]",
          "codec": "emergencyContactArray",
          "required": "at_least_one",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "scenarios",
          "type": "EmergencyScenario[]",
          "codec": "emergencyScenarioArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "workerAccountingMethod",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "contacts": "Names and phone numbers require field confirmation."
      },
      "legacyOverrides": {}
    },
    {
      "kind": "document_editor",
      "id": "DOC-09",
      "key": "photoEvidenceDraft",
      "title": "Photo Evidence",
      "component": "ImprovementEvidenceEditor",
      "primaryAction": "Select before and after",
      "bodyRoot": "documents.photoEvidenceDraft.content",
      "provenanceRoot": "evidence.byDocument.photoEvidenceDraft",
      "fields": [
        {
          "kind": "field",
          "name": "siteTimeZone",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "profile",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "improvements",
          "type": "Improvement[]",
          "codec": "improvementArrayNonEmpty",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "beforeFileName",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "local_or_server_metadata",
          "source": "photo",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "afterFileName",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "local_or_server_metadata",
          "source": "photo",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "beforeDigest",
          "type": "digest|null",
          "codec": "nullableSha256HexDigest",
          "required": "when_bytes_available",
          "source": "photo",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "afterDigest",
          "type": "digest|null",
          "codec": "nullableSha256HexDigest",
          "required": "when_bytes_available",
          "source": "photo",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "photoReviewState",
          "type": "enum",
          "codec": "photoReviewState",
          "required": "always",
          "source": "review",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "reviewEventId",
          "type": "string|null",
          "codec": "nullableStableId",
          "required": "authority",
          "source": "review",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayAllowEmpty",
          "required": "zero_or_more",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 0,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "verificationNote",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "required": "human_only",
          "source": "field",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        }
      ],
      "fieldNotes": {
        "reviewEventId": "Null until approved transactional authority returns an immutable event.",
        "evidenceRefs": "Candidate photos cannot populate evidenceRefs."
      },
      "legacyOverrides": {
        "photoReviewState": "review_status"
      }
    },
    {
      "kind": "document_editor",
      "id": "DOC-10",
      "key": "foreignWorkerBriefing",
      "title": "Foreign Worker Briefing",
      "component": "ForeignWorkerBriefingEditor",
      "primaryAction": "Edit language variants",
      "bodyRoot": "documents.foreignWorkerBriefing.content",
      "provenanceRoot": "evidence.byDocument.foreignWorkerBriefing",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "sourceDocumentKeys",
          "type": "DocumentKey[]",
          "codec": "documentKeyArrayNonEmpty",
          "required": "at_least_one",
          "source": "documents",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "sourceRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "authority",
          "source": "revision",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "targetLanguages",
          "type": "string[]",
          "codec": "nonEmptyStringArray",
          "required": "at_least_one",
          "source": "audience",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "variants",
          "type": "LanguageVariant[]",
          "codec": "languageVariantArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "required": "authority",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "workerConfirmationRequired",
          "type": "boolean",
          "codec": "strictBoolean",
          "required": "always",
          "source": "policy",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "workerConfirmationRequired": "Translation delivery never proves understanding."
      },
      "legacyOverrides": {}
    },
    {
      "kind": "document_editor",
      "id": "DOC-11",
      "key": "foreignWorkerTransmission",
      "title": "Foreign Worker Transmission",
      "component": "ForeignWorkerTransmissionEditor",
      "primaryAction": "Prepare transmission",
      "bodyRoot": "documents.foreignWorkerTransmission.content",
      "provenanceRoot": "evidence.byDocument.foreignWorkerTransmission",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "recipients",
          "type": "Recipient[]",
          "codec": "recipientArrayNonEmpty",
          "required": "at_least_one",
          "source": "audience",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "language",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "audience",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "messageBlocks",
          "type": "MessageBlock[]",
          "codec": "messageBlockArray",
          "required": "at_least_one",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "sourceRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "authority",
          "source": "revision",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "required": "authority",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "readConfirmation",
          "type": "ReadConfirmation|null",
          "codec": "nullableReadConfirmation",
          "required": "human_only",
          "source": "share",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "readConfirmation": "Read confirmation proves delivery/read only, not attendance or understanding."
      },
      "legacyOverrides": {}
    },
    {
      "kind": "document_editor",
      "id": "DOC-12",
      "key": "kakaoMessage",
      "title": "Kakao Message",
      "component": "KakaoMessageEditor",
      "primaryAction": "Prepare message",
      "bodyRoot": "documents.kakaoMessage.content",
      "provenanceRoot": "evidence.byDocument.kakaoMessage",
      "fields": [
        {
          "kind": "field",
          "name": "title",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "recipients",
          "type": "Recipient[]",
          "codec": "recipientArrayNonEmpty",
          "required": "at_least_one",
          "source": "audience",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "message",
          "type": "string",
          "codec": "nonEmptyString",
          "required": "always",
          "source": "body",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        },
        {
          "kind": "field",
          "name": "link",
          "type": "string|null",
          "codec": "nullableHttpsUrl",
          "required": "conditional",
          "source": "share",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "sourceRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "required": "authority",
          "source": "revision",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "required": "authority",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "readConfirmation",
          "type": "ReadConfirmation|null",
          "codec": "nullableReadConfirmation",
          "required": "human_only",
          "source": "share",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": null,
            "uniqueItems": false,
            "allowNull": true,
            "humanOnly": true,
            "generatedValueForbidden": true
          }
        },
        {
          "kind": "field",
          "name": "evidenceRefs",
          "type": "string[]",
          "codec": "stableIdArrayNonEmpty",
          "required": "at_least_one",
          "source": "evidence",
          "constraints": {
            "kind": "field_constraints",
            "minimumItems": 1,
            "uniqueItems": true,
            "allowNull": false,
            "humanOnly": false,
            "generatedValueForbidden": false
          }
        }
      ],
      "fieldNotes": {
        "link": "No share link is emitted before fresh server authority validates revision and evidence digest."
      },
      "legacyOverrides": {}
    }
  ],
  "authorityGates": [
    {
      "kind": "authority_gate",
      "id": "server_revision_authority",
      "status": "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
      "requiresUserDbApproval": true,
      "executableCommands": 0,
      "blockedCapability": "Transactional logical root, expected revision, idempotency replay, conflict rejection, and reseal.",
      "unblockRule": "A fresh independent contract review and explicit user approval of the exact migration or transactional RPC are both required."
    },
    {
      "kind": "authority_gate",
      "id": "photo_confirmation_persistence",
      "status": "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
      "requiresUserDbApproval": true,
      "executableCommands": 0,
      "blockedCapability": "Authority-backed atomic compare-and-consume of receipt nonces, same-receipt replay rejection, coherent-forgery rejection, immutable photo review events, and atomic resulting revision persistence.",
      "unblockRule": "A fresh independent contract review and explicit user approval of the exact DB transaction or RPC for nonce, event/history, and revision persistence are all required."
    },
    {
      "kind": "authority_gate",
      "id": "share_freshness_authority",
      "status": "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
      "requiresUserDbApproval": true,
      "executableCommands": 0,
      "blockedCapability": "Server-side latest revision, document block, evidence digest, audience, and language freshness enforcement.",
      "unblockRule": "A separately reviewed server contract plus the approved revision authority must reject stale or missing bindings before provider calls."
    }
  ],
  "browserMatrix": {
    "kind": "browser_matrix_contract",
    "status": "FUTURE_UNEXECUTED",
    "zoomPercent": 200,
    "browserExecutions": 0,
    "productExecutions": 0,
    "cases": [
      {
        "kind": "browser_case",
        "id": "CH-DESKTOP-1440",
        "browser": "chromium",
        "viewport": "1440x1000",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "CH-DESKTOP-1150",
        "browser": "chromium",
        "viewport": "1150x900",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "CH-MOBILE-390",
        "browser": "chromium",
        "viewport": "390x844",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "FF-DESKTOP-1440",
        "browser": "firefox",
        "viewport": "1440x1000",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "FF-DESKTOP-1150",
        "browser": "firefox",
        "viewport": "1150x900",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "FF-MOBILE-390",
        "browser": "firefox",
        "viewport": "390x844",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "WK-DESKTOP-1440",
        "browser": "webkit",
        "viewport": "1440x1000",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "WK-DESKTOP-1150",
        "browser": "webkit",
        "viewport": "1150x900",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      },
      {
        "kind": "browser_case",
        "id": "WK-MOBILE-390",
        "browser": "webkit",
        "viewport": "390x844",
        "zoomPercent": 200,
        "textScalingProfileId": "BROWSER-PAGE-ZOOM-200",
        "status": "FUTURE_UNEXECUTED"
      }
    ],
    "futureAssertions": [
      "touch:minTouchWidthCssPx=44;minTouchHeightCssPx=44",
      "layout:clippingCount=0;horizontal=scrollWidth<=clientWidth;panelOverflowCount=0;pageOverflowCount=0",
      "scroll:nestedTextareaPageDoubleScrollAllowed=false;textareaOverflowY=hidden;pageOwnsVerticalScroll=true",
      "coverage:viewport=390x844;zoomPercents=100,200;themes=Day,Night;editors=all-12;states=all-declared",
      "geometry:overlapCount=0;owningRoot=browser_page;leafFontSizeMutations=0;leafLineHeightMutations=0",
      "product:evidenceDrawerCount=1;forbiddenDefaultSurfaceCount=6;bodyProvenanceSeparate=true;mobileEditorStartMaxY=160"
    ]
  },
  "validationContract": {
    "kind": "validation_contract",
    "canonicalSpecReviewTokens": [
      "node",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/validate-contract.mjs",
      "spec-review",
      "--evidence",
      "<FULL_EVIDENCE_SHA>",
      "--manifest",
      "evaluation/workpack-document-editors-v2-target-ready-v6-2026-07-14/review-evidence.json",
      "--candidate",
      "<FULL_CANDIDATE_SHA>",
      "--source-base",
      "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
      "--target",
      "67d2c9e28e7278c58f46b46c2512c7133d88d1d3",
      "--validation-time",
      "<STRICT_CURRENT_RFC3339>"
    ],
    "negativeAttacks": [
      {
        "kind": "negative_attack",
        "id": "photo-empty-controls",
        "scope": "photo",
        "mutation": "acceptedControlIds=[]",
        "expectedErrorPrefix": "PHOTO_CONTROLS:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-duplicate-controls",
        "scope": "photo",
        "mutation": "duplicate accepted control ID",
        "expectedErrorPrefix": "PHOTO_CONTROLS:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-unapproved-control",
        "scope": "photo",
        "mutation": "acceptedControlIds contains an ID absent from the authoritative canonicalControlMap",
        "expectedErrorPrefix": "PHOTO_CONTROLS:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-arbitrary-digest-object",
        "scope": "photo",
        "mutation": "server receiptAuthority.controlDigest={}",
        "expectedErrorPrefix": "PHOTO_DIGEST:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-arbitrary-digest-string",
        "scope": "photo",
        "mutation": "server receiptAuthority.controlDigest=arbitrary",
        "expectedErrorPrefix": "PHOTO_DIGEST:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-mismatched-set",
        "scope": "photo",
        "mutation": "accepted ID set and digest projection differ",
        "expectedErrorPrefix": "PHOTO_DIGEST:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-mismatched-order",
        "scope": "photo",
        "mutation": "accepted IDs reorder the authoritative canonical control sequence",
        "expectedErrorPrefix": "PHOTO_CONTROLS:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-mismatched-hash",
        "scope": "photo",
        "mutation": "typed digest hash differs",
        "expectedErrorPrefix": "PHOTO_DIGEST:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-stale-analysis-revision",
        "scope": "photo",
        "mutation": "humanReceipt.snapshotRevision is stale",
        "expectedErrorPrefix": "PHOTO_REVISION:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-stale-review-revision",
        "scope": "photo",
        "mutation": "humanReceipt.reviewRevision is stale",
        "expectedErrorPrefix": "PHOTO_REVISION:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-authority-unimplemented",
        "scope": "photo",
        "mutation": "submit an otherwise coherent confirmation without the approved external nonce authority",
        "expectedErrorPrefix": "PHOTO_AUTHORITY_UNIMPLEMENTED:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-same-receipt-replay",
        "scope": "photo",
        "mutation": "atomically consume an issued receipt and submit the exact same receipt again",
        "expectedErrorPrefix": "PHOTO_NONCE_REPLAY:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-coherent-authority-forgery",
        "scope": "photo",
        "mutation": "forge and coherently re-digest the whole event, snapshot, receipt, workpack, logical root, and nonce outside the trusted authority",
        "expectedErrorPrefix": "PHOTO_AUTHORITY_FORGERY:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-share-before-confirmation",
        "scope": "photo",
        "mutation": "share from review_required",
        "expectedErrorPrefix": "PHOTO_SHARE:"
      },
      {
        "kind": "negative_attack",
        "id": "kosha-impossible-review-state",
        "scope": "evidence",
        "mutation": "eligibleReviewStates contains an unreachable combined pseudo-state",
        "expectedErrorPrefix": "EVIDENCE_STATE:"
      },
      {
        "kind": "negative_attack",
        "id": "sif-promoted-to-control",
        "scope": "evidence",
        "mutation": "SIF canSupplyControl=true",
        "expectedErrorPrefix": "EVIDENCE_ROLE:"
      },
      {
        "kind": "negative_attack",
        "id": "markdown-photo-drift",
        "scope": "markdown",
        "mutation": "photo codec prose differs from JSON",
        "expectedErrorPrefix": "MARKDOWN_DRIFT:"
      },
      {
        "kind": "negative_attack",
        "id": "markdown-hwpx-drift",
        "scope": "markdown",
        "mutation": "HWPX representation prose differs from JSON",
        "expectedErrorPrefix": "MARKDOWN_DRIFT:"
      },
      {
        "kind": "negative_attack",
        "id": "markdown-scroll-drift",
        "scope": "markdown",
        "mutation": "scroll prose differs from JSON",
        "expectedErrorPrefix": "MARKDOWN_DRIFT:"
      },
      {
        "kind": "negative_attack",
        "id": "hwpx-second-representation",
        "scope": "export",
        "mutation": "add a server HWPX route",
        "expectedErrorPrefix": "HWPX_REPRESENTATION:"
      },
      {
        "kind": "negative_attack",
        "id": "scroll-nested-editor",
        "scope": "scroll",
        "mutation": "allow editor internal scroll",
        "expectedErrorPrefix": "SCROLL_CONTRACT:"
      },
      {
        "kind": "negative_attack",
        "id": "stale-ledger-2000",
        "scope": "freshness",
        "mutation": "ledger capturedAt=2000-01-01",
        "expectedErrorPrefix": "FRESHNESS_STALE:"
      },
      {
        "kind": "negative_attack",
        "id": "future-ledger-301s",
        "scope": "freshness",
        "mutation": "ledger capturedAt is validation time plus 301 seconds",
        "expectedErrorPrefix": "FRESHNESS_FUTURE:"
      },
      {
        "kind": "negative_attack",
        "id": "exact-key-extra-bypass-shape",
        "scope": "closure",
        "mutation": "extra key with shape check skipped",
        "expectedErrorPrefix": "EXACT_KEYS:"
      },
      {
        "kind": "negative_attack",
        "id": "exact-key-extra-recomputed-shape",
        "scope": "closure",
        "mutation": "extra key with attacker-recomputed shape digest",
        "expectedErrorPrefix": "EXACT_KEYS:"
      },
      {
        "kind": "negative_attack",
        "id": "text-scaling-synthetic-leaf-mutation",
        "scope": "browser",
        "mutation": "replace owning-page browser zoom with synthetic leaf inline style mutation",
        "expectedErrorPrefix": "TEXT_SCALING:"
      },
      {
        "kind": "negative_attack",
        "id": "mobile-viewport-nonselected-width",
        "scope": "browser",
        "mutation": "set one mobile row to selected width plus one while keeping height 844",
        "expectedErrorPrefix": "BROWSER_MATRIX:"
      },
      {
        "kind": "negative_attack",
        "id": "evidence-self-sha",
        "scope": "review",
        "mutation": "manifest includes own SHA",
        "expectedErrorPrefix": "EXACT_KEYS:"
      },
      {
        "kind": "negative_attack",
        "id": "candidate-parent-drift",
        "scope": "review",
        "mutation": "manifest candidate parent differs from rejected evidence parent 82ff4a1",
        "expectedErrorPrefix": "IDENTITY:"
      }
    ],
    "requiredRuns": "Author evidence records one actual spawned process per exact command, dynamic unknown-key matrix twice, all 29 deliberate negative attacks twice, and two focused v6 harness processes. Each focused process contains multiple hostile cases; those cases are not claimed as separate or independent processes. Author runs remain untrusted and require fresh independent rerun.",
    "requiredCommandMultiplicities": [
      "authority-fetch=1",
      "authoring-check=2",
      "unknown-key-matrix=2",
      "deliberate-attack=58",
      "focused-remediation-test=2",
      "json-parse-check=1",
      "object-census=1",
      "diff-contract=1",
      "merge-tree-proof=1",
      "implementation-block=1"
    ],
    "runRecordKeys": [
      "kind",
      "recordId",
      "commandId",
      "executable",
      "args",
      "cwd",
      "startedAt",
      "completedAt",
      "exitCode",
      "stdoutDigest",
      "stderrDigest",
      "rawLogDigest",
      "outputLogPath",
      "outputRecordId"
    ],
    "executionLogKeys": [
      "kind",
      "recordId",
      "stdout",
      "stderr",
      "stdoutDigest",
      "stderrDigest"
    ],
    "executionLogBindingKeys": [
      "kind",
      "path",
      "sha256",
      "recordCount",
      "orderedRecordIds"
    ],
    "structuredEvidenceRule": "Each run record is emitted only from an actual spawned process and binds exact command, ordered args, cwd, start/end, exit, stdout/stderr hashes, and its raw JSONL row. The manifest additionally binds the complete LF-only JSONL byte digest, ordered record IDs, and record count to the exact run-record order. Reversed rows, synthetic/fabricated records, marker-only fallback, zero-spawn claims, missing/duplicate records, wrong args/digests/logs, or full-log drift fail closed. Focused hostile cases run inside one process per focused pass and are not called independent processes. Author evidence is UNTRUSTED_REPRODUCIBLE_REQUIRES_FRESH_INDEPENDENT_RERUN.",
    "implementationMode": "Always exits nonzero with IMPLEMENTATION_BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL.",
    "claimBoundary": "Author runs may establish only reproducible structural evidence and never an independent PASS. Fresh independent rerun is required; product, build, export, browser, DB, provider, and implementation execution remain unclaimed.",
    "browserExecutions": 0
  },
  "integrationLedger": {
    "kind": "integration_ledger",
    "capturedAt": "2026-07-14T03:36:34.451Z",
    "captureCommand": "Run git fetch --prune origin feat/phase-a-evidence-integration, then git rev-parse --verify 'refs/remotes/origin/feat/phase-a-evidence-integration^{commit}'.",
    "authorityRef": "refs/remotes/origin/feat/phase-a-evidence-integration",
    "authorityHead": "67d2c9e28e7278c58f46b46c2512c7133d88d1d3",
    "sourceBase": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "currentIntegrationTarget": "67d2c9e28e7278c58f46b46c2512c7133d88d1d3",
    "candidateBranch": "feat/workpack-document-editors-v2-target-ready-v5",
    "cleanlinessCommand": "git status --porcelain=v1 --untracked-files=all",
    "futureMtimeRule": "Every candidate and evidence artifact is stat'ed live; an mtime beyond validation time plus the declared one-second filesystem skew must fail closed.",
    "sourceCandidateHead": "af8d343c65445497da2f804bcdde2eb533390ee8",
    "sourceCandidateBranch": "feat/workpack-document-editors-v2-target-ready-v5",
    "sourceCandidateUse": "REVIEWED_V5_ANCESTRY_PREFIX_NO_RANGE_IMPORT",
    "rejectedReferenceHead": "cc9f5af297950b73b53a9ab4018bdc143830c499",
    "rejectedReferenceUse": "READ_ONLY_REJECTED_V4_REFERENCE_NO_ANCESTRY",
    "rejectedV6Candidate": "106eef7c609e937dbebfe06c3affb89d63f550d5",
    "rejectedV6Evidence": "82ff4a11b664b55c5ea9d7f6bdd815c72f6f460c",
    "rejectedV6Verdict": "INDEPENDENT_REJECT_REMEDIATION_SOURCE",
    "refreshRequiredAfterSeconds": 86400
  }
}
```
