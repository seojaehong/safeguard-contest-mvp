import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  accidentTypeLabel,
  evidenceRefsForDisplay,
  fourMLabel,
  riskLevelLabel,
  verificationStatusLabel
} from "@/lib/document-display-labels";
import {
  findUserOutputLeaks,
  gateAskResponseUserOutput,
  gateExportPayload,
  gateUserOutputCell,
  gateUserOutputText
} from "@/lib/user-output-gate";
import { findInternalCodeLeaks } from "../scripts/prod_ask_smoke.mjs";

// 운영 /api/ask full 응답 4건(프레스·굴착·정화조·폭염) + 수정 뒤 재수집 1건.
// scenario·deliverables·structured 만 뽑고 업체명은 합성 이름으로 바꿨다.
const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "user-output-gate");
const FIXTURES = [
  "ask-full-mfg-press.json",
  "ask-full-con-excavation.json",
  "ask-full-confined-space.json",
  "ask-full-logistics-heat.json",
  "ask-after-full-mfg-press.json"
] as const;

type Fixture = {
  scenario: Record<string, unknown>;
  deliverables: Record<string, string | string[]>;
  structured: Record<string, unknown>;
};

function loadFixture(name: string): Fixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8")) as Fixture;
}

function deliverableTexts(deliverables: Fixture["deliverables"]): Array<[string, string]> {
  return Object.entries(deliverables).flatMap(([key, value]): Array<[string, string]> => {
    if (typeof value === "string") return [[key, value]];
    if (!Array.isArray(value)) return [];
    return value.flatMap((item, index): Array<[string, string]> => (typeof item === "string" ? [[`${key}[${index}]`, item]] : []));
  });
}

// 브리프가 정한 6구절 + 문서 키·영문 enum 줄
const BRIEF_PHRASES = ["온톨로지", "파싱", "검수 보완", "SIF:sif-", "검색: rest", "원시 태그"];
const ENUM_LINE = /^\s*(?:-\s*)?(?:위험등급|4M|재해형태|확인상태)\s*:\s*(?:high|medium|low|Man|Machine|Media|Management|planned|done|needsReview|[a-z]+[A-Z]\w*)\s*$/mu;
const DOCUMENT_KEY = /\b(?:riskAssessmentDraft|tbmBriefing|tbmLogDraft|workPlanDraft|safetyEducationRecordDraft|emergencyResponseDraft|photoEvidenceDraft)\b/u;

describe("display label dictionary (결정 15: 상·중·하)", () => {
  it("maps every model enum to one Korean label", () => {
    expect([riskLevelLabel("high"), riskLevelLabel("medium"), riskLevelLabel("low")]).toEqual(["상", "중", "하"]);
    expect(riskLevelLabel("HIGH")).toBe("상");
    expect(fourMLabel("Machine")).toBe("기계·설비 요인");
    expect(accidentTypeLabel("fireExplosion")).toBe("화재·폭발");
    expect(verificationStatusLabel("planned")).toBe("조치 예정");
    expect(verificationStatusLabel("needsreview")).toBe("검토 필요");
    // 이미 한글이면 그대로
    expect(riskLevelLabel("상")).toBe("상");
    expect(fourMLabel("인적 요인")).toBe("인적 요인");
  });

  it("turns document keys into titles and drops internal provenance tags from evidence refs", () => {
    expect(evidenceRefsForDisplay(["riskAssessmentDraft", "tbmBriefing"])).toEqual(["위험성평가표", "TBM 브리핑"]);
    expect(evidenceRefsForDisplay([
      "DB 하네스 직접근거",
      "safety_reference_items",
      "sif-case",
      "이동식 비계 작업발판·난간 점검 지침",
      "검색: rest",
      "https://example.invalid/guide"
    ])).toEqual(["이동식 비계 작업발판·난간 점검 지침", "https://example.invalid/guide"]);
  });
});

