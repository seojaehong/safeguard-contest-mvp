#!/usr/bin/env node
// @ts-check

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BASE_URL = "https://www.safeclaw.kr";
const OUT_DIR = path.join("evaluation", "share-public-session-storage-readiness-2026-07-23");
const APPROVAL_DIR = path.join("evaluation", "share-public-session-storage-approval-2026-07-23");
const SAFE_MISSING_SESSION_ID = "00000000-0000-4000-8000-000000000000";
const SAFE_MISSING_WORKER_ID = "00000000-0000-4000-8000-000000000001";

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {string} filePath
 */
function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/**
 * @param {unknown} error
 */
function serializeSupabaseError(error) {
  if (!error || typeof error !== "object") return null;
  const value = /** @type {{ code?: unknown; message?: unknown; details?: unknown; hint?: unknown }} */ (error);
  return {
    code: typeof value.code === "string" ? value.code : null,
    message: typeof value.message === "string" ? value.message : String(value.message || error),
    details: typeof value.details === "string" ? value.details : null,
    hint: typeof value.hint === "string" ? value.hint : null,
  };
}

async function readBuildInfo(baseUrl) {
  try {
    const url = new URL("/api/build-info", baseUrl);
    url.searchParams.set("codexCacheBust", `share-storage-${Date.now()}`);
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      body,
      commitSha: typeof body?.commitSha === "string" ? body.commitSha : "",
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: {},
      commitSha: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * @param {string} baseUrl
 */
async function probeMissingPublicShareGet(baseUrl) {
  const url = new URL(`/api/share-sessions/${SAFE_MISSING_SESSION_ID}`, baseUrl);
  url.searchParams.set("workerId", SAFE_MISSING_WORKER_ID);
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  return {
    method: "GET",
    path: `${url.pathname}?workerId=${SAFE_MISSING_WORKER_ID}`,
    status: response.status,
    message: typeof body?.message === "string" ? body.message : "",
    mutationPerformed: false,
  };
}

async function main() {
  const baseUrl = process.env.SAFECLAW_BASE_URL || DEFAULT_BASE_URL;
  const checkedAt = new Date().toISOString();
  const sourceHead = gitHead();
  const buildInfo = await readBuildInfo(baseUrl);
  const productionCommit = buildInfo.commitSha;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRole) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only storage readiness probing.");
  }

  const livePublicApiProbe = await probeMissingPublicShareGet(baseUrl);
  const client = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const workpacks = await client.from("workpacks").select("id").limit(1);
  const fullSelect = await client
    .from("workpack_share_sessions")
    .select("id,share_scope,recipients_snapshot,access_policy,status,expires_at,created_at,updated_at")
    .limit(1);
  const legacySelect = await client
    .from("workpack_share_sessions")
    .select("id,workpack_id,recipients_snapshot,status,expires_at")
    .limit(1);
  const shareSessionsReadable = !fullSelect.error || !legacySelect.error;
  const shareSessionsError = serializeSupabaseError(fullSelect.error);
  const readinessVerdict = shareSessionsReadable
    ? "PASS_PUBLIC_SHARE_SESSION_STORAGE_READABLE_NO_MUTATION_EXACT_SESSION_MISSING"
    : "RED_PUBLIC_SHARE_SESSION_TABLE_MISSING_FROM_SCHEMA_CACHE_NO_MUTATION";

  const readinessReport = {
    schemaVersion: "safeclaw-share-public-session-storage-readiness/v1",
    checkedAt,
    sourceHead,
    productionCommit,
    baseUrl,
    verdict: readinessVerdict,
    dbMutationPerformed: false,
    providerDispatchLiveClaimed: false,
    externalProviderCalled: false,
    credentialShape: {
      supabaseUrlPresent: Boolean(supabaseUrl),
      serviceRolePresent: Boolean(serviceRole),
      secretPrinted: false,
    },
    livePublicApiProbe,
    serviceRoleReadOnlyProbe: {
      workpacks: {
        readable: !workpacks.error,
        dataLen: workpacks.data?.length ?? null,
        error: serializeSupabaseError(workpacks.error),
      },
      workpackShareSessionsFullSelect: {
        readable: !fullSelect.error,
        dataLen: fullSelect.data?.length ?? null,
        error: serializeSupabaseError(fullSelect.error),
      },
      workpackShareSessionsLegacySelect: {
        readable: !legacySelect.error,
        dataLen: legacySelect.data?.length ?? null,
        error: serializeSupabaseError(legacySelect.error),
      },
    },
    interpretation: {
      publicShareMissingSessionShape: livePublicApiProbe.status === 404
        ? "Missing public share-session GET fails closed at 404 for the deliberately missing UUID."
        : "Missing public share-session GET did not fail closed at 404.",
      storageReadiness: shareSessionsReadable
        ? "public.workpack_share_sessions is readable through at least one read-only select path."
        : "Production Supabase/PostgREST schema cache still cannot see public.workpack_share_sessions while the same service-role client can read public.workpacks.",
      exactSavedSessionGeometry: "MISSING_EVIDENCE",
      fixtureProofAcceptedAsExactSavedSession: false,
    },
    nextActions: [
      "Do not create a share session or mutate production data without explicit approval.",
      shareSessionsReadable
        ? "Use an existing user-provided production /share/[sessionId]?workerId=... URL for exact desktop/mobile geometry, or obtain explicit approval for DB-backed share-session creation."
        : "Run an approved read-only production DB/schema migration status check for workpack_share_sessions.",
      "Keep exact saved/generated /share/[sessionId] geometry as MISSING_EVIDENCE until a concrete production URL/payload or approved safe creation flow exists.",
    ],
    forbiddenClaims: [
      "Exact saved/generated Share session geometry is proven.",
      "A production share session was created.",
      "Provider dispatch was performed.",
      "The workpack_share_sessions production DB table is confirmed ready when read-only probes still report PGRST205.",
    ],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(readinessReport, null, 2)}\n`, "utf8");
  const readinessMd = `# Share Public Session Storage Readiness

Checked at: \`${checkedAt}\`

Source HEAD: \`${sourceHead}\`

Production \`/api/build-info\`: \`${productionCommit}\`

Verdict: \`${readinessVerdict}\`

## Boundary

- DB mutation performed: \`false\`
- Provider dispatch claimed: \`false\`
- External provider called: \`false\`
- Secrets printed: \`false\`
- Exact saved/generated \`/share/[sessionId]\` geometry: \`MISSING_EVIDENCE\`

## Read-Only Findings

| Probe | Result |
|---|---|
| Live missing public share GET | \`${livePublicApiProbe.status}\`, \`${livePublicApiProbe.message}\` |
| Service-role read: \`public.workpacks\` | ${workpacks.error ? `\`${serializeSupabaseError(workpacks.error)?.code || "error"}\`` : `readable, \`dataLen=${workpacks.data?.length ?? 0}\``} |
| Service-role read: \`public.workpack_share_sessions\` full select | ${fullSelect.error ? `\`${shareSessionsError?.code || "error"}\`, ${shareSessionsError?.message || "unknown"}` : `readable, \`dataLen=${fullSelect.data?.length ?? 0}\``} |
| Service-role read: \`public.workpack_share_sessions\` legacy select | ${legacySelect.error ? `\`${serializeSupabaseError(legacySelect.error)?.code || "error"}\`, ${serializeSupabaseError(legacySelect.error)?.message || "unknown"}` : `readable, \`dataLen=${legacySelect.data?.length ?? 0}\``} |

