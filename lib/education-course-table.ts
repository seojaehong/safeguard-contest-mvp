// 안전보건교육 기록의 「교육 종류·법정 시간 확인표」(EDU-03).
// 근거: 산업안전보건법 시행규칙 제26조(교육시간·교육내용·실시자), 별표 4(교육과정별 교육시간),
// 별표 5 제1호라목(특별교육 대상 작업). 2026-10-25 법제처 원문 확인(별표 4·5 <개정 2025. 5. 30.>).
// 입력만으로 확정할 수 있는 것만 「해당」으로 적고, 보유 대수·톤수·고용형태처럼 입력에 없는 조건이
// 걸리면 「교육 종류 확인 필요」로 남긴다. 사용자 문서에는 「판정」이라는 말을 쓰지 않는다.

export type EducationCourseStatus = "해당" | "교육 종류 확인 필요" | "고용형태 확인 후 시간 확정" | "이수 확인" | "누계 확인";

export type EducationCourseRow = {
  course: string;
  target: string;
  legalHours: string;
  status: EducationCourseStatus;
};

export type EducationCourseTable = {
  rows: EducationCourseRow[];
  /** 오늘 교육의 법정 과정을 입력만으로 정할 수 있었는가(특별교육 「해당」이 있을 때만 true). */
  determined: boolean;
};

export type EducationCourseInput = {
  question: string;
  taskId: string | null | undefined;
  companyType: string;
  workerCount: number;
};

// 별표 4 제1호라목(근로자 특별교육)
const SPECIAL_HOURS = "16시간 이상(최초 작업 전 4시간 이상, 12시간은 3개월 이내 분할 가능) · 단기간·간헐적 작업 2시간 이상 · 일용·1주 이하 기간제 2시간 이상";
// 별표 4 제1호나목(채용 시 교육)
const HIRING_HOURS = "8시간 이상 · 일용·1주 이하 기간제 1시간 이상 · 1주 초과 1개월 이하 기간제 4시간 이상";
// 별표 4 제1호가목(정기교육)
const REGULAR_HOURS = "매반기 12시간 이상(사무직·판매업무 종사자 매반기 6시간 이상)";
// 별표 4 제1호마목(건설업 기초안전ㆍ보건교육)
const CONSTRUCTION_BASIC_HOURS = "4시간 이상(건설 일용근로자, 이수증 확인)";

function special(no: number, name: string, status: EducationCourseStatus, note = ""): EducationCourseRow {
  return {
    course: `특별교육(시행규칙 별표5 제1호라목 제${no}호 ${name})${note ? ` — ${note}` : ""}`,
    target: "해당 작업 종사 근로자",
    legalHours: SPECIAL_HOURS,
    status
  };
}

function parseExcavationDepth(question: string): number | null {
  const match = /(?:굴착\s*)?(?:깊이|심도)\s*(\d+(?:\.\d+)?)\s*(?:m|미터)/i.exec(question);
  return match ? Number(match[1]) : null;
}

function parseCraneTonnage(question: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(?:톤|t(?![a-z]))/i.exec(question);
  return match ? Number(match[1]) : null;
}

export function buildEducationCourseTable(input: EducationCourseInput): EducationCourseTable {
  const { question, taskId, companyType } = input;
  const rows: EducationCourseRow[] = [];

  if (taskId === "confined-space" || (taskId === "pump-confined" && /밀폐/.test(question))) {
    rows.push(special(34, "밀폐공간에서의 작업", "해당"));
  }
  if (taskId === "excavation") {
    const depth = parseExcavationDepth(question);
    if (depth === null) {
      rows.push(special(19, "굴착면 높이 2미터 이상 지반 굴착", "교육 종류 확인 필요", "굴착 깊이 확인"));
    } else if (depth >= 2) {
      rows.push(special(19, "굴착면 높이 2미터 이상 지반 굴착", "해당", `굴착 깊이 ${depth}m`));
    }
  }
  if (taskId === "crane-lifting" || /크레인/.test(question)) {
    const tonnage = parseCraneTonnage(question);
    if (tonnage !== null && tonnage >= 1) {
      rows.push(special(14, "1톤 이상 크레인 사용 작업", "해당", `${tonnage}톤`));
    } else {
      rows.push(special(14, "1톤 이상 크레인 사용 작업", "교육 종류 확인 필요", "크레인 정격하중(톤) 확인"));
    }
  }
  if (taskId === "press") {
    rows.push(special(11, "동력 프레스 5대 이상 보유 사업장의 프레스 작업", "교육 종류 확인 필요", "사업장 동력 프레스 보유 대수 확인"));
  }
  if (taskId === "forklift-logistics" || /지게차/.test(question)) {
    rows.push(special(13, "운반용 하역기계 5대 이상 보유 사업장의 해당 기계 작업", "교육 종류 확인 필요", "하역기계 보유 대수 확인"));
  }
  if (taskId === "hotwork") {
    rows.push(special(38, "가연물이 있는 장소에서 하는 화재위험작업", "교육 종류 확인 필요", "작업장소 가연물 여부 확인"));
  }
  if (taskId === "electrical") {
    rows.push(special(17, "전압 75볼트 이상 정전·활선작업", "교육 종류 확인 필요", "작업 전압 확인"));
  }
  if (taskId === "scaffold-assembly") {
    rows.push(special(26, "비계의 조립·해체 또는 변경작업", "해당"));
  }

  if (/신규|신입|채용/.test(question)) {
    rows.push({
      course: "채용 시 교육(시행규칙 별표4 제1호나목)",
      target: "신규 투입자",
      legalHours: HIRING_HOURS,
      status: "고용형태 확인 후 시간 확정"
    });
  }
  if (companyType === "건설업" || /건설|공사/.test(question)) {
    rows.push({
      course: "건설업 기초안전보건교육(시행규칙 별표4 제1호마목)",
      target: "건설 일용근로자",
      legalHours: CONSTRUCTION_BASIC_HOURS,
      status: "이수 확인"
    });
  }
  rows.push({
    course: "정기교육(시행규칙 별표4 제1호가목)",
    target: "전 근로자",
    legalHours: REGULAR_HOURS,
    status: "누계 확인"
  });

  return {
    rows,
    determined: rows.some((row) => row.course.startsWith("특별교육") && row.status === "해당")
  };
}

export function formatEducationCourseTableLines(table: EducationCourseTable): string[] {
  const lines = table.rows.map((row) => (
    `- ${row.course}: ${row.status} / 대상 ${row.target} / 법정 시간 ${row.legalHours} / 실시 시간 ____시간`
  ));
  if (!table.determined) {
    lines.unshift("- 교육 종류 확인 필요: 대상자의 고용형태·작업 이력과 아래 조건을 확인해 정기·채용 시·작업내용 변경 시·특별교육 중 해당 과정을 정합니다.");
  }
  if (table.rows.some((row) => row.course.startsWith("특별교육"))) {
    lines.push("- 특별교육을 실시하면 해당 근로자의 채용 시 교육과 작업내용 변경 시 교육을 실시한 것으로 봅니다(시행규칙 제26조제1항 후단).");
  }
  lines.push("- 오늘 실시분: 작업 전 15분(TBM 연계 현장교육). 법정 교육시간을 채웠는지는 위 표의 실시 시간 누계로 따로 확인합니다.");
  return lines;
}