describe("user output gate on production ask fixtures", () => {
  it.each(FIXTURES)("raw fixture %s still carries the internal phrases (RED evidence)", (name) => {
    const raw = deliverableTexts(loadFixture(name).deliverables).map(([, text]) => text).join("\n");
    expect(findUserOutputLeaks(raw).length).toBeGreaterThan(0);
  });

  it.each(FIXTURES)("removes every internal phrase from %s deliverables", (name) => {
    const fixture = loadFixture(name);
    const gated = gateAskResponseUserOutput(fixture);
    for (const [key, text] of deliverableTexts(gated.deliverables)) {
      for (const phrase of BRIEF_PHRASES) expect(text, `${key}: ${phrase}`).not.toContain(phrase);
      expect(text, `${key}: enum line`).not.toMatch(ENUM_LINE);
      expect(text, `${key}: document key`).not.toMatch(DOCUMENT_KEY);
      expect(findUserOutputLeaks(text), key).toEqual([]);
    }
    // 배포 후 스모크의 leak 판정과도 맞아야 한다
    expect(findInternalCodeLeaks({ deliverables: gated.deliverables })).toEqual([]);
  });

  it.each(FIXTURES)("keeps the documents substantive for %s (no emptied document)", (name) => {
    const fixture = loadFixture(name);
    const gated = gateAskResponseUserOutput(fixture);
    const afterTexts = new Map(deliverableTexts(gated.deliverables));
    for (const [key, before] of deliverableTexts(fixture.deliverables)) {
      const after = afterTexts.get(key) ?? "";
      if (!before.trim()) continue;
      expect(after.trim().length, key).toBeGreaterThan(before.trim().length * 0.6);
    }
    expect(gateAskResponseUserOutput(gated)).toEqual(gated);
  });

  it.each(FIXTURES)("keeps every structured risk row that was in the draft still in the gated draft for %s", (name) => {
    // 편집기는 구조화 행의 hazard·additionalControls 가 본문에 있는지로 정본 일치를 본다.
    // 게이트가 본문만 바꾸고 행을 그대로 두면 이 판정이 깨진다 — 행 문장 칸도 같은 게이트를 거쳐야 한다.
    const fixture = loadFixture(name);
    const gated = gateAskResponseUserOutput(fixture);
    const rawRows = (fixture.structured.riskAssessmentRows ?? []) as Array<{ hazard: string; additionalControls: string; riskLevel: string; evidenceRefs: string[] }>;
    const gatedRows = ((gated.structured as Fixture["structured"]).riskAssessmentRows ?? []) as typeof rawRows;
    const rawDraft = fixture.deliverables.riskAssessmentDraft as string;
    const gatedDraft = gated.deliverables.riskAssessmentDraft as string;
    const represented = (draft: string, rows: typeof rawRows) => rows.map((row) => draft.includes(row.hazard) && draft.includes(row.additionalControls));

    expect(represented(gatedDraft, gatedRows)).toEqual(represented(rawDraft, rawRows));
    expect(represented(rawDraft, rawRows)).toContain(true);
    // enum·출처 추적 데이터는 바꾸지 않는다
    expect(gatedRows.map((row) => row.riskLevel)).toEqual(rawRows.map((row) => row.riskLevel));
    expect(gatedRows.map((row) => row.evidenceRefs)).toEqual(rawRows.map((row) => row.evidenceRefs));
  });

  it("localizes the risk assessment enum lines and keeps the remediation controls", () => {
    const fixture = loadFixture("ask-full-confined-space.json");
    const risk = gateAskResponseUserOutput(fixture).deliverables.riskAssessmentDraft as string;

    expect(risk).toContain("위험등급: 상");
    expect(risk).toContain("위험등급: 중");
    expect(risk).toContain("4M: 인적 요인");
    expect(risk).toContain("재해형태: 감전");
    expect(risk).toContain("확인상태: 검토 필요");
    expect(risk).toContain("근거: 위험성평가표 | TBM 브리핑");
    expect(risk).toContain("[추가 안전조치 확인 - 위험성평가]");
    expect(risk).toContain("관계자 외 출입금지 표지 게시");
    expect(risk).not.toContain("[내부 안전지식 DB 반영]");
    expect(risk).toContain("[안전 참고자료 반영]");
    expect(risk).not.toContain("permit / 반영 위치");

    const log = gateAskResponseUserOutput(fixture).deliverables.tbmLogDraft as string;
    expect(log).toContain("정화조 내부 산소결핍·황화수소 등 유해가스 체류로 인한 질식 위험");
    expect(log).not.toMatch(/SIF:/u);
    expect(log).toContain("1) 사람");
  });
});

describe("export payload gate", () => {
  it("localizes whole-cell enums in table cells but leaves structured enum fields to the builders", () => {
    const payload = gateExportPayload({
      title: "TBM 브리핑",
      rows: [
        { section: "위험성평가 기반 전달사항", item: "위험등급", content: "high" },
        { section: "근거", item: "근거", content: "riskAssessmentDraft | tbmBriefing" },
        { section: "위험요인", item: "위험", content: "질식 위험 (SIF:sif-아카이브-건설업-01001)" }
      ],
      structuredRiskRows: [{ hazard: "추락", riskLevel: "high", fourM: "Man", status: "planned" }]
    });

    expect(payload.rows.map((row) => row.content)).toEqual(["상", "위험성평가표 | TBM 브리핑", "질식 위험"]);
    expect(payload.structuredRiskRows[0]).toEqual({ hazard: "추락", riskLevel: "high", fourM: "Man", status: "planned" });
    expect(payload.title).toBe("TBM 브리핑");
  });

  it("gates one cell at a time", () => {
    expect(gateUserOutputCell("needsReview")).toBe("검토 필요");
    expect(gateUserOutputCell("fireExplosion")).toBe("화재·폭발");
    expect(gateUserOutputCell("기상 API 결과: 맑음")).toBe("기상청 예보 확인 결과: 맑음");
    // 문장 속 영단어는 건드리지 않는다
    expect(gateUserOutputText("KOSHA Guide low-voltage 참고")).toBe("KOSHA Guide low-voltage 참고");
  });
});
