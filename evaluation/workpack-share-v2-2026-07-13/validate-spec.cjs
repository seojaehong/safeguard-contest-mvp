"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SPEC_DIR = __dirname;
const REPO_ROOT = path.resolve(SPEC_DIR, "..", "..");
const MD_PATH = path.join(SPEC_DIR, "spec.md");
const JSON_PATH = path.join(SPEC_DIR, "spec.json");
const EVIDENCE_PATH = path.join(SPEC_DIR, "review-evidence.json");
const TICK = String.fromCharCode(96);

const FILES = {
  md: "evaluation/workpack-share-v2-2026-07-13/spec.md",
  json: "evaluation/workpack-share-v2-2026-07-13/spec.json",
  validator: "evaluation/workpack-share-v2-2026-07-13/validate-spec.cjs",
  evidence: "evaluation/workpack-share-v2-2026-07-13/review-evidence.json"
};
const CANDIDATE_FILES = [FILES.md, FILES.json, FILES.validator];
const EVIDENCE_FILES = [FILES.evidence];

const LANGUAGES = ["ko", "vi", "zh", "th", "uz", "mn", "ne", "km", "id", "my", "tl", "en"];
const CHANNELS = ["email", "sms", "kakao"];
const ROUTES = Array.from({ length: 11 }, function routeId(_, index) {
  return "R" + String(index + 1);
});
const STATES = [
  "blocked", "no_recipients", "selected", "logged_out", "review_required", "ready",
  "sending", "success", "partial", "fail", "offline", "stale"
];
const BLOCKERS = [
  "channel_not_selected", "worker_contact_missing", "worker_server_id_missing",
  "channel_unconfigured", "kakao_not_approved", "recipient_locale_invalid",
  "translation_incomplete", "translation_not_reviewed", "translation_rejected",
  "workpack_revalidation", "participant_snapshot_stale"
];
const RUNTIME_KEYS = [
  "SAFECLAW_CHANNEL_CONFIG_REVISION",
  "SAFECLAW_CHANNEL_CONFIG_DIGEST_KEY_ID",
  "SAFECLAW_CHANNEL_AVAILABILITY_SECRET",
  "SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET",
  "SAFECLAW_REVIEWED_LOCALIZATION_SECRET"
];
const SECRET_KEYS = [
  "SAFECLAW_CHANNEL_AVAILABILITY_SECRET",
  "SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET",
  "SAFECLAW_REVIEWED_LOCALIZATION_SECRET"
];
const STRUCTURAL_SURFACES = ["title", "metadataLabels", "metadataValues", "body"];
const COMPLETENESS_SURFACES = ["title", "site", "task", "coreRisk", "body", "action"];
const LANGUAGE_CASES = ["auto_all_languages", "manual_all_languages", "invalid_locale", "semantic_meaning"];
const DEFAULT_LANGUAGE_UI = ["autoSelection", "manualDropdown", "localizedPreview", "languageCardGrid"];
const EMOJI_INVENTORY = ["⚠️", "🧱", "🌬️", "🚧"];
const GEOMETRY_SETS = ["visibleElements", "interactables", "textLeaves", "ownerMappings", "scrollRegionMappings"];
const GEOMETRY_FAILURES = [
  "empty_census", "unmapped_owner", "overlap", "cross_parent_overlap", "text_clipping",
  "clipping_ancestor", "nested_scroll", "horizontal_overflow", "fixed_obstruction", "sticky_obstruction"
];
const ZOOM_REQUIREMENTS = [
  "representative_source", "immutable_baseline", "text_scaling", "ancestor_inspection",
  "prohibited_delivery", "scale_invariants", "reflow", "fresh_dom_runs",
  "viewport_matrix", "scroll_regions", "browser_execution_count"
];
const ENVIRONMENTS = ["day-desktop", "night-desktop", "day-mobile", "night-mobile"];
const ZOOM_MODES = ["normal_100", "computed_text_200"];
const FIXTURES = [
  "empty", "selected", "channel_unavailable", "review_required", "workpack_revalidation",
  "logged_out", "blocked", "ready", "sending", "result_accepted", "result_partial",
  "fail_session", "fail_dispatch", "fail_dispatch_unpersisted", "offline", "stale"
];
const WAVE_NAMES = [
  "Integrated Base Gate",
  "Authority Foundation And Session Binding",
  "Return Resolver, Share IA, And Owner Routes",
  "Real Browser Gate"
];

const ROUTE_CONTRACT = [
  { id: "R1", purpose: "roster registration, update, and quick add", ownerRoute: "/workers", returnPath: "/workers?next={encoded shareReturn}", exclusionSemantics: "Share is read-only; roster and quick-add mutation requests are 0" },
  { id: "R2", purpose: "today participant snapshot selection", ownerRoute: "/workspace?step=input, /workers", returnPath: "/workers?next={encoded shareReturn}", exclusionSemantics: "Share does not mutate or persist the participant snapshot" },
  { id: "R3", purpose: "current workpack send orchestration", ownerRoute: "/workspace?step=share", returnPath: "/workspace?step=share&theme={theme}", exclusionSemantics: "only the single session-then-dispatch action is send-capable" },
  { id: "R4", purpose: "localization generation, edit, review, and signed persistence", ownerRoute: "document-editor:foreignWorkerTransmission, /api/workpacks/{id}/localized-dispatch-artifacts/{locale}/review", returnPath: "/workspace?step=document&document=foreignWorkerTransmission&language={validatedSupportedCode}&returnStep=share&theme={theme}", exclusionSemantics: "Share cannot generate, edit, approve, sign, or persist localization" },
  { id: "R5", purpose: "email, sms, and kakao configuration, approval, and availability", ownerRoute: "/settings, /api/settings/channels/resolve", returnPath: "/settings?next={encoded shareReturn}", exclusionSemantics: "Share exposes no secret, channel setup, template approval, or sender input" },
  { id: "R6", purpose: "organization reporting recipient group", ownerRoute: "/settings", returnPath: "/settings?next={encoded shareReturn}", exclusionSemantics: "reporting recipients never change worker count or own the send primary" },
  { id: "R7", purpose: "dispatch request and channel results", ownerRoute: "/dispatch", returnPath: "/dispatch", exclusionSemantics: "Share shows only a compact result strip and links only with persisted log IDs" },
  { id: "R8", purpose: "session, save, and read history", ownerRoute: "/archive", returnPath: "/archive", exclusionSemantics: "Share contains no session, save, or full-history panel" },
  { id: "R9", purpose: "Before/After improvement history", ownerRoute: "/reports, /archive", returnPath: "not_available_from_share_body", exclusionSemantics: "improvement and history panels are excluded from Share" },
  { id: "R10", purpose: "login and canonical return", ownerRoute: "/login, /auth/callback, /workspace", returnPath: "/login?next={encoded shareReturn}", exclusionSemantics: "unvalidated next, step, document, language, or returnStep is forbidden" },
  { id: "R11", purpose: "invitation access policy", ownerRoute: "share-session API, /settings policy", returnPath: "/settings?next={encoded shareReturn}", exclusionSemantics: "no public link or worker provisioning; compact policy info only" }
];

const SCREEN_SECTION_CONTRACT = [
  { order: 1, id: "workpack_status", role: "status", content: "문서팩 이름과 readiness 한 줄", actionNodeId: "document_link" },
  { order: 2, id: "target", role: "target_summary", content: "오늘 참여자 N명과 최대 3명 이름", actionNodeId: "target_owner_link" },
  { order: 3, id: "channel", role: "channel_selection", content: "메일, 문자, 승인된 카카오 선택과 수신 가능 수", actionNodeId: "channel_controls" },
  { order: 4, id: "localized_preview", role: "localized_preview", content: "자동 해석 언어, option 12개 dropdown, 검토 artifact 미리보기", actionNodeId: "language_dropdown" },
  { order: 5, id: "operator_note", role: "optional_input", content: "선택 전달 메모", actionNodeId: "operator_note_input" },
  { order: 6, id: "result_strip", role: "result_status", content: "accepted, failed, unknown 채널/request 요약", actionNodeId: "history_link" },
  { order: 7, id: "primary_action", role: "primary_action", content: "현재 state의 primary 하나", actionNodeId: "primary_send" }
];

const CTA_CONTRACT = [
  { id: "document_link", sectionId: "workpack_status", kind: "secondary_navigation", sendCapable: false, maximumVisibleCount: 1 },
  { id: "target_owner_link", sectionId: "target", kind: "secondary_navigation", sendCapable: false, maximumVisibleCount: 1 },
  { id: "channel_controls", sectionId: "channel", kind: "selection_control", sendCapable: false, maximumVisibleCount: 1 },
  { id: "language_dropdown", sectionId: "localized_preview", kind: "preview_control", sendCapable: false, maximumVisibleCount: 1 },
  { id: "operator_note_input", sectionId: "operator_note", kind: "input_control", sendCapable: false, maximumVisibleCount: 1 },
  { id: "history_link", sectionId: "result_strip", kind: "conditional_navigation", sendCapable: false, maximumVisibleCount: 1 },
  { id: "primary_send", sectionId: "primary_action", kind: "primary_send", sendCapable: true, maximumVisibleCount: 1 }
];

const PRODUCT_KEYS = [
  "job", "screenSequence", "onePrimaryPerScreen", "singletonSurfaces",
  "desktopLayout", "screenSections", "ctaInventory", "excludedFromShareBody"
];

const SAFE_COMMANDS = [
  { id: "candidate_structure", executable: "node", arguments: [FILES.validator, "--skip-evidence"], stage: "candidate before evidence", requiredRuns: "2" },
  { id: "evidence_identity", executable: "node", arguments: [FILES.validator], stage: "evidence child", requiredRuns: "2" },
  { id: "markdown_mutation", executable: "node", arguments: [FILES.validator, "--skip-evidence", "--md-mutation", "{allowlistedMode}"], stage: "candidate mutation matrix", requiredRuns: "2 each" },
  { id: "json_mutation", executable: "node", arguments: [FILES.validator, "--skip-evidence", "--json-mutation", "{allowlistedMode}"], stage: "candidate mutation matrix", requiredRuns: "2 each" },
  { id: "identity_mutation", executable: "node", arguments: [FILES.validator, "--identity-mutation", "{allowlistedMode}"], stage: "evidence mutation matrix", requiredRuns: "2 each" },
  { id: "validator_syntax", executable: "node", arguments: ["--check", FILES.validator], stage: "final static check", requiredRuns: "1" }
];

const REVIEW_ATTACKS = [
  { id: "md_route_owner", reviewedCandidate: "0c6603adf7159dc98df6b6b365d3a03cddb65be1", observedBaselineExit: 0, requiredRemediatedExit: 1 },
  { id: "json_route_owner", reviewedCandidate: "0c6603adf7159dc98df6b6b365d3a03cddb65be1", observedBaselineExit: 0, requiredRemediatedExit: 1 },
  { id: "secondary_send_injection", reviewedCandidate: "0c6603adf7159dc98df6b6b365d3a03cddb65be1", observedBaselineExit: 0, requiredRemediatedExit: 1 },
  { id: "forged_validation_command", reviewedCandidate: "0c6603adf7159dc98df6b6b365d3a03cddb65be1", observedBaselineExit: 0, requiredRemediatedExit: 1 },
  { id: "product_actions_wrapper_injection", reviewedCandidate: "e7f976b71dcd9489b992ca13fa1750bf4f82948e", observedBaselineExit: 0, requiredRemediatedExit: 1 },
  { id: "product_jobs_wrapper_injection", reviewedCandidate: "e7f976b71dcd9489b992ca13fa1750bf4f82948e", observedBaselineExit: 0, requiredRemediatedExit: 1 }
];

const MD_MUTATIONS = [
  "revision", "review_status", "implementation_status", "browser_status", "route_row",
  "state_row", "blocker_row", "channel_row", "language_row", "localized_surface",
  "invalid_locale", "emoji_semantics", "geometry_category", "scroll_root",
  "runtime_config", "one_send_job", "wave_order", "planned_case_count",
  "handoff_observation", "locale_completeness", "emoji_inventory", "default_language_ui",
  "route_owner", "screen_section_relabel", "documented_command_forgery"
];
const JSON_MUTATIONS = [
  "missing_status", "missing_implementation_status", "missing_browser_status",
  "empty_languages", "missing_auto_contract", "missing_manual_contract",
  "empty_localized_surfaces", "invalid_cta_interpolation", "emoji_semantics",
  "empty_geometry_categories", "missing_geometry_category", "empty_runtime_config",
  "missing_rotation", "multi_send_job", "empty_blockers", "planned_case_count",
  "browser_execution_nonzero", "implementation_unblocked", "empty_locale_completeness",
  "empty_emoji_inventory", "fallback_unblocked", "default_language_ui", "route_owner",
  "screen_section_injection", "screen_section_relabel", "screen_section_removal",
  "cta_inventory_injection", "command_identity_forgery",
  "product_actions_wrapper_injection", "product_jobs_wrapper_injection"
];
const IDENTITY_MUTATIONS = [
  "contradictory_changed_files", "candidate_parent", "candidate_scope",
  "browser_executed_claim", "semantic_pass_claim", "evidence_command_forgery"
];
const TOP_KEYS = [
  "schemaVersion", "specId", "revision", "status", "implementationStatus",
  "browserTddStatus", "browserExecutions", "metadata", "evidence", "product",
  "ownership", "routeOwnership", "returnContract", "stateMachine", "dataContracts",
  "sendLifecycle", "resultContract", "accessibility", "browserGate", "implementation",
  "nonGoals", "runtimePersistenceClarification", "userCopy", "claimRules",
  "parityCheck", "completionGate"
];

