#!/usr/bin/env node
// 화이트리스트 diff 리포트 (읽기 전용) — Phase C 감사용.
//
// published Article 노드(기준규칙)와 lib/law-citation-gate.ts의 VERIFIED_ARTICLES.기준규칙을
// 대조한다. 어떤 데이터·파일도 변경하지 않는다. 향후 시드 확장/화이트리스트 갱신 시
// 두 소스가 어긋났는지 감사하는 용도다.
//
//   [A] published Article 인데 화이트리스트에 없음  → 게이트가 클로 답변에서 삭제하는 조문
//                                                    (온톨로지는 노출하는데 게이트가 막는 불일치)
//   [B] 화이트리스트에 있는데 published Article 노드 없음 → 온톨로지 미반영(정보성)
//
// 사용: node scripts/ontology/gen-whitelist.mjs
// env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GATE_PATH = resolve(__dirname, "../../lib/law-citation-gate.ts");
const LAW_기준규칙 = "산업안전보건기준에 관한 규칙";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/** lib/law-citation-gate.ts 소스에서 VERIFIED_ARTICLES.기준규칙 집합을 추출한다(파일이 authoritative). */
async function parseWhitelist() {
  const src = await readFile(GATE_PATH, "utf8");
  const start = src.indexOf("기준규칙: new Set([");
  if (start < 0) fail("law-citation-gate.ts에서 기준규칙 Set을 찾지 못했습니다.");
  const open = src.indexOf("[", start);
  const close = src.indexOf("])", open);
  const block = src.slice(open + 1, close);
  const set = new Set();
  for (const m of block.matchAll(/"([^"]+)"/g)) set.add(m[1]);
  for (const m of block.matchAll(/range\((\d+),\s*(\d+)\)/g)) {
    for (let n = Number(m[1]); n <= Number(m[2]); n++) set.add(String(n));
  }
  return set;
}

async function fetchPublishedArticles(config) {
  const url = `${config.url}/rest/v1/safety_ontology_nodes?select=node_id,label,meta&kind=eq.Article&review_state=eq.published&limit=10000`;
  const response = await fetch(url, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }
  });
  if (!response.ok) fail(`Article 조회 실패: ${response.status} ${await response.text().catch(() => "")}`);
  return await response.json();
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env가 필요합니다.");
  const config = { url: url.replace(/\/$/, ""), key };

  const whitelist = await parseWhitelist();
  const articles = await fetchPublishedArticles(config);

  const publishedNos = new Set();
  const outside = [];
  for (const a of articles) {
    const meta = a.meta && typeof a.meta === "object" ? a.meta : {};
    if (meta.law !== LAW_기준규칙) continue;
    const no = meta.article_no != null ? String(meta.article_no) : null;
    if (!no) continue;
    publishedNos.add(no);
    if (!whitelist.has(no)) outside.push({ no, node_id: a.node_id, label: a.label });
  }

  const missing = [...whitelist].filter((no) => !publishedNos.has(no)).sort((x, y) => x.localeCompare(y, "ko"));

  console.log(`화이트리스트(기준규칙) ${whitelist.size}개 / published 기준규칙 Article ${publishedNos.size}개\n`);
  console.log(`[A] published 인데 화이트리스트 밖: ${outside.length}`);
  for (const a of outside.sort((x, y) => x.node_id.localeCompare(y.node_id, "ko"))) {
    console.log(`    제${a.no}조 — ${a.node_id} "${a.label}"`);
  }
  console.log(`\n[B] 화이트리스트에 있으나 published 노드 없음(정보성): ${missing.length}`);
  console.log(`    ${missing.map((n) => `제${n}조`).join(", ")}`);

  console.log(`\n결론: 불일치(A) ${outside.length}건. 읽기 전용 리포트이며 파일/DB를 변경하지 않았습니다.`);
  process.exit(0);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
