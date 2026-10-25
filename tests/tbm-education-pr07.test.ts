import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMockAskResponse, inferScenario } from "@/lib/mock-data";
import { runAsk, selectTbmStructuredDeliverables, formatTbmQualityAppendix } from "@/lib/search";
import { buildWeatherActions } from "@/lib/weather";
import { isTbmTextForTask, ensureConfinedSpaceAirStandard } from "@/lib/tbm-consistency";
import { buildEducationCourseTable } from "@/lib/education-course-table";
import { resolveEducationEvidenceLabel, formatEvidenceBadge } from "@/lib/smsa-mapping";
import { scoreCourseFit } from "@/lib/work24";
import { buildEducationRecordStructuredXlsx, buildTbmLogStructuredXlsx, buildXlsxForDocument } from "@/lib/xlsx-builder";
import { applyOntologyQaRemediation } from "@/lib/workpack-ontology-qa";
import { POST as pdfPost } from "@/app/api/export/pdf/route";
import ExcelJS from "exceljs";

// 운영 full 4문항(합성 질문, 실명·실사업장 아님). tests/task-classification-coverage.test.ts 와 같다.
const Q = {
  press: "경기 안산 금속부품 제조공장 프레스 금형 교체 작업. 작업자 6명 중 외국인 근로자 2명(베트남어), 신규 투입자 1명. 지게차로 금형 운반, 상하차 포함. 오늘 작업 전 문서팩을 만들어줘.",
  excavation: "서울 강서구 도시가스 배관 굴착공사. 굴착 깊이 2.5m, 굴착기 1대와 이동식 크레인 1대, 작업자 8명, 매설물 확인 필요, 오후 강풍 예보. 오늘 작업 전 문서팩을 만들어줘.",
  confined: "부산 해운대 상가건물 지하 정화조 청소 작업. 밀폐공간 진입, 작업자 3명, 외부 협력업체 소속, 산소·황화수소 측정 필요. 오늘 작업 전 문서팩을 만들어줘.",
  heat: "대구 달서구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 10명 중 고령자 2명, 컨베이어와 핸드파렛트 사용. 오늘 작업 전 문서팩을 만들어줘."
} as const;
const ALL = Object.entries(Q);

const mock = (q: string) => buildMockAskResponse(q, [], "mock", "test");
const textOf = (response: ReturnType<typeof mock>) => Object.values(response.deliverables)
  .filter((value): value is string => typeof value === "string")
  .join("\n");

afterEach(() => {
  vi.useRealTimers();
});

