"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SPEC_DIR = __dirname;
const REPO_ROOT = path.resolve(SPEC_DIR, "..", "..");
const MD_PATH = path.join(SPEC_DIR, "spec.md");
const JSON_PATH = path.join(SPEC_DIR, "spec.json");
const EVIDENCE_PATH = path.join(SPEC_DIR, "review-evidence.json");
const EVIDENCE_RELATIVE_PATH = "evaluation/workpack-share-v2-2026-07-13/review-evidence.json";

const MD_MUTATIONS = [
  "revision",
  "authority",
  "wave_heading",
  "wave_order",
  "route",
  "state",
  "blocker",
  "channel",
  "language",
  "fixture",
  "one_send_job",
  "locale_fallback",
  "evidence_binding"
];

const ZOOM_NEGATIVE_FIXTURES = [
  "internal_wrapper_transform",
  "internal_zoom",
  "outer_transform",
  "repeated_evaluation",
  "device_scale_factor",
  "page_zoom"
];

function git(...args) {
  return childProcess.execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8"
  }).trim();
}

function sortedLines(value) {
  return value.split(/\r?\n/u).filter(Boolean).sort();
}

function exactLineValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [...markdown.matchAll(new RegExp(`^- ${escaped}: (.+)$`, "gmu"))];
  assert.equal(matches.length, 1, `Expected one Markdown metadata line for ${label}`);
  return matches[0][1].trim();
}

function section(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === heading);
  assert.notEqual(start, -1, `Missing Markdown heading: ${heading}`);
  assert.equal(lines.filter((line) => line === heading).length, 1, `Duplicate Markdown heading: ${heading}`);
  const level = heading.match(/^#+/u)[0].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#+) /u);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

function tableRows(sectionText, firstHeaderCell) {
  const lines = sectionText.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    if (!line.startsWith("|")) return false;
    return line.slice(1).split("|")[0].trim() === firstHeaderCell;
  });
  assert.notEqual(headerIndex, -1, `Missing Markdown table with first header ${firstHeaderCell}`);
  const rows = [];
  for (let index = headerIndex + 2; index < lines.length && lines[index].startsWith("|"); index += 1) {
    const cells = lines[index].slice(1, -1).split("|").map((cell) => cell.trim());
    rows.push(cells);
  }
  assert.ok(rows.length > 0, `Markdown table ${firstHeaderCell} has no rows`);
  return rows;
}

function unionValues(sectionText, typeName) {
  const match = sectionText.match(new RegExp(`type ${typeName}\\s*=\\s*([^;]+);`, "u"));
  assert.ok(match, `Missing Markdown union ${typeName}`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((item) => item[1]);
}

function typeFields(sectionText, typeName) {
  const match = sectionText.match(new RegExp(`type ${typeName}\\s*=\\s*\\{\\r?\\n([\\s\\S]*?)\\r?\\n\\};`, "u"));
  assert.ok(match, `Missing Markdown type ${typeName}`);
  return match[1]
    .split(/\r?\n/u)
    .map((line) => line.match(/^  ([A-Za-z][A-Za-z0-9]*)(?:\??):/u))
    .filter(Boolean)
    .map((field) => field[1]);
}

function bulletListAfter(sectionText, label) {
  const lines = sectionText.split(/\r?\n/u);
  const labelIndex = lines.findIndex((line) => line === label);
  assert.notEqual(labelIndex, -1, `Missing Markdown list label: ${label}`);
  const values = [];
  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    if (!lines[index].startsWith("- ")) {
      if (values.length > 0) break;
      if (lines[index].trim() === "") continue;
      break;
    }
    values.push(lines[index].slice(2).replace(/ \(new\)$/u, ""));
  }
  return values;
}

function waveContract(markdown) {
  const headings = [...markdown.matchAll(/^### Wave (\d+)\. (.+)$/gmu)].map((match) => ({
    id: Number.parseInt(match[1], 10),
    name: match[2]
  }));
  return headings.map((heading) => {
    const body = section(markdown, `### Wave ${heading.id}. ${heading.name}`);
    const exactFiles = heading.id === 0 ? [] : bulletListAfter(
      body,
      heading.id === 3 ? "Required exact files:" : "Exact files:"
    );
    const newFiles = [];
    for (const line of body.split(/\r?\n/u)) {
      const match = line.match(/^- (.+) \(new\)$/u);
      if (match && exactFiles.includes(match[1])) newFiles.push(match[1]);
    }
    const conditionalFixFiles = heading.id === 3
      ? bulletListAfter(body, "Conditional fix files:")
      : [];
    return { ...heading, exactFiles, newFiles, conditionalFixFiles };
  });
}

