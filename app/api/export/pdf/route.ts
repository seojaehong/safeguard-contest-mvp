import { NextRequest, NextResponse } from "next/server";

type PdfRow = {
  document: string;
  section: string;
  item: string;
  content: string;
};

type PdfScenario = {
  companyName: string;
  siteName: string;
  workSummary: string;
  workerCount: number;
  weatherNote: string;
};

type PdfDocumentKind = "risk" | "workPlan" | "permit" | "tbm" | "education" | "generic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "safeclaw-document";
}

function parseScenario(value: unknown): PdfScenario {
  const record = isRecord(value) ? value : {};
  return {
    companyName: readString(record.companyName, "SafeClaw 현장"),
    siteName: readString(record.siteName, "현장명 확인"),
    workSummary: readString(record.workSummary, "작업내용 확인"),
    workerCount: readNumber(record.workerCount, 0),
    weatherNote: readString(record.weatherNote, "기상 정보 확인")
  };
}

function parseRows(value: unknown, documentTitle: string): PdfRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PdfRow[] => {
    if (!isRecord(item)) return [];
    const content = readString(item.content);
    if (!content) return [];
    return [{
      document: readString(item.document, documentTitle),
      section: readString(item.section, "본문"),
      item: readString(item.item, "확인"),
      content
    }];
  });
}

function parseBodyText(value: unknown, documentTitle: string): PdfRow[] {
  const text = readString(value);
  if (!text) return [];
  const rows: PdfRow[] = [];
  let section = "본문";
  let index = 1;

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      index = 1;
      return;
    }
    const keyed = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    const bullet = line.match(/^[-ㆍ]\s*(.+)$/);
    if (keyed) {
      rows.push({ document: documentTitle, section, item: keyed[1].trim(), content: keyed[2].trim() });
      return;
    }
    if (numbered) {
      rows.push({ document: documentTitle, section, item: numbered[1].trim(), content: numbered[2].trim() });
      return;
    }
    if (bullet) {
      rows.push({ document: documentTitle, section, item: String(index), content: bullet[1].trim() });
      index += 1;
      return;
    }
    rows.push({ document: documentTitle, section, item: String(index), content: line });
    index += 1;
  });

  return rows;
}

function groupRows(rows: PdfRow[]) {
  const groups = new Map<string, PdfRow[]>();
  rows.forEach((row) => {
    const current = groups.get(row.section) || [];
    current.push(row);
    groups.set(row.section, current);
  });
  return Array.from(groups.entries()).map(([section, sectionRows]) => ({ section, rows: sectionRows }));
}

function detectDocumentKind(title: string): PdfDocumentKind {
  if (/위험성평가/.test(title)) return "risk";
  if (/작업계획/.test(title)) return "workPlan";
  if (/허가/.test(title)) return "permit";
  if (/TBM|작업 전 안전점검|툴박스/i.test(title)) return "tbm";
  if (/교육/.test(title)) return "education";
  return "generic";
}

