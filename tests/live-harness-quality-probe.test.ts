import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- the executable MJS module exposes a runtime API tested here.
import * as rawProbeModule from "../scripts/live_harness_quality_probe.mjs";

type ProbeContract = {
  id: string;
  state: "pass" | "fail";
  summary: string;
  evidence: string[];
  flags?: Array<{ kind: string; value: string; source: string }>;
};

type ProbeEvaluation = {
  verdict: "pass" | "fail";
  contracts: ProbeContract[];
};

type ProbeContext = {
  requestedMode: "enhanced";
  request: {
    method: "POST";
    path: string;
    body: Record<string, unknown>;
  };
  transport: {
    ok: boolean;
    status: number;
  };
  operations: Array<{
    method: string;
    path: string;
    mutatesDb: boolean;
  }>;
};

type ProbeModule = {
  CANONICAL_SCENARIO: {
    id: string;
    question: string;
    aiMode: "enhanced";
  };
  evaluateHarnessResponse: (response: unknown, context: ProbeContext) => ProbeEvaluation;
  renderMarkdownEvidence: (report: unknown) => string;
};

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/live_harness_quality_probe.mjs");

const {
  CANONICAL_SCENARIO,
  evaluateHarnessResponse,
  renderMarkdownEvidence,
} = rawProbeModule as unknown as ProbeModule;

function buildGoodFixture() {
  const packet = {
    mode: "db_harness_first",
    question: CANONICAL_SCENARIO.question,
    directEvidence: [
      {
        id: "kosha-exterior-work",
        title: "건물 외벽 작업 추락 예방",
        item_type: "guide",
        evidence_role: "direct",
        controls: ["작업발판 안전난간과 안전대 부착설비 확인"],
      },
      {
        id: "kosha-paint-fire",
        title: "B-E-17-2026 도장 공정 화재·폭발 예방",
        item_type: "guide",
        evidence_role: "direct",
        controls: ["도료·유기용제 취급 구역 환기", "점화원 통제 및 소화기 비치"],
      },
    ],
    sifCases: [{
      id: "sif-forklift-traffic",
      title: "지게차와 보행자 충돌 재해사례",
      item_type: "sif-case",
      evidence_role: "direct",
      controls: ["지게차 동선과 보행 동선 분리 및 신호수 배치"],
    }],
    supportingEvidence: [{
      id: "kosha-wind-stop",
      title: "강풍 시 고소작업 중지 기준",
      item_type: "guide",
      evidence_role: "supporting",
      controls: ["풍속 확인 후 강풍 기준 초과 시 작업중지"],
    }],
    ontologyChecklist: {
      status: "ready",
      missing: [],
    },
    generationContract: {
      llmRole: "naturalize_only",
      llmOutputScope: "rewrite_fixed_evidence_only",
      evidenceAuthority: "db_harness",
      providerRetryScope: "naturalization_retry_only",
      fallbackChainAllowed: false,
      genericProseSubstitutionAllowed: false,
      missingEvidencePolicy: "surface_review_required",
    },
  };

  const riskAssessmentRows = [
    {
      hazard: "이동식 비계 작업발판 외측 추락",
      currentControls: "작업발판과 안전난간 상태 확인",
      additionalControls: "안전대 부착설비 확인 후 작업",
      evidenceRefs: ["kosha-exterior-work"],
    },
    {
      hazard: "이동식 비계 전도",
      currentControls: "바퀴 잠금과 수평 상태 확인",
      additionalControls: "아웃트리거 설치 후 비계 고정",
      evidenceRefs: ["kosha-exterior-work"],
    },
    {
      hazard: "강풍 중 비계 전도와 추락",
      currentControls: "작업 전 풍속 확인",
      additionalControls: "강풍 기준 초과 시 작업중지 및 철수",
      evidenceRefs: ["kosha-wind-stop"],
    },
    {
      hazard: "지게차와 보행자 충돌",
      currentControls: "지게차 동선과 작업자 통행 동선 확인",
      additionalControls: "보행 동선 분리와 신호수 배치",
      evidenceRefs: ["sif-forklift-traffic"],
    },
    {
      hazard: "도료·유기용제 증기 점화에 의한 화재·폭발",
      currentControls: "도장 구역 국소배기·전체환기 실시",
      additionalControls: "화기·스파크 점화원 통제 및 소화기 비치",
      evidenceRefs: ["kosha-paint-fire"],
    },
  ];

  const tbmRiskLinks = riskAssessmentRows.map((row, riskRowIndex) => ({
    riskRowIndex,
    hazard: row.hazard,
    control: row.additionalControls,
    confirmQuestion: `${row.hazard} 통제조치를 확인했습니까?`,
    verification: "작업반장 현장 확인",
    evidenceRefs: row.evidenceRefs,
  }));

  return {
    question: CANONICAL_SCENARIO.question,
    generationMode: "enhanced",
    dbHarness: {
      packet,
      summary: {
        directEvidence: 2,
        sifCases: 1,
        supportingEvidence: 1,
        missingEvidence: [],
        documentCoverage: [],
        ontologyStatus: "ready",
      },
    },
    generationEvidence: {
      version: "safeclaw-generation-evidence/v1",
      algorithm: "HMAC-SHA256",
      signature: "fixture-signature",
      snapshot: {
        question: CANONICAL_SCENARIO.question,
        dbHarnessPacket: packet,
        responseContentDigest: "sha256:fixture-digest",
        generatedAt: "2026-07-10T00:00:00.000Z",
      },
    },
    structured: {
      riskAssessmentRows,
      tbmRiskLinks,
      riskAssessmentValidation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    },
    qualityContract: {
      overall: "ready",
      ontology: { status: "ready", detail: "온톨로지 안전조치 확인 완료" },
      evidence: { status: "ready" },
      structured: { status: "ready" },
      dbHarness: { status: "ready" },
    },
    ontologyQa: {
      result: {
        reviewable: true,
        verdict: "통과",
        missing: { controls: [] },
      },
    },
  };
}