describe("PR-07 TBM", () => {
  it.each(ALL)("TBM-03 %s: 일시 상수가 없고 작성일은 생성 시각(KST)이다", (_, q) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T05:00:00Z"));
    const response = mock(q);
    expect(textOf(response)).not.toContain("2026-04-25");
    const log = response.deliverables.tbmLogDraft;
    expect(log).toMatch(/^일시: ____년 __월 __일 __:__/m);
    expect(log).toContain("작성일: 2026-10-25");
    expect(JSON.stringify(response.deliverables.tbmLogStructured)).not.toContain("2026-04-25");
  });

  it.each(ALL)("TBM-02 %s: 브리핑과 기록이 같은 작업을 다룬다", (_, q) => {
    const response = mock(q);
    const taskId = response.scenario.taskClassification?.taskId ?? null;
    const workName = inferScenario(q).profile.workName;
    expect(response.deliverables.tbmBriefing).toContain(`오늘 작업: ${workName}`);
    expect(response.deliverables.tbmLogDraft).toContain(`- ${workName}`);
    expect(isTbmTextForTask(taskId, response.deliverables.tbmBriefing)).toBe(true);
    expect(isTbmTextForTask(taskId, response.deliverables.tbmLogDraft)).toBe(true);
    expect(isTbmTextForTask(taskId, response.deliverables.tbmQuestions.join("\n"))).toBe(true);
  });

  it("TBM-02: 정화조 문서팩에 기계실·감전 AI 기록이 오면 같은 작업이 아니라고 본다(양쪽)", () => {
    const wrong = "작업 전 안전점검회의(TBM) 기록\n오늘 작업: 지하 기계실 점검 및 정비 작업\n- 누수 구간 미끄러짐\n- 전기판넬 감전";
    const right = "작업 전 안전점검회의(TBM) 기록\n오늘 작업: 정화조 청소\n- 산소·황화수소 측정 후 진입\n- 감시인 배치";
    expect(isTbmTextForTask("confined-space", wrong)).toBe(false);
    expect(isTbmTextForTask("confined-space", right)).toBe(true);
    expect(isTbmTextForTask("press", "금형 교체 전 슬라이드 안전블록 설치")).toBe(true);
    expect(isTbmTextForTask("press", "용접·절단 화기작업 불티 비산")).toBe(false);
  });

  it("TBM-04: template 모드도 참석자 서명표가 있는 구조화 TBM 을 낸다", async () => {
    const response = await runAsk(Q.confined, { aiMode: "template" });
    expect(response.deliverables.tbmBriefingStructured).toBeTruthy();
    const log = response.deliverables.tbmLogStructured;
    expect(log).toBeTruthy();
    expect(log?.attendance.expected).toBe(3);
  });

  it("TBM-04: full·enhanced 에서도 AI 구조가 없으면 위험성평가 행으로 구조화 TBM 을 만든다", () => {
    const response = mock(Q.excavation);
    const rows = response.structured?.riskAssessmentRows ?? [];
    const picked = selectTbmStructuredDeliverables({
      aiBodies: {},
      scenario: response.scenario,
      structuredRiskRows: rows,
      weatherSummary: "맑음"
    });
    expect(picked.tbmBriefingStructured).toBeTruthy();
    expect(picked.tbmLogStructured?.attendance.expected).toBe(8);
    expect(picked.source).toBe("deterministic");
  });

  it("TBM-02: AI 구조화 TBM 이 다른 작업이면 버리고 결정형으로 내린다", () => {
    const response = mock(Q.confined);
    const rows = response.structured?.riskAssessmentRows ?? [];
    const deterministic = selectTbmStructuredDeliverables({ aiBodies: {}, scenario: response.scenario, structuredRiskRows: rows, weatherSummary: "" });
    const wrongLog = {
      ...deterministic.tbmLogStructured!,
      todayWork: { ...deterministic.tbmLogStructured!.todayWork, name: "지하 기계실 점검 및 정비 작업" },
      hazardsDiscussed: [{ category: "Machine" as const, description: "전기판넬 감전" }]
    };
    const picked = selectTbmStructuredDeliverables({
      aiBodies: { tbmLogStructured: wrongLog },
      scenario: response.scenario,
      structuredRiskRows: rows,
      weatherSummary: "",
      taskId: "confined-space"
    });
    expect(picked.tbmLogStructured?.todayWork.name).not.toContain("기계실");
    expect(picked.rejected).toContain("tbmLogStructured");
  });

  it.each(ALL)("TBM-08 %s: 회의 전부터 「확인」이 적혀 있지 않다", (_, q) => {
    const response = mock(q);
    const log = response.deliverables.tbmLogDraft;
    expect(log).not.toMatch(/위험구역 표시 및 통제: 확인$/m);
    expect(log).not.toMatch(/보호구 착용 상태: 상호 점검$/m);
    expect(log).toMatch(/위험구역 표시 및 통제: □ 확인 □ 미확인/);
    const structured = response.deliverables.tbmLogStructured;
    expect(structured?.attendance.actual).toBe(0);
    expect(structured?.attendance.attendees.some((name) => /작업자 \d/.test(name))).toBe(false);
  });

  it("TBM-08·09: TBM 필수 반영 체크에 실시 완료 표현·내부 문구가 없다", () => {
    const response = mock(Q.press);
    const appendix = formatTbmQualityAppendix(response, { summary: "맑음", actions: [] } as never, [], []);
    expect(appendix).not.toContain("evidence UI");
    expect(appendix).not.toContain("기상 API");
    expect(appendix).not.toMatch(/대상 구두 복창·서명·보호구 확인$/m);
    expect(appendix).toMatch(/□ 구두 복창 □ 서명 □ 보호구 확인/);
  });

  it("TBM-09: 개선 이력 섹션이 TBM 본문 앞에 붙지 않는다", async () => {
    const response = await runAsk(Q.press, {
      aiMode: "template",
      harnessMemory: {
        improvements: [{
          id: "imp-press-1",
          taskLabel: "금형 교체",
          hazardLabel: "끼임",
          improvementText: "안전블록 보관 위치 표시",
          reflectedDocuments: ["TBM 브리핑", "TBM 기록"],
          sourceType: "manual",
          memoryAdmission: "user_accepted_input",
          photoPairAttached: false
        }] as never,
        workpackMemory: []
      }
    });
    expect(response.deliverables.tbmLogDraft.startsWith("작업 전 안전점검회의(TBM) 기록")).toBe(true);
    expect(response.deliverables.tbmBriefing.startsWith("작업 전 안전점검회의(TBM) 브리핑")).toBe(true);
    expect(response.deliverables.tbmLogDraft).toContain("안전블록 보관 위치 표시");
  });

  it("TBM-05: 전국 풍랑주의보는 육상 작업 재판단 문구를 만들지 않는다(양쪽)", () => {
    const sea = buildWeatherActions([
      { endpoint: "기상특보", mode: "live", summary: "최근 특보 확인: [특보] 제10-151호 : 2026.10.25.13:00 / 풍랑주의보 발표 (*)", detail: "" }
    ] as never);
    expect(sea.join(" ")).not.toContain("기상특보가 확인되어");
    const land = buildWeatherActions([
      { endpoint: "기상특보", mode: "live", summary: "최근 특보 확인: [특보] 제10-152호 : 2026.10.25.13:00 / 호우경보 발표", detail: "" }
    ] as never);
    expect(land.join(" ")).toContain("기상특보가 확인되어");
  });

  it("TBM-12: 밀폐공간 TBM 기록에 제618조 적정공기 기준과 측정값 칸이 있다(AI 기록에도 덧붙인다)", () => {
    const log = mock(Q.confined).deliverables.tbmLogDraft;
    for (const term of ["산소 18% 이상 23.5% 미만", "이산화탄소 1.5% 미만", "일산화탄소 30ppm 미만", "황화수소 10ppm 미만"]) {
      expect(log).toContain(term);
    }
    expect(log).toMatch(/작업 전 측정값/);
    expect(log).toMatch(/작업 중 측정값/);
    const ai = ensureConfinedSpaceAirStandard("산소 18% 미만 또는 황화수소 10ppm 초과 시 작업중단", "confined-space");
    expect(ai).toContain("이산화탄소 1.5% 미만");
    expect(ensureConfinedSpaceAirStandard("금형 교체", "press")).toBe("금형 교체");
    expect(mock(Q.press).deliverables.tbmLogDraft).not.toContain("적정공기");
  });

  it("TBM-04: TBM 기록 xlsx 참석자 서명표가 작업자 수만큼 행을 낸다", async () => {
    const response = mock(Q.heat);
    const buffer = await buildTbmLogStructuredXlsx(response.scenario, response.deliverables.tbmLogStructured as never);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    const values: string[] = [];
    wb.worksheets[0].eachRow((row) => values.push(row.values ? JSON.stringify(row.values) : ""));
    const signRows = values.filter((value) => value.includes("서명: ______") && /\[null,"\d+"/.test(value));
    expect(signRows.length).toBe(10);
  });
});

