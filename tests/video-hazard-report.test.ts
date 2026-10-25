import { describe, expect, it } from "vitest";

import type { HazardPhotoVisionCandidate } from "@/lib/photo-vision-analysis";
import { createPendingHazardPhotoUserDecision } from "@/lib/photo-vision-analysis-policy";
import {
  buildMsdNote,
  buildVideoHazardReport,
  classifyChecklistSentence,
  detectMsdItems,
  enforceMsdPhrasing,
  extractArticleMentions,
  isArticleRelevantToCandidate,
  mergeVideoHazardReports,
  MSD_NOTICE_ITEMS,
  MSD_POSSIBILITY_PHRASE,
  splitChecklist,
  validateVideoCheckInput,
  VIDEO_REPORT_DISCLAIMER
} from "@/lib/video-hazard-report";

const FORBIDDEN_USER_WORDS = /상담|진단|판정|노무사|확률|적중률|%/u;

function candidate(input: {
  id: string;
  label: string;
  observation: string;
  inference?: string;
  scene: string;
  confirmed?: boolean;
  controls?: string[];
  evidence?: Array<{ title: string; excerpt: string }>;
}): HazardPhotoVisionCandidate {
  const confirmed = input.confirmed ?? true;
  return {
    id: input.id,
    label: input.label,
    detail: input.observation,
    severity: "review",
    evidence: input.observation,
    reflectedDocuments: ["위험성평가표"],
    sourcePhotoNames: [input.scene],
    observation: input.observation,
    inference: input.inference || "현장 확인 필요",
    modelRole: "hazard_candidate",
    harness: {
      authority: "safeclaw-db-mcp",
      status: confirmed ? "confirmed" : "insufficient",
      evidence: (input.evidence || []).map((item, index) => ({
        sourceId: `${input.id}-ev-${index}`,
        sourceType: "safeclaw-db",
        title: item.title,
        excerpt: item.excerpt
      })),
      confirmedControls: confirmed ? (input.controls || []).map((text) => ({ text, evidenceSourceIds: [] })) : [],
      confirmedAt: confirmed ? "2026-10-25T00:00:00.000Z" : null,
      errorMessage: confirmed ? null : "근거 부족"
    },
    userDecision: createPendingHazardPhotoUserDecision(confirmed ? "confirmed" : "insufficient")
  };
}

const LIGHTING_ARTICLE = {
  title: "산업안전보건기준에 관한 규칙 제21조(통로의 조명)",
  excerpt: "사업주는 근로자가 안전하게 통행할 수 있도록 통로에 75럭스 이상의 채광 또는 조명시설을 하여야 한다."
};
const PASSAGE_ARTICLE = {
  title: "산업안전보건기준에 관한 규칙 제22조(통로의 설치)",
  excerpt: "사업주는 작업장으로 통하는 장소 또는 작업장 내에 근로자가 사용할 안전한 통로를 설치하고 항상 사용할 수 있는 상태로 유지하여야 한다."
};
const SLIP_ARTICLE = {
  title: "산업안전보건기준에 관한 규칙 제3조(전도의 방지)",
  excerpt: "사업주는 근로자가 작업장에서 넘어지거나 미끄러지는 등의 위험이 없도록 작업장 바닥 등을 안전하고 청결한 상태로 유지하여야 한다."
};