const CLOSED_OBJECT_KEY_CONTRACT = {
  "$": ["accessibility|browserExecutions|browserGate|browserTddStatus|claimRules|completionGate|dataContracts|evidence|implementation|implementationStatus|metadata|nonGoals|ownership|parityCheck|product|resultContract|returnContract|revision|routeOwnership|runtimePersistenceClarification|schemaVersion|sendLifecycle|specId|stateMachine|status|userCopy"],
  "$.accessibility": ["contrast|focusOrder|horizontalOverflowRule|interactiveGapMinPx|meaningCannotBeColorIconOrEmojiOnly|mobileExcluded|mobilePriority|nestedVerticalScrollAllowed|normalZoom|preview|reducedMotion|stateSemantics|textClippingCount|themePersistence|touchTargetMinPx|unintendedOverlapAreaPx|verticalScrollOwner|viewports|zoom200"],
  "$.accessibility.contrast": ["largeTextAndUiBoundaryMin|normalTextMin|themes"],
  "$.accessibility.normalZoom": ["delivery|id|measurement|previewState|taskDistanceMaxPx|totalPageHeightCeiling|totalShareHeightCeiling|zoomPercent"],
  "$.accessibility.normalZoom.taskDistanceMaxPx": ["desktop|mobile"],
  "$.accessibility.normalZoom.taskDistanceMaxPx.desktop": ["preSendBlockerOrOwner|ready|sendingOrResult"],
  "$.accessibility.normalZoom.taskDistanceMaxPx.mobile": ["preSendBlockerOrOwner|ready|sendingOrResult"],
  "$.accessibility.preview": ["collapsedContent|collapsedVisualRowMax|contentTruncatedByFixedPageHeight|expandControlMinPx|expandedInternalScroll|expandedTaskDistanceGateApplied"],
  "$.accessibility.viewports": ["desktop|mobile"],
  "$.accessibility.zoom200": ["actualFreshDomRuns|ancestorThenDescendantComputedRecaptureAllowed|baselineCaptureBeforeAnyMutation|baselineImmutable|browserExecutions|cssViewportWidthMustEqualConfiguredViewport|cumulativeScalingAllowed|deliveryRequirement|devicePixelRatio|deviceScaleFactor|exactViewports|fixedHeightCeiling|fixedTaskDistanceCeiling|fontSizeRatioMax|fontSizeRatioMin|geometryCoverage|heightAssertion|humanRequirementIds|id|lineHeightRatioMax|lineHeightRatioMin|pathTraversalFromEveryRepresentativeToDocumentRoot|plannedFreshDomRunsRequired|plannedTestFile|prohibitedDelivery|representativeAndEveryAncestorScaleInspection|representativeSource|required|requirementStatus|rootFontChangeAccepted|sameDomRepeatedRunsAllowed|scalingPassCount|visualViewportScale|wrappingAssertion|zoomPercent"],
  "$.accessibility.zoom200.geometryCoverage": ["browserExecutions|censusExpression|emptyCensusAllowed|everyVisibleElementRequiresExactlyOneScrollRegionMapping|everyVisibleElementRequiresOwnerMapping|expectationMayBeDerivedFromRenderedDom|expectationSource|expectedCountsMustBePositiveIntegers|failureCategories|mandatoryMappingAttributes|nestedScrollExpected|ownershipRules|querySelectorAllIncludesRoot|requiredExpectedCountSets|requiredScrollRegionRootCounts|requiredScrollRegions|requirementStatus|rootIdentityDedupRequired|rootIncludedExactlyOnce|sets|verticalScrollOwner"],
  "$.accessibility.zoom200.geometryCoverage.failureCategories[]": ["condition|expected|id"],
  "$.accessibility.zoom200.geometryCoverage.requiredScrollRegionRootCounts": ["body|preview"],
  "$.accessibility.zoom200.geometryCoverage.sets[]": ["expected|id|source"],
  "$.browserGate": ["allFixturesUseAllZoomModes|allowedInputs|browserExecutions|cacheAuthority|caseAxes|caseCount|caseCountByZoom|caseCountFormula|caseIdTemplate|databaseWritesAllowed|environments|fixtureIngress|fixtures|forbiddenFixtureMechanisms|languageGate|layoutAssertions|plannedCaseCount|providerCallsAllowed|requestAssertions|requirementStatus|runner|status|zoomModes"],
  "$.browserGate.caseCountByZoom": ["computed_text_200|normal_100"],
  "$.browserGate.environments[]": ["id|theme|viewport"],
  "$.browserGate.fixtures[]": ["actions|assertions|entry|id|resolverInput"],
  "$.browserGate.languageGate": ["allTwelveLanguagesUseSameCompletenessContract|artifactFamily|authorityCases|autoResolutionAuthority|autoSelectionContract|autoSelectionLanguagesRequired|browserExecutions|defaultUiControls|dropdownCount|emojiOnlyMeaningAllowed|emojiSemantics|fallbackContract|hangulResidueAllowedInNonKoreanArtifact|iconOnlyMeaningAllowed|invalidLocaleCta|invalidLocaleDispatchRequestCount|invalidLocaleSessionRequestCount|koreanOnlyMetadataValueAllowed|languagePolicies|localeCompletenessSurfaces|localizedSurfaces|manualDropdownPurpose|manualSelectionContract|manualSelectionLanguagesRequired|meaningSemantics|neutralIdentifiers|nonKoreanTargetKoreanFallbackAllowed|optionOrder|partialBodyOrEnglishFallback|previewOverrideKeepsDispatchLanguage|previewOverrideKeepsDispatchPlanDigest|previewOverrideKeepsRecipientLanguage|requiredProvenanceAndReviewFields|requirementStatus|selectedLanguageResidualContract|structuralEmojiAllowed|unknownUnsupportedOrMalformedLocale|vietnameseKoreanResidualZeroSurfaces"],
  "$.browserGate.languageGate.authorityCases[]": ["dispatch|id|preview|result"],
  "$.browserGate.languageGate.autoSelectionContract": ["authority|languageCount|nonKoreanHangulResidual|requiredCompletenessSurfaces|requiredSurfaces"],
  "$.browserGate.languageGate.defaultUiControls[]": ["authority|behavior|id|visibleCount"],
  "$.browserGate.languageGate.emojiSemantics[]": ["accessibility|allowedRole|semanticPresentation|symbol"],
  "$.browserGate.languageGate.fallbackContract": ["automaticLocaleFallbackAllowed|dispatchRequestCount|partialTranslationFallbackAllowed|shareSessionRequestCount|state"],
  "$.browserGate.languageGate.invalidLocaleCta": ["dispatchRequestCount|languageQueryCount|ownerRoute|primaryLabel|rawLocaleInterpolationAllowed|reasonId|shareSessionRequestCount|state"],
  "$.browserGate.languageGate.languagePolicies[]": ["auto|code|hangul|manual|script"],
  "$.browserGate.languageGate.localeCompletenessSurfaces[]": ["id|incompleteResult|nonKoreanTargetKoreanResidue|requiredLocalizedContent"],
  "$.browserGate.languageGate.localizedSurfaces[]": ["auto|id|manual|script|source"],
  "$.browserGate.languageGate.manualSelectionContract": ["authority|dispatchLanguageMutationAllowed|dispatchPlanDigestMutationAllowed|languageCount|recipientLanguageMutationAllowed|requiredCompletenessSurfaces|requiredSurfaces"],
  "$.browserGate.languageGate.partialBodyOrEnglishFallback": ["primaryLabel|reasonId|state"],
  "$.browserGate.languageGate.selectedLanguageResidualContract": ["appliesTo|koreanMetadataLabelsAllowed|koreanMetadataValuesAllowed|koreanResidueCount"],
  "$.browserGate.languageGate.unknownUnsupportedOrMalformedLocale": ["languageQueryCount|ownerRoute|primaryLabel|rawLocaleInterpolationAllowed|reasonId|state"],
  "$.browserGate.zoomModes[]": ["actualFreshDomRuns|baselineCaptureBeforeAnyMutation|browserExecutions|cssViewportWidthEqualsConfiguredViewport|cssZoomUsedForZoom|delivery|devicePixelRatio|deviceScaleFactor|deviceScaleFactorUsedForZoom|id|inspectEveryRepresentativePathToDocumentRoot|plannedFreshDomRunsRequired|ratioUpperBoundPreventsFourOrEightTimes|repeatedEvaluationRequiresFreshProductionFixtureDom|requirementStatus|scaleEachNodeExactlyOnce|screenshotScalingUsedForZoom|taskDistanceGate|transformUsedForZoom|verificationRequirement|visualViewportScale","delivery|id|taskDistanceGate"],
  "$.claimRules": ["acceptedMeansRecipientRead|acceptedMeansRecipientReceived|partialLocalizationMeansComplete|savedMeansLegalEvidence"],
  "$.completionGate": ["actualBrowserCasesExecuted|browserPassClaim|browserSemanticsEvaluated|browserTddStatus|candidateCommitChangedFiles|cleanWorktreeRequired|commitRequired|evidenceCommitChangedFiles|finalBoundary|freshIndependentReviewRequired|gitDiffCheckRequired|identityMutationModesRequired|identityMutationRunsRequiredEach|implementationReady|implementationStatus|jsonMutationModesRequired|jsonMutationRunsRequiredEach|jsonParseRequired|markdownMutationModesRequired|markdownMutationRunsRequiredEach|nodeSyntaxCheckRequired|plannedBrowserCases|pullRebaseRequired|pushRequired|remoteShaMatchRequired|semanticPassClaim|status|structuralValidationRunsRequired"],
  "$.dataContracts": ["adapterContract|channelAvailability|dispatchChannels|localeParser|localizedDispatchArtifact|reportingRecipientGroup|resolvedChannel|serverRuntimeConfiguration|sessionDispatchBinding|supportedLanguageCodes|todayParticipantSnapshot"],
  "$.dataContracts.adapterContract": ["destructiveMigrationAllowed|displayAndRouteOwnershipMayMove|futureDatabaseProposalOnly|preserve"],
  "$.dataContracts.channelAvailability": ["authenticated|configuration|dispatchDefenseInDepthPreserved|dispatchRouteUsesSameServerFunction|forbiddenResponseFields|method|owner|readyRequires|requestFields|responseFields|route|serverChecks|serverFunction|sessionRouteRerunsServerFunction|sessionRouteRevalidatesToken|token|typeName|unresolvedOrUnavailableSessionRequestCount|version"],
  "$.dataContracts.channelAvailability.configuration": ["configuredOrApprovedBooleansAloneSufficient|digestAlgorithm|digestInputs|digestKeyIdRequired|digestSecret|identitySchema|missingInvalidRevision|persistedOrReturnedFields|rawIdentityFieldsExposed|recomputedAt|revisionSource|revisionType|rotation|version"],
  "$.dataContracts.channelAvailability.configuration.rotation": ["availabilitySecretRotation|bindingSecretRotation|endpointSenderTemplateProviderApprovalOrCredentialChange|existingSessionAfterIdentityOrKeyRotation"],
  "$.dataContracts.channelAvailability.serverChecks": ["authentication|dispatchMode|emailSmsContacts|kakaoEnabledFlags|kakaoProviderAndTemplateApproval|persistentIdempotencyPolicy|relayAndProviderPolicy|serverWorkerSnapshot|workpackOwnership"],
  "$.dataContracts.channelAvailability.token": ["algorithm|bindings|secret|secretUnconfigured|secretsExposed|ttlSeconds"],
  "$.dataContracts.localeParser": ["acceptedShape|allowlist|authoritativeInputsMustAgree|blockers|forbiddenCoercions|invalidAfterSessionReload|invalidBeforeSession|invalidState|koreanAllowedOnlyWhenAuthoritativeLocaleIsExactlyKo|manualPreviewOverrideChangesAuthority|normalization|rejectedReasons|serverAuthoritative|stageActions"],
  "$.dataContracts.localeParser.blockers": ["recipientLocaleInvalid|translationIncomplete"],
  "$.dataContracts.localeParser.blockers.recipientLocaleInvalid": ["covers|languageCodeInterpolationAllowed|ownerRoute|primaryLabel|reasonId"],
  "$.dataContracts.localeParser.blockers.translationIncomplete": ["covers|ownerRoute|primaryLabel|reasonId|requiresSupportedAllowlistedLocale"],
  "$.dataContracts.localeParser.invalidAfterSessionReload": ["dispatchLogInsertCount|providerDispatchCount|sessionState"],
  "$.dataContracts.localeParser.invalidBeforeSession": ["dispatchRequestCount|shareSessionRequestCount"],
  "$.dataContracts.localeParser.stageActions[]": ["automaticRetryCount|dispatchLogInsertCount|newSessionRowsCreated|providerDispatchCount|reasonId|sessionState|stage|state","dispatchLogInsertCount|providerDispatchCount|reasonId|retry|sessionRowsCreated|stage|state"],
  "$.dataContracts.localizedDispatchArtifact": ["artifactDigest|artifactFields|artifactTypeName|artifactVersion|envelopeFields|envelopeTypeName|envelopeVersion|failClosedState|fixtureAuthority|incompleteExamples|languageUi|nonKoreanReadyRequirements|owner|persistence|reviewRouteContract|reviewWrite|revisionSemantics|semanticRiskStandard|serverAuthority|shareMayApprove|shareMayEdit|shareMayGenerate|shareMayPersist|sourceDocumentDigest|staleOrInvalidWhen|vietnameseGateChecks"],
  "$.dataContracts.localizedDispatchArtifact.artifactDigest": ["algorithm|bindings"],
  "$.dataContracts.localizedDispatchArtifact.artifactFields": ["artifactId|artifactRevision|localized|provenance|targetLocale"],
  "$.dataContracts.localizedDispatchArtifact.artifactFields.localized": ["bodyLines|metadata|semanticRiskLabels|subject"],
  "$.dataContracts.localizedDispatchArtifact.artifactFields.localized.metadata": ["coreRiskLabel|coreRiskValue|siteLabel|siteValue|taskLabel|taskValue"],
  "$.dataContracts.localizedDispatchArtifact.artifactFields.provenance": ["generatedAt|method|modelOrVersion|provider"],
  "$.dataContracts.localizedDispatchArtifact.envelopeFields": ["artifact|artifactDigest|generationRevision|review|signature|signedAt|sourceDocumentDigest|sourceDocumentKey|targetLocale|workpackId"],
  "$.dataContracts.localizedDispatchArtifact.envelopeFields.review": ["reviewedAt|reviewerDisplayName|reviewerId|state"],
  "$.dataContracts.localizedDispatchArtifact.languageUi": ["alwaysVisibleChipCount|automaticSelection|dropdownCount|manualSelectionPurpose|optionCount|previewOverrideChangesDispatchPlanDigest|previewOverrideChangesRecipientDigest|previewOverrideChangesRecipientLanguage|previewOverrideChangesWorkpackRevision"],
  "$.dataContracts.localizedDispatchArtifact.persistence": ["clientOrLocalMutationAllowed|databaseMigrationRequired|mode|originalDeliverablesMutable|originalGenerationEvidenceMutable|storageBoundary"],
  "$.dataContracts.localizedDispatchArtifact.reviewRouteContract": ["clientCannotSet|mergeEnvelopeIntoDeliverablesBeforeGenerationVerification|requestFields|responseFields|verificationOrder"],
  "$.dataContracts.localizedDispatchArtifact.reviewWrite": ["artifactRevisionServerIncremented|compareAndSwap|expectedWorkpackRevisionRequired|generationEvidenceResealed|newEnvelopeSigned|originalGenerationEvidenceVerified|reviewerFromAuth|routeWritesUpdatedAt|secretUnconfigured|timestampsFromServerClock|zeroUpdatedRows"],
  "$.dataContracts.localizedDispatchArtifact.revisionSemantics": ["canonicalWorkpackRevision|changesAfterEveryReviewWrite|generationRevision|returnedBy|reviewSetDigest"],
  "$.dataContracts.localizedDispatchArtifact.semanticRiskStandard": ["default|emojiOnlyAllowed|iconRule"],
  "$.dataContracts.localizedDispatchArtifact.serverAuthority": ["authenticated|implementation|localeAllowlistRequired|method|organizationOwnershipRequired|route"],
  "$.dataContracts.localizedDispatchArtifact.sourceDocumentDigest": ["algorithm|clientDigestAuthority|serverInputs"],
  "$.dataContracts.reportingRecipientGroup": ["owner|separateFromWorkerRecipients|shareDisplaysResultOnly|unavailableDoesNotBlockWorkerDispatch"],
  "$.dataContracts.resolvedChannel": ["emailSmsResolution|fields|kakaoAvailability|losslessSurfaces|shareSetupUi|typeName|unavailableKakao"],
  "$.dataContracts.resolvedChannel.fields": ["approved|available|channel|configured|ownerRoute|reasonCode|recipientCount"],
  "$.dataContracts.serverRuntimeConfiguration": ["clientImportAllowed|digestKeyIdSecret|environment|environmentExample|httpResponseExposureAllowed|jsonbSecretPersistenceAllowed|logExposureAllowed|module|placeholdersOnlyInEnvExample|reader|secretNames|serverOnlyImportRequired|test"],
  "$.dataContracts.serverRuntimeConfiguration.environment[]": ["key|kind|missing|rotation|source"],
  "$.dataContracts.sessionDispatchBinding": ["databaseMigrationRequired|digestContracts|dispatchReload|existingJsonbEvidence|existingJsonbSafe|fields|migrationApprovalGate|mismatchOutcomes|serverAuthoritative|sessionCreate|sessionIdentity|storage|version"],
  "$.dataContracts.sessionDispatchBinding.digestContracts": ["bindingDigest|channelConfiguration|localePayloadDigest|normalizedWorkpackDigest|recipientSnapshotDigest|requestedChannels"],
  "$.dataContracts.sessionDispatchBinding.dispatchReload": ["automaticRetryAfterMismatch|clientFieldsAreLookupOnly|clientStateAuthority|dispatchLogInsertAfterMismatch|exactComparisons|providerCallAfterMismatch|reloads"],
  "$.dataContracts.sessionDispatchBinding.mismatchOutcomes[]": ["dispatchLogInsertCount|providerDispatchCount|reasonCode|session|state"],
  "$.dataContracts.sessionDispatchBinding.sessionCreate": ["atomicInsertFields|clientDigestAuthority|createdAtSource|identityGeneratedBeforeInsert|partialInsertMayReturnSuccess|preSessionMismatch|rowIdEqualsBindingSessionId"],
  "$.dataContracts.sessionDispatchBinding.sessionCreate.preSessionMismatch": ["dispatchRequestCount|shareSessionCreated|shareSessionId|stage"],
  "$.dataContracts.todayParticipantSnapshot": ["fields|localStorageAuthority|localStorageCannotCreate|mutationOwners|shareMayMutateRoster|shareMayMutateSnapshot|shareMayPostWorkers|typeName|version"],
  "$.dataContracts.todayParticipantSnapshot.fields": ["digest|selectedWorkerIds|source|sourceRevision|workDate|workers"],
  "$.dataContracts.todayParticipantSnapshot.fields.workers": ["displayName|email|languageCode|phone|workerId"],
  "$.evidence": ["browserHandoffObservation|currentAuthReturn|currentChannelChecks|currentCommercialLocaleParser|currentDispatchChannels|currentGenerationSeal|currentQualityFallback|currentSessionApi|currentWorkerOwnership|currentWorkspaceInitialization|currentWorkspaceRoute|observedDesktop|observedMobile|observedVietnamese"],
  "$.evidence.browserHandoffObservation": ["classification|countedAsBrowserExecutionForThisRevision|id|observedLocale|observedState|requiredDisposition"],
  "$.evidence.currentAuthReturn": ["owners|supportsSafeNext"],
  "$.evidence.currentChannelChecks": ["implementation|requiredV2Change|serverResolverBeforeSessionExists|timing"],
  "$.evidence.currentCommercialLocaleParser": ["currentAllowlistEnforced|currentMissingFallback|file|function|requiredChange"],
  "$.evidence.currentGenerationSeal": ["clientDeliverablesMutationWouldMismatch|implementation|responseContentDigestIncludesDeliverables|saveRecomputesAndVerifiesDigest|saveRoute"],
  "$.evidence.currentQualityFallback": ["canShare|localStorageMayOverrideReadiness|localStorageMayOverrideRevalidation|preserveFailClosed"],
  "$.evidence.currentSessionApi": ["createsAfterAdminAuth|currentAccessPolicyShape|currentJsonbFields|dispatchCurrentlyReadsAccessPolicy|requiredChange|returns|route"],
  "$.evidence.currentWorkerOwnership": ["contracts|owners"],
  "$.evidence.currentWorkspaceInitialization": ["currentInitialStep|file|requiredChange"],
  "$.evidence.currentWorkspaceRoute": ["acceptedQuery|file|missingContract"],
  "$.evidence.observedDesktop": ["defect|documentScrollApproxPx|rootApproxPx"],
  "$.evidence.observedMobile": ["commit|defects|inviteY|languageBox|languageControlsY|memoY|sharePathApproxPx|touchTargetsBelow44|viewport"],
  "$.evidence.observedMobile.languageBox": ["height|y"],
  "$.evidence.observedVietnamese": ["classification|commit|koreanResidue|structuralEmoji|translatedBodyLineCount"],
  "$.implementation": ["blocked|browserTddStatus|commonRules|implementationOnSpecBranchAllowed|releaseGate|startCondition|status|waves"],
  "$.implementation.waves[]": ["commands|conditionalFixFiles|exactFiles|exit|id|name|newFiles|rollback","commands|exactFiles|exit|id|name|newFiles|rollback","commands|exactFiles|exit|id|name|rollback"],
  "$.metadata": ["branch|browserSemanticValidationAllowed|candidateWriteFiles|evidenceOnlyWriteFile|forbiddenEdits|implementationStarted|reviewEvidenceManifest|reviewStatus|reviewedClaim|sourceBase|specOnly|validatorAuthority"],
  "$.ownership": ["archiveOwner|channelAvailabilityOwner|channelSetupOwner|dispatchHistoryOwner|noRecipientsOwnerRoute|noRecipientsPrimaryCount|reportingRecipientOwner|rosterOwner|shareCanCreateWorkers|shareCanMutateRoster|shareCanMutateTodaySnapshot|shareCanSavePeople|todaySnapshotOwners|translationOwner|translationPersistenceOwner"],
  "$.parityCheck": ["allowedAssertions|browserTddStatus|commandContract|executionContract|forbiddenAuthorities|forbiddenClaims|implementationStatus|location|reviewAttackTddRecord|runtime|status"],
  "$.parityCheck.commandContract": ["arbitrarySpecTextExecutionAllowed|documentedCommandRowsExecutedByValidator|documentedCommands|evidenceCommandIdentity|shellBuiltinsAllowed"],
  "$.parityCheck.commandContract.documentedCommands[]": ["arguments|executable|id|requiredRuns|stage"],
  "$.parityCheck.commandContract.evidenceCommandIdentity": ["candidateCommandId|evidenceCommandId|executable|validatorPath"],
  "$.parityCheck.executionContract": ["browserCasesExecutedBySpecValidation|identityMutationExpectedExitCode|identityMutationModeCount|identityMutationModes|identityMutationRunsRequiredEach|jsonMutationExpectedExitCode|jsonMutationModeCount|jsonMutationModes|jsonMutationRunsRequiredEach|markdownMutationExpectedExitCode|markdownMutationModeCount|markdownMutationModes|markdownMutationRunsRequiredEach|normalRunsRequired|syntheticGeometryCommandsAllowed|syntheticZoomCommandsAllowed"],
  "$.parityCheck.reviewAttackTddRecord[]": ["id|observedBaselineExit|requiredRemediatedExit|reviewedCandidate"],
  "$.product": ["ctaInventory|desktopLayout|excludedFromShareBody|job|onePrimaryPerScreen|screenSections|screenSequence|singletonSurfaces"],
  "$.product.ctaInventory[]": ["id|kind|maximumVisibleCount|sectionId|sendCapable"],
  "$.product.desktopLayout": ["emptySecondaryGridTrackAllowed|readingColumns|viewportWidthPx"],
  "$.product.screenSections[]": ["actionNodeId|content|id|order|role"],
  "$.product.singletonSurfaces": ["localizedPreviewMaxCount|localizedPreviewSelector|loggedOutAdditionalLoginCtaCount|screenTitleMaxCount|screenTitleOwner|workflowSharePanelRepeatsTitle"],
  "$.resultContract": ["classification|forbiddenClaims|historyRequiresPersistedLog|outcomes|persistenceProof|providerAndLogGranularity|recipientLevelDeliveredPersistence|sessionCreationClaimsInvitationSent|sessionFailureHistoryAllowed|stripFields"],
  "$.resultContract.classification": ["accepted|failState|failed|partialState|successState|unknown"],
  "$.resultContract.persistenceProof": ["authorityField|clientCacheIsAuthority|databaseMigrationRequired|method|requiredServerChange|route|savedCountAloneIsAuthority|workflowRunIdAloneIsAuthority"],
  "$.resultContract.stripFields": ["channels|duplicateRisk|idempotencyKey|persistedLogIds|providerCalled|requestOutcome|shareSessionId|stage|workflowRunId"],
  "$.resultContract.stripFields.channels": ["channel|logId|outcome|providerStatus"],
  "$.returnContract": ["authReturnResolvers|canonicalSharePaths|commandCenterContract|currentImplementationComplete|greenCannotBeClaimedByHrefOnly|implementationOwners|loginHrefTemplate|ownerHrefTemplates|workspaceQuery"],
  "$.returnContract.commandCenterContract": ["backAndReloadRestoreStep|blockedShareInspectable|blockedShareNetworkCalls|finalResolverInputs|missingWorkpackFallback|newProp|queryUpdatedOnStepChange|restoreInput|themePreserved"],
  "$.returnContract.ownerHrefTemplates": ["recipientLocaleInvalid|settings|translationReview|workers"],
  "$.returnContract.workspaceQuery": ["document|language|returnStep|step|theme"],
  "$.returnContract.workspaceQuery.document": ["allowedWhen|validation"],
  "$.returnContract.workspaceQuery.language": ["allowedWhen|validation"],
  "$.returnContract.workspaceQuery.returnStep": ["allowed"],
  "$.returnContract.workspaceQuery.step": ["allowed|owner"],
  "$.returnContract.workspaceQuery.theme": ["allowed|owner"],
  "$.routeOwnership[]": ["exclusionSemantics|id|ownerRoute|purpose|returnPath"],
  "$.sendLifecycle": ["attemptLock|betweenStepsFreshnessGate|createSession|dispatch|invitationPolicy|newSessionPerAttempt|onSessionFailure|order|preserveIdsOnlyWhenExistingStorageSupports|readyDoesNotMean|readyGuards|readyMeans|reuseExistingSession|saveChannelLog|sessionExistsInReady"],
  "$.sendLifecycle.betweenStepsFreshnessGate": ["authority|clientStateAuthority|inputs|onRecipientLocaleInvalid|onTranslationIncomplete|onWorkpackRecipientChannelOrIdentityChange"],
  "$.sendLifecycle.createSession": ["atomicBeforeDispatch|atomicScope|method|onPartialBinding|partialBindingCanReturnSuccess|requestBody|requestCount|route|serverValidationBeforeInsert|successRequires|unresolvedOrUnavailableDispatchCount|unresolvedOrUnavailableInsertCount"],
  "$.sendLifecycle.createSession.requestBody": ["availabilityToken|canonicalWorkpackRevision|channels|recipients"],
  "$.sendLifecycle.dispatch": ["allowedPayloadFields|bindingMismatchDispatchLogInsertCount|bindingMismatchProviderDispatchCount|channelChecksPreservedAsDefenseInDepth|forbiddenPayloadAdditions|method|requestCountAfterSessionSuccess|requiresNewSessionId|requiresServerBindingReloadBeforeProvider|route"],
  "$.sendLifecycle.invitationPolicy": ["access|adminAuthRequiredForCreation|anonymousAllowed|expiry|publicLinkAllowed|role|workerAccountProvisioning"],
  "$.sendLifecycle.onSessionFailure": ["covers|dispatchRequestCount|failureStage|historyHrefCount|primaryLabel|state|userCopy"],
  "$.sendLifecycle.saveChannelLog": ["granularity|historyAllowedOnlyAfterPersistedLogId|recipientDeliveryPersistence|route"],
  "$.stateMachine": ["blockingReasons|failureCta|historyAuthority|nonBlockingStatus|precedence|primaryCta|reasonArbitration|revalidationDecisionRule|states|transitions|unusedPreviewLanguageRule|visiblePrimaryCount|visiblePrimarySelector"],
  "$.stateMachine.blockingReasons[]": ["action|id|label|languageCodeInterpolationAllowed|owner|returnRoute|state","action|id|label|owner|requiresAllowlistedLocale|returnRoute|state","action|id|label|owner|returnRoute|state"],
  "$.stateMachine.failureCta": ["channel_resolution_unresolved|channel_unavailable|dispatch_failed_log_persisted|dispatch_rejected_before_provider|dispatch_result_log_missing|sent_or_partial_log_persisted|session_create_failed"],
  "$.stateMachine.failureCta.channel_resolution_unresolved": ["action|historyHrefAllowed|persistedDispatchLog|primaryLabel|route|sessionRequestCount"],
  "$.stateMachine.failureCta.channel_unavailable": ["action|historyHrefAllowed|persistedDispatchLog|primaryLabel|route|sessionRequestCount"],
  "$.stateMachine.failureCta.dispatch_failed_log_persisted": ["action|historyHrefAllowed|persistedDispatchLog|primaryLabel|route"],
  "$.stateMachine.failureCta.dispatch_rejected_before_provider": ["action|automaticRetry|historyHrefAllowed|persistedDispatchLog|primaryLabel|route"],
  "$.stateMachine.failureCta.dispatch_result_log_missing": ["action|automaticRetry|historyHrefAllowed|persistedDispatchLog|primaryLabel|route"],
  "$.stateMachine.failureCta.sent_or_partial_log_persisted": ["action|historyHrefAllowed|persistedDispatchLog|primaryLabel|route"],
  "$.stateMachine.failureCta.session_create_failed": ["action|dispatchRequestCount|historyHrefAllowed|persistedDispatchLog|primaryLabel|route"],
  "$.stateMachine.nonBlockingStatus": ["action|changesWorkerDispatchState|id|mayOwnPrimary|owner|returnRoute"],
  "$.stateMachine.primaryCta": ["blocked|fail|logged_out|no_recipients|offline|partial|ready|recipient_locale_invalid|review_required|sending|session_create_failed|stale|success|translation_incomplete|translation_not_reviewed|translation_rejected|workpack_revalidation"],
  "$.stateMachine.revalidationDecisionRule": ["condition|evaluateBeforeGenericBlocked|genericBlockedPrimaryLabelForbidden|primaryLabel|reasonId"],
  "$.stateMachine.states[]": ["action|enabled|entry|id|networkCalls|primaryLabel","action|enabled|entry|id|primaryLabel","action|enabled|entry|id|primaryLabel|routeBackControlCount|secondaryTargetChangeLinkVisible|workerMutationRequests","action|enabled|entry|id|primaryLabel|sessionExists"],
  "$.stateMachine.transitions[]": ["action|dispatchLogInsertCount|event|from|languageQueryCount|providerDispatchCount|reasonId|sessionState|to","action|dispatchLogInsertCount|event|from|providerDispatchCount|reasonId|sessionState|to","dispatchLogInsertCount|event|from|providerDispatchCount|sessionState|to","dispatchRequestCount|event|failureStage|from|historyHrefCount|to","event|from|networkRequestsWhileOffline|to","event|from|to"],
  "$.userCopy": ["acceptedWithPersistedLog|language|loggedOutCta|noRecipients|noRecipientsCta|partial|readyCta|recipientLanguageBlocker|recipientLanguageCta|revalidation|sessionFailure|sessionFailureCta|stale|target|translationBlocker|translationIncompleteCta|unknownWithoutLog"]
};

