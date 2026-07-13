# SafeClaw Workpack Document Editors v2 target-ready v4

> This entire normative document is deterministically derived from `spec.json`. Manual prose is not authoritative.

## Status

- Contract: HOLD_PENDING_FRESH_INDEPENDENT_REVIEW
- Implementation: BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL
- Browser executions: 0
- Frozen source/target/parent: f45bba17bcce0d8ebb2690f82d014dbe42ae8191

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
| eventId | string | stableId | always | true |
| improvementId | string | stableId | always | true |
| pairId | string | stableId | always | true |
| action | enum | photoReviewAction | always | true |
| analysisId | string | stableId | always | true |
| analysisRevision | integer | strictPositiveInteger | always | true |
| analysisSnapshotDigest | digest | sha256HexDigest | always | true |
| modelProvider | string | nonEmptyString | always | true |
| modelName | string | nonEmptyString | always | true |
| modelVersion | string | nonEmptyString | always | true |
| reviewRevision | integer | strictPositiveInteger | always | true |
| approvedControls | ApprovedControl[] | approvedControlArrayNonEmpty | confirmation | true |
| acceptedControlIds | string[] | stableIdArrayNonEmpty | confirmation | true |
| controlAcceptanceDigest | digest | sha256HexDigest | confirmation | true |
| beforeImageSha256 | digest | sha256HexDigest | always | true |
| afterImageSha256 | digest&#124;null | nullableSha256HexDigest | confirmation_or_completed_rejection | true |
| reviewerId | string | stableId | always | true |
| reviewerDisplayName | string | nonEmptyString | always | true |
| occurredAt | datetime | strictRfc3339 | always | true |
| confirmedAt | datetime&#124;null | nullableStrictRfc3339 | confirmation | true |
| rejectedAt | datetime&#124;null | nullableStrictRfc3339 | rejection | true |
| rejectionReason | string&#124;null | nullableNonEmptyString | rejection | true |
| candidateRevision | integer | strictPositiveInteger | always | true |
| resultingRevision | integer | strictPositiveInteger | always | true |
| priorMaterializationDigest | digest | sha256HexDigest | always | true |
| resultingMaterializationDigest | digest | sha256HexDigest | always | true |
| priorEvidenceDigest | digest | sha256HexDigest | always | true |
| resultingEvidenceDigest | digest | sha256HexDigest | always | true |
| resultingGenerationEvidenceDigest | digest | sha256HexDigest | always | true |
| eventDigest | digest | sha256HexDigest | always | false |

Control digest kind: safeclaw-photo-control-acceptance/v1

Control digest codec: sha256:<64 lowercase hexadecimal>

Control digest inputs: kind, analysisId, analysisRevision, reviewRevision, acceptedControls

Reject arbitrary objects, untyped strings, empty controls, duplicates, unknown or unapproved IDs, set/order mismatch, digest mismatch, and stale revisions.

## Photo State Transitions

| From | Event | To | Confirmation blocked | Share blocked | Precondition |
| --- | --- | --- | --- | --- | --- |
| candidate | ANALYSIS_REVIEW_REQUESTED | review_required | true | true | A typed analysis snapshot, current revisions, approved-control candidates, and before/after source digests exist. |
| review_required | VALID_HUMAN_CONFIRMATION | human_confirmed | false | false | The complete event passes exact-key, codec, control digest, source digest, reviewer, timestamp, and current revision validation. |
| review_required | VALID_HUMAN_REJECTION | rejected | true | true | The rejection event passes exact-key, codec, reviewer, reason, timestamp, and current revision validation. |

Before confirmation: confirmation and share remain blocked in candidate and review_required

After confirmation: human_confirmed clears the photo confirmation blocker and advances to authority_check_required

