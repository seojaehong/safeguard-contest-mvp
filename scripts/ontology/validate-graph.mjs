#!/usr/bin/env node
// 안전 온톨로지 검증 리포트 (읽기 전용) — Supabase 전체(draft 포함) 그래프에 대해
//   1) 무출처(cited_uids 빈) 노드/엣지
//   2) 고아 노드 (엣지가 하나도 안 걸린 노드)
//   3) 화이트리스트(lib/law-citation-gate.ts VERIFIED_ARTICLES.기준규칙) 밖 Article
// 을 리포트한다. 어떤 데이터도 변경하지 않는다.
//
// 사용: node scripts/ontology/validate-graph.mjs
// env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (draft까지 보려면 service role 필수)

// lib/law-citation-gate.ts의 VERIFIED_ARTICLES.기준규칙 스냅숏 (2026-07-03 기준).
// Phase C의 gen-whitelist.mjs가 published Article → 화이트리스트 diff 생성을 담당하며,
// 이 리포트의 "화이트리스트 밖" 항목이 그 추가 후보다. 조문 표기: "241의2" 형식.
const WHITELIST_기준규칙 = new Set([
  "32", "38", "39", "40", "86",
  "171", "172", "173", "174", "175", "176", "177", "178", "179",
  "180", "181", "182", "183",
  "241", "241의2", "562", "566", "567"
]);

const UID_RE = /^(law|ref|case|kb|manual):.+$/;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function fetchAll(config, table) {
  const response = await fetch(`${config.url}/rest/v1/${table}?select=*&limit=10000`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }
  });
  if (!response.ok) fail(`${table} 조회 실패: ${response.status} ${await response.text().catch(() => "")}`);
  return await response.json();
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env가 필요합니다.");
  const config = { url: url.replace(/\/$/, ""), key };

  const [nodes, edges] = await Promise.all([
    fetchAll(config, "safety_ontology_nodes"),
    fetchAll(config, "safety_ontology_edges")
  ]);
  console.log(`노드 ${nodes.length} / 엣지 ${edges.length} (draft 포함 전체)\n`);

  // 1) 무출처
  const uncitedNodes = nodes.filter(
    (n) => !Array.isArray(n.cited_uids) || n.cited_uids.length === 0 || n.cited_uids.some((u) => !UID_RE.test(u))
  );
  const uncitedEdges = edges.filter(
    (e) => !Array.isArray(e.cited_uids) || e.cited_uids.length === 0 || e.cited_uids.some((u) => !UID_RE.test(u))
  );
  console.log(`[1] 무출처/uid형식위반 노드: ${uncitedNodes.length}`);
  for (const n of uncitedNodes) console.log(`    ${n.node_id} (${n.kind}) "${n.label}"`);
  console.log(`[1] 무출처/uid형식위반 엣지: ${uncitedEdges.length}`);
  for (const e of uncitedEdges) console.log(`    ${e.src} -${e.rel}→ ${e.dst}`);

  // 2) 고아 노드
  const connected = new Set();
  for (const e of edges) {
    connected.add(e.src);
    connected.add(e.dst);
  }
  const orphans = nodes.filter((n) => !connected.has(n.node_id));
  console.log(`\n[2] 고아 노드 (엣지 0): ${orphans.length}`);
  for (const n of orphans) console.log(`    ${n.node_id} (${n.kind}, ${n.review_state}) "${n.label}"`);

  // 3) 화이트리스트 밖 Article (기준규칙만 — 그 외 법령은 스킵 리포트)
  const articles = nodes.filter((n) => n.kind === "Article");
  const outside = [];
  const otherLaw = [];
  for (const a of articles) {
    const articleNo = a.meta && typeof a.meta === "object" ? a.meta.article_no : undefined;
    const law = a.meta && typeof a.meta === "object" ? a.meta.law : undefined;
    if (law !== "산업안전보건기준에 관한 규칙") {
      otherLaw.push(a);
      continue;
    }
    if (!articleNo || !WHITELIST_기준규칙.has(String(articleNo))) outside.push(a);
  }
  console.log(`\n[3] 화이트리스트(기준규칙) 밖 Article: ${outside.length} — Phase C gen-whitelist 추가 후보`);
  for (const a of outside.sort((x, y) => String(x.node_id).localeCompare(String(y.node_id), "ko"))) {
    console.log(`    ${a.node_id} (${a.review_state}) "${a.label}"`);
  }
  if (otherLaw.length > 0) {
    console.log(`[3] 기준규칙 외 법령 Article (화이트리스트 대조 스킵): ${otherLaw.length}`);
    for (const a of otherLaw) console.log(`    ${a.node_id} "${a.label}"`);
  }

  const issueCount = uncitedNodes.length + uncitedEdges.length;
  console.log(`\n결론: provenance 위반 ${issueCount}건, 고아 ${orphans.length}건, 화이트리스트 후보 ${outside.length}건`);
  process.exit(issueCount > 0 ? 2 : 0);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