function replaceExactly(value, before, after, mutation) {
  const count = value.split(before).length - 1;
  assert.equal(count, 1, `Mutation ${mutation} expected one target but found ${count}`);
  return value.replace(before, after);
}

function mutateMarkdown(markdown, mutation) {
  switch (mutation) {
    case "revision":
      return markdown.replace(/^- Revision: .+$/mu, "- Revision: deliberately-broken");
    case "authority":
      return replaceExactly(
        markdown,
        "모든 digest는 server pure function에서 생성하고 client가 보낸 digest는 비교 입력으로도 사용하지 않습니다.",
        "모든 digest는 client state가 생성하며 서버 검증은 선택입니다.",
        mutation
      );
    case "wave_heading":
      return replaceExactly(
        markdown,
        "### Wave 1. Authority Foundation And Session Binding",
        "### Wave 1. Deliberately Broken Authority",
        mutation
      );
    case "wave_order":
      return replaceExactly(
        markdown,
        "### Wave 1. Authority Foundation And Session Binding",
        "### Wave 2. Authority Foundation And Session Binding",
        mutation
      );
    case "route":
      return markdown.replace(/^\| R11 \|.*\r?\n/mu, "");
    case "state":
      return markdown.replace(/^\| ready \|.*\r?\n/mu, "");
    case "blocker":
      return markdown.replace(/^\| recipient_locale_invalid \|.*\r?\n/mu, "");
    case "channel":
      return replaceExactly(
        markdown,
        'type DispatchChannel = "email" | "sms" | "kakao";',
        'type DispatchChannel = "email" | "sms";',
        mutation
      );
    case "language":
      return replaceExactly(
        markdown,
        'type SupportedLanguageCode = "ko" | "vi" | "zh" | "th" | "uz" | "mn" | "ne" | "km" | "id" | "my" | "tl" | "en";',
        'type SupportedLanguageCode = "ko" | "vi" | "zh" | "th" | "uz" | "mn" | "ne" | "km" | "id" | "my" | "tl";',
        mutation
      );
    case "fixture":
      return replaceExactly(
        markdown,
        "| stale | pre-session binding mismatch 또는 session success 뒤 identity/workpack/recipient/channel binding mismatch | pre-session은 session/dispatch 0; post-session은 session created, provider dispatch/log insert 0, reasonCode별 owner route |",
        "",
        mutation
      );
    case "one_send_job":
      return markdown.replace(/^- 제품 Job: .+$/mu, "- 제품 Job: 여러 문서팩을 여러 번 전송합니다.");
    case "locale_fallback":
      return replaceExactly(
        markdown,
        "ko, en 또는 다른 언어로 fallback하지 않습니다.",
        "비한국어 대상도 ko fallback을 허용합니다.",
        mutation
      );
    case "evidence_binding":
      return markdown.replace(/^- Source base: [0-9a-f]{40}$/mu, "- Source base: 0000000000000000000000000000000000000000");
    default:
      throw new Error(`Unknown Markdown mutation: ${mutation}`);
  }
}