## Interpretation

The deliberately missing public share-session GET now fails closed at \`${livePublicApiProbe.status}\`, so the previous missing-session 5xx shape is not reproduced on the current live build. However, read-only service-role probes still report \`${shareSessionsError?.code || "none"}\` for \`public.workpack_share_sessions\`, while \`public.workpacks\` remains readable.

Exact saved/generated \`/share/[sessionId]\` geometry is still \`MISSING_EVIDENCE\`: no concrete production session URL, saved session id, user-observed generated payload, or approved safe creation flow was provided.

## Next Actions

${readinessReport.nextActions.map((item) => `- ${item}`).join("\n")}

## Forbidden Claims

${readinessReport.forbiddenClaims.map((item) => `- ${item}`).join("\n")}
`;
  fs.writeFileSync(path.join(OUT_DIR, "report.md"), readinessMd, "utf8");

  const migrationPath = path.join("supabase", "migrations", "010_commercial_operations.sql");
  const migrationPathForReport = "supabase/migrations/010_commercial_operations.sql";
  const migrationSql = readUtf8(migrationPath);
  const migrationHash = crypto.createHash("sha256").update(migrationSql).digest("hex");
  const approvalVerdict = shareSessionsReadable
    ? "STORAGE_READABLE_EXACT_SHARE_SESSION_CREATION_APPROVAL_REQUIRED_NO_MUTATION"
    : "APPROVAL_REQUIRED_PUBLIC_SHARE_SESSION_STORAGE_MIGRATION_NO_MUTATION";
  const approvalReport = {
    schemaVersion: "safeclaw-share-public-session-storage-approval/v1",
    generatedAt: checkedAt,
    sourceHead,
    productionCommit,
    verdict: approvalVerdict,
    exactSavedShareSessionVerdict: "MISSING_EVIDENCE",
    storageReadinessArtifact: "evaluation/share-public-session-storage-readiness-2026-07-23/report.json",
    shareExactSessionBoundaryArtifact: "evaluation/share-exact-session-boundary-2026-07-22/report.json",
    migration: {
      path: migrationPathForReport,
      sha256: migrationHash,
      bytes: Buffer.byteLength(migrationSql, "utf8"),
      containsShareSessionStorage: migrationSql.includes("workpack_share_sessions"),
      containsReadConfirmations: migrationSql.includes("workpack_read_confirmations"),
      containsImprovementMemory: migrationSql.includes("improvement"),
      containsSifKoshaEmbeddingHooks: migrationSql.includes("embedding"),
      containsVectorExtension: migrationSql.includes("vector"),
      containsRlsPolicies: migrationSql.toLowerCase().includes("policy"),
      broadMigrationRequiresOperatorReview: true,
    },
    readinessBlocker: {
      workpackShareSessionsReadable: shareSessionsReadable,
      workpackShareSessionsErrorCode: shareSessionsError?.code || null,
      workpackShareSessionsErrorMessage: shareSessionsError?.message || null,
      postgrestSchemaCacheReady: shareSessionsReadable,
      publicShareSessionReadinessVerdict: readinessVerdict,
    },
    approvalBoundary: {
      operatorApprovalRequiredBeforeMigration: !shareSessionsReadable,
      operatorApprovalRequiredBeforeShareSessionCreation: true,
      dbMutationPerformed: false,
      schemaMutationAuthorized: false,
      schemaMutationPerformed: false,
      shareSessionCreated: false,
      shareSessionCreationWouldInsertWorkpackShareSessions: true,
      approvedSafeCreationFlowAvailable: false,
      concreteProductionShareUrlProvided: false,
      providerDispatchLiveClaimed: false,
      externalProviderCalled: false,
    },
    allowedNextStepsWithoutApproval: [
      "Keep exact saved/generated /share/[sessionId] geometry as MISSING_EVIDENCE.",
      "Measure a user-provided existing production /share/[sessionId]?workerId=... URL without creating or mutating a session.",
      "Refresh read-only live markers and no-mutation evidence.",
    ],
    blockedUntilApproval: [
      ...(shareSessionsReadable ? [] : [
        "Apply or repair public workpack_share_sessions storage in production.",
        "Refresh PostgREST schema cache after storage changes.",
      ]),
      "Create a saved/generated production share session through POST /api/workpacks/[id]/share-sessions.",
      "Promote fixture or /workspace?share generated proof to exact saved-session proof.",
    ],
    acceptanceAfterApproval: [
      ...(shareSessionsReadable ? [] : [
        "workpack_share_sessions is readable through the expected server storage path.",
      ]),
      "Missing public share-session URLs fail closed without a 5xx server-error shape.",
      "A concrete saved-exact session URL or approved created session is measured at 1440x723, 1440x900, and 390x723.",
      "Desktop saved-result geometry shows a non-mobile multi-pane workbench with no horizontal overflow.",
      "Provider dispatch and unrelated DB mutations remain unclaimed unless separately approved.",
    ],
    forbiddenClaims: [
      ...(shareSessionsReadable ? [] : ["The production DB migration has been applied."]),
      "A public share session was created by this packet.",
      "Exact saved/generated /share/[sessionId] geometry has been reproduced.",
      "Fixture or generated /workspace Share proof closes the user's exact saved-session complaint.",
      "Provider dispatch was executed.",
      "The broad commercial operations migration is safe to apply without operator review.",
    ],
  };
  fs.mkdirSync(APPROVAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(APPROVAL_DIR, "report.json"), `${JSON.stringify(approvalReport, null, 2)}\n`, "utf8");
  const approvalMd = `# Share Public Session Storage Approval Packet

- Generated: \`${checkedAt}\`
- Source HEAD: \`${sourceHead}\`
- Production \`/api/build-info\`: \`${productionCommit}\`
- Verdict: \`${approvalVerdict}\`
- Exact saved/generated \`/share/[sessionId]\`: \`MISSING_EVIDENCE\`

## Boundary

No DB mutation, schema migration, share-session creation, provider dispatch, or exact saved-session claim was performed by this packet.

The current read-only storage readiness check reports \`${shareSessionsError?.code || "none"}\` for \`public.workpack_share_sessions\` and public missing-session GET status \`${livePublicApiProbe.status}\`. Exact saved/generated session geometry remains separate from fixture/layout proof.

## Approval Scope

Candidate migration:

- Path: \`${migrationPathForReport}\`
- SHA-256: \`${migrationHash}\`
- Size: \`${Buffer.byteLength(migrationSql, "utf8")}\` bytes

This migration is broader than public share sessions. It also contains read confirmations, improvement memory tables, photo metadata, SIF/KOSHA embedding hooks, \`vector\` extension usage, and RLS policies. Operator review is required before applying or repairing production storage.

## Current Safe Options

${approvalReport.allowedNextStepsWithoutApproval.map((item) => `- ${item}`).join("\n")}

## Blocked Without Approval

${approvalReport.blockedUntilApproval.map((item) => `- ${item}`).join("\n")}

## Acceptance After Approval

${approvalReport.acceptanceAfterApproval.map((item, index) => `${index + 1}. ${item}`).join("\n")}
`;
  fs.writeFileSync(path.join(APPROVAL_DIR, "report.md"), approvalMd, "utf8");

  console.log(JSON.stringify({
    readiness: readinessVerdict,
    approval: approvalVerdict,
    sourceHead,
    productionCommit,
    publicStatus: livePublicApiProbe.status,
    shareSessionsReadable,
    shareSessionsErrorCode: shareSessionsError?.code || null,
    dbMutationPerformed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