function buildContext(path = "/api/ask", mutatesDb = false): ProbeContext {
  return {
    requestedMode: "enhanced",
    request: {
      method: "POST",
      path,
      body: {
        question: CANONICAL_SCENARIO.question,
        aiMode: "enhanced",
      },
    },
    transport: {
      ok: true,
      status: 200,
    },
    operations: [{ method: "POST", path, mutatesDb }],
  };
}

function createTempEvaluationDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "live-harness-quality-probe-"));
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function removeDirectoryIfPresent(targetPath: string) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

describe("live harness quality probe evaluator", () => {
  it("passes canonical evidence and pinpoints every bad-fixture contract", () => {
    const goodResponse = buildGoodFixture();
    const good = evaluateHarnessResponse(goodResponse, buildContext());
    const expectedContractIds = [
      "api_response",
      "enhanced_mode",
      "generation_evidence_sealed",
      "db_harness_first",
      "evidence_sets_present",
      "evidence_labels_clean",
      "structured_risk_tbm_links",
      "risk_control_fields_distinct",
      "scenario_controls_present",
      "irrelevant_controls_absent",
      "quality_state_ready",
      "ontology_state_ready",
      "no_db_mutation",
    ];

    expect(good.verdict).toBe("pass");
    expect(good.contracts.map((contract) => contract.id)).toEqual(expectedContractIds);
    expect(good.contracts.every((contract) => contract.state === "pass")).toBe(true);

    const missingPaintResponse = {
      ...goodResponse,
      structured: {
        ...goodResponse.structured,
        riskAssessmentRows: goodResponse.structured.riskAssessmentRows.filter(
          (row) => !row.evidenceRefs.includes("kosha-paint-fire"),
        ),
        tbmRiskLinks: goodResponse.structured.tbmRiskLinks.filter(
          (link) => !link.evidenceRefs.includes("kosha-paint-fire"),
        ),
      },
    };
    const missingPaint = evaluateHarnessResponse(missingPaintResponse, buildContext());
    const scenarioContract = missingPaint.contracts.find((contract) => contract.id === "scenario_controls_present");
    expect(scenarioContract?.state).toBe("fail");
    expect(scenarioContract?.evidence).toContain("paint_fire: missing");

    const provenanceSummaryResponse = {
      ...goodResponse,
      dbHarness: {
        ...goodResponse.dbHarness,
        packet: {
          ...goodResponse.dbHarness.packet,
          supportingEvidence: [
            ...goodResponse.dbHarness.packet.supportingEvidence,
            {
              id: "historical-source-summary",
              title: "외벽 작업 과거 자료",
              summary: "원문 사고 설명에는 정비 전 잠금표지와 비상정지장치라는 표현이 포함되어 있다.",
              item_type: "source",
              evidence_role: "supporting",
              controls: ["외벽 작업구역 하부 출입통제"],
            },
          ],
        },
      },
    };
    const provenanceSummary = evaluateHarnessResponse(provenanceSummaryResponse, buildContext());
    expect(
      provenanceSummary.contracts.find((contract) => contract.id === "irrelevant_controls_absent")?.state,
    ).toBe("pass");

    const goodPacket = goodResponse.dbHarness.packet;
    const badPacket = {
      ...goodPacket,
      mode: "llm_first",
      directEvidence: [{
        id: "be-20-electrostatic",
        title: "B-E-20-2026 B-E-20-2026 정전도장기",
        item_type: "guide",
        evidence_role: "direct",
        controls: ["정전도장기 접지와 정전기 제거"],
      }],
      sifCases: [],
      supportingEvidence: [],
      ontologyChecklist: {
        status: "review_required",
        missing: ["추락", "강풍", "지게차 동선"],
      },
      generationContract: {
        ...goodPacket.generationContract,
        evidenceAuthority: "llm",
        fallbackChainAllowed: true,
      },
    };
    const badResponse = {
      ...goodResponse,
      generationMode: "template",
      dbHarness: {
        ...goodResponse.dbHarness,
        packet: badPacket,
      },
      generationEvidence: undefined,
      generationEvidenceError: { code: "secret_unconfigured" },
      structured: {
        riskAssessmentRows: [{
          hazard: "외벽 도장 작업",
          currentControls: "가동부 방호덮개와 비상정지장치 확인",
          additionalControls: "가동부 방호덮개와 비상정지장치 확인",
          evidenceRefs: ["be-20-electrostatic"],
        }],
        tbmRiskLinks: [],
        riskAssessmentValidation: {
          ok: false,
          issueCount: 1,
          issues: [{ field: "row", message: "fixture failure" }],
        },
      },
      qualityContract: {
        overall: "blocked",
        ontology: { status: "blocked", detail: "통제 누락" },
        evidence: { status: "blocked" },
        structured: { status: "blocked" },
        dbHarness: { status: "blocked" },
      },
      ontologyQa: {
        result: {
          reviewable: true,
          verdict: "미흡",
          missing: { controls: ["추락", "강풍", "지게차 동선"] },
        },
      },
    };
    const badContext = buildContext("/api/workpacks", true);
    badContext.transport = { ok: false, status: 500 };
    const bad = evaluateHarnessResponse(badResponse, badContext);
    const failedContracts = new Set(
      bad.contracts.filter((contract) => contract.state === "fail").map((contract) => contract.id),
    );

    expect(bad.verdict).toBe("fail");
    expect([...failedContracts]).toEqual(expectedContractIds);
    expect(
      bad.contracts
        .find((contract) => contract.id === "irrelevant_controls_absent")
        ?.flags?.map((flag) => flag.kind),
    ).toEqual(expect.arrayContaining(["machine_guard", "electrostatic_paint"]));

    const markdown = renderMarkdownEvidence({
      schemaVersion: "safeclaw-live-harness-quality-probe/v1",
      generatedAt: "2026-07-10T00:00:00.000Z",
      baseUrl: "https://www.safeclaw.kr",
      request: buildContext().request,
      transport: buildContext().transport,
      evaluation: good,
    });

    expect(markdown).toContain("Overall: PASS");
    expect(markdown).toContain("generation_evidence_sealed");
    expect(markdown).not.toMatch(/score|probability|점수|확률/i);

    const overflowEvaluation = {
      ...bad,
      contracts: bad.contracts.map((contract) => contract.id === "irrelevant_controls_absent"
        ? {
            ...contract,
            evidence: Array.from({ length: 7 }, (_, index) => `flag evidence ${index}`),
          }
        : contract),
      flags: Array.from({ length: 7 }, (_, index) => ({
        kind: "machine_guard",
        value: `fixture ${index}`,
        source: `structured.fixture[${index}]`,
      })),
    };
    const badMarkdown = renderMarkdownEvidence({
      schemaVersion: "safeclaw-live-harness-quality-probe/v1",
      generatedAt: "2026-07-10T00:00:00.000Z",
      baseUrl: "https://www.safeclaw.kr",
      request: badContext.request,
      transport: badContext.transport,
      evaluation: overflowEvaluation,
    });
    expect(badMarkdown).toContain("additional evidence in JSON");
    expect(badMarkdown).not.toMatch(/score|probability|점수|확률/i);
  });

  it("revalidates a saved api ask response from --input-json without network access", () => {
    const fixtureDir = createTempEvaluationDir();
    const outputName = `input-json-recheck-${path.basename(fixtureDir)}`;
    const inputJsonPath = path.join(fixtureDir, "api-ask-response.json");
    const outputDir = path.join(process.cwd(), "evaluation", outputName);
    try {
      fs.writeFileSync(inputJsonPath, `${JSON.stringify(buildGoodFixture(), null, 2)}\n`, "utf8");

      const stdout = execFileSync(
        process.execPath,
        [SCRIPT_PATH, "--input-json", inputJsonPath, "--output", outputName],
        { cwd: process.cwd(), encoding: "utf8" },
      );

      const summary = JSON.parse(stdout) as {
        verdict: string;
        httpStatus: number | null;
        failedContracts: string[];
        json: string;
        markdown: string;
      };
      const reportJsonPath = path.join(process.cwd(), summary.json);
      const reportMdPath = path.join(process.cwd(), summary.markdown);
      const report = JSON.parse(fs.readFileSync(reportJsonPath, "utf8")) as {
        sourceSha?: string;
        liveBuildInfo?: unknown;
        baseUrl?: string;
        inputJson?: { path?: string };
        transport: { status: number | null };
        evaluation: { verdict: string };
      };
      const markdown = fs.readFileSync(reportMdPath, "utf8");

      expect(summary).toEqual({
        verdict: "pass",
        httpStatus: 200,
        failedContracts: [],
        json: path.relative(process.cwd(), path.join(outputDir, "report.json")),
        markdown: path.relative(process.cwd(), path.join(outputDir, "report.md")),
      });
      expect(report.sourceSha).toMatch(/^[0-9a-f]{40}$/);
      expect(report.liveBuildInfo).toBeUndefined();
      expect(report.baseUrl).toBe("unavailable (input-json)");
      expect(report.inputJson?.path).toBe(inputJsonPath);
      expect(report.transport.status).toBe(200);
      expect(report.evaluation.verdict).toBe("pass");
      expect(markdown).toContain("Overall: PASS");
      expect(markdown).toContain("Source HEAD at generation:");
      expect(markdown).toContain("Live commit at generation: unavailable");
      expect(markdown).toContain("Base URL: unavailable (input-json)");
      expect(markdown).toContain("HTTP: 200");
    } finally {
      removeDirectoryIfPresent(outputDir);
      removeDirectoryIfPresent(fixtureDir);
    }
  });

  it("prints the exact CLI error when --base-url and --input-json are combined", () => {
    const inputDir = createTempEvaluationDir();
    const inputJsonPath = path.join(inputDir, "api-ask-response.json");
    try {
      fs.writeFileSync(inputJsonPath, `${JSON.stringify(buildGoodFixture(), null, 2)}\n`, "utf8");

      const result = runCli([
        "--base-url",
        "https://www.safeclaw.kr",
        "--input-json",
        inputJsonPath,
        "--output",
        "evaluation/live-harness-quality-probe-cli-error",
      ]);

      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Exactly one of --base-url or --input-json is required");
    } finally {
      removeDirectoryIfPresent(inputDir);
    }
  });
});