function fail(message) {
  throw new Error(message);
}

function ensure(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function object(value, label) {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value), label + " must be an object");
  ensure(Object.keys(value).length > 0, label + " must not be empty");
  return value;
}

function array(value, label) {
  ensure(Array.isArray(value) && value.length > 0, label + " must be a non-empty array");
  return value;
}

function string(value, label) {
  ensure(typeof value === "string" && value.trim().length > 0, label + " must be a non-empty string");
  return value;
}

function exact(actual, expected, label) {
  ensure(
    JSON.stringify(actual) === JSON.stringify(expected),
    label + " mismatch; expected " + JSON.stringify(expected) + ", received " + JSON.stringify(actual)
  );
}

function members(actual, expected, label) {
  ensure(Array.isArray(actual), label + " must be an array");
  exact(actual.slice().sort(), expected.slice().sort(), label);
}

function itemIds(items, label) {
  return array(items, label).map(function mapId(item, index) {
    return string(object(item, label + "[" + String(index) + "]").id, label + " id");
  });
}

function unique(values, label) {
  ensure(new Set(values).size === values.length, label + " must be unique");
}

function noEmptyValues(value, currentPath) {
  const emptyArrayException = "$.implementation.waves[0].exactFiles";
  const nullException = "$.dataContracts.sessionDispatchBinding.sessionCreate.preSessionMismatch.shareSessionId";

  if (value === null) {
    ensure(currentPath === nullException, currentPath + " must not be null");
    return;
  }
  if (Array.isArray(value)) {
    ensure(value.length > 0 || currentPath === emptyArrayException, currentPath + " must not be empty");
    value.forEach(function visit(item, index) {
      noEmptyValues(item, currentPath + "[" + String(index) + "]");
    });
    return;
  }
  if (value !== null && typeof value === "object") {
    ensure(Object.keys(value).length > 0, currentPath + " must not be empty");
    Object.entries(value).forEach(function visit(entry) {
      noEmptyValues(entry[1], currentPath + "." + entry[0]);
    });
    return;
  }
  if (typeof value === "string") {
    ensure(value.trim().length > 0, currentPath + " must not be blank");
  }
}