describe("rule 4 — required site/task/concern", () => {
  it("rejects missing fields with the Korean field names", () => {
    const result = validateVideoCheckInput({ site: "물류센터 B동", task: "", concern: " " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["task", "concern"]);
    expect(result.message).toContain("작업·걱정되는 점");
  });

  it("accepts and trims complete input", () => {
    const result = validateVideoCheckInput({ site: " 물류센터  B동 ", task: "호스 정리", concern: "통로 걸림" });
    expect(result).toEqual({ ok: true, value: { site: "물류센터 B동", task: "호스 정리", concern: "통로 걸림" } });
  });
});

describe("rule 1 — MSD wording", () => {
  it("keeps the notice text verbatim including the 제4호 support clause and 2-hour requirement", () => {
    expect(MSD_NOTICE_ITEMS[4]).toBe("지지되지 않은 상태이거나 임의로 자세를 바꿀 수 없는 조건에서, 하루에 총 2시간 이상 목이나 허리를 구부리거나 트는 상태에서 이루어지는 작업");
    expect(MSD_NOTICE_ITEMS[5]).toContain("하루에 총 2시간 이상");
  });

  it("maps bent-back posture to 제4호 and writes only 해당 가능성, 현장 확인 필요", () => {
    const items = detectMsdItems("작업자가 허리를 구부린 채 바닥 배관을 조인다");
    expect(items).toContain(4);
    const note = buildMsdNote(items);
    expect(note).toContain(MSD_POSSIBILITY_PHRASE);
    expect(note).toContain("지지되지 않은 상태이거나 임의로 자세를 바꿀 수 없는 조건에서");
    expect(note).toContain("2시간 이상");
    expect(note).not.toMatch(/해당한다|해당됨|해당합니다/u);
  });

  it("rewrites an asserted MSD sentence", () => {
    const fixed = enforceMsdPhrasing("이 작업은 근골격계부담작업에 해당합니다. 휴식을 준다.");
    expect(fixed).toContain(`근골격계부담작업 ${MSD_POSSIBILITY_PHRASE}`);
    expect(fixed).not.toContain("해당합니다");
    expect(fixed).toContain("휴식을 준다");
  });
});

describe("rule 2 — article matching filter", () => {
  const hoseText = "바닥에 호스가 놓여 걸림 위험, 좁은 통로";

  it("does not attach the lighting article (제21조) to hose tripping in a narrow passage", () => {
    const [lighting] = extractArticleMentions(LIGHTING_ARTICLE.title);
    expect(lighting).toMatchObject({ citation: "산업안전보건기준에 관한 규칙 제21조", heading: "통로의 조명" });
    expect(isArticleRelevantToCandidate(lighting, hoseText)).toBe(false);
  });

  it("attaches passage and slip articles to the same hazard", () => {
    const [passage] = extractArticleMentions(PASSAGE_ARTICLE.title);
    const [slip] = extractArticleMentions(SLIP_ARTICLE.title);
    expect(isArticleRelevantToCandidate(passage, hoseText)).toBe(true);
    expect(isArticleRelevantToCandidate(slip, hoseText)).toBe(true);
  });

  it("attaches the lighting article when the scene actually points at darkness", () => {
    const [lighting] = extractArticleMentions(LIGHTING_ARTICLE.title);
    expect(isArticleRelevantToCandidate(lighting, "통로가 어두워 발밑이 잘 보이지 않음")).toBe(true);
  });
});

describe("rule 3 — questions vs actions", () => {
  it("classifies endings and keeps 유지·방지 nouns as actions", () => {
    expect(classifyChecklistSentence("하루 총 2시간 이상 이어지는지")).toBe("question");
    expect(classifyChecklistSentence("설비 상태가 어떤지")).toBe("question");
    expect(classifyChecklistSentence("통로를 항상 사용할 수 있게 유지")).toBe("action");
    expect(classifyChecklistSentence("호스를 통로 밖으로 정리한다.")).toBe("action");
  });

  it("removes items that duplicate a table control", () => {
    const result = splitChecklist({
      questions: ["호스가 다시 통로에 놓이는지"],
      actions: ["호스를 통로 밖으로 정리한다.", "작업 전 통로 상태를 점검한다."],
      tableControls: ["호스를 통로 밖으로 정리한다"]
    });
    expect(result.fieldChecks).toEqual(["호스가 다시 통로에 놓이는지"]);
    expect(result.baseActions).toEqual(["작업 전 통로 상태를 점검한다."]);
  });
});

describe("video hazard report", () => {
  const scenes = [
    { name: "scene-01_00m04s.jpg", time: 4 },
    { name: "scene-02_00m21s.jpg", time: 21 },
    { name: "scene-03_00m47s.jpg", time: 47 }
  ];
  const candidates = [
    candidate({
      id: "c2",
      label: "작업 자세 부담",
      observation: "작업자가 허리를 구부린 채 바닥 배관을 조인다",
      scene: "scene-03_00m47s.jpg",
      confirmed: false
    }),
    candidate({
      id: "c1",
      label: "통로 호스 걸림",
      observation: "바닥에 호스가 놓여 걸림 위험, 좁은 통로",
      scene: "scene-01_00m04s.jpg",
      controls: ["호스를 통로 밖으로 정리한다.", "작업 전 통로 상태를 점검한다.", "호스를 통로 밖으로 정리한다"],
      evidence: [LIGHTING_ARTICLE, PASSAGE_ARTICLE, SLIP_ARTICLE]
    })
  ];

  const report = buildVideoHazardReport({ candidates, scenes, durationSec: 62 });

  it("orders rows by video time with a time label and table control", () => {
    expect(report.rows.map((row) => row.timeLabel)).toEqual(["0:04", "0:47"]);
    expect(report.rows[0]).toMatchObject({ control: "호스를 통로 밖으로 정리한다.", controlStatus: "confirmed" });
    expect(report.rows[1]).toMatchObject({ control: "현장 확인 후 정함", controlStatus: "check" });
  });

  it("filters articles per hazard (no 제21조 for the hose)", () => {
    expect(report.rows[0].articles).toEqual([
      "산업안전보건기준에 관한 규칙 제22조",
      "산업안전보건기준에 관한 규칙 제3조"
    ]);
    expect(report.articles.map((article) => article.citation)).not.toContain("산업안전보건기준에 관한 규칙 제21조");
    expect(report.articles[0]).toMatchObject({ heading: "통로의 설치", timeLabels: ["0:04"] });
  });

  it("writes MSD only as a possibility with the notice requirements", () => {
    expect(report.rows[1].msdNote).toContain(MSD_POSSIBILITY_PHRASE);
    expect(report.rows[1].msdNote).toContain("제3조 제4호");
    expect(report.flowOpinion).toContain(MSD_POSSIBILITY_PHRASE);
  });

  it("separates field questions from base actions and drops table duplicates", () => {
    expect(report.baseActions).toEqual(["작업 전 통로 상태를 점검한다."]);
    expect(report.fieldChecks).toContain("영상에 보인 자세가 하루 총 2시간 이상 이어지는지");
    expect(report.fieldChecks).toContain("0:47 장면의 「작업 자세 부담」이(가) 실제 작업 중에도 그대로인지");
    expect(report.fieldChecks.every((item) => classifyChecklistSentence(item) === "question")).toBe(true);
  });

  it("states limits, disclaimer and avoids forbidden user words and percentages", () => {
    expect(report.disclaimer).toBe(VIDEO_REPORT_DISCLAIMER);
    expect(report.disclaimer).toContain("음성");
    expect(report.limits.join(" ")).toContain("확인 안 됨");
    const visible = [
      report.flowOpinion,
      report.disclaimer,
      ...report.limits,
      ...report.fieldChecks,
      ...report.baseActions,
      ...report.rows.flatMap((row) => [row.msdNote, row.control])
    ].join(" ");
    expect(visible).not.toMatch(FORBIDDEN_USER_WORDS);
  });

  it("merges batch reports and re-applies duplicate removal", () => {
    const first = buildVideoHazardReport({ candidates: [candidates[1]], scenes: scenes.slice(0, 2), durationSec: 62 });
    const second = buildVideoHazardReport({ candidates: [candidates[0]], scenes: scenes.slice(2), durationSec: 62 });
    const merged = mergeVideoHazardReports([second, first], { sceneCount: 3, durationSec: 62 });
    expect(merged.rows.map((row) => row.timeLabel)).toEqual(["0:04", "0:47"]);
    expect(merged.flowOpinion).toContain("장면 3개");
    expect(merged.fieldChecks.filter((item) => item.startsWith("영상에 보이지 않는 설비"))).toHaveLength(1);
    expect(merged.riskScenes.map((scene) => scene.timeLabel)).toEqual(["0:04", "0:47"]);
  });

  it("says nothing was found without inventing hazards", () => {
    const empty = buildVideoHazardReport({ candidates: [], scenes, durationSec: 62 });
    expect(empty.rows).toEqual([]);
    expect(empty.flowOpinion).toContain("위험 후보를 찾지 못했습니다");
  });
});
