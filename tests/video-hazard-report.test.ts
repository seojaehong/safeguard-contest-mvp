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
  enforceMsdPhrasingInControl,
  missedScenesOf,
  resolveArticleMentions,
  splitChecklist,
  UNKNOWN_LAW_LABEL,
  validateVideoCheckInput,
  VIDEO_REPORT_DISCLAIMER
} from "@/lib/video-hazard-report";
import { readVideoBatchResponse } from "@/lib/video-hazard-response";

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

  it("catches spaced spellings the model often writes", () => {
    for (const asserted of [
      "이 작업은 근골격계 부담작업에 해당합니다.",
      "근골격계 부담 작업입니다.",
      "근골격계부담 작업으로 본다."
    ]) {
      const fixed = enforceMsdPhrasing(asserted);
      expect(fixed).toBe(`근골격계부담작업 ${MSD_POSSIBILITY_PHRASE}.`);
    }
  });

  it("keeps the action of a harness-confirmed control and removes only the assertion", () => {
    const fixed = enforceMsdPhrasingInControl("근골격계부담작업에 해당하므로 유해요인조사를 실시한다.");
    expect(fixed).toBe(`근골격계부담작업(${MSD_POSSIBILITY_PHRASE})에 해당하면 유해요인조사를 실시한다.`);
    const spaced = enforceMsdPhrasingInControl("근골격계 부담작업에 대하여 3년마다 유해요인조사를 한다.");
    expect(spaced).toContain("유해요인조사를 한다");
    expect(spaced).toContain(MSD_POSSIBILITY_PHRASE);
    expect(enforceMsdPhrasingInControl("근골격계 부담작업에 해당한다.")).toBe(`근골격계부담작업 ${MSD_POSSIBILITY_PHRASE}.`);
    expect(enforceMsdPhrasingInControl("호스를 통로 밖으로 정리한다.")).toBe("호스를 통로 밖으로 정리한다.");
  });

  it("applies the wording to row text, controls and field questions in the report", () => {
    const report = buildVideoHazardReport({
      candidates: [
        candidate({
          id: "m1",
          label: "근골격계 부담작업에 해당하는 반복 작업",
          observation: "근골격계 부담 작업입니다.",
          scene: "scene-01_00m04s.jpg",
          controls: ["근골격계부담작업에 해당하므로 유해요인조사를 실시한다."]
        }),
        candidate({
          id: "m2",
          label: "근골격계 부담작업 해당 자세",
          observation: "허리를 구부린 채 작업",
          scene: "scene-02_00m21s.jpg",
          confirmed: false
        })
      ],
      scenes: [{ name: "scene-01_00m04s.jpg", time: 4 }, { name: "scene-02_00m21s.jpg", time: 21 }],
      durationSec: 62
    });
    const visible = [
      ...report.rows.flatMap((row) => [row.hazard, row.observation, row.control]),
      ...report.fieldChecks,
      ...report.baseActions
    ];
    for (const text of visible) {
      if (/근골격계\s*부담\s*작업/u.test(text)) expect(text).toContain(MSD_POSSIBILITY_PHRASE);
    }
    expect(report.rows[0].control).toContain("유해요인조사를 실시한다");
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

  it("reads the knowledge-DB title format 「제N조 제목」 without brackets", () => {
    // data/ 지식 항목의 실제 제목 형식
    const [confined] = extractArticleMentions("제619조 밀폐공간 작업 프로그램의 수립ㆍ시행");
    // 법령명이 없는 제목은 법령명을 지어내지 않고 「법령명 확인 안 됨」을 붙인다(제21조만으로는 법령을 알 수 없다).
    expect(confined).toMatchObject({ citation: `${UNKNOWN_LAW_LABEL} 제619조`, lawName: "", heading: "밀폐공간 작업 프로그램의 수립ㆍ시행" });
    expect(isArticleRelevantToCandidate(confined, "맨홀 밀폐공간에 작업자가 들어가려 함")).toBe(true);
    expect(isArticleRelevantToCandidate(confined, hoseText)).toBe(false);
  });

  it("attaches the lighting article when the scene actually points at darkness", () => {
    const [lighting] = extractArticleMentions(LIGHTING_ARTICLE.title);
    expect(isArticleRelevantToCandidate(lighting, "통로가 어두워 발밑이 잘 보이지 않음")).toBe(true);
  });

  it("does not read the topic from the surrounding sentence of a mid-sentence article", () => {
    const excerpt = "통로에 호스가 놓여 걸려 넘어질 위험과 어두운 조명이 함께 있으면 안전보건규칙 제21조에 따라 조치한다.";
    const [mention] = extractArticleMentions(excerpt);
    expect(mention).toMatchObject({ citation: "산업안전보건기준에 관한 규칙 제21조", heading: "" });
    expect(isArticleRelevantToCandidate(mention, "호스 걸림 좁은 통로")).toBe(false);
  });

  it("borrows the heading of the same article from a sibling mention, then filters by it", () => {
    const mentions = resolveArticleMentions([
      ...extractArticleMentions("제21조 통로의 조명"),
      ...extractArticleMentions("통로에 호스가 놓여 걸리면 안전보건규칙 제21조에 따라 조치한다.")
    ]);
    // 법령명 없는 DB 제목은 같은 조 번호에 보이는 법령명 하나로 채워져 한 항목이 된다.
    expect(new Set(mentions.map((mention) => mention.citation))).toEqual(new Set(["산업안전보건기준에 관한 규칙 제21조"]));
    expect(mentions.every((mention) => mention.heading === "통로의 조명")).toBe(true);
    expect(mentions.some((mention) => isArticleRelevantToCandidate(mention, "호스 걸림 좁은 통로"))).toBe(false);
    expect(isArticleRelevantToCandidate(mentions[1], "통로가 어두워 발밑이 잘 보이지 않음")).toBe(true);
  });

  it("does not guess the law name when the same article number appears under two laws", () => {
    const mentions = resolveArticleMentions([
      ...extractArticleMentions("제21조 통로의 조명"),
      ...extractArticleMentions("산업안전보건법 제21조(안전관리전문기관 등)"),
      ...extractArticleMentions("산업안전보건기준에 관한 규칙 제21조(통로의 조명)")
    ]);
    expect(mentions[0].citation).toBe(`${UNKNOWN_LAW_LABEL} 제21조`);
  });

  it("pairs a bare article with the nearest preceding law name, not the first one in the text", () => {
    const mentions = extractArticleMentions("산업안전보건법 제38조에 따른 조치로 산업안전보건기준에 관한 규칙에서 정한 제3조를 지킨다.");
    expect(mentions.map((mention) => mention.citation)).toEqual([
      "산업안전보건법 제38조",
      "산업안전보건기준에 관한 규칙 제3조"
    ]);
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
    expect(empty.missedScenes).toEqual([]);
    expect(empty.flowOpinion).toContain("위험 후보를 찾지 못했습니다");
  });

  it("names scenes that were sent but not analyzed (partial) instead of reading as a clean result", () => {
    const missedScenes = missedScenesOf([
      { name: "scene-01_00m04s.jpg", status: "analyzed" },
      { name: "scene-03_00m47s.jpg", status: "failed" },
      { name: "scene-02_00m21s.jpg", status: "rejected" }
    ], scenes);
    expect(missedScenes.map((scene) => scene.timeLabel)).toEqual(["0:21", "0:47"]);
    const partial = buildVideoHazardReport({ candidates: [], scenes, durationSec: 62, missedScenes });
    expect(partial.flowOpinion).toContain("그중 1개만 점검했습니다");
    expect(partial.flowOpinion).toContain("0:21, 0:47 장면은 점검하지 못했습니다");
    expect(partial.flowOpinion).not.toContain("고른 장면에서 위험 후보를 찾지 못했습니다");
    const merged = mergeVideoHazardReports([report, partial], { sceneCount: 3, durationSec: 62 });
    expect(merged.missedScenes.map((scene) => scene.timeLabel)).toEqual(["0:21", "0:47"]);
    expect(merged.flowOpinion).toContain("점검하지 못했습니다");
  });
});

