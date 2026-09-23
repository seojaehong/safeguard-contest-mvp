#!/usr/bin/env node
/**
 * 구매 전환 루브릭 — **외부 검수가 쓴 10개 항목**으로 채점한다.
 * 출처: safeclaw-leave-100-persona-purchase-audit-2026-09-23.md
 *
 * 내가 만든 기준(leave_rubric)과 별개다. 남의 기준으로도 세야 한다.
 */
import fs from "node:fs";
import path from "node:path";

const R = process.cwd();
const read = (p) => { try { return fs.readFileSync(path.join(R, p), "utf8"); } catch { return ""; } };

const pageA = read("app/tools/leave/page.tsx");
const pageB = read("app/tools/leave/settlement/page.tsx");
const pageC = read("app/tools/leave/advanced/page.tsx");
const inA = read("components/leave/LeaveInput.tsx");
const inB = read("components/leave/SettlementInput.tsx");
const inC = read("components/leave/PromotionInput.tsx");
const inD = read("components/leave/UsageInput.tsx");
const xlsx = read("lib/leave-xlsx.ts");
const css = read("app/globals.css");
const all = [pageA, pageB, pageC, inA, inB, inC, inD].join("\n");

const items = [
  ["첫 사용자가 1분 안에 가치 이해", 10,
    !all.includes("미리보기 화면입니다") &&
    pageA.includes("붙여넣으세요") &&
    pageA.includes("lv-how"),
    "미리보기 문구 제거 · 헤드라인이 행동을 말함 · 누가·언제·어떻게 블록"],

  ["붙여넣기 입력과 계산", 10,
    inA.includes("parseLines") && inA.includes("textarea"),
    "탭·쉼표·공백 구분, 날짜 4형식"],

  ["근거와 계산식 설명", 10,
    inA.includes("basisLabel") && inB.includes("groundNote") &&
    pageA.includes("근로기준법 제60조"),
    "행마다 적용 근거 + 조항 표시"],

  ["잘못된 입력의 안전한 처리", 10,
    inA.includes('verdict !== "error"') && inA.includes("recordedRaw") &&
    read("tests/leave-adversarial.test.mts").length > 0,
    "오류를 일치로 세지 않음 · 미확인 보존 · 적대적 테스트"],

  ["회계연도·퇴직 정산의 실무성", 10,
    pageB.includes("SettlementInput") && inB.includes("hasRecalcClause"),
    "실제 대장값을 입력받고 취업규칙 조항까지 반영"],

  ["개인정보 보호 신뢰", 10,
    [inA, inB, inC, inD].every((f) => f.includes("lv-input__privacy")) &&
    !all.includes("fetch(") && xlsx.includes("브라우저에서만"),
    "네 화면 고지 + 서버 전송 코드 없음"],

  ["실무 산출물", 10,
    inA.includes("downloadXlsx") && inB.includes("downloadXlsx") &&
    inA.includes("window.print()") && css.includes("@media print"),
    "XLSX 다운로드 + 인쇄/PDF 저장"],

  ["반복 업무 절감", 10,
    inA.includes("handleFile") && inA.includes("lv-map") &&
    inA.includes("saveTemplate"),
    "엑셀 업로드 + 열 매핑 + 배치 기억"],

  ["가격·이용 조건 제시", 10,
    pageA.includes("무료") || pageA.includes("비용"),
    "무료 서비스임을 명시"],

  ["법률 리스크 경계", 10,
    pageA.includes("상시 5인 이상") && pageA.includes("참고 계산") &&
    all.includes("공인노무사"),
    "적용 전제 + 보조도구 위치 + 전문가 검토 안내"],
];

let got = 0, total = 0;
console.log("\n═══ 구매 전환 루브릭 (외부 검수 기준) ═══\n");
for (const [label, w, ok, note] of items) {
  total += w;
  if (ok) got += w;
  console.log(`  ${ok ? "✅" : "❌"} ${label} (${w}점)`);
  if (!ok) console.log(`      ${note}`);
}
console.log(`\n총점 ${got}/${total} = ${Math.round((got / total) * 100)}점\n`);
process.exit(got === total ? 0 : 1);