function assertStructuralParity(markdown, spec) {
  const expectedMainHeadings = [
    "## 1. Current Truth And Decisions",
    "## 2. Target IA And Ownership",
    "## 3. State Machine And CTA Authority",
    "## 4. Data And Lifecycle Contracts",
    "## 5. Accessibility And Responsive Acceptance",
    "## 6. Real Browser RED/GREEN Matrix",
    "## 7. Implementation Waves",
    "## 8. Non-Goals And User Copy",
    "## 9. Executable Structural MD/JSON Parity"
  ];
  assert.deepEqual(
    [...markdown.matchAll(/^## \d+\. .+$/gmu)].map((match) => match[0]),
    expectedMainHeadings,
    "Markdown top-level section structure differs"
  );

  assert.equal(exactLineValue(markdown, "Spec ID"), spec.specId);
  assert.equal(exactLineValue(markdown, "Revision"), spec.revision);
  assert.equal(exactLineValue(markdown, "상태"), spec.status);
  assert.equal(exactLineValue(markdown, "Review status"), spec.metadata.reviewStatus);
  assert.equal(exactLineValue(markdown, "기준 branch"), spec.metadata.branch);
  assert.equal(exactLineValue(markdown, "Source base"), spec.metadata.sourceBase);
  assert.equal(exactLineValue(markdown, "Candidate evidence"), `${EVIDENCE_RELATIVE_PATH}의 full candidate SHA`);
  assert.equal(exactLineValue(markdown, "제품 Job"), spec.product.job);

  const sequenceMap = new Map([
    ["대상", "target"],
    ["채널", "channel"],
    ["현지화 미리보기", "localized_preview"],
    ["전송", "send"]
  ]);
  const markdownSequence = exactLineValue(markdown, "화면 순서")
    .split(" -> ")
    .map((label) => sequenceMap.get(label));
  assert.deepEqual(markdownSequence, spec.product.screenSequence);
  assert.equal(spec.product.onePrimaryPerScreen, true);
  assert.match(markdown, /현재 state의 primary 하나/u);

  const truthSources = tableRows(section(markdown, "## 1. Current Truth And Decisions"), "근거").map((row) => row[0]);
  assert.deepEqual(truthSources, [
    "app/workspace/page.tsx",
    "SafeGuardCommandCenter.tsx:1056",
    "AdminLoginPanel, AuthCallbackClient",
    "CurrentWorkpackModules.tsx, /workers",
    "share-sessions API",
    "workflow dispatch API/client",
    "workpack_share_sessions.access_policy",
    "workpack-commercial.ts",
    "generation-evidence.ts, /api/workpacks",
    "workflow dispatch route",
    "foreignWorkerLanguages",
    "d3ad865, 391x844",
    "d3ad865 베트남어"
  ]);

  const shareBodyIds = tableRows(section(markdown, "### 2.1 Share Body"), "순서").map((row) => row[1]);
  assert.deepEqual(shareBodyIds, spec.product.screenSections.map((item) => item.id));

  const routeIds = tableRows(section(markdown, "### 2.2 Route Ownership"), "ID").map((row) => row[0]);
  assert.deepEqual(routeIds, spec.routeOwnership.map((route) => route.id));
  const returnSection = section(markdown, "### 2.3 Workspace Return Contract");
  assert.deepEqual(
    returnSection.split(/\r?\n/u).filter((line) => line.startsWith("- /workspace?step=share&theme="))
      .map((line) => line.slice(2)),
    spec.returnContract.canonicalSharePaths
  );
  assert.ok(returnSection.includes(spec.returnContract.loginHrefTemplate));
  assert.ok(returnSection.includes(spec.returnContract.ownerHrefTemplates.translationReview));
  assert.ok(returnSection.includes(spec.returnContract.ownerHrefTemplates.recipientLocaleInvalid));

  const stateIds = tableRows(section(markdown, "## 3. State Machine And CTA Authority"), "State").map((row) => row[0]);
  assert.deepEqual(stateIds, spec.stateMachine.states.map((state) => state.id));
  assert.equal(spec.stateMachine.visiblePrimaryCount, 1);

  const selectedReasons = tableRows(section(markdown, "### 3.1 Selected Reasons"), "Reason ID").map((row) => row[0]);
  const reviewReasons = tableRows(section(markdown, "### 3.2 Review Required Reasons"), "Reason ID").map((row) => row[0]);
  assert.deepEqual([...selectedReasons, ...reviewReasons], spec.stateMachine.blockingReasons.map((reason) => reason.id));

  const failureReasons = tableRows(section(markdown, "### 3.3 Failure CTA Catalog"), "Failure stage/reason").map((row) => row[0]);
  assert.deepEqual(failureReasons, Object.keys(spec.stateMachine.failureCta));

  const channelSection = section(markdown, "### 4.2 Channels And Reporting Group");
  assert.deepEqual(unionValues(channelSection, "DispatchChannel"), spec.dataContracts.dispatchChannels);
  assert.deepEqual(
    typeFields(channelSection, "ResolvedChannel"),
    Object.keys(spec.dataContracts.resolvedChannel.fields)
  );
  assert.deepEqual(
    typeFields(channelSection, "ChannelAvailabilityResolution"),
    ["version", ...spec.dataContracts.channelAvailability.responseFields]
  );

  const configSection = section(markdown, "### 4.2.1 Server Runtime Configuration Sources");
  const configRows = tableRows(configSection, "Environment key").map((row) => ({
    key: row[0],
    kind: row[1],
    source: row[2],
    rotation: row[3],
    missing: row[4]
  }));
  assert.deepEqual(configRows, spec.dataContracts.serverRuntimeConfiguration.environment);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.module, "lib/workpack-share-server-config.ts");
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.test, "tests/workpack-share-server-config.test.ts");
  assert.deepEqual(spec.dataContracts.serverRuntimeConfiguration.secretNames, [
    "SAFECLAW_CHANNEL_AVAILABILITY_SECRET",
    "SAFECLAW_CHANNEL_CONFIG_BINDING_SECRET",
    "SAFECLAW_REVIEWED_LOCALIZATION_SECRET"
  ]);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.digestKeyIdSecret, false);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.placeholdersOnlyInEnvExample, true);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.clientImportAllowed, false);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.httpResponseExposureAllowed, false);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.logExposureAllowed, false);
  assert.equal(spec.dataContracts.serverRuntimeConfiguration.jsonbSecretPersistenceAllowed, false);
  assert.match(configSection, /import "server-only"/u);
  assert.match(configSection, /never returns, serializes, or logs secret values/u);

  const localeSection = section(markdown, "### 4.2.2 Allowlisted Locale Parser");
  assert.deepEqual(unionValues(localeSection, "SupportedLanguageCode"), spec.dataContracts.supportedLanguageCodes);
  assert.match(localeSection, /ko, en 또는 다른 언어로 fallback하지 않습니다\./u);
  assert.equal(spec.dataContracts.localeParser.koreanAllowedOnlyWhenAuthoritativeLocaleIsExactlyKo, true);
  assert.equal(spec.browserGate.languageGate.nonKoreanTargetKoreanFallbackAllowed, false);

  const participantSection = section(markdown, "### 4.1 Today Participant Snapshot");
  assert.deepEqual(
    typeFields(participantSection, "TodayParticipantSnapshotV2"),
    ["version", ...Object.keys(spec.dataContracts.todayParticipantSnapshot.fields)]
  );
  assert.equal(spec.dataContracts.todayParticipantSnapshot.shareMayPostWorkers, false);
  assert.equal(spec.dataContracts.todayParticipantSnapshot.shareMayMutateRoster, false);
  assert.equal(spec.dataContracts.todayParticipantSnapshot.shareMayMutateSnapshot, false);

  const localizationSection = section(markdown, "### 4.3 Source-Bound Localized Dispatch Artifact");
  assert.deepEqual(
    typeFields(localizationSection, "ReviewedLocalizationEnvelope"),
    ["version", ...Object.keys(spec.dataContracts.localizedDispatchArtifact.envelopeFields)]
  );
  assert.deepEqual(
    typeFields(localizationSection, "LocalizedDispatchArtifact"),
    ["version", ...Object.keys(spec.dataContracts.localizedDispatchArtifact.artifactFields)]
  );
  assert.deepEqual(
    typeFields(localizationSection, "ReviewRouteRequest"),
    spec.dataContracts.localizedDispatchArtifact.reviewRouteContract.requestFields
  );
  assert.deepEqual(
    typeFields(localizationSection, "ReviewRouteResponse"),
    spec.dataContracts.localizedDispatchArtifact.reviewRouteContract.responseFields
  );
  assert.match(localizationSection, /원본 workpacks\.deliverables와 generationEvidence는 불변입니다\./u);
  assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.originalDeliverablesMutable, false);
  assert.equal(spec.dataContracts.localizedDispatchArtifact.persistence.originalGenerationEvidenceMutable, false);
  assert.equal(spec.dataContracts.localizedDispatchArtifact.semanticRiskStandard.emojiOnlyAllowed, false);

  const bindingSection = section(markdown, "### 4.4 Server-Authoritative Session-To-Dispatch Binding");
  assert.deepEqual(
    typeFields(bindingSection, "ShareDispatchBindingV1"),
    spec.dataContracts.sessionDispatchBinding.fields
  );
  assert.match(bindingSection, /모든 digest는 server pure function에서 생성하고 client가 보낸 digest는 비교 입력으로도 사용하지 않습니다\./u);
  assert.match(bindingSection, /client state를 authority로 사용하지 않습니다\./u);
  assert.equal(spec.dataContracts.sessionDispatchBinding.serverAuthoritative, true);
  assert.equal(spec.dataContracts.sessionDispatchBinding.dispatchReload.clientStateAuthority, false);
  assert.equal(spec.dataContracts.sessionDispatchBinding.databaseMigrationRequired, false);
  const dispatchMismatchIds = tableRows(bindingSection, "Dispatch preflight reasonCode").map((row) => row[0]);
  assert.deepEqual(
    dispatchMismatchIds,
    spec.dataContracts.sessionDispatchBinding.mismatchOutcomes.map((outcome) => outcome.reasonCode)
  );

  const lifecycleSection = section(markdown, "### 4.5 Ready Guards And Send Lifecycle");
  assert.match(lifecycleSection, /share-sessions를 정확히 한 번 호출합니다\./u);
  assert.match(lifecycleSection, /workflow\/dispatch를 정확히 한 번 호출합니다\./u);
  assert.equal(spec.sendLifecycle.createSession.requestCount, 1);
  assert.equal(spec.sendLifecycle.dispatch.requestCountAfterSessionSuccess, 1);
  assert.deepEqual(spec.sendLifecycle.order, [
    "validate_reviewed_localization",
    "resolve_channels",
    "create_session",
    "dispatch",
    "save_channel_log"
  ]);

  const resultSection = section(markdown, "### 4.6 Honest Result Classification");
  assert.deepEqual(unionValues(resultSection, "RequestOutcome"), spec.resultContract.outcomes);
  assert.deepEqual(
    typeFields(resultSection, "DispatchResultStripV2"),
    Object.keys(spec.resultContract.stripFields)
  );
  assert.equal(spec.resultContract.historyRequiresPersistedLog, true);
  assert.equal(spec.resultContract.recipientLevelDeliveredPersistence, false);

  const accessibilitySection = section(markdown, "### 5.1 Exact Common Gates");
  const accessibilityGates = tableRows(accessibilitySection, "항목").map((row) => row[0]);
  assert.deepEqual(accessibilityGates, [
    "Touch target",
    "Touch gap",
    "Overlap",
    "Horizontal overflow",
    "Nested scroll",
    "Focus",
    "State semantics",
    "Contrast",
    "Theme",
    "Motion",
    "Meaning"
  ]);
  assert.equal(spec.accessibility.meaningCannotBeColorIconOrEmojiOnly, true);

  const taskDistanceRows = tableRows(section(markdown, "### 5.2 Normal Zoom Task Distance"), "Viewport/state");
  assert.deepEqual(taskDistanceRows.map((row) => [row[0], Number.parseInt(row[1], 10)]), [
    ["1440x1000 pre-send blocker/owner state", spec.accessibility.normalZoom.taskDistanceMaxPx.desktop.preSendBlockerOrOwner],
    ["1440x1000 ready", spec.accessibility.normalZoom.taskDistanceMaxPx.desktop.ready],
    ["1440x1000 sending/result", spec.accessibility.normalZoom.taskDistanceMaxPx.desktop.sendingOrResult],
    ["391x844 pre-send blocker/owner state", spec.accessibility.normalZoom.taskDistanceMaxPx.mobile.preSendBlockerOrOwner],
    ["391x844 ready", spec.accessibility.normalZoom.taskDistanceMaxPx.mobile.ready],
    ["391x844 sending/result", spec.accessibility.normalZoom.taskDistanceMaxPx.mobile.sendingOrResult]
  ]);

  const zoomSection = section(markdown, "### 5.3 Text Zoom 200%");
  for (const requiredToken of [
    "representativePaths",
    "window.devicePixelRatio",
    "window.visualViewport",
    "data-share-text-scale-run",
    "path does not reach document root",
    "baselineCaptureBeforeAnyMutation",
    "fresh production fixture DOM"
  ]) {
    assert.ok(zoomSection.includes(requiredToken), `200% Markdown contract missing ${requiredToken}`);
  }
  const zoomFixtureIds = tableRows(zoomSection, "Fixture ID").map((row) => row[0]);
  assert.deepEqual(zoomFixtureIds, spec.accessibility.zoom200.negativeFixtureIds);
  assert.equal(spec.accessibility.zoom200.pathTraversalFromEveryRepresentativeToDocumentRoot, true);
  assert.equal(spec.accessibility.zoom200.repeatedEvaluationWithoutFreshDomAllowed, false);
  assert.equal(spec.accessibility.zoom200.deviceScaleFactor, 1);
  assert.equal(spec.accessibility.zoom200.devicePixelRatio, 1);
  assert.equal(spec.accessibility.zoom200.visualViewportScale, 1);

  const environmentRows = tableRows(section(markdown, "### 6.1 Environments"), "Env ID");
  assert.deepEqual(
    environmentRows.map((row) => ({ id: row[0], theme: row[1].toLowerCase(), viewport: row[2] })),
    spec.browserGate.environments
  );
  const zoomRows = tableRows(section(markdown, "### 6.1 Environments"), "Zoom ID");
  assert.deepEqual(zoomRows.map((row) => row[0]), spec.browserGate.zoomModes.map((mode) => mode.id));
  const fixtureIds = tableRows(section(markdown, "### 6.3 Fixtures"), "Fixture ID").map((row) => row[0]);
  assert.deepEqual(fixtureIds, spec.browserGate.fixtures.map((fixture) => fixture.id));
  assert.equal(
    spec.browserGate.environments.length * spec.browserGate.fixtures.length * spec.browserGate.zoomModes.length,
    spec.browserGate.caseCount
  );
  assert.match(section(markdown, "### 6.5 Vietnamese And Language Gates"), /Korean residual count는 각각 0입니다\./u);
  assert.match(section(markdown, "### 6.5 Vietnamese And Language Gates"), /실제 signing secret, provider credential, provider call, Supabase insert\/update\/delete는 browser gate에서 사용하지 않습니다\./u);
  assert.equal(spec.browserGate.languageGate.vietnameseKoreanResidualZeroSurfaces.length, 5);
  assert.equal(spec.browserGate.languageGate.emojiOnlyMeaningAllowed, false);
  assert.equal(spec.browserGate.providerCallsAllowed, false);
  assert.equal(spec.browserGate.databaseWritesAllowed, false);

  const markdownWaves = waveContract(markdown);
  assert.deepEqual(
    markdownWaves.map((wave) => ({ id: wave.id, name: wave.name })),
    spec.implementation.waves.map((wave) => ({ id: wave.id, name: wave.name }))
  );
  for (const markdownWave of markdownWaves) {
    const jsonWave = spec.implementation.waves.find((wave) => wave.id === markdownWave.id);
    assert.deepEqual(markdownWave.exactFiles, jsonWave.exactFiles, `Wave ${markdownWave.id} exactFiles differ`);
    assert.deepEqual(markdownWave.newFiles, jsonWave.newFiles || [], `Wave ${markdownWave.id} newFiles differ`);
    assert.deepEqual(markdownWave.conditionalFixFiles, jsonWave.conditionalFixFiles || [], `Wave ${markdownWave.id} conditionalFixFiles differ`);
  }
  const waveOneFiles = spec.implementation.waves.find((wave) => wave.id === 1).exactFiles;
  for (const runtimeConfigOwner of [
    ".env.example",
    "lib/workpack-share-server-config.ts",
    "tests/workpack-share-server-config.test.ts"
  ]) {
    assert.ok(waveOneFiles.includes(runtimeConfigOwner), `Wave 1 missing runtime config owner ${runtimeConfigOwner}`);
  }

  assert.equal(spec.product.onePrimaryPerScreen, true);
  assert.ok(spec.product.excludedFromShareBody.includes("Before/After history"));
  assert.ok(spec.product.excludedFromShareBody.includes("full dispatch history"));
  assert.equal(spec.dataContracts.dispatchChannels.length, 3);
  assert.equal(spec.dataContracts.supportedLanguageCodes.length, 12);
  assert.equal(spec.routeOwnership.length, 11);
  assert.equal(spec.stateMachine.states.length, 12);
  assert.equal(spec.stateMachine.blockingReasons.length, 11);
  assert.equal(spec.browserGate.fixtures.length, 16);
  assert.equal(spec.browserGate.caseCount, 128);
  assert.equal(spec.nonGoals.includes("real external provider execution by this spec task or browser gate"), true);
  assert.equal(spec.runtimePersistenceClarification.includes("adds no migration"), true);

  const userCopyRows = tableRows(section(markdown, "## 8. Non-Goals And User Copy"), "상황");
  const userCopyMap = new Map(userCopyRows.map((row) => [row[0], row[1]]));
  assert.equal(userCopyMap.get("대상"), spec.userCopy.target);
  assert.equal(userCopyMap.get("대상 없음"), spec.userCopy.noRecipients);
  assert.equal(userCopyMap.get("대상 CTA"), spec.userCopy.noRecipientsCta);
  assert.equal(userCopyMap.get("로그인 CTA"), spec.userCopy.loggedOutCta);
  assert.equal(userCopyMap.get("전송 CTA"), spec.userCopy.readyCta);
  assert.equal(userCopyMap.get("언어"), spec.userCopy.language);
  assert.equal(userCopyMap.get("작업자 언어 blocker"), spec.userCopy.recipientLanguageBlocker);
  assert.equal(userCopyMap.get("작업자 언어 CTA"), spec.userCopy.recipientLanguageCta);
  assert.equal(userCopyMap.get("번역 blocker"), spec.userCopy.translationBlocker);
  assert.equal(userCopyMap.get("번역 미완료 CTA"), spec.userCopy.translationIncompleteCta);
  assert.equal(userCopyMap.get("Revalidation"), spec.userCopy.revalidation);
  assert.equal(userCopyMap.get("Session 실패"), spec.userCopy.sessionFailure);
  assert.equal(userCopyMap.get("Session 실패 CTA"), spec.userCopy.sessionFailureCta);
  assert.equal(userCopyMap.get("Accepted + log"), spec.userCopy.acceptedWithPersistedLog);
  assert.equal(userCopyMap.get("Partial"), spec.userCopy.partial);
  assert.equal(userCopyMap.get("Unknown + no log"), spec.userCopy.unknownWithoutLog);
  assert.equal(userCopyMap.get("Stale"), spec.userCopy.stale);
  assert.equal(userCopyRows.length, Object.keys(spec.userCopy).length);
}