External authority: Actual persistence/share remains blocked until approved transactional revision, photo-event, and share freshness authorities exist.

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
| Validation clock skew seconds | 300 |
| Perpetual | false |
| Regeneration action | Fetch the authoritative integration ref, recapture the ledger and blob identities, create a new candidate/evidence pair, and rerun independent review. Never refresh timestamps in place. |

## Schema Closure

- Minimum closed objects: 328
- Legacy permissive objects closed: 86
- Unknown-key passes per matrix: 2
- Root included: true
- Object graph SHA-256: sha256:fa7a82debe7866036779c194adb3164a5eb63d94c6841755d06b5b7cdf1e5226

## Authority Gates

| ID | Status | DB approval required | Executable commands | Blocked capability |
| --- | --- | --- | --- | --- |
| server_revision_authority | BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL | true | 0 | Transactional logical root, expected revision, idempotency replay, conflict rejection, and reseal. |
| photo_confirmation_persistence | BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL | true | 0 | Immutable photo review events and atomic resulting revision persistence. |
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
  "schemaVersion": "4.0.0",
  "meta": {
    "kind": "meta",
    "artifact": "SafeClaw Workpack Document Editors v2 target-ready v4",
    "contractDate": "2026-07-14",
    "branch": "feat/workpack-document-editors-v2-target-ready-v4",
    "sourceBase": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "currentIntegrationTarget": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "candidateParent": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "status": "HOLD_PENDING_FRESH_INDEPENDENT_REVIEW",
    "implementationStatus": "BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL",
    "browserExecutions": 0
  },
  "reviewScope": {
    "kind": "review_scope",
    "candidateAllowedPaths": [
      "evaluation/workpack-document-editors-v2-2026-07-13/spec.json",
      "evaluation/workpack-document-editors-v2-2026-07-13/spec.md",
      "evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs"
    ],
    "evidenceAllowedPaths": [
      "evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json"
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
    "sourceCandidate": "c2ed91db690b9db508580099590130e0cf057209",
    "sourceCandidateBranch": "feat/workpack-document-editors-v2-target-ready-v3",
    "sourceCandidateUse": "READ_ONLY_FILE_CONTENT_PORT_NO_ANCESTRY",
    "rejectedCandidate": "99b1af5385e0b5eaa9ff479761ecea944f0958ab",
    "rejectedEvidence": "b3762867d380f20faee2a83a17354dc61557ce12",
    "ancestryRule": "The candidate is a fresh direct child of sourceBase. The v3 source candidate is read-only content provenance, not an ancestor or history source. Neither rejected commit may be an ancestor, cherry-pick source, or range-merge source.",
    "selfHashRule": "The evidence manifest binds candidate and target blobs but contains no evidence commit SHA, own blob OID, or own SHA-256."
  },
  "freshnessPolicy": {
    "kind": "freshness_policy",
    "validationTimeArgument": "--validation-time",
    "evidenceMaxAgeSeconds": 86400,
    "ledgerMaxAgeSeconds": 86400,
    "futureSkewSeconds": 300,
    "validationTimeSystemClockSkewSeconds": 300,
    "notPerpetual": true,
    "regenerationAction": "Fetch the authoritative integration ref, recapture the ledger and blob identities, create a new candidate/evidence pair, and rerun independent review. Never refresh timestamps in place."
  },
  "schemaClosure": {
    "kind": "schema_closure",
    "objectGraphSha256": "sha256:fa7a82debe7866036779c194adb3164a5eb63d94c6841755d06b5b7cdf1e5226",
    "minimumClosedObjects": 328,
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
      "schemaId": "safeclaw-photo-confirmation-event/v3",
      "fields": [
        {
          "kind": "photo_field",
          "name": "eventId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "improvementId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "pairId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "action",
          "type": "enum",
          "codec": "photoReviewAction",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "analysisId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "analysisRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "analysisSnapshotDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "modelProvider",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "modelName",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "modelVersion",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "reviewRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "approvedControls",
          "type": "ApprovedControl[]",
          "codec": "approvedControlArrayNonEmpty",
          "requiredOn": "confirmation",
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
          "name": "controlAcceptanceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "beforeImageSha256",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "afterImageSha256",
          "type": "digest|null",
          "codec": "nullableSha256HexDigest",
          "requiredOn": "confirmation_or_completed_rejection",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "reviewerId",
          "type": "string",
          "codec": "stableId",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "reviewerDisplayName",
          "type": "string",
          "codec": "nonEmptyString",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "occurredAt",
          "type": "datetime",
          "codec": "strictRfc3339",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "confirmedAt",
          "type": "datetime|null",
          "codec": "nullableStrictRfc3339",
          "requiredOn": "confirmation",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "rejectedAt",
          "type": "datetime|null",
          "codec": "nullableStrictRfc3339",
          "requiredOn": "rejection",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "rejectionReason",
          "type": "string|null",
          "codec": "nullableNonEmptyString",
          "requiredOn": "rejection",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "candidateRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "resultingRevision",
          "type": "integer",
          "codec": "strictPositiveInteger",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "priorMaterializationDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "resultingMaterializationDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "priorEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "resultingEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "resultingGenerationEvidenceDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": true
        },
        {
          "kind": "photo_field",
          "name": "eventDigest",
          "type": "digest",
          "codec": "sha256HexDigest",
          "requiredOn": "always",
          "digestCovered": false
        }
      ],
      "eventDigestRule": "eventDigest is SHA-256 over canonical UTF-8 JSON containing every event field in this table except eventDigest itself.",
      "unknownKeyRule": "The event object and each approved control reject unknown keys before any digest comparison."
    },
    "controlDigest": {
      "kind": "control_digest_contract",
      "digestKind": "safeclaw-photo-control-acceptance/v1",
      "codec": "sha256:<64 lowercase hexadecimal>",
      "canonicalization": "Recursively sort object keys, preserve array order, serialize JSON once as UTF-8, and hash with SHA-256.",
      "inputFields": [
        "kind",
        "analysisId",
        "analysisRevision",
        "reviewRevision",
        "acceptedControls"
      ],
      "acceptedControlProjection": "acceptedControls is the exact ordered projection of acceptedControlIds to approvedControls as {controlId,controlTextSha256}.",
      "setRule": "acceptedControlIds is non-empty and unique; every ID resolves exactly once to approvalState=approved.",
      "orderRule": "acceptedControlIds must preserve the relative order of approvedControls; set-equal reordering is rejected.",
      "revisionRule": "analysisRevision and reviewRevision must equal the current authoritative revisions at confirmation time.",
      "verificationRule": "Reject arbitrary objects, untyped strings, empty controls, duplicates, unknown or unapproved IDs, set/order mismatch, digest mismatch, and stale revisions."
    },
    "transitions": [
      {
        "kind": "photo_transition",
        "from": "candidate",
        "event": "ANALYSIS_REVIEW_REQUESTED",
        "to": "review_required",
        "precondition": "A typed analysis snapshot, current revisions, approved-control candidates, and before/after source digests exist.",
        "confirmationBlocked": true,
        "shareBlocked": true
      },
      {
        "kind": "photo_transition",
        "from": "review_required",
        "event": "VALID_HUMAN_CONFIRMATION",
        "to": "human_confirmed",
        "precondition": "The complete event passes exact-key, codec, control digest, source digest, reviewer, timestamp, and current revision validation.",
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
      "afterConfirmation": "human_confirmed clears the photo confirmation blocker and advances to authority_check_required",
      "externalAuthority": "Actual persistence/share remains blocked until approved transactional revision, photo-event, and share freshness authorities exist.",
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
      "Canonical JSON"
    ],
    "photoTableRule": "The Photo Confirmation Fields table is generated from every eventSchema.fields row with name, type, codec, requiredOn, and digestCovered; no manual count or second field list exists.",
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
      "blockedCapability": "Immutable photo review events and atomic resulting revision persistence.",
      "unblockRule": "A fresh independent contract review and explicit user approval of event/history and transaction storage are both required."
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
      "one evidence drawer and zero forbidden duplicate evidence surfaces",
      "mobile editor heading starts at or above y=160 after Edit",
      "no editor/page double nested scroll and no internally scrolling multiline editor",
      "body and provenance remain separate",
      "all text reflows without overlap at 200 percent",
      "one native browser page zoom profile owns text scaling; synthetic descendant or leaf inline fontSize and lineHeight mutation counts remain zero"
    ]
  },
  "validationContract": {
    "kind": "validation_contract",
    "canonicalSpecReviewTokens": [
      "node",
      "evaluation/workpack-document-editors-v2-2026-07-13/validate-contract.mjs",
      "spec-review",
      "--evidence",
      "<FULL_EVIDENCE_SHA>",
      "--manifest",
      "evaluation/workpack-document-editors-v2-2026-07-13/review-evidence.json",
      "--candidate",
      "<FULL_CANDIDATE_SHA>",
      "--source-base",
      "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
      "--target",
      "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
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
        "mutation": "accept a candidate control that is not approved",
        "expectedErrorPrefix": "PHOTO_CONTROLS:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-arbitrary-digest-object",
        "scope": "photo",
        "mutation": "controlAcceptanceDigest={}",
        "expectedErrorPrefix": "PHOTO_DIGEST:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-arbitrary-digest-string",
        "scope": "photo",
        "mutation": "controlAcceptanceDigest=arbitrary",
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
        "mutation": "accepted IDs reorder the approved control sequence",
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
        "mutation": "analysisRevision is stale",
        "expectedErrorPrefix": "PHOTO_REVISION:"
      },
      {
        "kind": "negative_attack",
        "id": "photo-stale-review-revision",
        "scope": "photo",
        "mutation": "reviewRevision is stale",
        "expectedErrorPrefix": "PHOTO_REVISION:"
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
        "mutation": "manifest candidate parent differs from f45",
        "expectedErrorPrefix": "IDENTITY:"
      }
    ],
    "requiredRuns": "Canonical spec-review twice, dynamic unknown-key matrix twice, and all 26 deliberate negative attacks twice.",
    "implementationMode": "Always exits nonzero with IMPLEMENTATION_BLOCKED_PENDING_EXPLICIT_USER_DB_AUTHORITY_APPROVAL.",
    "claimBoundary": "PASS output is limited to contract structure, Markdown parity, immutable Git identity, freshness, and negative test behavior. It never claims product, build, export, browser, DB, provider, or implementation execution.",
    "browserExecutions": 0
  },
  "integrationLedger": {
    "kind": "integration_ledger",
    "capturedAt": "2026-07-13T23:36:58.239Z",
    "captureCommand": "git fetch --prune origin; git pull --rebase origin feat/phase-a-evidence-integration",
    "authorityRef": "refs/remotes/origin/feat/phase-a-evidence-integration",
    "authorityHead": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "sourceBase": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "currentIntegrationTarget": "f45bba17bcce0d8ebb2690f82d014dbe42ae8191",
    "candidateBranch": "feat/workpack-document-editors-v2-target-ready-v4",
    "worktreeWasCleanBeforeEdits": true,
    "sourceCandidateHead": "c2ed91db690b9db508580099590130e0cf057209",
    "sourceCandidateBranch": "feat/workpack-document-editors-v2-target-ready-v3",
    "sourceCandidateUse": "READ_ONLY_FILE_CONTENT_PORT_NO_ANCESTRY",
    "rejectedReferenceHead": "b3762867d380f20faee2a83a17354dc61557ce12",
    "rejectedReferenceUse": "READ_ONLY_CONCEPT_REFERENCE_NO_ANCESTRY",
    "refreshRequiredAfterSeconds": 86400
  }
}
```
