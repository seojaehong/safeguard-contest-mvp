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
    ${renderRows(rows)}
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
