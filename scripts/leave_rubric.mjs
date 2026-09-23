#!/usr/bin/env node
/**
 * 연차 도구 루브릭 — 100점 채점 + E2E 드라이런.
 *
 * 왜 루브릭인가: "다 됐다"는 말은 검증이 아니다. 무엇을 만족해야 하는지 먼저 적고,
 * 그 항목을 기계가 세야 한다. 항목은 **법적 정확성 · 안전선 · 사용성** 세 축이다.
 *
 * 실행
 *   node scripts/leave_rubric.mjs            # 유닛 축만 (서버 불필요)
 *   LEAVE_BASE_URL=http://127.0.0.1:3000 node scripts/leave_rubric.mjs   # E2E 포함
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE_URL = process.env.LEAVE_BASE_URL || "";
const OUT_DIR = path.join(ROOT, "evaluation", "leave-rubric");

const results = [];
function score(axis, id, label, weight, ok, detail = "") {
  results.push({ axis, id, label, weight, ok: Boolean(ok), detail });
}

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

function runTest(file) {
  try {
    const out = execFileSync(
      "node",
      ["--experimental-strip-types", path.join("tests", file)],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 }
    );
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: String(e.stdout || e.message).trim() };
  }
}

// ══ 축 1. 법적 정확성 (40점) ══════════════════════════════════
const t1 = runTest("annual-leave.crosscheck.mts");
score("법적 정확성", "L1", "발생일수가 Frappe 엔진과 교차 일치(8건)", 8, t1.ok, t1.out);

const t2 = runTest("leave-ledger.crosscheck.mts");
score("법적 정확성", "L2", "퇴직정산이 근로기준과-5802 본문값과 일치(79/62/26일)", 12, t2.ok, t2.out);

const t3 = runTest("leave-advanced.test.mts");
score("법적 정확성", "L3", "출근율 80%·회계연도 비례(최영우 7.5일)", 10, t3.ok, t3.out);

const t4 = runTest("leave-usage.test.mts");
score("법적 정확성", "L4", "반차·반반차·시간차 환산(소정근로시간 반영)", 5, t4.ok, t4.out);

const ledger = read("lib/leave-ledger.ts");
score(
  "법적 정확성", "L5", "취업규칙 재산정 조항을 입력으로 받는다(최영우 산정 예)", 5,
  ledger.includes("hasRecalcClause") && ledger.includes("최영우"),
  "회계연도가 많을 때 조항 유무로 결과가 갈린다"
);

// ══ 축 2. 안전선 — 넘지 말아야 할 것 (40점) ═══════════════════
const t5 = runTest("leave-guardrails.test.mts");
score("안전선", "S1", "제우스 출시 게이트 통과(10건)", 15, t5.ok, t5.out);

const allowance = read("lib/leave-allowance.ts");
score(
  "안전선", "S2", "통상임금을 산정하지 않고 입력받는다", 6,
  allowance.includes("통상임금을 우리가 산정하지 않는다") &&
    allowance.includes("insufficient-input"),
  "단가·출처가 없으면 금액을 내지 않는다"
);

const exposed = ["app", "components"].some((d) => {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) return false;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(tsx?|mjs)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("leave-allowance"))
        return true;
    }
  }
  return false;
});
score("안전선", "S3", "수당 엔진이 화면·API에 노출되지 않음", 7, !exposed,
  exposed ? "노출됨 — 재홍님 지시 위반" : "노출 0건");

const advanced = read("lib/leave-advanced.ts");
score(
  "안전선", "S4", "소멸시효를 개별 일수와 연결하지 않는다", 6,
  advanced.includes("assertNoPrescriptionMath") &&
    !/\d+\s*일[^.]{0,12}시효/.test(advanced.replace(/^\s*\*.*$/gm, "")),
  "가드 함수로 개발 중 실수도 막는다"
);

const promo = read("lib/leave-promotion.ts");
score(
  "안전선", "S5", "촉진 적법성을 판정하지 않는다", 6,
  promo.includes("적법성은 확인하지 않았습니다") &&
    promo.includes("일정 대조: 일치") &&
    promo.includes("out-of-scope") &&
    read("app/tools/leave/advanced/page.tsx").includes("scheduleStatusLabel"),
  "1년 미만은 범위밖, 라벨은 「일정 대조」, 화면도 같은 라벨을 쓴다"
);

// ══ 축 3. 사용성·투명성 (20점) ════════════════════════════════
const pageA = read("app/tools/leave/page.tsx");
const pageB = read("app/tools/leave/settlement/page.tsx");
const ui = read("components/leave/LeaveUI.tsx");

const pageC = read("app/tools/leave/advanced/page.tsx");
score("사용성", "U1", "결론이 화면 최상단에 온다", 5,
  pageA.includes("ConclusionBanner") && pageB.includes("ConclusionBanner") &&
  pageC.includes("ConclusionBanner"));

score("사용성", "U2", "데모 성격을 고정 표시한다", 4,
  pageA.includes("DemoNotice") && pageB.includes("DemoNotice") && pageC.includes("DemoNotice"));

score("사용성", "U3", "다루지 않는 범위를 먼저 밝힌다", 4,
  pageA.includes("ScopeNote") && pageB.includes("ScopeNote") && pageC.includes("ScopeNote"));

score("사용성", "U4", "상태를 색만으로 구분하지 않는다(기호 병기)", 4,
  ui.includes("lv-badge__mark") && ui.includes('mark: "≠"'));

score("사용성", "U5", "모바일에서 표가 카드로 무너진다", 3,
  read("app/globals.css").includes("data-label") &&
    pageA.includes('data-label="입사일"'));

// ══ E2E 드라이런 (서버가 있을 때만) ═══════════════════════════
const e2e = [];
if (BASE_URL) {
  const paths = [
    ["/tools/leave", ["가상 데이터 데모", "조건상 일치", "적용 근거"]],
    ["/tools/leave/settlement", ["정산", "근로기준과-5802", "유리한 쪽"]],
    ["/tools/leave/settlement?case=fiscal-favourable", ["회계연도", "재산정"]],
    ["/tools/leave/advanced", ["사용 단위", "출근율", "비례부여", "사용촉진", "확인 불가"]],
  ];
  for (const [p, musts] of paths) {
    try {
      const res = await fetch(`${BASE_URL}${p}`, { signal: AbortSignal.timeout(20000) });
      const html = await res.text();
      const missing = musts.filter((m) => !html.includes(m));
      e2e.push({ path: p, status: res.status, ok: res.ok && missing.length === 0, missing });
    } catch (err) {
      e2e.push({ path: p, status: null, ok: false, missing: [String(err)] });
    }
  }
  const allOk = e2e.every((r) => r.ok);
  score("E2E", "E1", `라우트 ${e2e.length}개가 200 + 필수 문구 포함`, 0, allOk,
    JSON.stringify(e2e));
}

// ══ 채점 ══════════════════════════════════════════════════════
const total = results.reduce((s, r) => s + r.weight, 0);
const got = results.reduce((s, r) => s + (r.ok ? r.weight : 0), 0);
const pct = total ? Math.round((got / total) * 1000) / 10 : 0;

const byAxis = {};
for (const r of results) {
  byAxis[r.axis] ??= { got: 0, total: 0 };
  byAxis[r.axis].total += r.weight;
  if (r.ok) byAxis[r.axis].got += r.weight;
}

console.log("\n═══ 연차 도구 루브릭 ═══");
for (const [axis, v] of Object.entries(byAxis)) {
  if (v.total === 0) continue;
  console.log(`\n[${axis}] ${v.got}/${v.total}`);
  for (const r of results.filter((x) => x.axis === axis)) {
    if (r.weight === 0) continue;
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.id} (${r.weight}점) ${r.label}`);
    if (!r.ok && r.detail) console.log(`      ${r.detail.split("\n")[0].slice(0, 100)}`);
  }
}
if (e2e.length) {
  console.log("\n[E2E 드라이런]");
  for (const r of e2e) {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.path} → ${r.status}${r.missing.length ? ` · 누락 ${r.missing.join(", ")}` : ""}`);
  }
} else {
  console.log("\n[E2E 드라이런] 건너뜀 — LEAVE_BASE_URL 이 없습니다");
}

console.log(`\n총점 ${got}/${total} = ${pct}점`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(
  path.join(OUT_DIR, `rubric-${stamp}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), got, total, pct, results, e2e }, null, 2)
);

process.exit(pct === 100 ? 0 : 1);
