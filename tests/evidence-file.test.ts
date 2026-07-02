import { describe, expect, it } from "vitest";

import {
  documentKeysFromDeliverables,
  groupEvidenceByArticle,
  SMSA_ARTICLE_4_ITEMS,
  type EvidenceFileWorkpack
} from "@/lib/evidence-file";

function workpack(overrides: Partial<EvidenceFileWorkpack> = {}): EvidenceFileWorkpack {
  return {
    id: "wp-1",
    siteName: "서울 성수동 근린생활시설 현장",
    question: "외벽 도장 작업 문서팩",
    createdAt: "2026-06-01T00:00:00.000Z",
    documentKeys: ["riskAssessmentDraft"],
    reopenHref: "/documents?workpackId=wp-1",
    ...overrides
  };
}

describe("groupEvidenceByArticle", () => {
  it("returns all 9 grid items with zero counts for an empty workpack list", () => {
    const result = groupEvidenceByArticle([]);
    expect(result.gridItems).toHaveLength(9);
    expect(result.sections).toEqual([]);
    for (const item of result.gridItems) {
      expect(item.count).toBe(0);
      expect(item.latestAt).toBeNull();
    }
    expect(result.gridItems.map((item) => item.article)).toEqual(SMSA_ARTICLE_4_ITEMS.map((item) => item.article));
  });

  it("groups a workpack with multiple mapped document keys into separate article sections", () => {
    const result = groupEvidenceByArticle([
      workpack({
        documentKeys: ["riskAssessmentDraft", "emergencyResponseDraft", "tbmBriefing"]
      })
    ]);

    const articles = result.sections.map((section) => section.article).sort();
    expect(articles).toEqual([
      "중대재해처벌법 시행령 제4조 제3호",
      "중대재해처벌법 시행령 제4조 제8호"
    ].sort());

    // riskAssessmentDraft + tbmBriefing both map to 제3호, so that section has 2 documents.
    const article3 = result.sections.find((section) => section.article === "중대재해처벌법 시행령 제4조 제3호");
    expect(article3?.count).toBe(2);
    expect(article3?.documents.map((doc) => doc.documentKey).sort()).toEqual(["riskAssessmentDraft", "tbmBriefing"].sort());
  });

  it("excludes unmapped document keys (e.g. workpackSummaryDraft) from sections and grid counts", () => {
    const result = groupEvidenceByArticle([
      workpack({ documentKeys: ["workpackSummaryDraft", "workPermitDraft"] })
    ]);
    expect(result.sections).toEqual([]);
    for (const item of result.gridItems) {
      expect(item.count).toBe(0);
    }
  });

  it("attributes a multi-호 label (제3호·제5호) to both grid items", () => {
    const result = groupEvidenceByArticle([
      workpack({ documentKeys: ["safetyEducationRecordDraft"] })
    ]);

    const grid3 = result.gridItems.find((item) => item.article.endsWith("제3호"));
    const grid5 = result.gridItems.find((item) => item.article.endsWith("제5호"));
    expect(grid3?.count).toBe(1);
    expect(grid5?.count).toBe(1);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].article).toBe("중대재해처벌법 시행령 제4조 제3호·제5호");
  });

  it("sorts documents within a section by createdAt descending and picks the latest date for the section/grid", () => {
    const result = groupEvidenceByArticle([
      workpack({ id: "wp-old", createdAt: "2026-01-01T00:00:00.000Z", documentKeys: ["riskAssessmentDraft"] }),
      workpack({ id: "wp-new", createdAt: "2026-06-15T00:00:00.000Z", documentKeys: ["riskAssessmentDraft"] })
    ]);

    const section = result.sections.find((item) => item.article === "중대재해처벌법 시행령 제4조 제3호");
    expect(section?.count).toBe(2);
    expect(section?.latestAt).toBe("2026-06-15T00:00:00.000Z");
    expect(section?.documents.map((doc) => doc.workpackId)).toEqual(["wp-new", "wp-old"]);

    const grid3 = result.gridItems.find((item) => item.article.endsWith("제3호"));
    expect(grid3?.latestAt).toBe("2026-06-15T00:00:00.000Z");
    expect(grid3?.count).toBe(2);
  });

  it("orders sections by document count descending, then by first 호 number ascending", () => {
    const result = groupEvidenceByArticle([
      workpack({ id: "wp-1", documentKeys: ["emergencyResponseDraft"] }),
      workpack({ id: "wp-2", documentKeys: ["riskAssessmentDraft"] }),
      workpack({ id: "wp-3", documentKeys: ["riskAssessmentDraft"] })
    ]);

    expect(result.sections.map((section) => section.article)).toEqual([
      "중대재해처벌법 시행령 제4조 제3호",
      "중대재해처벌법 시행령 제4조 제8호"
    ]);
  });
});

describe("documentKeysFromDeliverables", () => {
  it("keeps keys with non-empty string content and drops blank/whitespace-only strings", () => {
    expect(documentKeysFromDeliverables({
      riskAssessmentDraft: "실제 내용",
      workpackSummaryDraft: "",
      tbmBriefing: "   "
    })).toEqual(["riskAssessmentDraft"]);
  });

  it("keeps keys whose value is a structured object, but drops array-valued keys", () => {
    expect(documentKeysFromDeliverables({
      workPlanStructured: { rows: [] },
      foreignWorkerLanguages: ["ko", "vi"],
      tbmQuestions: ["질문1"]
    })).toEqual(["workPlanStructured"]);
  });

  it("returns an empty array for non-object input", () => {
    expect(documentKeysFromDeliverables(null)).toEqual([]);
    expect(documentKeysFromDeliverables(undefined)).toEqual([]);
    expect(documentKeysFromDeliverables("not an object")).toEqual([]);
    expect(documentKeysFromDeliverables([1, 2, 3])).toEqual([]);
  });
});
