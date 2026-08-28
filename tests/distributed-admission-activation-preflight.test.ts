import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type ActivationReport = {
  activationPerformed: boolean;
  configurationChangeApproved: boolean;
  ephemeralRedisMutationPerformed: boolean;
  failedCheckIds: string[];
  forbiddenBeforeApproval: string[];
  mutationBoundary: { exactSavedShareVerdict: string };
  operatorApprovalRequired: boolean;
  overall: string;
  requestedChange: { requiredVariables: string[]; remoteHermesLedgerModeChangeRequested: boolean };
  secretValuesInspected: boolean;
  secretValuesRecorded: boolean;
  sharedCredentialBoundary: { remoteHermesLedgerEnabledByThisChange: boolean };
  verdict: string;
};

type ActivationModule = {
  buildDistributedAdmissionActivationPreflight: (input: { root: string }) => ActivationReport;
  renderDistributedAdmissionActivationPreflightMarkdown: (report: ActivationReport) => string;
};

async function loadModule(): Promise<ActivationModule> {
  // @ts-expect-error -- executable MJS module exposes the audited runtime API.
  return await import("../scripts/distributed_admission_activation_preflight.mjs") as ActivationModule;
}

function write(root: string, relativePath: string, value: string): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, value, "utf8");
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "safeclaw-distributed-activation-"));
  write(root, "lib/public-distributed-rate-limit.ts", [
    "if (!url || !token) return { state: \"invalid\" }",
    "parsed.protocol !== \"https:\"",
    "distributed limiter configuration is incomplete or unsafe",
    "distributed concurrency configuration is incomplete or unsafe",
    "safeclaw:public-rate:${namespace}:${digest}",
    "safeclaw:public-concurrency:${namespace}",
    "createHash(\"sha256\").update(identifier)",
    "CONCURRENCY_ACQUIRE_SCRIPT",
    "CONCURRENCY_RELEASE_SCRIPT",
  ].join("\n"));
  write(root, "lib/remote-hermes-upstash-ledger.ts", [
    "SAFECLAW_REMOTE_HERMES_LEDGER_MODE?.trim() !== \"upstash\"",
    "safeclaw:remote-hermes:v1",
  ].join("\n"));
  writeJson(root, "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_PUBLIC_SEARCH_DISTRIBUTED_CONFIGURATION_TRUTH",
    currentSourceContract: {
      productionRequiresDistributedAdmission: true,
      absentConfigurationFailsClosedBeforeProviderWork: true,
    },
    configuration: {
      requiredVariables: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      configurationState: "absent",
      productionConfigured: false,
      distributedActivationPending: true,
    },
    boundary: {
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      vectorMutationPerformed: false,
      wikiPublicationPerformed: false,
      koshaRegistryMutationPerformed: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  writeJson(root, "evaluation/launch-operations-readiness-2026-08-26/report.json", {
    verdict: "PASS_LIVE_PRODUCTION_LAUNCH_OPERATIONS_CONFIGURATION_TRUTH",
    summary: { configurationState: "absent" },
    boundaries: {
      distributedAdmissionConfigured: false,
      distributedAdmissionActivationRequired: true,
      providerDispatchReady: false,
      fullyAutomatedLaunchClaimAllowed: false,
      dbMutationPerformed: false,
      providerDispatchCalled: false,
      shareSessionCreated: false,
      exactSavedShareVerdict: "MISSING_EVIDENCE",
    },
  });
  return root;
}

describe("distributed admission activation approval preflight", () => {
  it("creates an approval-ready packet without applying secrets or runtime mutations", async () => {
    const { buildDistributedAdmissionActivationPreflight } = await loadModule();
    const report = buildDistributedAdmissionActivationPreflight({ root: createFixtureRoot() });

    expect(report.verdict).toBe("APPROVAL_REQUIRED_DISTRIBUTED_ADMISSION_ACTIVATION_NO_MUTATION");
    expect(report.overall).toBe("approval_ready_open");
    expect(report.operatorApprovalRequired).toBe(true);
    expect(report.configurationChangeApproved).toBe(false);
    expect(report.activationPerformed).toBe(false);
    expect(report.ephemeralRedisMutationPerformed).toBe(false);
    expect(report.secretValuesInspected).toBe(false);
    expect(report.secretValuesRecorded).toBe(false);
    expect(report.requestedChange.requiredVariables).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    expect(report.requestedChange.remoteHermesLedgerModeChangeRequested).toBe(false);
    expect(report.sharedCredentialBoundary.remoteHermesLedgerEnabledByThisChange).toBe(false);
    expect(report.mutationBoundary.exactSavedShareVerdict).toBe("MISSING_EVIDENCE");
    expect(report.failedCheckIds).toEqual([]);
  });

  it("fails closed when the live readiness packet claims activation is already complete", async () => {
    const { buildDistributedAdmissionActivationPreflight } = await loadModule();
    const root = createFixtureRoot();
    const reportPath = join(root, "evaluation/public-search-distributed-rate-limit-readiness-2026-08-02/report.json");
    const readiness = JSON.parse(readFileSync(reportPath, "utf8")) as {
      configuration: { configurationState: string; productionConfigured: boolean; distributedActivationPending: boolean };
    };
    readiness.configuration.configurationState = "ready";
    readiness.configuration.productionConfigured = true;
    readiness.configuration.distributedActivationPending = false;
    writeFileSync(reportPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");

    const report = buildDistributedAdmissionActivationPreflight({ root });
    expect(report.verdict).toBe("BLOCKED_DISTRIBUTED_ADMISSION_ACTIVATION_PREFLIGHT_FAILED");
    expect(report.failedCheckIds).toContain("current_production_is_fail_closed_before_provider_work");
  });

  it("fails closed when the remote Hermes ledger would be activated implicitly", async () => {
    const { buildDistributedAdmissionActivationPreflight } = await loadModule();
    const root = createFixtureRoot();
    write(root, "lib/remote-hermes-upstash-ledger.ts", "safeclaw:remote-hermes:v1\n");

    const report = buildDistributedAdmissionActivationPreflight({ root });
    expect(report.failedCheckIds).toContain("remote_hermes_ledger_requires_separate_explicit_mode");
  });

  it("renders the approval, behavioral-probe, rollback, and exact Share boundaries", async () => {
    const {
      buildDistributedAdmissionActivationPreflight,
      renderDistributedAdmissionActivationPreflightMarkdown,
    } = await loadModule();
    const report = buildDistributedAdmissionActivationPreflight({ root: createFixtureRoot() });
    const markdown = renderDistributedAdmissionActivationPreflightMarkdown(report);

    expect(markdown).toContain("operator decision");
    expect(markdown).toContain("invalid-payload POST /api/export/pdf");
    expect(markdown).toContain("Remove both Production-scoped Upstash variables together");
    expect(markdown).toContain("Exact saved Share remains `MISSING_EVIDENCE`");
  });
});