describe("PR-08 교육기록", () => {
  it("EDU-01: 정화조 교육기록에 제641조 주지 6항목과 별표5 제34호 개별내용, 이수·측정자·도급 확인란이 있다", () => {
    const record = mock(Q.confined).deliverables.safetyEducationRecordDraft;
    for (const item of [
      "밀폐공간의 위험성",
      "산소 및 유해가스농도 측정에 관한 사항",
      "환기설비의 가동 등 안전한 작업방법에 관한 사항",
      "보호구의 착용과 사용방법에 관한 사항",
      "비상연락처 및 응급조치에 관한 사항",
      "대피용 기구의 위치 및 사용방법"
    ]) {
      expect(record).toContain(item);
    }
    expect(record).toContain("산소농도 측정 및 작업환경에 관한 사항");
    expect(record).toContain("사고 시의 응급처치 및 비상 시 구출에 관한 사항");
    expect(record).toMatch(/특별교육 이수 확인: □ 이수/);
    expect(record).toMatch(/측정자 교육 확인/);
    expect(record).toMatch(/도급인 확인/);
    expect(record.match(/^교육명: .*$/m)?.[0]).not.toContain("특별교육");
  });

  it("EDU-03: 교육 종류·법정 시간 확인표 — 정화조는 별표5 제34호 특별교육 16시간, 15분은 오늘 실시분만", () => {
    const record = mock(Q.confined).deliverables.safetyEducationRecordDraft;
    expect(record).toContain("[교육 종류·법정 시간 확인표]");
    expect(record).toMatch(/특별교육.*제34호.*16시간 이상/);
    expect(record).not.toContain("교육일시: 작업 시작 전 15분");
    expect(record).toMatch(/오늘 실시분: 작업 전 15분/);
    expect(record).toContain("제26조제1항");
  });

  it("EDU-03: 굴착 2.5m 는 제19호, 이동식 크레인은 톤수 확인 필요, 건설업 기초교육 이수 확인(양쪽)", () => {
    const table = buildEducationCourseTable({ question: Q.excavation, taskId: "excavation", companyType: "건설업", workerCount: 8 });
    expect(table.rows.some((row) => /제19호/.test(row.course) && row.status === "해당")).toBe(true);
    expect(table.rows.some((row) => /제14호/.test(row.course) && row.status === "교육 종류 확인 필요")).toBe(true);
    expect(table.rows.some((row) => /기초안전보건교육/.test(row.course) && /4시간/.test(row.legalHours))).toBe(true);
    const shallow = buildEducationCourseTable({ question: "광주 상수도관 터파기 작업, 깊이 1.5m, 굴착기 1대", taskId: "excavation", companyType: "건설업", workerCount: 3 });
    expect(shallow.rows.some((row) => /제19호/.test(row.course) && row.status === "해당")).toBe(false);
  });

  it("EDU-03: 프레스는 5대 보유 여부, 신규 투입자는 고용형태를 확인해야 시간을 정한다", () => {
    const table = buildEducationCourseTable({ question: Q.press, taskId: "press", companyType: "제조업", workerCount: 6 });
    expect(table.rows.some((row) => /제11호/.test(row.course) && row.status === "교육 종류 확인 필요")).toBe(true);
    expect(table.rows.some((row) => /채용 시 교육/.test(row.course) && /8시간/.test(row.legalHours) && /1시간/.test(row.legalHours))).toBe(true);
  });

  it("EDU-03: 판정할 근거가 없으면 「교육 종류 확인 필요」로 남긴다(폭염 상하차)", () => {
    const table = buildEducationCourseTable({ question: Q.heat, taskId: "manual-loading-heat", companyType: "물류업", workerCount: 10 });
    expect(table.rows.some((row) => row.course.startsWith("특별교육") && row.status === "해당")).toBe(false);
    expect(table.determined).toBe(false);
    expect(mock(Q.heat).deliverables.safetyEducationRecordDraft).toContain("교육 종류 확인 필요");
  });

  it.each(ALL)("EDU-03 %s: 「제29조 실시 증빙」 라벨은 생성 초안에 붙지 않는다", (_, q) => {
    const label = mock(q).evidenceLabels?.safetyEducationRecordDraft;
    expect(label?.article).toBe("산업안전보건법 제29조");
    expect(label?.purpose).not.toBe("안전보건교육 실시 증빙");
    expect(formatEvidenceBadge(label!.article, label!.purpose)).not.toContain("증빙");
  });

  it("EDU-03: 교육 종류·시간·서명이 모두 채워졌을 때만 실시 증빙 라벨(양쪽)", () => {
    expect(resolveEducationEvidenceLabel({ courseDetermined: true, hoursRecorded: true, signed: true }).purpose).toBe("안전보건교육 실시 증빙");
    expect(resolveEducationEvidenceLabel({ courseDetermined: true, hoursRecorded: true, signed: false }).purpose).not.toBe("안전보건교육 실시 증빙");
    expect(resolveEducationEvidenceLabel({ courseDetermined: false, hoursRecorded: true, signed: true }).purpose).not.toBe("안전보건교육 실시 증빙");
  });

  it("EDU-04: PDF(html) 교육 출력이 본문 섹션 전부와 작업자 수만큼 서명란을 싣고 추천 과정은 뺀다", async () => {
    const record = mock(Q.heat).deliverables.safetyEducationRecordDraft
      + "\n\n[추천 후속 교육]\n1. [인재키움]물질안전보건자료 검증 실무(GHS-MSDS)_서울_대면 / 기관 / 2026-11-01~2026-11-02";
    const rows: Array<{ document: string; section: string; item: string; content: string }> = [];
    let section = "기본정보";
    let n = 1;
    for (const raw of record.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const header = line.match(/^\[(.+)\]$/);
      if (header) { section = header[1]; n = 1; continue; }
      const keyed = line.match(/^([^:]{1,20}):\s*(.+)$/);
      if (keyed) rows.push({ document: "안전보건교육 기록", section, item: keyed[1], content: keyed[2] });
      else rows.push({ document: "안전보건교육 기록", section, item: String(n++), content: line.replace(/^[-ㆍ]\s*/, "") });
    }
    const scenario = { ...mock(Q.heat).scenario };
    const response = await pdfPost(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "안전보건교육 기록", scenario, rows })
    }));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("교육내용");
    expect(html).toContain("보호구 및 작업방법 강조사항");
    expect(html).toContain("확인방법");
    expect(html).not.toContain("물질안전보건자료 검증 실무");
    expect(html).toContain(inferScenario(Q.heat).profile.educationName);
    const attendeeTable = html.split("참석자 확인")[1] ?? "";
    expect((attendeeTable.match(/<tr><td>\d+<\/td>/g) ?? []).length).toBe(10);
  });

  it("EDU-04: 바이너리 PDF 서식 구분이 「안전보건교육 기록」이다", async () => {
    const response = await pdfPost(new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "안전보건교육 기록",
        scenario: mock(Q.confined).scenario,
        documentText: mock(Q.confined).deliverables.safetyEducationRecordDraft
      })
    }));
    expect(response.status).toBe(200);
  });

  it("EDU-05: 폭염 상하차 교육기록 강조사항에 법정 폭염 고지가 있고 실내는 휴게시설로 쓴다", () => {
    const record = mock(Q.heat).deliverables.safetyEducationRecordDraft;
    const emphasis = record.split("[보호구 및 작업방법 강조사항]")[1]?.split(/\n\[/)[0] ?? "";
    expect(emphasis).toMatch(/2시간/);
    expect(emphasis).toMatch(/20분/);
    expect(emphasis).toMatch(/119/);
    expect(emphasis).toMatch(/체감온도.*기록/);
    expect(emphasis).toMatch(/휴게시설/);
    expect(record).not.toMatch(/그늘/);
    expect(mock(Q.press).deliverables.safetyEducationRecordDraft).not.toMatch(/20분 이상 휴식/);
  });

  it("EDU-06: 입력에 없는 청각장애·지게차를 넣지 않고 고령은 한 번만 적는다", () => {
    const response = mock(Q.heat);
    const record = response.deliverables.safetyEducationRecordDraft;
    expect(record).not.toContain("청각");
    expect(record).not.toContain("지게차");
    const target = record.match(/^교육대상: .*$/m)?.[0] ?? "";
    expect((target.match(/고령/g) ?? []).length).toBe(1);
    const withHearing = mock("대구 물류창고 상하차 작업. 폭염(체감 34도), 작업자 4명 중 청각장애 작업자 1명.").deliverables.safetyEducationRecordDraft;
    expect(withHearing).toContain("청각장애");
    expect(withHearing).not.toMatch(/고령/);
  });

  it("EDU-07: 이동식 크레인 교육에 제37조 작업중지 판단과 정격 풍속 한계, 제140조는 옥외 주행 크레인 한정", () => {
    const record = mock(Q.excavation).deliverables.safetyEducationRecordDraft;
    expect(record).toMatch(/정격|제조사 풍속/);
    expect(record).toMatch(/제37조/);
    expect(record).not.toMatch(/제140조/);
    const remediated = applyOntologyQaRemediation(mock(Q.excavation), "이동식 크레인", {
      reviewable: true,
      verdict: "보완 필요",
      missing: {
        hazards: [],
        controls: [{ control: "순간풍속 30m/s 초과 시 이탈방지장치 작동", articles: ["기준규칙 제140조(폭풍에 의한 이탈 방지)"] }],
        articles: []
      }
    } as never);
    expect(remediated.deliverables.safetyEducationRecordDraft).toMatch(/제140조[^\n]*옥외 주행 크레인 한정/);
  });

  it("EDU-08: 선원·수산 과정과 경영책임자 과정은 근로자 교육 적합으로 보지 않는다(양쪽)", () => {
    const base = { url: "https://example.invalid", institution: "기관", startDate: "2026-11-01", endDate: "2026-11-02" };
    const seafarer = scoreCourseFit(Q.press, { ...base, title: "외국인근로자 취업교육(일성_첫번째반)", target: "수산업협동조합중앙회 선원지원부" } as never);
    expect(seafarer.fitLabel).not.toMatch(/적합/);
    const ceo = scoreCourseFit(Q.confined, { ...base, title: "위험성평가 교육(사업주(경영책임자))", target: "사업주(경영책임자)" } as never);
    expect(ceo.fitLabel).not.toMatch(/적합/);
    const msds = scoreCourseFit(Q.confined, { ...base, title: "[인재키움]물질안전보건자료 검증 실무(GHS-MSDS)_서울_대면" } as never);
    expect(msds.fitLabel).not.toBe("현장 적합");
    const confinedCourse = scoreCourseFit(Q.confined, { ...base, title: "밀폐공간 작업 안전보건교육", target: "근로자" } as never);
    expect(confinedCourse.fitLabel).toBe("현장 적합");
  });

  it("EDU-10: 구조화 교육 xlsx 참석자 행이 작업자 수와 같다", async () => {
    const response = mock(Q.excavation);
    const buffer = await buildEducationRecordStructuredXlsx(response.scenario, {
      educationName: "굴착 작업 교육", type: "특별교육", dateTime: "", location: "", target: "", instructor: "실시자", confirmer: "확인자",
      curriculum: [], understandingCheck: "", tbmLink: "", followupRecommendation: ""
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    let signRows = 0;
    wb.worksheets[0].eachRow((row) => { if (JSON.stringify(row.values).includes("□ 이해함")) signRows += 1; });
    expect(signRows).toBe(8);
  });

  it("EDU-04: 일반 xlsx 교육·TBM 기록에도 작업자 수만큼 참석자 서명 행이 있다", async () => {
    const response = mock(Q.confined);
    for (const layout of ["education", "tbmLog"] as const) {
      const buffer = await buildXlsxForDocument({
        title: layout === "education" ? "안전보건교육 기록" : "TBM 기록",
        rows: [{ document: "문서", section: "교육내용", item: "1", content: "밀폐공간의 위험성" }],
        profile: { layout, approvalLabels: ["작성", "확인"] } as never,
        scenario: response.scenario
      } as never);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as never);
      let signRows = 0;
      wb.worksheets[0].eachRow((row) => { if (JSON.stringify(row.values).includes("참석자 서명")) signRows += 1; });
      expect(signRows).toBe(3);
    }
  });

  it.each(ALL)("EDU-11 %s: 보존 기간 문구는 사업장 규정·관할 지청 확인", (_, q) => {
    const record = mock(q).deliverables.safetyEducationRecordDraft;
    expect(record).toContain("보존 기간: 사업장 규정·관할 지청 확인");
    expect(record).not.toMatch(/3년간 보존/);
  });
});