function findByKeywords(rows: PdfRow[], keywords: string[], limit: number) {
  const matches = rows.filter((row) => {
    const haystack = `${row.section} ${row.item} ${row.content}`;
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  const source = matches.length ? matches : rows;
  return source.slice(0, limit);
}

function compactCell(row: PdfRow | undefined, fallback: string) {
  if (!row) return fallback;
  const value = row.content || row.item || fallback;
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function renderRiskAssessmentRows(rows: PdfRow[], scenario: PdfScenario, topRisk: string) {
  const hazards = findByKeywords(rows, ["위험", "추락", "전도", "충돌", "끼임", "화재", "중독", "질식", "붕괴"], 5);
  const controls = findByKeywords(rows, ["조치", "대책", "통제", "점검", "작업중지", "보호구"], 5);
  return `
    <section class="section">
      <h2>1. 사전준비</h2>
      <table class="meta-table">
        <tbody>
          <tr><th>평가대상 작업</th><td>${escapeHtml(scenario.workSummary)}</td><th>평가 장소</th><td>${escapeHtml(scenario.siteName)}</td></tr>
          <tr><th>평가 참여자</th><td>관리감독자, 작업반장, 근로자 대표</td><th>작업 조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr>
          <tr><th>검토 기준</th><td colspan="3">작업계획서, TBM, 안전보건교육 기록, 법령·KOSHA 근거, 현장 사진 증빙</td></tr>
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>2. 유해·위험요인 파악 및 위험성 결정</h2>
      <table>
        <thead><tr><th class="no">No.</th><th>단위작업</th><th>유해·위험요인</th><th>4M</th><th>재해형태</th><th>위험성</th><th>현재 안전조치</th></tr></thead>
        <tbody>
          ${hazards.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(scenario.workSummary)}</td><td>${escapeHtml(compactCell(row, topRisk || "핵심 위험 확인"))}</td><td>Man/Machine/Media/Management</td><td>추락·충돌·전도 등</td><td>상/중/하</td><td>${escapeHtml(compactCell(controls[index], "작업 전 통제대책 지정"))}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>3. 감소대책 수립·실행</h2>
      <table>
        <thead><tr><th>추가 감소대책</th><th>담당자</th><th>기한</th><th>증빙</th><th>확인</th></tr></thead>
        <tbody>
          ${controls.map((row) => `<tr><td>${escapeHtml(compactCell(row, "위험요인별 감소대책"))}</td><td>작업반장</td><td>작업 전</td><td>사진·TBM·점검표</td><td>□</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="section">
      <h2>4. 공유·교육 및 재평가</h2>
      <table><tbody><tr><th>공유 방법</th><td>작업 전 TBM, 안전보건교육, 문자/메일 전파</td><th>재평가 기준</th><td>작업조건·장비·기상·인원 변경 또는 잔류위험 발생 시</td></tr></tbody></table>
    </section>`;
}

function renderWorkPlanRows(rows: PdfRow[], scenario: PdfScenario) {
  const steps = findByKeywords(rows, ["작업", "순서", "장비", "인원", "구간", "방법"], 6);
  const stopRules = findByKeywords(rows, ["중지", "비상", "강풍", "우천", "폭염", "위험"], 4);
  return `
    <section class="section">
      <h2>1. 작업개요</h2>
      <table class="meta-table"><tbody><tr><th>현장</th><td>${escapeHtml(scenario.siteName)}</td><th>작업</th><td>${escapeHtml(scenario.workSummary)}</td></tr><tr><th>작업인원</th><td>${scenario.workerCount.toLocaleString("ko-KR")}명</td><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 세부 작업순서 및 안전대책</h2>
      <table><thead><tr><th class="no">No.</th><th>세부작업</th><th>작업방법</th><th>안전대책</th><th>확인</th></tr></thead><tbody>${steps.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(compactCell(row, "작업방법 확인"))}</td><td>위험성평가·TBM 반영</td><td>□</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 장비·인원·첨부서류</h2>
      <table><thead><tr><th>확인 항목</th><th>해당</th><th>첨부</th><th>비고</th></tr></thead><tbody><tr><td>위험성평가표</td><td>■</td><td>□</td><td>감소대책 포함</td></tr><tr><td>TBM 참석명단</td><td>■</td><td>□</td><td>서명 포함</td></tr><tr><td>장비 검사증·자격증·MSDS</td><td>□</td><td>□</td><td>해당 시 첨부</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>4. 작업중지 및 재개 기준</h2>
      <table><thead><tr><th>중지 기준</th><th>판단자</th><th>전파 방법</th><th>재개 조건</th></tr></thead><tbody>${stopRules.map((row) => `<tr><td>${escapeHtml(compactCell(row, scenario.weatherNote))}</td><td>관리감독자</td><td>TBM·무전·문자</td><td>위험 제거 후 재확인</td></tr>`).join("")}</tbody></table>
    </section>`;
}

function renderPermitRows(rows: PdfRow[], scenario: PdfScenario) {
  const checks = findByKeywords(rows, ["허가", "차단", "격리", "보호구", "가스", "화재", "종료"], 6);
  return `
    <section class="section">
      <h2>1. 허가 기본정보</h2>
      <table class="meta-table"><tbody><tr><th>허가번호</th><td>PTW-${new Date().getFullYear()}-____</td><th>작업명</th><td>${escapeHtml(scenario.workSummary)}</td></tr><tr><th>장소</th><td>${escapeHtml(scenario.siteName)}</td><th>작업시간</th><td>____:____ ~ ____:____</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 작업 전 허가조건</h2>
      <table><thead><tr><th>확인 항목</th><th>적합</th><th>보완</th><th>확인 내용</th></tr></thead><tbody>${checks.map((row) => `<tr><td>${escapeHtml(row.item)}</td><td>□</td><td>□</td><td>${escapeHtml(compactCell(row, "허가조건 확인"))}</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 첨부서류 및 종료 확인</h2>
      <table><thead><tr><th>서류/상태</th><th>해당</th><th>확인</th><th>서명</th></tr></thead><tbody><tr><td>작업계획서</td><td>■</td><td>□</td><td></td></tr><tr><td>위험성평가표</td><td>■</td><td>□</td><td></td></tr><tr><td>작업 종료·원상복구</td><td>■</td><td>□</td><td></td></tr></tbody></table>
    </section>`;
}

function renderTbmRows(rows: PdfRow[], scenario: PdfScenario, topRisk: string) {
  const risks = findByKeywords(rows, ["위험", "조치", "작업중지", "기상", "보호구", "질문"], 5);
  return `
    <section class="section">
      <h2>1. TBM 회의 정보</h2>
      <table class="meta-table"><tbody><tr><th>일시</th><td>____년 ____월 ____일 ____시</td><th>장소</th><td>${escapeHtml(scenario.siteName)}</td></tr><tr><th>작업내용</th><td>${escapeHtml(scenario.workSummary)}</td><th>기상/환경</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 위험성평가 기반 전달사항</h2>
      <table><thead><tr><th class="no">No.</th><th>주요 유해·위험요인</th><th>오늘 기상/환경 신호</th><th>TBM 전달 문구</th><th>복창</th></tr></thead><tbody>${risks.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(compactCell(row, topRisk || "핵심위험"))}</td><td>${escapeHtml(scenario.weatherNote)}</td><td>작업 전 확인하고 이해하지 못하면 작업을 시작하지 않습니다.</td><td>□</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 참석자 확인</h2>
      <table><thead><tr><th>연번</th><th>성명</th><th>소속/역할</th><th>오전</th><th>오후</th><th>서명</th></tr></thead><tbody>${Array.from({ length: Math.max(4, Math.min(8, scenario.workerCount || 4)) }, (_, index) => `<tr><td>${index + 1}</td><td></td><td></td><td>□</td><td>□</td><td></td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>4. 미조치 위험 및 증빙</h2>
      <table><thead><tr><th>미조치 위험</th><th>후속조치</th><th>사진/영상 파일</th><th>확인자</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
    </section>`;
}

function renderEducationRows(rows: PdfRow[], scenario: PdfScenario) {
  const contents = findByKeywords(rows, ["교육", "보호구", "위험", "확인", "외국인", "신규"], 5);
  return `
    <section class="section">
      <h2>1. 교육 개요</h2>
      <table class="meta-table"><tbody><tr><th>교육명</th><td>${escapeHtml(scenario.workSummary)} 작업 전 안전보건교육</td><th>교육대상</th><td>투입 근로자 ${scenario.workerCount.toLocaleString("ko-KR")}명</td></tr><tr><th>교육방법</th><td>TBM 연계 구두교육·서명</td><th>작업조건</th><td>${escapeHtml(scenario.weatherNote)}</td></tr></tbody></table>
    </section>
    <section class="section">
      <h2>2. 교육 내용 및 이해 확인</h2>
      <table><thead><tr><th class="no">No.</th><th>교육 항목</th><th>주요 내용</th><th>확인방법</th></tr></thead><tbody>${contents.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.item)}</td><td>${escapeHtml(compactCell(row, "교육 내용"))}</td><td>구두 복창·서명</td></tr>`).join("")}</tbody></table>
    </section>
    <section class="section">
      <h2>3. 교육 실시 및 보관</h2>
      <table><tbody><tr><th>교육 실시자</th><td>____________________</td><th>보관 위치</th><td>문서철/전자폴더: ____________________</td></tr><tr><th>미이해자 조치</th><td colspan="3">□ 재설명 □ 통역 확인 □ 작업 배치 전 보완교육</td></tr></tbody></table>
    </section>`;
}

function renderStructuredRows(kind: PdfDocumentKind, scenario: PdfScenario, rows: PdfRow[], topRisk: string) {
  if (kind === "risk") return renderRiskAssessmentRows(rows, scenario, topRisk);
  if (kind === "workPlan") return renderWorkPlanRows(rows, scenario);
  if (kind === "permit") return renderPermitRows(rows, scenario);
  if (kind === "tbm") return renderTbmRows(rows, scenario, topRisk);
  if (kind === "education") return renderEducationRows(rows, scenario);
  return renderRows(rows);
}

function renderRows(rows: PdfRow[]) {
  const groups = groupRows(rows);
  if (!groups.length) {
    return `
      <section class="section">
        <h2>본문 확인</h2>
        <p class="empty">문서 본문이 비어 있습니다. 현장 확인 후 내용을 입력하세요.</p>
      </section>`;
  }

  return groups.map((group) => `
    <section class="section">
      <h2>${escapeHtml(group.section)}</h2>
      <table>
        <thead>
          <tr>
            <th class="no">No.</th>
            <th>항목</th>
            <th>내용</th>
            <th class="check">확인</th>
          </tr>
        </thead>
        <tbody>
          ${group.rows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.item)}</td>
              <td>${escapeHtml(row.content)}</td>
              <td>□ 확인<br />담당: ___</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function buildPdfReadyHtml(title: string, scenario: PdfScenario, rows: PdfRow[], riskLevel: string, topRisk: string) {
  const generatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const kind = detectDocumentKind(title);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f1e8;
      color: #15171b;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      line-height: 1.55;
    }
    .page {
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fffdf7;
      padding: 18mm 16mm;
      border: 1px solid #d7d0c2;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      border-bottom: 3px solid #17191d;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.04em; }
    .subtitle { margin: 8px 0 0; color: #5c6472; font-size: 13px; }
    .approval { display: grid; grid-template-columns: repeat(3, 70px); border: 1px solid #17191d; }
    .approval div { min-height: 58px; border-left: 1px solid #17191d; padding: 6px; text-align: center; font-size: 12px; }
    .approval div:first-child { border-left: 0; }
    .approval b { display: block; margin-bottom: 14px; }
    .meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border: 1px solid #17191d;
      margin-bottom: 16px;
    }
    .meta div { padding: 10px 12px; border-right: 1px solid #17191d; border-bottom: 1px solid #17191d; }
    .meta div:nth-child(2n) { border-right: 0; }
    .meta div:nth-last-child(-n+2) { border-bottom: 0; }
    .meta b { display: block; color: #4f5663; font-size: 12px; margin-bottom: 3px; }
    .riskbox {
      display: grid;
      grid-template-columns: 130px 1fr;
      border: 2px solid #17191d;
      margin-bottom: 18px;
    }
    .riskbox b { padding: 12px; background: #f5de41; border-right: 2px solid #17191d; }
    .riskbox span { padding: 12px; }
    .section { margin-top: 18px; break-inside: avoid; }
    h2 { margin: 0 0 8px; font-size: 18px; border-left: 5px solid #17191d; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #17191d; padding: 8px; vertical-align: top; font-size: 12px; word-break: keep-all; overflow-wrap: anywhere; }
    th { background: #ebe6dc; }
    .meta-table th { width: 18%; }
    .meta-table td { width: 32%; }
    .no { width: 44px; }
    .check { width: 92px; }
    .signature {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid #17191d;
      margin-top: 22px;
    }
    .signature div { min-height: 54px; border-right: 1px solid #17191d; padding: 9px; font-size: 12px; }
    .signature div:last-child { border-right: 0; }
    .notice {
      margin-top: 18px;
      border: 2px solid #17191d;
      padding: 10px 12px;
      font-size: 12px;
      background: #fff8d8;
    }
    .empty { color: #6b7280; }
    @media print {
      body { background: #fff; }
      .page { border: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="topline">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">SafeClaw 공식자료 기반 제출용 출력 초안 · 생성 ${escapeHtml(generatedAt)}</p>
      </div>
      <div class="approval">
        <div><b>작성</b>서명</div>
        <div><b>검토</b>서명</div>
        <div><b>승인</b>서명</div>
      </div>
    </header>
    <section class="meta">
      <div><b>사업장</b>${escapeHtml(scenario.companyName)}</div>
      <div><b>현장</b>${escapeHtml(scenario.siteName)}</div>
      <div><b>작업내용</b>${escapeHtml(scenario.workSummary)}</div>
      <div><b>인원/기상</b>${scenario.workerCount.toLocaleString("ko-KR")}명 · ${escapeHtml(scenario.weatherNote)}</div>
    </section>
    <section class="riskbox">
      <b>위험수준 ${escapeHtml(riskLevel || "확인")}</b>
      <span>${escapeHtml(topRisk || "핵심 위험요인을 현장에서 최종 확인하세요.")}</span>
    </section>
    ${renderStructuredRows(kind, scenario, rows, topRisk)}
    <section class="signature">
      <div><b>작성자</b><br />성명/서명:</div>
      <div><b>관리감독자</b><br />성명/서명:</div>
      <div><b>TBM·교육 확인</b><br />성명/서명:</div>
      <div><b>보관 위치</b><br />문서번호/철:</div>
    </section>
    <p class="notice">본 출력물은 공식자료 기반 초안입니다. 발주처 지정 원본 양식, 현장 실측, 작업중지 기준, 법령 원문, 서명·결재선을 최종 확인한 뒤 사용하세요.</p>
  </main>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const parsed = await request.json().catch((): unknown => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const title = readString(body.title, "SafeClaw 제출 문서");
  const scenario = parseScenario(body.scenario);
  const rows = parseRows(body.rows, title);
  const bodyRows = rows.length ? rows : parseBodyText(body.documentText, title);
  const riskLevel = readString(body.riskLevel, "확인");
  const topRisk = readString(body.topRisk, "");
  const html = buildPdfReadyHtml(title, scenario, bodyRows, riskLevel, topRisk);
  const fileName = `${sanitizeFileName(`${scenario.companyName}-${title}`)}.html`;
  const encodedFileName = encodeURIComponent(fileName);

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="safeclaw-pdf-ready.html"; filename*=UTF-8''${encodedFileName}`,
      "cache-control": "no-store"
    }
  });
}