function freshZoomFixture() {
  return {
    applied: false,
    environment: {
      deviceScaleFactor: 1,
      devicePixelRatio: 1,
      visualViewportScale: 1,
      viewportWidth: 1440,
      documentClientWidth: 1440
    },
    representatives: [
      {
        key: "preview-body:0",
        fontSizePx: 16,
        lineHeightPx: 24,
        lineCount: 2,
        heightPx: 48,
        path: [
          { id: "preview-body", transform: "none", zoom: 1 },
          { id: "preview-wrapper", transform: "none", zoom: 1 },
          { id: "share-root", transform: "none", zoom: 1 },
          { id: "body", transform: "none", zoom: 1 },
          { id: "html", transform: "none", zoom: 1 }
        ]
      }
    ]
  };
}

function evaluateZoomFixture(fixture) {
  assert.equal(fixture.applied, false, "repeated evaluation on the same DOM is forbidden");
  assert.equal(fixture.environment.deviceScaleFactor, 1, "deviceScaleFactor must equal 1");
  assert.equal(fixture.environment.devicePixelRatio, 1, "devicePixelRatio must equal 1");
  assert.equal(fixture.environment.visualViewportScale, 1, "visualViewport.scale must equal 1");
  assert.equal(
    fixture.environment.documentClientWidth,
    fixture.environment.viewportWidth,
    "page zoom changed the CSS viewport"
  );

  const immutableBaselines = fixture.representatives.map((representative) => ({
    key: representative.key,
    fontSizePx: representative.fontSizePx,
    lineHeightPx: representative.lineHeightPx,
    lineCount: representative.lineCount,
    heightPx: representative.heightPx
  }));
  const representativePaths = fixture.representatives.map((representative) => representative.path);
  for (const pathNodes of representativePaths) {
    for (const node of pathNodes) {
      assert.equal(node.transform, "none", `transform found on ${node.id}`);
      assert.equal(node.zoom, 1, `zoom found on ${node.id}`);
    }
    assert.equal(pathNodes.at(-1).id, "html", "representative path must reach document root");
  }

  fixture.applied = true;
  const results = immutableBaselines.map((baseline) => ({
    key: baseline.key,
    fontRatio: (baseline.fontSizePx * 2) / baseline.fontSizePx,
    lineRatio: (baseline.lineHeightPx * 2) / baseline.lineHeightPx,
    lineCountBefore: baseline.lineCount,
    lineCountAfter: baseline.lineCount + 2,
    heightBefore: baseline.heightPx,
    heightAfter: baseline.heightPx * 2
  }));
  for (const result of results) {
    assert.ok(result.fontRatio >= 1.9 && result.fontRatio <= 2.1);
    assert.ok(result.lineRatio >= 1.9 && result.lineRatio <= 2.1);
    assert.ok(result.lineCountAfter > result.lineCountBefore);
    assert.ok(result.heightAfter > result.heightBefore);
  }
  return results;
}

