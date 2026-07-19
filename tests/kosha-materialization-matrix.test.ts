import { describe, expect, it } from "vitest";

import { runAsk } from "@/lib/search";
import { withNoSupabase } from "@/tests/helpers/kosha-offline-fixture";

function collectWorkpackSurface(response: Awaited<ReturnType<typeof runAsk>>): string {
  return [
    response.scenario.workSummary,
    response.riskSummary.topRisk,
    response.deliverables.riskAssessmentDraft,
    response.deliverables.tbmBriefing,
    response.deliverables.tbmLogDraft,
    response.deliverables.kakaoMessage,
    JSON.stringify(response.structured ?? {}),
  ].join("\n");
}

function collectEvidenceSurface(response: Awaited<ReturnType<typeof runAsk>>): string {
  return JSON.stringify({
    dbHarness: response.dbHarness,
    externalData: response.externalData,
    qualityContract: response.qualityContract,
    ontologyQa: response.ontologyQa,
  });
}

describe("KOSHA/SIF materialization matrix", () => {
  it("materializes exact D-C-13 exterior-wall KOSHA guidance into the generated workpack", async () => {
    const response = await withNoSupabase(() => runAsk(
      "세이프건설 서울 성수동 외벽 도장 작업. 이동식 비계와 작업발판을 사용하고 안전난간, 안전대, 강풍 위험을 반영해 위험성평가와 TBM을 만들어줘.",
      { aiMode: "enhanced" },
    ));

    const documentSurface = collectWorkpackSurface(response);
    const evidenceSurface = collectEvidenceSurface(response);

    expect(evidenceSurface).toContain("D-C-13");
    expect(response.dbHarness?.summary.directEvidence).toBeGreaterThan(0);
    expect(response.dbHarness?.summary.sifCases).toBeGreaterThan(0);
    expect(documentSurface).toMatch(/외벽|도장/);
    expect(documentSurface).toMatch(/작업발판|비계/);
    expect(documentSurface).toMatch(/안전난간|안전대|추락/);
    expect(response.qualityContract?.dbHarness.status).toBe("ready");
  }, 30_000);

  it("materializes exact D-C-7 scaffold guidance for mobile-scaffold assembly work", async () => {
    const response = await withNoSupabase(() => runAsk(
      "이동식비계 조립작업. 작업자 4명, 바퀴 고정과 아웃트리거, 승강통로, 추락 위험을 반영해 위험성평가와 TBM을 만들어줘.",
      { aiMode: "enhanced" },
    ));

    const documentSurface = collectWorkpackSurface(response);
    const evidenceSurface = collectEvidenceSurface(response);

    expect(evidenceSurface).toContain("D-C-7");
    expect(response.dbHarness?.summary.directEvidence).toBeGreaterThan(0);
    expect(documentSurface).toMatch(/이동식비계|비계/);
    expect(documentSurface).toMatch(/바퀴|아웃트리거|승강|추락/);
    expect(response.qualityContract?.dbHarness.status).toBe("ready");
  }, 30_000);

  it("materializes exact B-E-10 electrical guidance into the generated workpack", async () => {
    const response = await runAsk(
      "세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 작업자 3명, 절연보호구와 검전 필요. 위험성평가와 TBM을 만들어줘.",
      { aiMode: "enhanced" },
    );

    const documentSurface = collectWorkpackSurface(response);
    const evidenceSurface = collectEvidenceSurface(response);

    expect(evidenceSurface).toContain("B-E-10");
    expect(response.scenario.companyType).toBe("전기설비 점검");
    expect(documentSurface).toContain("정전전로");
    expect(documentSurface).toContain("배전반");
    expect(documentSurface).toContain("검전");
    expect(documentSurface).toContain("절연보호구");
    expect(`${JSON.stringify(response.structured ?? {})}\n${documentSurface}`).toMatch(/감전|전원 차단|잠금표지|무전압|절연/);
    expect(response.qualityContract?.dbHarness.status).toBe("ready");
  }, 30_000);
});