function assertClosedObjectGraph(spec) {
  const seenPaths = new Set();

  function visit(value, currentPath) {
    if (Array.isArray(value)) {
      value.forEach(function visitArrayItem(item) {
        visit(item, currentPath + "[]");
      });
      return;
    }
    if (value === null || typeof value !== "object") {
      return;
    }

    const allowedSignatures = CLOSED_OBJECT_KEY_CONTRACT[currentPath];
    ensure(Array.isArray(allowedSignatures), "unknown object path: " + currentPath);
    const actualSignature = Object.keys(value).sort().join("|");
    ensure(
      allowedSignatures.includes(actualSignature),
      currentPath + " object keys mismatch; expected one of " + JSON.stringify(allowedSignatures) + ", received " + actualSignature
    );
    seenPaths.add(currentPath);
    Object.entries(value).forEach(function visitObjectEntry(entry) {
      visit(entry[1], currentPath + "." + entry[0]);
    });
  }

  visit(spec, "$");
  members(Array.from(seenPaths), Object.keys(CLOSED_OBJECT_KEY_CONTRACT), "closed object paths");
}

function git(args) {
  return childProcess.execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function resolveCommit(ref) {
  return git(["rev-parse", "--verify", ref + "^{commit}"]);
}

function directParent(ref) {
  const fields = git(["rev-list", "--parents", "-n", "1", ref]).split(/\s+/);
  ensure(fields.length === 2, ref + " must have one direct parent");
  return fields[1];
}

function commitFiles(ref) {
  const output = git(["diff-tree", "--no-commit-id", "--name-only", "-r", ref]);
  return output.length === 0 ? [] : output.split(/\r?\n/).filter(Boolean).sort();
}

function assertSchema(spec) {
  object(spec, "$");
  members(Object.keys(spec), TOP_KEYS, "top-level keys");
  assertClosedObjectGraph(spec);
  noEmptyValues(spec, "$");

  ensure(spec.schemaVersion === "safeclaw-workpack-share-v2-product-spec/v3", "schemaVersion mismatch");
  ensure(spec.specId === "workpack-share-v2-2026-07-13", "specId mismatch");
  ensure(spec.revision === "independent-review-remediation-9", "revision mismatch");
  ensure(spec.status === "SPEC_REVIEW_ONLY", "status must be SPEC_REVIEW_ONLY");
  ensure(spec.implementationStatus === "IMPLEMENTATION_BLOCKED", "implementation must be blocked");
  ensure(spec.browserTddStatus === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "browser TDD status mismatch");
  ensure(spec.browserExecutions === 0, "browser executions must be 0");

  const metadata = object(spec.metadata, "metadata");
  ensure(metadata.branch === "feat/workpack-share-v2-target-ready", "branch mismatch");
  ensure(metadata.sourceBase === "f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5", "sourceBase mismatch");
  ensure(metadata.reviewStatus === "pending" && metadata.reviewedClaim === false, "review must remain pending");
  ensure(metadata.specOnly === true && metadata.implementationStarted === false, "metadata must remain spec-only");
  ensure(metadata.browserSemanticValidationAllowed === false, "validator cannot claim browser semantics");
  exact(metadata.candidateWriteFiles, CANDIDATE_FILES, "candidate write files");
  ensure(metadata.evidenceOnlyWriteFile === FILES.evidence, "evidence-only path mismatch");

  ["evidence", "ownership", "returnContract", "resultContract", "userCopy"].forEach(function requiredSection(key) {
    object(spec[key], key);
  });
  array(spec.nonGoals, "nonGoals");
  string(spec.runtimePersistenceClarification, "runtimePersistenceClarification");

  const observation = object(spec.evidence.browserHandoffObservation, "browser handoff observation");
  ensure(observation.id === "d3ad865" && observation.observedLocale === "vi", "browser handoff identity mismatch");
  ensure(observation.classification === "partial_translation", "handoff must be partial translation");
  ensure(observation.countedAsBrowserExecutionForThisRevision === false, "handoff cannot count as this revision execution");
  ensure(observation.requiredDisposition.includes("review_required"), "handoff must require review");
  ensure(observation.requiredDisposition.includes("share-session=0"), "handoff session count must be 0");
  ensure(observation.requiredDisposition.includes("dispatch=0"), "handoff dispatch count must be 0");

  const product = object(spec.product, "product");
  members(Object.keys(product), PRODUCT_KEYS, "product keys");
  ensure(product.job === "오늘 문서팩을 선택된 오늘 참여자에게 보냅니다.", "single send job mismatch");
  ensure(typeof product.job === "string", "product job must be one scalar");
  exact(product.screenSequence, ["target", "channel", "localized_preview", "send"], "screen sequence");
  ensure(product.onePrimaryPerScreen === true, "one primary action is required");
  exact(product.screenSections, SCREEN_SECTION_CONTRACT, "complete screenSections contract");
  exact(product.ctaInventory, CTA_CONTRACT, "complete CTA inventory");
  unique(itemIds(product.screenSections, "screenSections"), "screen section IDs");
  unique(itemIds(product.ctaInventory, "ctaInventory"), "CTA IDs");
  exact(product.screenSections.map(function sectionOrder(entry) { return entry.order; }), [1, 2, 3, 4, 5, 6, 7], "screen section order");
  exact(product.screenSections.map(function sectionAction(entry) { return entry.actionNodeId; }), product.ctaInventory.map(function ctaId(entry) { return entry.id; }), "section action-node references");
  const sendActions = product.ctaInventory.filter(function sendCapable(entry) { return entry.sendCapable; });
  ensure(sendActions.length === 1, "exactly one send-capable CTA is required");
  ensure(sendActions[0].id === "primary_send" && sendActions[0].sectionId === "primary_action" && sendActions[0].kind === "primary_send", "send-capable CTA must be the primary action");
  ensure(product.ctaInventory.filter(function secondarySend(entry) { return !entry.sendCapable && entry.kind.includes("send"); }).length === 0, "secondary or duplicate send CTA is forbidden");
  ensure(product.excludedFromShareBody.includes("Before/After history"), "improvement history must be excluded");
  ensure(product.excludedFromShareBody.includes("full dispatch history"), "dispatch history panel must be excluded");

  exact(spec.routeOwnership, ROUTE_CONTRACT, "complete route ownership contract");
  exact(itemIds(spec.routeOwnership, "routeOwnership"), ROUTES, "route IDs");
  unique(itemIds(spec.routeOwnership, "routeOwnership"), "route IDs");

  const state = object(spec.stateMachine, "stateMachine");
  exact(itemIds(state.states, "states"), STATES, "state IDs");
  exact(itemIds(state.blockingReasons, "blockingReasons"), BLOCKERS, "blocker IDs");
  ensure(state.visiblePrimaryCount === 1, "visible primary count must be 1");
  array(state.precedence, "state precedence");
  object(state.failureCta, "failure CTA catalog");
  state.blockingReasons.forEach(function blockerFields(reason, index) {
    string(reason.id, "blocker " + String(index) + " id");
    string(reason.state, "blocker " + String(index) + " state");
    ensure(typeof reason.owner === "string" || (Array.isArray(reason.owner) && reason.owner.length > 0), "blocker owner missing");
    string(reason.label, "blocker label");
    string(reason.action, "blocker action");
    string(reason.returnRoute, "blocker return route");
  });
  const localeReason = state.blockingReasons.find(function findReason(reason) {
    return reason.id === "recipient_locale_invalid";
  });
  ensure(localeReason.languageCodeInterpolationAllowed === false, "invalid locale interpolation must be false");
  ensure(localeReason.returnRoute === "/workers?focus=language&next={encoded shareReturn}", "invalid locale route mismatch");

  const data = object(spec.dataContracts, "dataContracts");
  exact(data.dispatchChannels, CHANNELS, "dispatch channels");
  exact(data.supportedLanguageCodes, LANGUAGES, "supported languages");

  const runtime = object(data.serverRuntimeConfiguration, "server runtime configuration");
  ensure(runtime.module === "lib/workpack-share-server-config.ts", "runtime module mismatch");
  ensure(runtime.test === "tests/workpack-share-server-config.test.ts", "runtime test mismatch");
  ensure(runtime.environmentExample === ".env.example", "runtime env example mismatch");
  ensure(runtime.serverOnlyImportRequired === true && runtime.clientImportAllowed === false, "runtime must be server-only");
  ensure(runtime.httpResponseExposureAllowed === false && runtime.logExposureAllowed === false, "secret exposure must be false");
  ensure(runtime.jsonbSecretPersistenceAllowed === false, "secret JSONB persistence must be false");
  exact(runtime.environment.map(function envKey(entry) {
    string(entry.kind, "runtime kind");
    string(entry.source, "runtime source");
    string(entry.rotation, "runtime rotation");
    string(entry.missing, "runtime missing behavior");
    return entry.key;
  }), RUNTIME_KEYS, "runtime keys");
  exact(runtime.secretNames, SECRET_KEYS, "runtime secrets");

  const availability = object(data.channelAvailability, "channel availability");
  const config = object(availability.configuration, "channel configuration");
  ensure(config.version === "channel-configuration/v2", "channel config version mismatch");
  ensure(config.revisionType === "positive monotonic integer", "channel revision type mismatch");
  ensure(config.digestAlgorithm === "HMAC-SHA256 over canonical normalized server configuration identity", "channel digest mismatch");
  ensure(config.configuredOrApprovedBooleansAloneSufficient === false, "boolean config identity is insufficient");
  ensure(config.rawIdentityFieldsExposed === false, "raw configuration identity must be redacted");
  array(config.digestInputs, "channel digest inputs");
  object(config.rotation, "channel rotation");
  exact(config.recomputedAt, ["resolver", "share-session creation", "dispatch preflight"], "channel recompute stages");

  const locale = object(data.localeParser, "locale parser");
  ensure(locale.serverAuthoritative === true, "locale parser must be server-authoritative");
  exact(locale.allowlist, LANGUAGES, "locale allowlist");
  ensure(locale.invalidState === "review_required", "invalid locale state mismatch");
  ensure(locale.forbiddenCoercions.includes("Korean fallback for a non-Korean target"), "Korean fallback must be forbidden");
  ensure(locale.invalidBeforeSession.shareSessionRequestCount === 0, "invalid locale session count must be 0");
  ensure(locale.invalidBeforeSession.dispatchRequestCount === 0, "invalid locale dispatch count must be 0");
  ensure(locale.invalidAfterSessionReload.sessionState === "created", "post-session invalid locale must keep created session");
  ensure(locale.invalidAfterSessionReload.providerDispatchCount === 0, "post-session provider count must be 0");
  ensure(locale.invalidAfterSessionReload.dispatchLogInsertCount === 0, "post-session log count must be 0");
  ensure(locale.koreanAllowedOnlyWhenAuthoritativeLocaleIsExactlyKo === true, "Korean authority mismatch");
  ensure(locale.manualPreviewOverrideChangesAuthority === false, "manual preview cannot change authority");
  array(locale.stageActions, "locale stage actions").forEach(function stageFailClosed(entry) {
    ensure(entry.state === "review_required", "locale stage must require review");
    ensure(entry.providerDispatchCount === 0 && entry.dispatchLogInsertCount === 0, "locale stage must fail closed");
  });

  const binding = object(data.sessionDispatchBinding, "session dispatch binding");
  ensure(binding.serverAuthoritative === true, "dispatch binding must be server-authoritative");
  ensure(binding.storage === "workpack_share_sessions.access_policy.dispatchBinding", "binding storage mismatch");
  ensure(binding.existingJsonbSafe === true && binding.databaseMigrationRequired === false, "binding must use existing JSONB");
  exact(binding.sessionIdentity, ["shareSessionId", "organizationId", "siteId", "workpackId", "createdBy"], "session identity");
  exact(binding.fields, [
    "version", "sessionIdentity", "canonicalWorkpackRevision", "normalizedWorkpackDigest",
    "recipientSnapshotDigest", "requestedChannels", "channelConfigurationVersion",
    "channelConfigurationRevision", "channelConfigurationDigestKeyId",
    "channelConfigurationDigest", "localePayloadDigest", "createdAt", "bindingDigest"
  ], "binding fields");
  ensure(binding.sessionCreate.preSessionMismatch.shareSessionCreated === false, "pre-session mismatch must create no session");
  ensure(binding.sessionCreate.preSessionMismatch.dispatchRequestCount === 0, "pre-session mismatch dispatch must be 0");
  ensure(binding.dispatchReload.clientStateAuthority === false, "client cannot be freshness authority");
  ensure(binding.dispatchReload.providerCallAfterMismatch === false, "provider call after mismatch must be false");
  ensure(binding.dispatchReload.dispatchLogInsertAfterMismatch === false, "log insert after mismatch must be false");
  array(binding.dispatchReload.reloads, "dispatch reload sources");
  array(binding.dispatchReload.exactComparisons, "dispatch exact comparisons");
  array(binding.mismatchOutcomes, "binding mismatch outcomes").forEach(function mismatchClosed(entry) {
    ensure(entry.session === "created", "post-session mismatch must keep created session");
    ensure(entry.providerDispatchCount === 0 && entry.dispatchLogInsertCount === 0, "post-session mismatch must fail closed");
  });

  const adapter = object(data.adapterContract, "adapter contract");
  ensure(adapter.destructiveMigrationAllowed === false && adapter.futureDatabaseProposalOnly === true, "DB changes must remain gated");
  ensure(adapter.preserve.includes("original generationEvidence and responseContentDigest"), "generationEvidence must be immutable");
  ensure(adapter.preserve.includes("original deliverables"), "deliverables must be immutable");

  const lifecycle = object(spec.sendLifecycle, "send lifecycle");
  ensure(lifecycle.createSession.requestCount === 1, "one session request required");
  ensure(lifecycle.dispatch.requestCountAfterSessionSuccess === 1, "one dispatch request required");
  ensure(lifecycle.onSessionFailure.dispatchRequestCount === 0, "session failure dispatch must be 0");
  ensure(lifecycle.betweenStepsFreshnessGate.clientStateAuthority === false, "client cannot own freshness");
  array(lifecycle.readyGuards, "ready guards");

  const accessibility = object(spec.accessibility, "accessibility");
  ensure(accessibility.meaningCannotBeColorIconOrEmojiOnly === true, "meaning cannot depend on emoji/icon");
  ensure(accessibility.nestedVerticalScrollAllowed === false && accessibility.verticalScrollOwner === "document", "document-only scroll required");

  const zoom = object(accessibility.zoom200, "zoom200");
  ensure(zoom.requirementStatus === "human_normative_unexecuted" && zoom.browserExecutions === 0, "zoom must be unexecuted");
  ensure(!Object.hasOwn(zoom, "executableContractId") && !Object.hasOwn(zoom, "executableContractSha256"), "zoom executable/hash oracle forbidden");
  exact(zoom.humanRequirementIds, ZOOM_REQUIREMENTS, "zoom human requirements");
  ensure(zoom.baselineCaptureBeforeAnyMutation === true && zoom.baselineImmutable === true, "immutable baselines required");
  ensure(zoom.scalingPassCount === 1 && zoom.cumulativeScalingAllowed === false, "single non-cumulative scale required");
  ensure(zoom.pathTraversalFromEveryRepresentativeToDocumentRoot === true, "complete ancestor traversal required");
  ensure(zoom.fontSizeRatioMin === 1.9 && zoom.fontSizeRatioMax === 2.1, "font ratio bounds mismatch");
  ensure(zoom.lineHeightRatioMin === 1.9 && zoom.lineHeightRatioMax === 2.1, "line ratio bounds mismatch");
  ensure(zoom.deviceScaleFactor === 1 && zoom.devicePixelRatio === 1 && zoom.visualViewportScale === 1, "scale invariants must be 1");
  ensure(zoom.plannedFreshDomRunsRequired === 2 && zoom.actualFreshDomRuns === 0, "fresh DOM plan/execution mismatch");
  array(zoom.prohibitedDelivery, "prohibited zoom delivery");
  array(zoom.required, "zoom requirements");

  const geometry = object(zoom.geometryCoverage, "geometry coverage");
  ensure(geometry.requirementStatus === "human_normative_unexecuted" && geometry.browserExecutions === 0, "geometry must be unexecuted");
  ensure(geometry.censusExpression === "[root, ...root.querySelectorAll(\"*\")]", "root-once census mismatch");
  ensure(geometry.querySelectorAllIncludesRoot === false && geometry.rootIncludedExactlyOnce === true, "root census semantics mismatch");
  ensure(geometry.rootIdentityDedupRequired === true && geometry.emptyCensusAllowed === false, "root dedup and non-empty census required");
  ensure(geometry.expectationMayBeDerivedFromRenderedDom === false, "rendered DOM cannot author expectations");
  ensure(geometry.expectedCountsMustBePositiveIntegers === true, "positive expected counts required");
  exact(itemIds(geometry.sets, "geometry sets"), GEOMETRY_SETS, "geometry set IDs");
  geometry.sets.forEach(function completeSet(entry) {
    string(entry.source, "geometry set source");
    string(entry.expected, "geometry set expected count");
  });
  exact(geometry.requiredExpectedCountSets, GEOMETRY_SETS, "required geometry count sets");
  exact(geometry.mandatoryMappingAttributes, ["data-share-owner", "data-share-scroll-region"], "mapping attributes");
  ensure(geometry.everyVisibleElementRequiresOwnerMapping === true, "every visible element needs owner mapping");
  ensure(geometry.everyVisibleElementRequiresExactlyOneScrollRegionMapping === true, "exactly one region mapping required");
  exact(geometry.requiredScrollRegions, ["body", "preview"], "scroll regions");
  ensure(geometry.requiredScrollRegionRootCounts.body === 1 && geometry.requiredScrollRegionRootCounts.preview === 1, "body/preview roots must each be 1");
  array(geometry.ownershipRules, "ownership rules");
  ensure(geometry.nestedScrollExpected === "none" && geometry.verticalScrollOwner === "document", "nested scroll must fail");
  exact(itemIds(geometry.failureCategories, "geometry failures"), GEOMETRY_FAILURES, "geometry failure IDs");
  geometry.failureCategories.forEach(function failureShape(entry) {
    string(entry.condition, "geometry failure condition");
    ensure(entry.expected === "fail", "geometry category must fail");
  });

  const browser = object(spec.browserGate, "browser gate");
  ensure(browser.status === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "browser status mismatch");
  ensure(browser.requirementStatus === "human_normative_unexecuted" && browser.browserExecutions === 0, "browser must be unexecuted");
  ensure(browser.plannedCaseCount === 128 && browser.caseCount === 128, "planned case count must be 128");
  exact(itemIds(browser.environments, "environments"), ENVIRONMENTS, "environment IDs");
  exact(itemIds(browser.zoomModes, "zoom modes"), ZOOM_MODES, "zoom IDs");
  exact(itemIds(browser.fixtures, "fixtures"), FIXTURES, "fixture IDs");
  ensure(browser.caseCount === browser.environments.length * browser.fixtures.length * browser.zoomModes.length, "case relationship must be 4 x 16 x 2");
  ensure(browser.caseCountByZoom.normal_100 === 64 && browser.caseCountByZoom.computed_text_200 === 64, "zoom case counts mismatch");
  ensure(browser.providerCallsAllowed === false && browser.databaseWritesAllowed === false, "browser fixtures cannot call provider or DB");
  array(browser.requestAssertions, "planned request assertions");
  array(browser.layoutAssertions, "planned layout assertions");

  const language = object(browser.languageGate, "language gate");
  ensure(language.requirementStatus === "human_normative_unexecuted" && language.browserExecutions === 0, "language gate must be unexecuted");
  ensure(!Object.hasOwn(language, "executableContractId") && !Object.hasOwn(language, "executableContractSha256"), "language executable/hash oracle forbidden");
  exact(language.optionOrder, LANGUAGES, "language inventory");
  exact(array(language.languagePolicies, "language policies").map(function languageCode(entry) {
    return string(object(entry, "language policy").code, "language policy code");
  }), LANGUAGES, "language policy IDs");
  language.languagePolicies.forEach(function policyShape(entry) {
    string(entry.script, "language script");
    ensure(entry.auto === "required" && entry.manual === "required", "auto/manual language contract required");
    string(entry.hangul, "language Hangul rule");
  });
  exact(itemIds(language.localizedSurfaces, "localized surfaces"), STRUCTURAL_SURFACES, "structural localized surfaces");
  exact(itemIds(language.localeCompletenessSurfaces, "locale completeness"), COMPLETENESS_SURFACES, "locale completeness surfaces");
  language.localeCompletenessSurfaces.forEach(function completenessShape(entry) {
    string(entry.requiredLocalizedContent, "completeness content");
    ensure(entry.nonKoreanTargetKoreanResidue === 0, "non-ko Korean residue must be 0");
    ensure(entry.incompleteResult === "review_required; session 0; dispatch 0", "incomplete locale must fail closed");
  });
  exact(itemIds(language.authorityCases, "language authority cases"), LANGUAGE_CASES, "language authority IDs");
  exact(itemIds(language.defaultUiControls, "default language UI"), DEFAULT_LANGUAGE_UI, "default language UI IDs");
  language.defaultUiControls.forEach(function defaultUiShape(entry) {
    ensure(Number.isInteger(entry.visibleCount) && entry.visibleCount >= 0, "default language UI visible count invalid");
    string(entry.authority, "default language UI authority");
    string(entry.behavior, "default language UI behavior");
  });
  ensure(language.defaultUiControls.find(function byId(entry) { return entry.id === "manualDropdown"; }).visibleCount === 1, "one language dropdown required");
  ensure(language.defaultUiControls.find(function byId(entry) { return entry.id === "localizedPreview"; }).visibleCount === 1, "one localized preview required");
  ensure(language.defaultUiControls.find(function byId(entry) { return entry.id === "languageCardGrid"; }).visibleCount === 0, "language card grid must be absent");
  const residual = object(language.selectedLanguageResidualContract, "selected language residual contract");
  ensure(residual.koreanMetadataLabelsAllowed === false, "Korean metadata labels must be forbidden");
  ensure(residual.koreanMetadataValuesAllowed === false, "Korean metadata values must be forbidden");
  ensure(residual.koreanResidueCount === 0, "selected non-ko artifact Korean residue must be 0");

  const auto = object(language.autoSelectionContract, "auto selection contract");
  ensure(auto.authority === "allowlisted server locale parser" && auto.languageCount === 12, "auto authority/count mismatch");
  exact(auto.requiredSurfaces, STRUCTURAL_SURFACES, "auto structural surfaces");
  exact(auto.requiredCompletenessSurfaces, COMPLETENESS_SURFACES, "auto completeness surfaces");
  ensure(auto.nonKoreanHangulResidual === 0, "auto Hangul residual must be 0");

  const manual = object(language.manualSelectionContract, "manual selection contract");
  ensure(manual.authority === "operator dropdown preview override only" && manual.languageCount === 12, "manual authority/count mismatch");
  exact(manual.requiredSurfaces, STRUCTURAL_SURFACES, "manual structural surfaces");
  exact(manual.requiredCompletenessSurfaces, COMPLETENESS_SURFACES, "manual completeness surfaces");
  ensure(manual.recipientLanguageMutationAllowed === false, "manual recipient mutation forbidden");
  ensure(manual.dispatchLanguageMutationAllowed === false, "manual dispatch mutation forbidden");
  ensure(manual.dispatchPlanDigestMutationAllowed === false, "manual digest mutation forbidden");

  const fallback = object(language.fallbackContract, "fallback contract");
  ensure(fallback.state === "review_required", "fallback must require review");
  ensure(fallback.automaticLocaleFallbackAllowed === false && fallback.partialTranslationFallbackAllowed === false, "fallback must be forbidden");
  ensure(fallback.shareSessionRequestCount === 0 && fallback.dispatchRequestCount === 0, "fallback must fail closed");

  exact(language.emojiSemantics.map(function emojiSymbol(entry) {
    string(entry.allowedRole, "emoji role");
    string(entry.semanticPresentation, "emoji semantic presentation");
    string(entry.accessibility, "emoji accessibility");
    return entry.symbol;
  }), EMOJI_INVENTORY, "emoji inventory");
  language.emojiSemantics.forEach(function emojiShape(entry) {
    ensure(entry.allowedRole === "decorative only", "emoji role must be decorative only");
    ensure(entry.semanticPresentation.includes("standard"), "standard icon required");
    ensure(entry.semanticPresentation.includes("localized visible text"), "localized text required");
    ensure(entry.accessibility.includes("aria-hidden"), "decorative emoji must be aria-hidden");
    ensure(entry.accessibility.includes("accessible label"), "icon accessible label required");
  });

  ensure(language.autoSelectionLanguagesRequired === 12 && language.manualSelectionLanguagesRequired === 12, "12-language auto/manual counts required");
  ensure(language.hangulResidueAllowedInNonKoreanArtifact === false, "non-ko Hangul residue forbidden");
  ensure(language.nonKoreanTargetKoreanFallbackAllowed === false, "Korean fallback forbidden");
  ensure(language.iconOnlyMeaningAllowed === false && language.emojiOnlyMeaningAllowed === false, "icon/emoji-only meaning forbidden");
  exact(language.vietnameseKoreanResidualZeroSurfaces, [
    "title and subject", "site label and value", "task label and value",
    "core-risk label and value", "entire body"
  ], "Vietnamese residual-zero surfaces");

  const invalid = object(language.invalidLocaleCta, "invalid locale CTA");
  ensure(invalid.state === "review_required" && invalid.reasonId === "recipient_locale_invalid", "invalid locale CTA state/reason mismatch");
  ensure(invalid.primaryLabel === "작업자 언어 확인", "invalid locale CTA label mismatch");
  ensure(invalid.ownerRoute === "/workers?focus=language&next={encoded shareReturn}", "invalid locale CTA route mismatch");
  ensure(invalid.languageQueryCount === 0 && invalid.rawLocaleInterpolationAllowed === false, "invalid locale interpolation forbidden");
  ensure(invalid.shareSessionRequestCount === 0 && invalid.dispatchRequestCount === 0, "invalid locale must fail closed");

  const implementation = object(spec.implementation, "implementation");
  ensure(implementation.status === "IMPLEMENTATION_BLOCKED", "implementation status mismatch");
  ensure(implementation.browserTddStatus === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "implementation browser status mismatch");
  ensure(implementation.blocked === true && implementation.implementationOnSpecBranchAllowed === false, "implementation must remain blocked");
  exact(array(implementation.waves, "waves").map(function waveId(entry) {
    object(entry, "wave");
    ensure(Number.isInteger(entry.id), "wave id must be an integer");
    return entry.id;
  }), [0, 1, 2, 3], "wave IDs");
  exact(implementation.waves.map(function waveName(entry) { return entry.name; }), WAVE_NAMES, "wave names");
  implementation.waves.forEach(function waveShape(entry, index) {
    ensure(Array.isArray(entry.exactFiles), "wave exactFiles must be an array");
    if (index > 0) {
      ensure(entry.exactFiles.length > 0, "implementation wave exactFiles must not be empty");
    }
    array(entry.commands, "wave commands");
    string(entry.exit, "wave exit");
    string(entry.rollback, "wave rollback");
  });
  unique(implementation.waves.flatMap(function owned(entry) { return entry.exactFiles; }), "wave exact-file ownership");
  [".env.example", "lib/workpack-share-server-config.ts", "tests/workpack-share-server-config.test.ts"].forEach(function waveOneFile(file) {
    ensure(implementation.waves[1].exactFiles.includes(file), "Wave 1 must own " + file);
  });
  exact(implementation.waves[3].exactFiles, [
    "tests/workpack-share-v2-browser.test.ts",
    "tests/fixtures/workpack-share-v2.ts"
  ], "Wave 3 exact files");

  const parity = object(spec.parityCheck, "parity check");
  ensure(parity.status === "SPEC_REVIEW_ONLY" && parity.implementationStatus === "IMPLEMENTATION_BLOCKED", "parity status mismatch");
  ensure(parity.browserTddStatus === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "parity browser status mismatch");
  ensure(parity.allowedAssertions.includes("recursively closed object key sets including all sibling wrappers"), "closed object assertion missing");
  const commandContract = object(parity.commandContract, "validation command contract");
  exact(commandContract.documentedCommands, SAFE_COMMANDS, "documented validation commands");
  exact(commandContract.evidenceCommandIdentity, {
    candidateCommandId: "candidate_structure",
    evidenceCommandId: "evidence_identity",
    executable: "node",
    validatorPath: FILES.validator
  }, "evidence command identity");
  ensure(commandContract.arbitrarySpecTextExecutionAllowed === false, "arbitrary spec command execution must be false");
  ensure(commandContract.documentedCommandRowsExecutedByValidator === false, "validator must not execute documented rows");
  ensure(commandContract.shellBuiltinsAllowed === false, "shell builtins must be forbidden");
  commandContract.documentedCommands.forEach(function safeCommand(entry) {
    ensure(entry.executable === "node", "documented executable must be node");
    array(entry.arguments, "documented command arguments").forEach(function safeArgument(argument) {
      ensure(!/[;&|<>]/.test(argument), "documented command argument contains a shell metacharacter");
    });
  });
  exact(parity.reviewAttackTddRecord, REVIEW_ATTACKS, "review attack TDD record");
  const execution = object(parity.executionContract, "execution contract");
  exact(execution.markdownMutationModes, MD_MUTATIONS, "Markdown mutation modes");
  exact(execution.jsonMutationModes, JSON_MUTATIONS, "JSON mutation modes");
  exact(execution.identityMutationModes, IDENTITY_MUTATIONS, "identity mutation modes");
  ensure(execution.markdownMutationModeCount === MD_MUTATIONS.length, "Markdown mutation count mismatch");
  ensure(execution.jsonMutationModeCount === JSON_MUTATIONS.length, "JSON mutation count mismatch");
  ensure(execution.identityMutationModeCount === IDENTITY_MUTATIONS.length, "identity mutation count mismatch");
  ensure(execution.normalRunsRequired === 2, "normal run count must be 2");
  ensure(execution.browserCasesExecutedBySpecValidation === 0, "validator browser execution must be 0");
  ensure(execution.syntheticZoomCommandsAllowed === false && execution.syntheticGeometryCommandsAllowed === false, "synthetic browser commands forbidden");

  const completion = object(spec.completionGate, "completion gate");
  ensure(completion.status === "SPEC_REVIEW_ONLY" && completion.implementationStatus === "IMPLEMENTATION_BLOCKED", "completion status mismatch");
  ensure(completion.browserTddStatus === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "completion browser status mismatch");
  ensure(completion.structuralValidationRunsRequired === 2, "structural run count mismatch");
  ensure(completion.markdownMutationModesRequired === MD_MUTATIONS.length, "completion Markdown mutation count mismatch");
  ensure(completion.jsonMutationModesRequired === JSON_MUTATIONS.length, "completion JSON mutation count mismatch");
  ensure(completion.identityMutationModesRequired === IDENTITY_MUTATIONS.length, "completion identity mutation count mismatch");
  ensure(completion.plannedBrowserCases === 128 && completion.actualBrowserCasesExecuted === 0, "completion case counts mismatch");
  ensure(completion.browserSemanticsEvaluated === false, "browser semantics cannot be evaluated");
  ensure(completion.implementationReady === false && completion.semanticPassClaim === false && completion.browserPassClaim === false, "completion claims must be false");
  exact(completion.candidateCommitChangedFiles, CANDIDATE_FILES, "completion candidate files");
  exact(completion.evidenceCommitChangedFiles, EVIDENCE_FILES, "completion evidence files");
  ensure(completion.freshIndependentReviewRequired === true, "fresh independent review required");

  Object.entries(object(spec.claimRules, "claim rules")).forEach(function falseClaim(entry) {
    ensure(entry[1] === false, "claimRules." + entry[0] + " must be false");
  });
}

function normalizeCell(value) {
  return String(value).split(TICK).join("").trim().replace(/\s+/g, " ");
}

function parseRow(line) {
  const trimmed = line.trim();
  ensure(trimmed.startsWith("|") && trimmed.endsWith("|"), "invalid table row");
  return trimmed.slice(1, -1).split("|").map(normalizeCell);
}

function tableAfter(markdown, marker) {
  const markerIndex = markdown.indexOf(marker);
  ensure(markerIndex >= 0, "missing Markdown marker: " + marker);
  const tableMarker = marker.trim().startsWith("|");
  const lines = markdown.slice(tableMarker ? markerIndex : markerIndex + marker.length).split(/\r?\n/);
  const start = lines.findIndex(function startsTable(line) { return line.trim().startsWith("|"); });
  ensure(start >= 0, "missing table after: " + marker);
  const tableLines = [];
  for (let index = start; index < lines.length && lines[index].trim().startsWith("|"); index += 1) {
    tableLines.push(lines[index]);
  }
  ensure(tableLines.length >= 3, "incomplete table after: " + marker);
  return {
    header: parseRow(tableLines[0]),
    rows: tableLines.slice(2).map(parseRow)
  };
}

function tableIds(table, label) {
  const values = table.rows.map(function firstCell(row) { return row[0]; });
  unique(values, label);
  return values;
}

function assertRows(actual, expected, label) {
  const normalized = expected.map(function rowValues(row) { return row.map(normalizeCell); });
  exact(actual, normalized, label);
}

function topMetadata(markdown) {
  const end = markdown.indexOf("\n## ");
  ensure(end > 0, "top metadata boundary missing");
  const output = {};
  markdown.slice(0, end).split(/\r?\n/).forEach(function metadataLine(line) {
    const match = /^- ([^:]+): (.+)$/.exec(line);
    if (match) {
      output[match[1]] = match[2].trim();
    }
  });
  return output;
}

function listBetween(markdown, marker, nextMarker) {
  const start = markdown.indexOf(marker);
  const end = markdown.indexOf(nextMarker, start + marker.length);
  ensure(start >= 0 && end > start, "mutation list boundary missing: " + marker);
  const output = [];
  const pattern = /^- (.+)$/gm;
  const body = markdown.slice(start + marker.length, end);
  let match = pattern.exec(body);
  while (match) {
    output.push(match[1].trim());
    match = pattern.exec(body);
  }
  return array(output, "Markdown list " + marker);
}

function waveSections(markdown) {
  const pattern = /^### Wave ([0-3])\. (.+)$/gm;
  const found = [];
  let match = pattern.exec(markdown);
  while (match) {
    found.push({ id: Number(match[1]), name: match[2].trim(), index: match.index, size: match[0].length });
    match = pattern.exec(markdown);
  }
  ensure(found.length === 4, "exactly four Wave headings required");
  return found.map(function waveSection(item, index) {
    const end = index + 1 < found.length ? found[index + 1].index : markdown.indexOf("\n## 8.", item.index);
    ensure(end > item.index, "Wave boundary missing");
    return { id: item.id, name: item.name, text: markdown.slice(item.index + item.size, end) };
  });
}

function filesAfter(section, marker, endMarker) {
  const start = section.indexOf(marker);
  let end = section.indexOf(endMarker, start + marker.length);
  if (end < 0) {
    end = section.indexOf("~~~", start + marker.length);
  }
  ensure(start >= 0 && end > start, "Wave file boundary missing: " + marker);
  const output = [];
  const pattern = /^- (.+)$/gm;
  const body = section.slice(start + marker.length, end);
  let match = pattern.exec(body);
  while (match) {
    output.push(match[1].replace(/ \(new\)$/, "").trim());
    match = pattern.exec(body);
  }
  return output;
}

function assertMarkdown(markdown, spec) {
  string(markdown, "spec.md");
  ensure(!markdown.includes("<!-- normative-code:"), "normative executable marker forbidden");
  ensure(!markdown.includes("executableContractSha256"), "normative executable hash forbidden");
  ensure(!markdown.includes("--zoom-fixture") && !markdown.includes("--geometry-fixture"), "synthetic browser commands forbidden");
  ensure(markdown.includes("Every object path is closed recursively against an independently declared validator key contract"), "Markdown recursive object closure missing");

  const meta = topMetadata(markdown);
  ensure(meta["Spec ID"] === spec.specId, "Markdown Spec ID mismatch");
  ensure(meta.Revision === spec.revision, "Markdown revision mismatch");
  ensure(meta["상태"] === spec.status, "Markdown status mismatch");
  ensure(meta["Implementation status"] === spec.implementationStatus, "Markdown implementation status mismatch");
  ensure(meta["Browser/TDD status"] === spec.browserTddStatus, "Markdown browser status mismatch");
  ensure(meta["Browser executions"] === String(spec.browserExecutions), "Markdown browser execution mismatch");
  ensure(meta["Review status"] === spec.metadata.reviewStatus, "Markdown review status mismatch");
  ensure(meta["기준 branch"] === spec.metadata.branch, "Markdown branch mismatch");
  ensure(meta["Source base"] === spec.metadata.sourceBase, "Markdown source mismatch");
  ensure(meta["제품 Job"] === spec.product.job, "Markdown product job mismatch");
  ensure(meta["화면 순서"] === "대상 -> 채널 -> 현지화 미리보기 -> 전송", "Markdown sequence mismatch");

  const headings = [
    "# SafeClaw 공유 화면 v2 제품 명세",
    "## 1. Current Truth And Decisions",
    "## 2. Target IA And Ownership",
    "## 3. State Machine And CTA Authority",
    "## 4. Data And Lifecycle Contracts",
    "## 5. Accessibility And Responsive Acceptance",
    "## 6. Planned Real Browser Acceptance Matrix (Unexecuted)",
    "## 7. Implementation Waves",
    "## 8. Non-Goals And User Copy",
    "## 9. Spec-Only Structural Verification"
  ];
  let prior = -1;
  headings.forEach(function headingOrder(heading) {
    const index = markdown.indexOf(heading);
    ensure(index > prior, "heading missing or out of order: " + heading);
    prior = index;
  });

  assertRows(
    tableAfter(markdown, "### 2.1 Share Body").rows,
    SCREEN_SECTION_CONTRACT.map(function screenSectionRow(entry) {
      return [entry.order, entry.id, entry.role, entry.content, entry.actionNodeId];
    }),
    "Markdown screenSections table"
  );
  assertRows(
    tableAfter(markdown, "CTA inventory:").rows,
    CTA_CONTRACT.map(function ctaRow(entry) {
      return [entry.id, entry.sectionId, entry.kind, entry.sendCapable ? "yes" : "no", entry.maximumVisibleCount];
    }),
    "Markdown CTA inventory"
  );
  assertRows(
    tableAfter(markdown, "### 2.2 Route Ownership").rows,
    ROUTE_CONTRACT.map(function routeRow(entry) {
      return [entry.id, entry.purpose, entry.ownerRoute, entry.returnPath, entry.exclusionSemantics];
    }),
    "Markdown complete route ownership"
  );
  exact(tableIds(tableAfter(markdown, "### 2.2 Route Ownership"), "routes"), ROUTES, "Markdown route IDs");
  exact(tableIds(tableAfter(markdown, "## 3. State Machine And CTA Authority"), "states"), STATES, "Markdown state IDs");
  exact(
    tableIds(tableAfter(markdown, "### 3.1 Selected Reasons"), "selected blockers")
      .concat(tableIds(tableAfter(markdown, "### 3.2 Review Required Reasons"), "review blockers")),
    BLOCKERS,
    "Markdown blocker IDs"
  );
  exact(tableIds(tableAfter(markdown, "Dispatch channel catalog:"), "channels"), CHANNELS, "Markdown channels");

  assertRows(
    tableAfter(markdown, "### 4.2.1 Server Runtime Configuration Sources").rows,
    spec.dataContracts.serverRuntimeConfiguration.environment.map(function runtimeRow(entry) {
      return [entry.key, entry.kind, entry.source, entry.rotation, entry.missing];
    }),
    "Markdown runtime table"
  );

  exact(tableIds(tableAfter(markdown, "Planned browser requirement table (human normative, unexecuted):"), "zoom requirements"), ZOOM_REQUIREMENTS, "Markdown zoom requirement IDs");
  assertRows(
    tableAfter(markdown, "Geometry coverage table:").rows,
    spec.accessibility.zoom200.geometryCoverage.sets.map(function geometryRow(entry) {
      return [entry.id, entry.source, entry.expected];
    }),
    "Markdown geometry sets"
  );
  assertRows(
    tableAfter(markdown, "Geometry failure categories:").rows,
    spec.accessibility.zoom200.geometryCoverage.failureCategories.map(function failureRow(entry) {
      return [entry.id, entry.condition, entry.expected];
    }),
    "Markdown geometry failures"
  );

  assertRows(
    tableAfter(markdown, "| Env ID | Theme | Viewport |").rows,
    spec.browserGate.environments.map(function environmentRow(entry) {
      return [entry.id, entry.theme === "day" ? "Day" : "Night", entry.viewport];
    }),
    "Markdown environments"
  );
  exact(tableIds(tableAfter(markdown, "| Zoom ID | Delivery | Task-distance gate |"), "zoom modes"), ZOOM_MODES, "Markdown zoom modes");
  exact(tableIds(tableAfter(markdown, "### 6.3 Fixtures"), "fixtures"), FIXTURES, "Markdown fixtures");

  assertRows(
    tableAfter(markdown, "Language script policy:").rows,
    spec.browserGate.languageGate.languagePolicies.map(function languageRow(entry) {
      return [entry.code, entry.script, entry.auto, entry.manual, entry.hangul];
    }),
    "Markdown language inventory"
  );
  assertRows(
    tableAfter(markdown, "Localized surface coverage:").rows,
    spec.browserGate.languageGate.localizedSurfaces.map(function surfaceRow(entry) {
      return [entry.id, entry.source, entry.auto, entry.manual, entry.script];
    }),
    "Markdown structural surfaces"
  );
  assertRows(
    tableAfter(markdown, "Locale completeness surface inventory:").rows,
    spec.browserGate.languageGate.localeCompletenessSurfaces.map(function completenessRow(entry) {
      return [entry.id, entry.requiredLocalizedContent, entry.nonKoreanTargetKoreanResidue, entry.incompleteResult];
    }),
    "Markdown completeness surfaces"
  );
  assertRows(
    tableAfter(markdown, "Language authority cases:").rows,
    spec.browserGate.languageGate.authorityCases.map(function authorityRow(entry) {
      return [entry.id, entry.preview, entry.dispatch, entry.result];
    }),
    "Markdown language authority"
  );
  assertRows(
    tableAfter(markdown, "Default language UI contract:").rows,
    spec.browserGate.languageGate.defaultUiControls.map(function defaultUiRow(entry) {
      return [entry.id, entry.visibleCount, entry.authority, entry.behavior];
    }),
    "Markdown default language UI"
  );
  assertRows(
    tableAfter(markdown, "Decorative emoji semantics:").rows,
    spec.browserGate.languageGate.emojiSemantics.map(function emojiRow(entry) {
      return [entry.symbol, entry.allowedRole, entry.semanticPresentation, entry.accessibility];
    }),
    "Markdown emoji inventory"
  );
  assertRows(
    tableAfter(markdown, "Documented validation command contract:").rows,
    SAFE_COMMANDS.map(function commandRow(entry) {
      return [entry.id, entry.executable, entry.arguments.join(" "), entry.stage, entry.requiredRuns];
    }),
    "Markdown documented validation commands"
  );
  assertRows(
    tableAfter(markdown, "Review attack TDD record:").rows,
    REVIEW_ATTACKS.map(function reviewAttackRow(entry) {
      return [entry.id, entry.reviewedCandidate, entry.observedBaselineExit, entry.requiredRemediatedExit];
    }),
    "Markdown review attack TDD record"
  );

  ensure(markdown.includes("browser handoff d3ad865"), "Markdown handoff observation missing");
  ensure(markdown.includes("부분 번역이며 ready가 아닙니다."), "Markdown partial translation classification missing");
  ensure(markdown.includes(TICK + "[root, ...root.querySelectorAll(\"*\")]" + TICK + " construction"), "Markdown root-once census missing");
  ensure(markdown.includes("the explicit first item supplies the share root"), "Markdown root explanation missing");
  ensure(markdown.includes("Exactly one body scroll-region root and one preview scroll-region root are required."), "Markdown region ownership missing");
  ensure(markdown.includes("This revision ran zero browser cases."), "Markdown zero browser execution statement missing");
  ensure(markdown.includes("총 128개 browser case입니다."), "Markdown 128-case relationship missing");
  ensure(markdown.includes("POST /api/workpacks/{workpackId}/share-sessions를 정확히 한 번 호출합니다."), "one session call clause missing");
  ensure(markdown.includes("POST /api/workflow/dispatch를 정확히 한 번 호출합니다."), "one dispatch call clause missing");
  ensure(markdown.includes("원본 workpacks.deliverables와 generationEvidence는 불변입니다."), "generationEvidence clause missing");
  ensure(markdown.includes("recipients_snapshot array에 object metadata를 섞거나 client state를 authority로 사용하지 않습니다."), "server authority clause missing");
  ensure(markdown.includes("databaseMigrationRequired=false"), "no-migration clause missing");

  const waves = waveSections(markdown);
  exact(waves.map(function waveId(entry) { return entry.id; }), [0, 1, 2, 3], "Markdown wave IDs");
  exact(waves.map(function waveName(entry) { return entry.name; }), WAVE_NAMES, "Markdown wave names");
  ensure(waves[0].text.includes("Files: none"), "Wave 0 files must be none");
  exact(filesAfter(waves[1].text, "Exact files:", "~~~powershell"), spec.implementation.waves[1].exactFiles, "Wave 1 files");
  exact(filesAfter(waves[2].text, "Exact files:", "~~~powershell"), spec.implementation.waves[2].exactFiles, "Wave 2 files");
  exact(filesAfter(waves[3].text, "Required exact files:", "Conditional fix files:"), spec.implementation.waves[3].exactFiles, "Wave 3 files");
  exact(filesAfter(waves[3].text, "Conditional fix files:", "~~~powershell"), spec.implementation.waves[3].conditionalFixFiles, "Wave 3 conditional files");

  exact(listBetween(markdown, "Structural Markdown mutation modes:", "Structural JSON mutation modes:"), MD_MUTATIONS, "Markdown-declared MD mutations");
  exact(listBetween(markdown, "Structural JSON mutation modes:", "Identity mutation modes:"), JSON_MUTATIONS, "Markdown-declared JSON mutations");
  exact(listBetween(markdown, "Identity mutation modes:", "The validator derives each mutation count"), IDENTITY_MUTATIONS, "Markdown-declared identity mutations");
}

function replaceOnce(source, search, replacement, mode) {
  const index = source.indexOf(search);
  ensure(index >= 0, "mutation target missing: " + mode);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function mutateMarkdown(markdown, mode) {
  switch (mode) {
    case "revision":
      return replaceOnce(markdown, "- Revision: independent-review-remediation-9", "- Revision: independent-review-remediation-x", mode);
    case "review_status":
      return replaceOnce(markdown, "- 상태: SPEC_REVIEW_ONLY", "- 상태: REVIEWED", mode);
    case "implementation_status":
      return replaceOnce(markdown, "- Implementation status: IMPLEMENTATION_BLOCKED", "- Implementation status: IMPLEMENTATION_ALLOWED", mode);
    case "browser_status":
      return replaceOnce(markdown, "- Browser/TDD status: IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "- Browser/TDD status: BROWSER_COMPLETE", mode);
    case "route_row":
      return replaceOnce(markdown, "| R1 | roster registration, update, and quick add |", "| RX | roster registration, update, and quick add |", mode);
    case "state_row":
      return replaceOnce(markdown, "| blocked | readiness.canShare=false", "| blocked_changed | readiness.canShare=false", mode);
    case "blocker_row":
      return replaceOnce(markdown, "| channel_not_selected | Share channel section |", "| channel_missing | Share channel section |", mode);
    case "channel_row":
      return replaceOnce(markdown, "| email | Settings and server resolver |", "| push | Settings and server resolver |", mode);
    case "language_row":
      return replaceOnce(markdown, "| ko | Hangul and Han |", "| kr | Hangul and Han |", mode);
    case "localized_surface":
      return replaceOnce(markdown, "| title | preview-title owner |", "| heading | preview-title owner |", mode);
    case "invalid_locale":
      return replaceOnce(markdown, "| invalid_locale | none | none | review_required; exact static workers owner CTA; no language query/raw interpolation; session 0; dispatch 0 |", "| invalid_locale | none | none | fallback allowed; session 1; dispatch 1 |", mode);
    case "emoji_semantics":
      return replaceOnce(markdown, "| semantic_meaning | localized visible text | not applicable | accessible icon plus visible text or visible text-only; emoji is never sole meaning |", "| semantic_meaning | emoji | not applicable | emoji may be sole meaning |", mode);
    case "geometry_category":
      return replaceOnce(markdown, "| fixed_obstruction | fixed content obscures", "| fixed_overlay_allowed | fixed content obscures", mode);
    case "scroll_root":
      return replaceOnce(markdown, TICK + "[root, ...root.querySelectorAll(\"*\")]" + TICK + " filtered to rendered visible boxes", TICK + "[...root.querySelectorAll(\"*\")]" + TICK + " filtered to rendered visible boxes", mode);
    case "runtime_config":
      return replaceOnce(markdown, "| SAFECLAW_CHANNEL_CONFIG_REVISION | positive monotonic integer |", "| SAFECLAW_CHANNEL_CONFIG_REVISION_REMOVED | positive monotonic integer |", mode);
    case "one_send_job":
      return replaceOnce(markdown, "- 제품 Job: 오늘 문서팩을 선택된 오늘 참여자에게 보냅니다.", "- 제품 Job: 문서팩 전송과 이력 편집을 함께 합니다.", mode);
    case "wave_order":
      return replaceOnce(markdown, "### Wave 1. Authority Foundation And Session Binding", "### Wave 1. Return Resolver Before Authority", mode);
    case "planned_case_count":
      return replaceOnce(markdown, "총 128개 browser case입니다.", "총 127개 browser case입니다.", mode);
    case "handoff_observation":
      return replaceOnce(markdown, "| browser handoff d3ad865 |", "| browser handoff missing |", mode);
    case "locale_completeness":
      return replaceOnce(markdown, "| action | visible action label and accessible action name |", "| action_removed | visible action label and accessible action name |", mode);
    case "emoji_inventory":
      return replaceOnce(markdown, "| ⚠️ | decorative only |", "| ❓ | decorative only |", mode);
    case "default_language_ui":
      return replaceOnce(markdown, "| manualDropdown | 1 | operator preview override only |", "| manualDropdown | 12 | operator preview override only |", mode);
    case "route_owner":
      return replaceOnce(markdown, "| R1 | roster registration, update, and quick add | /workers |", "| R1 | roster registration, update, and quick add | /workspace?step=share |", mode);
    case "screen_section_relabel":
      return replaceOnce(markdown, "| 7 | primary_action | primary_action |", "| 7 | primary_action | secondary_send |", mode);
    case "documented_command_forgery":
      return replaceOnce(markdown, "| candidate_structure | node |", "| candidate_structure | Write-Output |", mode);
    default:
      fail("unsupported Markdown mutation: " + mode);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mutateJson(spec, mode) {
  const mutated = clone(spec);
  switch (mode) {
    case "missing_status": delete mutated.status; break;
    case "missing_implementation_status": delete mutated.implementationStatus; break;
    case "missing_browser_status": delete mutated.browserTddStatus; break;
    case "empty_languages": mutated.dataContracts.supportedLanguageCodes = []; break;
    case "missing_auto_contract": delete mutated.browserGate.languageGate.autoSelectionContract; break;
    case "missing_manual_contract": delete mutated.browserGate.languageGate.manualSelectionContract; break;
    case "empty_localized_surfaces": mutated.browserGate.languageGate.localizedSurfaces = []; break;
    case "invalid_cta_interpolation": mutated.browserGate.languageGate.invalidLocaleCta.rawLocaleInterpolationAllowed = true; break;
    case "emoji_semantics": mutated.browserGate.languageGate.emojiOnlyMeaningAllowed = true; break;
    case "empty_geometry_categories": mutated.accessibility.zoom200.geometryCoverage.failureCategories = []; break;
    case "missing_geometry_category": mutated.accessibility.zoom200.geometryCoverage.failureCategories.pop(); break;
    case "empty_runtime_config": mutated.dataContracts.serverRuntimeConfiguration.environment = []; break;
    case "missing_rotation": delete mutated.dataContracts.serverRuntimeConfiguration.environment[0].rotation; break;
    case "multi_send_job": mutated.product.job = [mutated.product.job, "edit history"]; break;
    case "empty_blockers": mutated.stateMachine.blockingReasons = []; break;
    case "planned_case_count": mutated.browserGate.caseCount = 127; break;
    case "browser_execution_nonzero": mutated.browserExecutions = 1; break;
    case "implementation_unblocked": mutated.implementation.blocked = false; break;
    case "empty_locale_completeness": mutated.browserGate.languageGate.localeCompletenessSurfaces = []; break;
    case "empty_emoji_inventory": mutated.browserGate.languageGate.emojiSemantics = []; break;
    case "fallback_unblocked": mutated.browserGate.languageGate.fallbackContract.dispatchRequestCount = 1; break;
    case "default_language_ui": mutated.browserGate.languageGate.defaultUiControls = []; break;
    case "route_owner": mutated.routeOwnership[0].ownerRoute = "/workspace?step=share"; break;
    case "screen_section_injection": mutated.product.screenSections.push({ order: 8, id: "secondary_send", role: "secondary_send", content: "duplicate send", actionNodeId: "secondary_send" }); break;
    case "screen_section_relabel": mutated.product.screenSections[6].role = "secondary_send"; break;
    case "screen_section_removal": mutated.product.screenSections.pop(); break;
    case "cta_inventory_injection": mutated.product.ctaInventory.push({ id: "secondary_send", sectionId: "primary_action", kind: "secondary_send", sendCapable: true, maximumVisibleCount: 1 }); break;
    case "command_identity_forgery": mutated.parityCheck.commandContract.documentedCommands[0].executable = "Write-Output"; break;
    case "product_actions_wrapper_injection": mutated.product.actions = [{ id: "secondary_send", kind: "secondary_send", sendCapable: true }]; break;
    case "product_jobs_wrapper_injection": mutated.product.jobs = [mutated.product.job, "secondary send job"]; break;
    default: fail("unsupported JSON mutation: " + mode);
  }
  return mutated;
}

function mutateEvidence(evidence, mode) {
  const mutated = clone(evidence);
  switch (mode) {
    case "contradictory_changed_files": mutated.evidenceCommitContract.changedFiles = ["app/globals.css"]; break;
    case "candidate_parent": mutated.candidateParent = "0000000000000000000000000000000000000000"; break;
    case "candidate_scope": mutated.candidateChangedFiles.push("app/globals.css"); break;
    case "browser_executed_claim": mutated.browserExecutions = 128; break;
    case "semantic_pass_claim": mutated.semanticPassClaim = true; break;
    case "evidence_command_forgery": mutated.validationCommandIdentity.candidateTokens[0] = "Write-Output"; break;
    default: fail("unsupported identity mutation: " + mode);
  }
  return mutated;
}

function assertIdentity(evidence, spec) {
  object(evidence, "review evidence");
  ensure(evidence.schemaVersion === "safeclaw-spec-review-evidence/v2", "evidence schema mismatch");
  ensure(evidence.status === "SPEC_REVIEW_ONLY", "evidence status mismatch");
  ensure(evidence.implementationStatus === "IMPLEMENTATION_BLOCKED", "evidence implementation status mismatch");
  ensure(evidence.browserTddStatus === "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD", "evidence browser status mismatch");
  ensure(evidence.browserExecutions === 0, "evidence browser execution must be 0");
  ensure(evidence.reviewStatus === "pending" && evidence.reviewedClaim === false, "evidence review must remain pending");
  ensure(evidence.semanticPassClaim === false, "semantic claim must be false");
  ensure(evidence.implementationReadyClaim === false, "implementation-ready claim must be false");
  ensure(evidence.browserPassClaim === false, "browser claim must be false");
  exact(evidence.validationCommandIdentity, {
    candidateCommandId: "candidate_structure",
    candidateTokens: ["node", FILES.validator, "--skip-evidence"],
    evidenceCommandId: "evidence_identity",
    evidenceTokens: ["node", FILES.validator],
    arbitrarySpecTextExecuted: false
  }, "evidence validation command identity");
  ensure(evidence.branch === spec.metadata.branch && evidence.sourceBase === spec.metadata.sourceBase, "evidence branch/source mismatch");
  ensure(/^[0-9a-f]{40}$/.test(evidence.candidate), "candidate must be full SHA");
  ensure(evidence.candidateParent === evidence.sourceBase, "candidate parent declaration mismatch");
  exact(evidence.candidateChangedFiles, CANDIDATE_FILES, "declared candidate files");

  const candidateProof = object(evidence.candidateEvidence, "candidate evidence");
  ensure(candidateProof.scope === "identity_and_exact_file_scope_only", "candidate proof scope mismatch");
  ensure(candidateProof.sourceBaseResolves === true && candidateProof.candidateResolves === true, "commit resolution evidence mismatch");
  ensure(candidateProof.candidateDirectParentIsSourceBase === true && candidateProof.candidateScopeExact === true, "candidate parent/scope evidence mismatch");

  const contract = object(evidence.evidenceCommitContract, "evidence commit contract");
  ensure(contract.recordsOwnCommitSha === false, "evidence cannot record own SHA");
  ensure(contract.requiredParent === evidence.candidate, "evidence required parent mismatch");
  exact(contract.changedFiles, EVIDENCE_FILES, "declared evidence files");

  const scope = object(evidence.validationScope, "validation scope");
  exact(scope.proves, [
    "source and candidate commit identities",
    "candidate parent and exact three-file diff-tree",
    "evidence parent and exact one-file diff-tree",
    "browser execution count is honestly zero"
  ], "evidence proves scope");
  exact(scope.doesNotProve, [
    "browser behavior",
    "language rendering",
    "geometry or zoom behavior",
    "implementation readiness",
    "semantic review approval"
  ], "evidence non-proof scope");
  ensure(evidence.independentReview.status === "pending", "independent review must remain pending");

  const source = resolveCommit(evidence.sourceBase);
  const candidate = resolveCommit(evidence.candidate);
  ensure(source === evidence.sourceBase && candidate === evidence.candidate, "full SHA resolution mismatch");
  ensure(directParent(candidate) === source, "candidate parent does not equal source");
  exact(commitFiles(candidate), CANDIDATE_FILES.slice().sort(), "actual candidate diff-tree");

  const head = resolveCommit("HEAD");
  ensure(directParent(head) === candidate, "evidence commit parent does not equal candidate");
  exact(commitFiles(head), EVIDENCE_FILES.slice().sort(), "actual evidence diff-tree");
  ensure(git(["branch", "--show-current"]) === evidence.branch, "current branch mismatch");
  ensure(!JSON.stringify(evidence).includes(head), "evidence manifest self-references HEAD");
}

function parseArgs(argv) {
  const options = { skipEvidence: false, md: null, json: null, identity: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skip-evidence") {
      options.skipEvidence = true;
    } else if (arg === "--md-mutation" || arg === "--json-mutation" || arg === "--identity-mutation") {
      ensure(index + 1 < argv.length, arg + " requires a mode");
      const mode = argv[index + 1];
      index += 1;
      if (arg === "--md-mutation") options.md = mode;
      if (arg === "--json-mutation") options.json = mode;
      if (arg === "--identity-mutation") options.identity = mode;
    } else {
      fail("unknown argument: " + arg);
    }
  }
  ensure([options.md, options.json, options.identity].filter(Boolean).length <= 1, "select at most one mutation");
  ensure(!options.identity || !options.skipEvidence, "identity mutation requires evidence");
  if (options.md) ensure(MD_MUTATIONS.includes(options.md), "unknown Markdown mutation");
  if (options.json) ensure(JSON_MUTATIONS.includes(options.json), "unknown JSON mutation");
  if (options.identity) ensure(IDENTITY_MUTATIONS.includes(options.identity), "unknown identity mutation");
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let markdown = fs.readFileSync(MD_PATH, "utf8");
  let spec = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

  if (options.md) markdown = mutateMarkdown(markdown, options.md);
  if (options.json) spec = mutateJson(spec, options.json);

  assertSchema(spec);
  assertMarkdown(markdown, spec);

  if (!options.skipEvidence) {
    let evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
    if (options.identity) evidence = mutateEvidence(evidence, options.identity);
    assertIdentity(evidence, spec);
  }

  process.stdout.write(JSON.stringify({
    status: "SPEC_REVIEW_ONLY",
    implementationStatus: "IMPLEMENTATION_BLOCKED",
    browserTddStatus: "IMPLEMENTATION_BLOCKED_PENDING_REAL_TDD",
    browserExecutions: 0,
    plannedBrowserCases: 128,
    structuralValidation: "completed",
    identityValidation: options.skipEvidence ? "skipped_for_candidate_preparation" : "completed",
    markdownMutationModeCount: MD_MUTATIONS.length,
    jsonMutationModeCount: JSON_MUTATIONS.length,
    identityMutationModeCount: IDENTITY_MUTATIONS.length
  }, null, 2) + "\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write("SPEC_STRUCTURE_ERROR: " + message + "\n");
  process.exitCode = 1;
}