function zoomFixture(name) {
  const fixture = freshZoomFixture();
  if (name === "internal_wrapper_transform") {
    fixture.representatives[0].path[1].transform = "matrix(2, 0, 0, 2, 0, 0)";
  } else if (name === "internal_zoom") {
    fixture.representatives[0].path[1].zoom = 2;
  } else if (name === "outer_transform") {
    fixture.representatives[0].path[3].transform = "matrix(2, 0, 0, 2, 0, 0)";
  } else if (name === "device_scale_factor") {
    fixture.environment.deviceScaleFactor = 2;
    fixture.environment.devicePixelRatio = 2;
  } else if (name === "page_zoom") {
    fixture.environment.visualViewportScale = 1.25;
    fixture.environment.documentClientWidth = 1152;
  } else if (name !== "repeated_evaluation") {
    throw new Error(`Unknown zoom fixture: ${name}`);
  }
  return fixture;
}

function assertZoomContractSelfTests() {
  evaluateZoomFixture(freshZoomFixture());
  evaluateZoomFixture(freshZoomFixture());
  for (const name of ZOOM_NEGATIVE_FIXTURES) {
    const fixture = zoomFixture(name);
    assert.throws(() => {
      evaluateZoomFixture(fixture);
      if (name === "repeated_evaluation") evaluateZoomFixture(fixture);
    }, undefined, `Zoom fixture ${name} did not fail`);
  }
}

