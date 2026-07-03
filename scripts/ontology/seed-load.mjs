#!/usr/bin/env node
// 안전 온톨로지 시드 적재 — lib/ontology/seed/core-triples.json → Supabase.
// service role env(SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) 필요. idempotent(upsert).
//
// 사용:
//   node scripts/ontology/seed-load.mjs --dry   # 적재 없이 통계·검증만 출력
//   node scripts/ontology/seed-load.mjs         # 실제 적재 (코디네이터 수행)
//
// 규칙: 확신도 '높음' → review_state='published', '중간' → 'draft'(+meta.confidence)
//       — 시드 JSON에 이미 반영되어 있으며 이 스크립트는 그대로 적재만 한다.
//       무출처(cited_uids 빈) 행이 발견되면 적재를 중단한다 (provenance 게이트).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_JSON = path.resolve(__dirname, "..", "..", "lib", "ontology", "seed", "core-triples.json");

const VALID_KINDS = new Set(["Task", "Hazard", "Control", "Article", "Accident", "Document", "Duty"]);
const VALID_RELS = new Set([
  "entailsHazard",
  "mitigatedBy",
  "mandatedBy",
  "evidencedBy",
  "documentedIn",
  "fulfillsDuty",
  "relatedTo"
]);
const VALID_STATES = new Set(["draft", "verified", "published"]);
const UID_RE = /^(law|ref|case|kb|manual):.+$/;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function validate(seed) {
  const nodeIds = new Set();
  for (const node of seed.nodes) {
    if (!node.node_id || nodeIds.has(node.node_id)) fail(`노드 id 중복/누락: ${node.node_id}`);
    nodeIds.add(node.node_id);
    if (!VALID_KINDS.has(node.kind)) fail(`kind 위반: ${node.node_id} → ${node.kind}`);
    if (!VALID_STATES.has(node.review_state)) fail(`review_state 위반: ${node.node_id}`);
    if (!Array.isArray(node.cited_uids) || node.cited_uids.length === 0) fail(`무출처 노드: ${node.node_id}`);
    for (const uid of node.cited_uids) if (!UID_RE.test(uid)) fail(`uid 형식 위반: ${node.node_id} → ${uid}`);
  }
  const edgeKeys = new Set();
  for (const edge of seed.edges) {
    const key = `${edge.src}|${edge.rel}|${edge.dst}`;
    if (edgeKeys.has(key)) fail(`엣지 중복: ${key}`);
    edgeKeys.add(key);
    if (!VALID_RELS.has(edge.rel)) fail(`rel 위반: ${key}`);
    if (!VALID_STATES.has(edge.review_state)) fail(`review_state 위반: ${key}`);
    if (!nodeIds.has(edge.src) || !nodeIds.has(edge.dst)) fail(`dangling 엣지: ${key}`);
    if (!Array.isArray(edge.cited_uids) || edge.cited_uids.length === 0) fail(`무출처 엣지: ${key}`);
    for (const uid of edge.cited_uids) if (!UID_RE.test(uid)) fail(`uid 형식 위반: ${key} → ${uid}`);
  }
}

async function upsert(config, table, onConflict, rows) {
  const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`${table} upsert 실패: ${response.status} ${body}`);
  }
}

async function main() {
  const dry = process.argv.includes("--dry");
  const seed = JSON.parse(readFileSync(SEED_JSON, "utf-8"));
  validate(seed);

  console.log(`시드: ${seed.source}`);
  console.log(JSON.stringify(seed.stats, null, 2));
  console.log(
    `published 노드 ${seed.stats.published_nodes} / draft 노드 ${seed.stats.draft_nodes} · ` +
      `published 엣지 ${seed.stats.published_edges} / draft 엣지 ${seed.stats.draft_edges}`
  );

  if (dry) {
    console.log("\n--dry: 검증만 완료. 적재하지 않았습니다.");
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env가 필요합니다.");
  const config = { url: url.replace(/\/$/, ""), key };

  // 노드 먼저(FK 참조), 그다음 엣지.
  await upsert(config, "safety_ontology_nodes", "node_id", seed.nodes);
  console.log(`노드 upsert 완료: ${seed.nodes.length}`);
  await upsert(config, "safety_ontology_edges", "src,rel,dst", seed.edges);
  console.log(`엣지 upsert 완료: ${seed.edges.length}`);
  console.log("\n시드 적재 완료 (idempotent — 재실행 안전).");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