describe("batch response reading (screen side)", () => {
  const goodReport = buildVideoHazardReport({ candidates: [], scenes: [{ name: "a.jpg", time: 1 }], durationSec: 10 });

  it("refuses failed or unconfigured responses even when they carry a report-shaped body", () => {
    for (const [status, body] of [
      [200, { ok: false, code: "VIDEO_SCENE_ANALYSIS_FAILED", report: goodReport, message: "장면 사진 점검을 완료하지 못했습니다." }],
      [502, { ok: false, code: "VIDEO_SCENE_ANALYSIS_FAILED", message: "장면 사진 점검을 완료하지 못했습니다." }],
      [503, { ok: false, code: "VIDEO_SCENE_ANALYSIS_UNCONFIGURED", message: "사진 분석 제공자 설정이 안 되어 장면을 점검하지 못했습니다." }],
      [500, "not json"]
    ] as const) {
      const result = readVideoBatchResponse(status, body);
      expect(result.ok).toBe(false);
    }
    const unconfigured = readVideoBatchResponse(503, { ok: false, message: "사진 분석 제공자 설정이 안 되어 장면을 점검하지 못했습니다." });
    expect(unconfigured).toEqual({ ok: false, message: "사진 분석 제공자 설정이 안 되어 장면을 점검하지 못했습니다." });
  });

  it("accepts a successful response and fills missedScenes for older payloads", () => {
    const { missedScenes: _omit, ...legacy } = goodReport;
    const result = readVideoBatchResponse(200, { ok: true, report: legacy });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.missedScenes).toEqual([]);
  });
});