function assertEvidence(spec, evidence) {
  const fullSha = /^[0-9a-f]{40}$/u;
  assert.match(evidence.sourceBase, fullSha);
  assert.match(evidence.candidate, fullSha);
  assert.equal(evidence.status, "HOLD_PENDING_FRESH_REVIEW");
  assert.equal(evidence.reviewStatus, "pending");
  assert.equal(evidence.reviewedClaim, false);
  assert.equal(evidence.branch, spec.metadata.branch);
  assert.equal(evidence.sourceBase, spec.metadata.sourceBase);
  assert.equal(evidence.candidateParent, evidence.sourceBase);
  assert.deepEqual([...evidence.candidateChangedFiles].sort(), [...spec.metadata.candidateWriteFiles].sort());
  git("cat-file", "-e", `${evidence.sourceBase}^{commit}`);
  git("cat-file", "-e", `${evidence.candidate}^{commit}`);
  assert.equal(git("rev-parse", `${evidence.candidate}^`), evidence.sourceBase);
  assert.equal(git("rev-parse", "HEAD^"), evidence.candidate);
  assert.deepEqual(
    sortedLines(git("diff-tree", "--no-commit-id", "--name-only", "-r", evidence.candidate)),
    [...spec.metadata.candidateWriteFiles].sort()
  );
  assert.deepEqual(
    sortedLines(git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")),
    [spec.metadata.evidenceOnlyWriteFile]
  );
  assert.equal(evidence.evidenceCommitContract.recordsOwnCommitSha, false);
  assert.equal(evidence.evidenceCommitContract.requiredParent, evidence.candidate);
  assert.equal(Object.hasOwn(evidence, "evidenceCommitSha"), false);
  assert.equal(Object.hasOwn(evidence.evidenceCommitContract, "ownCommitSha"), false);
}

function parseArgs(argv) {
  const result = { mutation: null, zoom: null, skipEvidence: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--md-mutation") {
      result.mutation = argv[++index];
      if (!result.mutation) throw new Error("--md-mutation requires a value");
    } else if (value === "--zoom-fixture") {
      result.zoom = argv[++index];
      if (!result.zoom) throw new Error("--zoom-fixture requires a value");
    }
    else if (value === "--skip-evidence") result.skipEvidence = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mutation && !MD_MUTATIONS.includes(args.mutation)) {
    throw new Error(`Unknown Markdown mutation: ${args.mutation}`);
  }
  if (args.zoom && ![...ZOOM_NEGATIVE_FIXTURES, "positive_twice"].includes(args.zoom)) {
    throw new Error(`Unknown zoom fixture: ${args.zoom}`);
  }

  if (args.zoom) {
    if (args.zoom === "positive_twice") {
      evaluateZoomFixture(freshZoomFixture());
      evaluateZoomFixture(freshZoomFixture());
      console.log(JSON.stringify({ result: "ZOOM_CONTRACT_OK", positiveFreshDomRuns: 2 }));
      return;
    }
    const fixture = zoomFixture(args.zoom);
    evaluateZoomFixture(fixture);
    if (args.zoom === "repeated_evaluation") evaluateZoomFixture(fixture);
    return;
  }

  const originalMarkdown = fs.readFileSync(MD_PATH, "utf8");
  const markdown = args.mutation ? mutateMarkdown(originalMarkdown, args.mutation) : originalMarkdown;
  const spec = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
  assertStructuralParity(markdown, spec);
  assertZoomContractSelfTests();
  if (!args.skipEvidence) assertEvidence(spec, evidence);

  console.log(JSON.stringify({
    result: "STRUCTURAL_PARITY_OK",
    markdownMutation: args.mutation || "none",
    routes: spec.routeOwnership.length,
    states: spec.stateMachine.states.length,
    blockers: spec.stateMachine.blockingReasons.length,
    channels: spec.dataContracts.dispatchChannels.length,
    languages: spec.dataContracts.supportedLanguageCodes.length,
    fixtures: spec.browserGate.fixtures.length,
    browserCaseArithmetic: spec.browserGate.caseCount,
    zoomPositiveFreshDomRuns: 2,
    zoomNegativeFixtureCount: ZOOM_NEGATIVE_FIXTURES.length,
    sourceBase: spec.metadata.sourceBase,
    candidate: args.skipEvidence ? null : evidence.candidate
  }, null, 2));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`STRUCTURAL_PARITY_ERROR: ${message}`);
  process.exitCode = 1;
}
