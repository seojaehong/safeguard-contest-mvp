import sha256 from "fast-sha256";

const REQUIRED_CHECK_IDS = Object.freeze([
  "sif_source_count_still_matches",
  "embedding_table_ready",
  "uploaded_row_count_matches_corpus",
  "match_rpc_ready",
  "embedding_samples_have_metadata",
  "vector_feature_flag_allowed",
]);

function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function safeEqual(left, right) {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function sha256Hex(value) {
  return Array.from(
    sha256(new TextEncoder().encode(value)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function inspectSifVectorVerificationReceipt(reportValue, expected = {}) {
  const report = asRecord(reportValue);
  const embeddings = asRecord(report.safetyReferenceEmbeddings);
  const matchRpc = asRecord(report.matchRpc);
  const checks = Array.isArray(report.checks)
    ? report.checks.map(asRecord).map((check) => ({
      id: typeof check.id === "string" ? check.id : "",
      passed: check.passed === true,
    })).sort((left, right) => left.id.localeCompare(right.id))
    : [];
  const failedCheckIds = Array.isArray(report.failedCheckIds)
    ? report.failedCheckIds.filter((value) => typeof value === "string").sort()
    : [];
  const expectedCorpusCount = Number(report.expectedCorpusCount);
  const dimensions = Number(report.dimensions);
  const model = typeof report.model === "string" ? report.model : "";
  const fixedCorpusHash = typeof report.fixedCorpusHash === "string" ? report.fixedCorpusHash : "";
  const uploadedCount = Number(embeddings.count);
  const rpcRowCount = Number(matchRpc.rowCount);
  const rpcModel = typeof matchRpc.model === "string" ? matchRpc.model : "";
  const checkMap = new Map(checks.map((check) => [check.id, check.passed]));
  const canonical = {
    scope: report.scope,
    configured: report.configured === true,
    ok: report.ok === true,
    status: report.status,
    dbMutationPerformed: report.dbMutationPerformed === true,
    model,
    dimensions,
    expectedCorpusCount,
    fixedCorpusHash,
    uploadedCount,
    tableReady: embeddings.ok === true,
    rpcReady: matchRpc.ok === true,
    rpcRowCount,
    rpcModel,
    failedCheckIds,
    checks,
  };
  const fingerprint = sha256Hex(JSON.stringify(canonical));
  const evidenceValid = canonical.scope === "sif_embedding_post_migration_verify"
    && canonical.configured
    && canonical.ok
    && canonical.status === "ready"
    && !canonical.dbMutationPerformed
    && Number.isInteger(expectedCorpusCount)
    && expectedCorpusCount > 0
    && uploadedCount === expectedCorpusCount
    && canonical.tableReady
    && canonical.rpcReady
    && Number.isInteger(rpcRowCount)
    && rpcRowCount > 0
    && /^[a-f0-9]{64}$/u.test(fixedCorpusHash)
    && failedCheckIds.length === 0
    && REQUIRED_CHECK_IDS.every((id) => checkMap.get(id) === true)
    && (!expected.model || model === expected.model)
    && (!expected.dimensions || dimensions === expected.dimensions)
    && rpcModel === model;

  return { evidenceValid, fingerprint };
}

export function createSifVectorRuntimeEvidence(reportValue, expected = {}) {
  const report = asRecord(reportValue);
  const inspection = inspectSifVectorVerificationReceipt(report, expected);
  return {
    schema: "safeclaw-sif-vector-runtime-verification/v1",
    model: report.model,
    dimensions: report.dimensions,
    expectedCorpusCount: report.expectedCorpusCount,
    fixedCorpusHash: report.fixedCorpusHash,
    verificationReceipt: {
      algorithm: "sha256",
      fingerprint: inspection.fingerprint,
      machineVerified: inspection.evidenceValid,
    },
  };
}

export function evaluateSifVectorRuntimeReceipt(reportValue, expected) {
  const report = asRecord(reportValue);
  const declaredReceipt = asRecord(report.verificationReceipt);
  const isRuntimeEvidence = report.schema === "safeclaw-sif-vector-runtime-verification/v1";
  const inspection = isRuntimeEvidence
    ? {
      evidenceValid: declaredReceipt.machineVerified === true
        && report.model === expected.model
        && report.dimensions === expected.dimensions
        && Number.isInteger(report.expectedCorpusCount)
        && Number(report.expectedCorpusCount) > 0
        && typeof report.fixedCorpusHash === "string"
        && /^[a-f0-9]{64}$/u.test(report.fixedCorpusHash),
      fingerprint: typeof declaredReceipt.fingerprint === "string"
        ? declaredReceipt.fingerprint.toLowerCase()
        : "",
    }
    : inspectSifVectorVerificationReceipt(report, expected);
  const declaredFingerprint = typeof declaredReceipt.fingerprint === "string"
    ? declaredReceipt.fingerprint.toLowerCase()
    : "";
  const expectedFingerprint = typeof expected.fingerprint === "string"
    ? expected.fingerprint.trim().toLowerCase()
    : "";
  const declaredValid = declaredReceipt.algorithm === "sha256"
    && declaredReceipt.machineVerified === true
    && (isRuntimeEvidence || safeEqual(declaredFingerprint, inspection.fingerprint));
  const environmentValid = safeEqual(expectedFingerprint, inspection.fingerprint);

  return {
    ok: inspection.evidenceValid && declaredValid && environmentValid,
    evidenceValid: inspection.evidenceValid,
    declaredValid,
    environmentValid,
    fingerprint: inspection.fingerprint,
    reason: !inspection.evidenceValid
      ? "verification-evidence-invalid"
      : !declaredValid
        ? "verification-receipt-invalid"
        : !environmentValid
          ? "verification-fingerprint-missing-or-mismatched"
          : "verified",
  };
}
