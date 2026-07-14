import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_EXPORT_NAMES = [
  "buildValidPhotoConfirmation",
  "computeControlAcceptanceDigest",
  "computePhotoEventDigest",
  "validateContract",
  "validateEvidenceManifestShape",
  "validatePhotoConfirmation"
];
const OPTIONAL_EXPORT_NAMES = ["buildSyntheticEvidenceManifest", "resolveLiveAuthorityRef"];
const EXPECTED_AUTHORITY_HEAD = "ea7aa7223a056c884d5b0ba55563d602af328451";
const EXPECTED_NORMATIVE_MUTATIONS = 2167;

function parseArguments(argv) {
  const args = { validator: "", spec: "", label: "candidate", root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const take = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--validator") args.validator = take();
    else if (key === "--spec") args.spec = take();
    else if (key === "--label") args.label = take();
    else if (key === "--root") args.root = take();
    else throw new Error(`Unknown argument: ${key}`);
  }
  if (!args.validator || !args.spec) {
    throw new Error("--validator and --spec are required");
  }
  return args;
}

function typedSha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function clone(value) {
  return structuredClone(value);
}

async function loadInstrumentedValidator(path) {
  const source = readFileSync(path, "utf8");
  const footerMatch = /\r?\ntry \{\r?\n  main\(\);/u.exec(source);
  const footer = footerMatch?.index ?? -1;
  if (footer < 0) throw new Error("Validator footer was not found for external instrumentation");
  for (const name of REQUIRED_EXPORT_NAMES) {
    if (!source.includes(`function ${name}(`)) {
      throw new Error(`Validator does not expose the expected function body: ${name}`);
    }
  }
  const exportNames = [
    ...REQUIRED_EXPORT_NAMES,
    ...OPTIONAL_EXPORT_NAMES.filter((name) => source.includes(`function ${name}(`))
  ];
  const tempDirectory = mkdtempSync(join(dirname(import.meta.filename), ".tmp-remediation-"));
  const instrumentedPath = join(tempDirectory, "instrumented-validator.mjs");
  const exports = `\nexport { ${exportNames.join(", ")} };\n`;
  writeFileSync(instrumentedPath, `${source.slice(0, footer)}${exports}`, "utf8");
  const module = await import(`${pathToFileURL(instrumentedPath).href}?run=${Date.now()}`);
  return { module, source, tempDirectory };
}

function refreshLegacyPhotoDigests(module, event) {
  if (Object.hasOwn(event, "controlAcceptanceDigest")) {
    event.controlAcceptanceDigest = module.computeControlAcceptanceDigest(event);
  }
  if (Object.hasOwn(event, "eventDigest")) {
    event.eventDigest = module.computePhotoEventDigest(event);
  }
}

function expectRejection(results, id, operation) {
  try {
    operation();
    results.push({ id, rejected: false, error: "ATTACK_ACCEPTED" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ id, rejected: true, error: message });
  }
}

function recordAccepted(results, id, error) {
  results.push({ id, rejected: false, error });
}

function expectForbiddenClientField(module, results, valid, id, owner, field) {
  if (Object.hasOwn(owner, field)) {
    recordAccepted(results, id, `FORBIDDEN_CLIENT_FIELD_PRESENT: ${field}`);
    return;
  }
  expectRejection(results, id, () => {
    const fixture = clone(valid);
    const target = owner === valid.event ? fixture.event : fixture.event.humanReceipt;
    target[field] = typedSha256(`attacker-${field}`);
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });
}

function runPhotoAuthorityAttacks(module, results) {
  const valid = module.buildValidPhotoConfirmation();
  module.validatePhotoConfirmation(clone(valid.event), clone(valid.context));

  expectForbiddenClientField(module, results, valid, "photo-client-snapshot-digest", valid.event, "snapshotDigest");
  expectForbiddenClientField(
    module,
    results,
    valid,
    "photo-client-control-digest",
    valid.event.humanReceipt,
    "controlDigest"
  );
  expectForbiddenClientField(
    module,
    results,
    valid,
    "photo-client-event-digest",
    valid.event.humanReceipt,
    "eventDigest"
  );

  if (!Object.hasOwn(valid.context, "photoAnalysisSnapshot") || !Object.hasOwn(valid.event, "humanReceipt")) {
    recordAccepted(results, "photo-cross-workpack", "SERVER_AUTHORITY_BINDING_MISSING");
    recordAccepted(results, "photo-cross-logical-root", "SERVER_AUTHORITY_BINDING_MISSING");
  } else if (
    !Object.hasOwn(valid.event.humanReceipt, "workpackId") ||
    !Object.hasOwn(valid.event.humanReceipt, "logicalRootId")
  ) {
    recordAccepted(results, "photo-cross-workpack", "RECEIPT_WORKPACK_BINDING_MISSING");
    recordAccepted(results, "photo-cross-logical-root", "RECEIPT_LOGICAL_ROOT_BINDING_MISSING");
  } else {
    expectRejection(results, "photo-cross-workpack", () => {
      const fixture = clone(valid);
      fixture.event.humanReceipt.workpackId = "attacker-workpack";
      module.validatePhotoConfirmation(fixture.event, fixture.context);
    });
    expectRejection(results, "photo-cross-logical-root", () => {
      const fixture = clone(valid);
      fixture.event.humanReceipt.logicalRootId = "attacker-logical-root";
      module.validatePhotoConfirmation(fixture.event, fixture.context);
    });
  }

  if (!Object.hasOwn(valid.context.receiptAuthority, "nonceState")) {
    recordAccepted(results, "photo-consumed-nonce-replay", "NONCE_CONSUMPTION_STATE_MISSING");
  } else {
    expectRejection(results, "photo-consumed-nonce-replay", () => {
      const fixture = clone(valid);
      fixture.context.receiptAuthority.nonceState = "consumed";
      fixture.context.receiptAuthority.consumedAt = fixture.context.receiptAuthority.confirmedAt;
      module.validatePhotoConfirmation(fixture.event, fixture.context);
    });
  }

  if (!Object.hasOwn(valid.context.receiptAuthority, "expiresAt")) {
    recordAccepted(results, "photo-expired-receipt", "RECEIPT_EXPIRY_BINDING_MISSING");
  } else {
    expectRejection(results, "photo-expired-receipt", () => {
      const fixture = clone(valid);
      fixture.context.receiptAuthority.expiresAt = "2000-01-01T00:00:00.000Z";
      module.validatePhotoConfirmation(fixture.event, fixture.context);
    });
  }

  expectRejection(results, "photo-submitted-control-object", () => {
    const fixture = clone(valid);
    if (!Object.hasOwn(fixture.event, "approvedControls")) {
      fixture.event.approvedControls = [
        { controlId: "forged-control", controlTextSha256: typedSha256("forged"), approvalState: "approved" }
      ];
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-arbitrary-analysis-result", () => {
    const fixture = clone(valid);
    if (Object.hasOwn(fixture.event, "modelVersion")) {
      fixture.event.modelVersion = "attacker-selected-model";
      refreshLegacyPhotoDigests(module, fixture.event);
    } else {
      fixture.event.analysisResult = { status: "approved", controls: ["forged-control"] };
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-forged-additional-control", () => {
    const fixture = clone(valid);
    if (Array.isArray(fixture.event.approvedControls)) {
      fixture.event.approvedControls.push({
        controlId: "forged-control",
        controlTextSha256: typedSha256("forged-control-text"),
        approvalState: "approved"
      });
      fixture.event.acceptedControlIds.push("forged-control");
      refreshLegacyPhotoDigests(module, fixture.event);
    } else {
      fixture.event.acceptedControlIds.push("forged-control");
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-arbitrary-snapshot-digest", () => {
    const fixture = clone(valid);
    if (Object.hasOwn(fixture.event, "analysisSnapshotDigest")) {
      fixture.event.analysisSnapshotDigest = typedSha256("attacker-snapshot");
      refreshLegacyPhotoDigests(module, fixture.event);
    } else {
      fixture.event.snapshotDigest = typedSha256("attacker-snapshot");
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-arbitrary-snapshot-id", () => {
    const fixture = clone(valid);
    if (Object.hasOwn(fixture.event, "analysisId")) {
      fixture.event.analysisId = "attacker-analysis";
      refreshLegacyPhotoDigests(module, fixture.event);
    } else {
      fixture.event.snapshotId = "attacker-snapshot";
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-arbitrary-snapshot-revision", () => {
    const fixture = clone(valid);
    if (Object.hasOwn(fixture.event, "analysisRevision")) {
      fixture.event.analysisRevision += 1;
      fixture.context.currentAnalysisRevision = fixture.event.analysisRevision;
      refreshLegacyPhotoDigests(module, fixture.event);
    } else {
      fixture.event.humanReceipt.snapshotRevision += 1;
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-human-receipt-mismatch", () => {
    const fixture = clone(valid);
    if (Object.hasOwn(fixture.event, "reviewerId")) {
      fixture.event.reviewerId = "attacker-reviewer";
      refreshLegacyPhotoDigests(module, fixture.event);
    } else if (Object.hasOwn(fixture.event.humanReceipt, "actorId")) {
      fixture.event.humanReceipt.actorId = "attacker-actor";
    } else {
      fixture.event.humanReceipt.reviewerId = "attacker-reviewer";
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });

  expectRejection(results, "photo-missing-authoritative-control", () => {
    const fixture = clone(valid);
    const acceptedId = fixture.event.acceptedControlIds[0];
    const snapshot = fixture.context.photoAnalysisSnapshot;
    if (snapshot?.canonicalControlMap) {
      delete snapshot.canonicalControlMap[acceptedId];
    } else {
      fixture.context.canonicalControlMap = {};
    }
    module.validatePhotoConfirmation(fixture.event, fixture.context);
  });
}

function logsForManifest(manifest) {
  const logs = new Map();
  for (const record of manifest.runRecords ?? []) {
    logs.set(`${record.outputLogPath}#${record.outputRecordId}`, `${record.requiredMarker}\n`);
  }
  return logs;
}

function validateManifestFixture(module, manifest, spec, validationTime, logs) {
  module.validateEvidenceManifestShape(
    manifest,
    spec,
    validationTime,
    (path, recordId) => {
      const key = `${path}#${recordId}`;
      if (!logs.has(key)) throw new Error(`TEST_LOG_MISSING: ${key}`);
      return logs.get(key);
    }
  );
}

function runExecutionEvidenceAttacks(module, spec, validationTime, results) {
  if (typeof module.buildSyntheticEvidenceManifest !== "function") {
    expectRejection(results, "execution-zero-spawns-64-fabricated-records", () => {
      module.validateEvidenceManifestShape(
        { kind: "review_evidence", runRecords: Array.from({ length: 64 }, () => ({ kind: "run_record" })) },
        spec,
        validationTime
      );
    });
    expectRejection(results, "execution-marker-only-fallback", () => {
      module.validateEvidenceManifestShape({ kind: "review_evidence", runRecords: [] }, spec, validationTime);
    });
    return;
  }
  const baseline = module.buildSyntheticEvidenceManifest(spec, validationTime);
  const structured = Array.isArray(baseline.runRecords);
  const baselineLogs = logsForManifest(baseline);
  validateManifestFixture(module, clone(baseline), spec, validationTime, baselineLogs);

  expectRejection(results, "execution-zero-spawns-64-fabricated-records", () => {
    if (baseline.runRecords.length !== 64) throw new Error("FABRICATED_RECORD_COUNT_DIFFERS");
    module.validateEvidenceManifestShape(clone(baseline), spec, validationTime);
  });
  expectRejection(results, "execution-marker-only-fallback", () => {
    module.validateEvidenceManifestShape(clone(baseline), spec, validationTime);
  });

  const run = (id, mutate) => {
    expectRejection(results, id, () => {
      const manifest = clone(baseline);
      const logs = new Map(baselineLogs);
      mutate(manifest, logs, structured);
      validateManifestFixture(module, manifest, spec, validationTime, logs);
    });
  };

  run("execution-empty-log", (manifest, logs) => {
    if (structured) {
      const record = manifest.runRecords[0];
      logs.set(`${record.outputLogPath}#${record.outputRecordId}`, "");
    } else {
      manifest.validationSummary.commandLog = [];
    }
  });
  run("execution-arbitrary-log", (manifest, logs) => {
    if (structured) {
      const record = manifest.runRecords[0];
      const value = "arbitrary output without the required marker\n";
      logs.set(`${record.outputLogPath}#${record.outputRecordId}`, value);
      record.stdoutDigest = typedSha256(value);
    } else {
      manifest.validationSummary.commandLog = ["arbitrary"];
    }
  });
  run("execution-count-999", (manifest) => {
    if (structured) manifest.passCount = 999;
    else {
      manifest.validationSummary.authoringChecks = 999;
      manifest.validationSummary.unknownKeyMatrixRuns = 999;
      manifest.validationSummary.deliberateAttackRuns = 999;
    }
  });
  run("execution-empty-red-failures", (manifest) => {
    manifest.redBaseline.failures = [];
  });
  run("execution-missing-record", (manifest) => {
    if (structured) manifest.runRecords.splice(0, 1);
    else manifest.validationSummary.commandLog = ["no structured records exist"];
  });
  run("execution-duplicate-record", (manifest) => {
    if (structured) manifest.runRecords.push(clone(manifest.runRecords[0]));
    else manifest.validationSummary.commandLog.push("duplicate unstructured claim");
  });
  run("execution-wrong-args", (manifest) => {
    if (structured) manifest.runRecords[0].args = ["attacker-selected-args"];
    else manifest.validationSummary.commandLog = ["wrong args are not represented"];
  });
  run("execution-wrong-marker", (manifest) => {
    if (structured) manifest.runRecords[0].requiredMarker = "ATTACKER_MARKER=PASS";
    else manifest.validationSummary.commandLog = ["wrong marker is not represented"];
  });
  run("execution-wrong-digest", (manifest) => {
    if (structured) manifest.runRecords[0].stdoutDigest = typedSha256("wrong digest");
    else manifest.validationSummary.commandLog = ["wrong digest is not represented"];
  });
}

function runEvidenceSourceAttacks(source, results) {
  if (/function syntheticRunRecords\s*\(/u.test(source)) {
    recordAccepted(results, "execution-synthetic-run-record-builder", "SYNTHETIC_RUN_RECORD_BUILDER_PRESENT");
  } else {
    results.push({ id: "execution-synthetic-run-record-builder", rejected: true, error: "BUILDER_ABSENT" });
  }
  if (/record\.requiredMarker/u.test(source) && /effectiveLogReader/u.test(source)) {
    recordAccepted(results, "execution-fallback-marker-acceptance", "MARKER_ONLY_FALLBACK_PRESENT");
  } else {
    results.push({ id: "execution-fallback-marker-acceptance", rejected: true, error: "FALLBACK_ABSENT" });
  }
}

function runBrowserNormativeAttacks(module, spec, validationTime, root, results) {
  const expectedTokens = [
    "minTouchWidthCssPx=44",
    "minTouchHeightCssPx=44",
    "clippingCount=0",
    "scrollWidth<=clientWidth",
    "panelOverflowCount=0",
    "pageOverflowCount=0",
    "nestedTextareaPageDoubleScrollAllowed=false",
    "viewport=390x844",
    "zoomPercents=100,200",
    "themes=Day,Night",
    "editors=all-12",
    "states=all-declared",
    "owningRoot=browser_page"
  ];
  for (const token of expectedTokens) {
    const id = `browser-exact-${token.split("=")[0].replace(/[^a-zA-Z0-9-]/gu, "-")}`;
    const index = spec.browserMatrix.futureAssertions.findIndex((assertion) => assertion.includes(token));
    if (index < 0) {
      recordAccepted(results, id, `BROWSER_ASSERTION_MISSING: ${token}`);
      continue;
    }
    expectRejection(results, id, () => {
      const mutated = clone(spec);
      mutated.browserMatrix.futureAssertions[index] = mutated.browserMatrix.futureAssertions[index].replace(
        token,
        `${token}-drift`
      );
      module.validateContract(mutated, validationTime, { root });
    });
  }
}

function runLiveAuthorityAttacks(module, spec, validationTime, root, results) {
  if (
    spec.meta.currentIntegrationTarget !== EXPECTED_AUTHORITY_HEAD ||
    spec.integrationLedger.currentIntegrationTarget !== EXPECTED_AUTHORITY_HEAD ||
    spec.integrationLedger.authorityHead !== EXPECTED_AUTHORITY_HEAD
  ) {
    recordAccepted(results, "authority-stale-declared-ref", "DECLARED_AUTHORITY_HEAD_IS_STALE");
  } else {
    expectRejection(results, "authority-stale-declared-ref", () => {
      const mutated = clone(spec);
      mutated.meta.currentIntegrationTarget = mutated.meta.sourceBase;
      mutated.integrationLedger.currentIntegrationTarget = mutated.integrationLedger.sourceBase;
      mutated.integrationLedger.authorityHead = mutated.integrationLedger.sourceBase;
      module.validateContract(mutated, validationTime, { root });
    });
  }
  if (typeof module.resolveLiveAuthorityRef !== "function") {
    recordAccepted(results, "authority-live-resolver-required", "LIVE_AUTHORITY_RESOLVER_MISSING");
  } else {
    expectRejection(results, "authority-live-resolver-required", () => {
      const resolved = module.resolveLiveAuthorityRef(root);
      if (resolved !== EXPECTED_AUTHORITY_HEAD) {
        throw new Error(`AUTHORITY_REF: expected ${EXPECTED_AUTHORITY_HEAD}, received ${resolved}`);
      }
    });
    const last = results.at(-1);
    if (last?.id === "authority-live-resolver-required" && last.rejected) {
      last.rejected = false;
      last.error = "VALID_RESOLUTION_WAS_TREATED_AS_REJECTION";
    } else if (last?.id === "authority-live-resolver-required") {
      last.rejected = true;
      last.error = "LIVE_RESOLUTION_MATCHED";
    }
  }
  expectRejection(results, "authority-injected-stale-head", () => {
    module.validateContract(clone(spec), validationTime, { root, authorityHead: spec.meta.sourceBase });
  });
}

function evidenceRole(spec, sourceClass) {
  const role = spec.evidenceContract.roles.find((entry) => entry.sourceClass === sourceClass);
  if (!role) throw new Error(`Missing evidence role: ${sourceClass}`);
  return role;
}

function photoField(spec, name) {
  const field = spec.photoConfirmation.eventSchema.fields.find((entry) => entry.name === name);
  if (!field) throw new Error(`Missing photo field: ${name}`);
  return field;
}

function runNamedNormativeAttacks(module, spec, validationTime, results) {
  const run = (id, mutate) => {
    expectRejection(results, id, () => {
      const mutated = clone(spec);
      mutate(mutated);
      module.validateContract(mutated, validationTime);
    });
  };
  run("normative-primary-action-drift", (mutated) => {
    mutated.documents[0].primaryAction = "Attacker selected action";
  });
  run("normative-primary-action-duplicate", (mutated) => {
    mutated.documents[1].primaryAction = mutated.documents[0].primaryAction;
  });
  run("normative-forbidden-surface-set-drift", (mutated) => {
    mutated.productContract.forbiddenDefaultSurfaces[0] = "attacker surface";
  });
  run("normative-kosha-direct-eligibility", (mutated) => {
    evidenceRole(mutated, "kosha_guidance").directEligibility = false;
  });
  run("normative-law-can-supply-control", (mutated) => {
    evidenceRole(mutated, "law").canSupplyControl = true;
  });
  run("normative-photo-required-on", (mutated) => {
    photoField(mutated, mutated.photoConfirmation.eventSchema.fields[0].name).requiredOn = "attacker-selected";
  });
  run("normative-primary-experience", (mutated) => {
    mutated.productContract.primaryExperience = "attacker-selected";
  });
  run("normative-evidence-rule", (mutated) => {
    evidenceRole(mutated, "kosha_guidance").rule = "attacker-selected";
  });
  run("normative-photo-privacy-rule", (mutated) => {
    mutated.photoConfirmation.privacyRule = "attacker-selected";
  });
}

function scalarMutation(value) {
  if (typeof value === "string") return `${value}__MUTATED`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  if (value === null) return "__MUTATED_NULL";
  throw new Error(`Unsupported scalar mutation: ${typeof value}`);
}

function collectScalarMutationPaths(value, path = [], output = []) {
  if (Array.isArray(value)) {
    if (value.length === 0) output.push({ path, emptyArray: true });
    value.forEach((entry, index) => collectScalarMutationPaths(entry, [...path, index], output));
    return output;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const joined = [...path, key].join(".");
      if (joined === "schemaClosure.objectGraphSha256" || joined === "schemaClosure.normativeContractSha256") continue;
      collectScalarMutationPaths(entry, [...path, key], output);
    }
    return output;
  }
  output.push({ path, emptyArray: false });
  return output;
}

function mutateAtPath(root, mutation) {
  let owner = root;
  for (let index = 0; index < mutation.path.length - 1; index += 1) {
    owner = owner[mutation.path[index]];
  }
  const key = mutation.path.at(-1);
  if (mutation.emptyArray) owner[key].push("__MUTATED_EMPTY_SET");
  else owner[key] = scalarMutation(owner[key]);
}

function runNormativeMutationMatrix(module, spec, validationTime) {
  const mutations = collectScalarMutationPaths(spec);
  const accepted = [];
  for (const mutation of mutations) {
    const mutated = clone(spec);
    mutateAtPath(mutated, mutation);
    try {
      module.validateContract(mutated, validationTime);
      accepted.push(mutation.path.join("."));
    } catch {
      // Expected fail-closed behavior.
    }
  }
  return { total: mutations.length, accepted };
}

function printResults(label, results, normativeMatrix) {
  const rejected = results.filter((result) => result.rejected);
  const accepted = results.filter((result) => !result.rejected);
  console.log(`TEST_TARGET=${label}`);
  console.log(`EXTERNAL_ATTACK_CASES=${results.length}`);
  console.log(`EXTERNAL_ATTACK_REJECTIONS=${rejected.length}`);
  console.log(`EXTERNAL_ATTACK_ACCEPTED=${accepted.length}`);
  console.log(`NORMATIVE_MUTATION_CASES=${normativeMatrix.total}`);
  console.log(`NORMATIVE_MUTATION_REJECTIONS=${normativeMatrix.total - normativeMatrix.accepted.length}`);
  console.log(`NORMATIVE_MUTATION_ACCEPTED=${normativeMatrix.accepted.length}`);
  console.log(`PRESERVED_NORMATIVE_MUTATION_TARGET=${EXPECTED_NORMATIVE_MUTATIONS}`);
  for (const result of accepted) console.log(`ACCEPTED_ATTACK=${result.id}`);
  for (const path of normativeMatrix.accepted.slice(0, 50)) console.log(`ACCEPTED_NORMATIVE_PATH=${path}`);
  if (normativeMatrix.accepted.length > 50) {
    console.log(`ACCEPTED_NORMATIVE_PATHS_OMITTED=${normativeMatrix.accepted.length - 50}`);
  }
  if (
    accepted.length > 0 ||
    normativeMatrix.accepted.length > 0 ||
    normativeMatrix.total !== EXPECTED_NORMATIVE_MUTATIONS
  ) {
    if (normativeMatrix.total !== EXPECTED_NORMATIVE_MUTATIONS) {
      console.log(`NORMATIVE_MUTATION_COUNT_DRIFT=${normativeMatrix.total}`);
    }
    console.log("CONTRACT_REMEDIATION_ATTACKS=FAIL");
    process.exitCode = 1;
  } else {
    console.log("CONTRACT_REMEDIATION_ATTACKS=PASS");
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const validator = resolve(args.validator);
  const spec = JSON.parse(readFileSync(resolve(args.spec), "utf8"));
  const validationTime = Date.parse(spec.integrationLedger.capturedAt) + 60_000;
  const results = [];
  const root = resolve(args.root);
  const { module, source, tempDirectory } = await loadInstrumentedValidator(validator);
  try {
    module.validateContract(clone(spec), validationTime, { root });
    runPhotoAuthorityAttacks(module, results);
    runExecutionEvidenceAttacks(module, spec, validationTime, results);
    runEvidenceSourceAttacks(source, results);
    runBrowserNormativeAttacks(module, spec, validationTime, root, results);
    runLiveAuthorityAttacks(module, spec, validationTime, root, results);
    runNamedNormativeAttacks(module, spec, validationTime, results);
    const normativeMatrix = runNormativeMutationMatrix(module, spec, validationTime);
    printResults(args.label, results, normativeMatrix);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`TEST_HARNESS_ERROR: ${message}`);
  process.exitCode = 1;
});
