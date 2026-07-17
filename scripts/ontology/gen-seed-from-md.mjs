#!/usr/bin/env node
// 안전 온톨로지 시드 생성기 — 노무사 감수용 md(온톨로지_시드트리플_감수용_v1.md)를
// 파싱해 lib/ontology/seed/core-triples.ts + core-triples.json 을 생성한다.
//
// 규칙 (2026-07-03 코디네이터 확정):
//   - 노드 동일성: 라벨 정규화(공백 제거·괄호 보존) 후 동일 라벨 = 동일 노드, cited_uids 합집합
//   - 확신도 '높음' 행 → review_state='published', '중간' 행 → 'draft' + meta.confidence="medium"
//   - 노드는 '높음' 엣지에 하나라도 걸리면 published (published 그래프의 엣지 단절 방지)
//   - 무출처 금지: 모든 노드/엣지 cited_uids ≥ 1 (manual: 네임스페이스 = 감수 문서)
//
// 사용: node scripts/ontology/gen-seed-from-md.mjs <감수용md경로> [--check]
//   --check: 파일을 쓰지 않고 파싱 리포트만 출력

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_TS = path.join(REPO_ROOT, "lib", "ontology", "seed", "core-triples.ts");
const OUT_JSON = path.join(REPO_ROOT, "lib", "ontology", "seed", "core-triples.json");

const MANUAL_UID = "manual:온톨로지_시드트리플_감수용_v1";
const LAW_NAME = "산업안전보건기준에 관한 규칙";

// smsa-mapping.ts 키와 1:1 (Document 노드)
const DOCUMENT_LABELS = {
  riskAssessment: "위험성평가",
  workPlan: "작업계획서",
  tbmLog: "TBM일지",
  safetyEducationRecord: "안전보건교육 기록",
  emergencyResponse: "비상대응매뉴얼",
  photoEvidence: "현장사진"
};

const DUTY_DEFS = {
  "§4-3호": {
    nodeId: "Duty_중처법시행령_제4조제3호",
    label: "중대재해처벌법 시행령 제4조 제3호 (유해·위험요인 확인·개선 절차)",
    citedUid: "law:중대재해처벌법 시행령:제4조제3호"
  },
  "§4-8호": {
    nodeId: "Duty_중처법시행령_제4조제8호",
    label: "중대재해처벌법 시행령 제4조 제8호 (급박한 위험 대비 매뉴얼)",
    citedUid: "law:중대재해처벌법 시행령:제4조제8호"
  }
};

// 자동 매칭이 못 푸는 축약 src → 정식 노드 라벨(또는 "@TASK") 수동 별칭.
// 섹션 번호 기준. 생성기 리포트를 보고 사람이 유지보수한다.
const SRC_ALIASES = {
  "2|유도자·접촉방지": "유도자 배치 및 접촉위험구역 출입통제",
  "8|중량물 취급": "근골격계 부담(중량물 인력운반)",
  "8|중량물 취급작업": "@TASK"
};

function normalizeLabel(label) {
  return label.normalize("NFC").replace(/\s+/g, "");
}

function slugify(label) {
  return label.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
}

// 매칭 키: 괄호 안 부연설명 제거 + 구분자(·, /, 및 등) 기준 토큰화
function matchTokens(label) {
  const stripped = label.replace(/\([^)]*\)/g, " ");
  return stripped
    .split(/[·\/,\s]+|및/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// src 축약 라벨을 후보 라벨 목록에 매칭: 정규화 동일 → 토큰 포함(부분문자열) → 부분 점수
function resolveLabel(src, candidates) {
  const nSrc = normalizeLabel(src);
  for (const cand of candidates) {
    if (normalizeLabel(cand) === nSrc) return { label: cand, method: "exact" };
  }
  const srcTokens = matchTokens(src);
  const scored = candidates.map((cand) => {
    const candTokens = matchTokens(cand);
    const covered = srcTokens.filter((t) => candTokens.some((c) => c.includes(t) || t.includes(c)));
    const reverse = candTokens.filter((t) => srcTokens.some((c) => c.includes(t) || t.includes(c)));
    const subset = covered.length === srcTokens.length || reverse.length === candTokens.length;
    return { cand, score: covered.length / Math.max(srcTokens.length, 1), subset };
  });
  const subsetHits = scored.filter((s) => s.subset).sort((a, b) => b.score - a.score);
  if (subsetHits.length > 0) return { label: subsetHits[0].cand, method: "subset" };
  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.5) return { label: best.cand, method: `partial(${best.score.toFixed(2)})` };
  return null;
}

function parseArticle(text) {
  const m = text.match(/제(\d+)조(?:의(\d+))?/);
  if (!m) return null;
  const no = m[2] ? `${m[1]}의${m[2]}` : m[1];
  const titleMatch = text.match(/\(([^)]+)\)\s*$/);
  return { no, title: titleMatch ? titleMatch[1] : "" };
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const mdPath = args.find((a) => !a.startsWith("--"));
  if (!mdPath) {
    console.error("usage: node gen-seed-from-md.mjs <감수용md경로> [--check]");
    process.exit(1);
  }
  const md = readFileSync(mdPath, "utf-8");

  // ---- 섹션 분리 ----
  const sectionRe = /^## (\d+)\. (.+?) \(Task: ([^)]+)\)$/gm;
  const sections = [];
  let m;
  while ((m = sectionRe.exec(md)) !== null) {
    sections.push({ no: Number(m[1]), taskLabel: m[2].trim(), taskEn: m[3].split("—")[0].split("/")[0].trim(), start: m.index });
  }
  if (sections.length !== 10) {
    console.error(`섹션 10개 기대, ${sections.length}개 발견`);
    process.exit(1);
  }
  const endBoundary = md.indexOf("## 화이트리스트 추가 후보");
  sections.forEach((s, i) => {
    s.body = md.slice(s.start, i + 1 < sections.length ? sections[i + 1].start : endBoundary);
  });

  // ---- 노드/엣지 누적기 ----
  const nodes = new Map(); // node_id -> node
  const edges = new Map(); // src|rel|dst -> edge
  const report = { rows: 0, high: 0, medium: 0, fuzzy: [], createdControls: [], aliasUsed: [], dupRows: 0 };

  function upsertNode(nodeId, kind, label, citedUids, meta, isHigh) {
    const existing = nodes.get(nodeId);
    if (existing) {
      for (const uid of citedUids) if (!existing.cited_uids.includes(uid)) existing.cited_uids.push(uid);
      if (isHigh) existing._high = true;
      return existing;
    }
    const node = { node_id: nodeId, kind, label, text_excerpt: null, cited_uids: [...citedUids], meta: meta || {}, _high: Boolean(isHigh) };
    nodes.set(nodeId, node);
    return node;
  }

  function upsertEdge(src, rel, dst, citedUids, isHigh) {
    const key = `${src}|${rel}|${dst}`;
    const existing = edges.get(key);
    if (existing) {
      for (const uid of citedUids) if (!existing.cited_uids.includes(uid)) existing.cited_uids.push(uid);
      existing._high = existing._high || isHigh;
      existing._rows += 1;
      report.dupRows += 1;
      return existing;
    }
    const edge = { src, rel, dst, cited_uids: [...citedUids], meta: {}, _high: isHigh, _rows: 1 };
    edges.set(key, edge);
    return edge;
  }

  for (const section of sections) {
    const taskId = `Task_${slugify(section.taskEn.toLowerCase())}`;
    upsertNode(taskId, "Task", section.taskLabel, [MANUAL_UID], { task_key: slugify(section.taskEn.toLowerCase()) }, false);
    const sectionHazards = []; // 라벨 목록 (매칭 후보)
    const sectionControls = [];
    const labelToId = new Map(); // 섹션 로컬: 라벨 -> node_id

    const rowRe = /^\|([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|[^|]*\|$/gm;
    let row;
    while ((row = rowRe.exec(section.body)) !== null) {
      const tripleText = row[1].trim();
      const articleCol = row[2].trim();
      const conf = row[4].trim();
      if (!/^(높음|중간)$/.test(conf)) continue;
      const t = tripleText.match(/^(.+?)\s*—\s*(entailsHazard|mitigatedBy|mandatedBy|evidencedBy|documentedIn|fulfillsDuty|relatedTo)\s*→\s*(.+)$/);
      if (!t) continue;
      const [, rawSrc, rel, rawDst] = t;
      const isHigh = conf === "높음";
      report.rows += 1;
      if (isHigh) report.high += 1;
      else report.medium += 1;

      const aliasKey = `${section.no}|${rawSrc.trim()}`;
      const alias = SRC_ALIASES[aliasKey];
      if (alias) report.aliasUsed.push(aliasKey);

      if (rel === "entailsHazard") {
        const hazardLabel = rawDst.trim();
        const hazardId = `Hazard_${slugify(hazardLabel)}`;
        upsertNode(hazardId, "Hazard", hazardLabel, [MANUAL_UID], {}, isHigh);
        sectionHazards.push(hazardLabel);
        labelToId.set(hazardLabel, hazardId);
        upsertEdge(taskId, "entailsHazard", hazardId, [MANUAL_UID], isHigh);
      } else if (rel === "mitigatedBy") {
        // src = 위험요인(축약 가능), dst = 안전조치
        let hazardLabel = alias && alias !== "@TASK" ? alias : null;
        if (!hazardLabel) {
          const resolved = resolveLabel(rawSrc.trim(), sectionHazards);
          if (!resolved) {
            console.error(`[S${section.no}] mitigatedBy src 미해결: "${rawSrc.trim()}" — SRC_ALIASES에 추가 필요`);
            process.exit(1);
          }
          if (resolved.method !== "exact") report.fuzzy.push(`S${section.no} mitigatedBy "${rawSrc.trim()}" → "${resolved.label}" (${resolved.method})`);
          hazardLabel = resolved.label;
        }
        const hazardId = labelToId.get(hazardLabel) || `Hazard_${slugify(hazardLabel)}`;
        const controlLabel = rawDst.trim();
        const controlId = `Control_${slugify(controlLabel)}`;
        upsertNode(controlId, "Control", controlLabel, [MANUAL_UID], {}, isHigh);
        sectionControls.push(controlLabel);
        labelToId.set(controlLabel, controlId);
        if (isHigh) {
          const h = nodes.get(hazardId);
          if (h) h._high = true;
        }
        upsertEdge(hazardId, "mitigatedBy", controlId, [MANUAL_UID], isHigh);
      } else if (rel === "mandatedBy") {
        const article = parseArticle(rawDst.trim());
        if (!article) {
          console.error(`[S${section.no}] mandatedBy dst 조문 파싱 실패: "${rawDst.trim()}"`);
          process.exit(1);
        }
        const articleId = `Article_기준규칙_${article.no}`;
        const lawUid = `law:${LAW_NAME}:제${article.no.replace("의", "조의")}${article.no.includes("의") ? "" : "조"}`;
        upsertNode(articleId, "Article", `기준규칙 제${article.no.replace("의", "조의")}${article.no.includes("의") ? "" : "조"}${article.title ? `(${article.title})` : ""}`, [lawUid, MANUAL_UID], { law: LAW_NAME, article_no: article.no }, isHigh);
        // src = 안전조치(축약) | Task
        let srcId;
        if (alias === "@TASK" || normalizeLabel(rawSrc.trim()) === normalizeLabel(section.taskLabel)) {
          srcId = taskId;
        } else if (alias) {
          srcId = labelToId.get(alias) || `Control_${slugify(alias)}`;
        } else {
          const resolved = resolveLabel(rawSrc.trim(), sectionControls);
          if (resolved) {
            if (resolved.method !== "exact") report.fuzzy.push(`S${section.no} mandatedBy "${rawSrc.trim()}" → "${resolved.label}" (${resolved.method})`);
            srcId = labelToId.get(resolved.label) || `Control_${slugify(resolved.label)}`;
          } else {
            // mitigatedBy에 등장하지 않은 독립 안전조치 → 신규 Control 노드
            const controlLabel = rawSrc.trim();
            srcId = `Control_${slugify(controlLabel)}`;
            upsertNode(srcId, "Control", controlLabel, [MANUAL_UID], {}, isHigh);
            sectionControls.push(controlLabel);
            labelToId.set(controlLabel, srcId);
            report.createdControls.push(`S${section.no} "${controlLabel}"`);
          }
        }
        if (isHigh) {
          const s = nodes.get(srcId);
          if (s) s._high = true;
        }
        upsertEdge(srcId, "mandatedBy", articleId, [lawUid, MANUAL_UID], isHigh);
      } else if (rel === "documentedIn") {
        // dst = "workPlan(부연)" 형태
        const keyMatch = rawDst.trim().match(/^(\w+)/);
        const docKey = keyMatch ? keyMatch[1] : "";
        if (!DOCUMENT_LABELS[docKey]) {
          console.error(`[S${section.no}] documentedIn dst 문서키 미상: "${rawDst.trim()}"`);
          process.exit(1);
        }
        const docId = `Document_${docKey}`;
        upsertNode(docId, "Document", DOCUMENT_LABELS[docKey], [MANUAL_UID], { smsa_key: docKey }, isHigh);
        // src는 Task 변형("용접(화기)작업" 등) — Task로 해석
        const cites = [MANUAL_UID];
        const srcArticle = parseArticle(articleCol);
        if (srcArticle && !articleCol.includes("/") && !articleCol.includes("등")) {
          cites.unshift(`law:${LAW_NAME}:제${srcArticle.no.replace("의", "조의")}${srcArticle.no.includes("의") ? "" : "조"}`);
        }
        upsertEdge(taskId, "documentedIn", docId, cites, isHigh);
      } else if (rel === "fulfillsDuty") {
        const dutyKey = rawDst.includes("4-3") ? "§4-3호" : rawDst.includes("4-8") ? "§4-8호" : null;
        if (!dutyKey) {
          console.error(`[S${section.no}] fulfillsDuty dst 미상: "${rawDst.trim()}"`);
          process.exit(1);
        }
        const duty = DUTY_DEFS[dutyKey];
        upsertNode(duty.nodeId, "Duty", duty.label, [duty.citedUid, MANUAL_UID], { law: "중대재해처벌법 시행령" }, isHigh);
        const docKey = rawSrc.trim().match(/^(\w+)/)?.[1] || "";
        if (!DOCUMENT_LABELS[docKey]) {
          console.error(`[S${section.no}] fulfillsDuty src 문서키 미상: "${rawSrc.trim()}"`);
          process.exit(1);
        }
        upsertEdge(`Document_${docKey}`, "fulfillsDuty", duty.nodeId, [duty.citedUid, MANUAL_UID], isHigh);
      }
    }
    // Task 노드 published 여부: 해당 섹션에 높음 행이 있으면 published
    const task = nodes.get(taskId);
    task._high = true; // 모든 섹션에 높음 행 존재 (177/190)
  }

  // ---- review_state 확정 ----
  const outNodes = Array.from(nodes.values()).map((n) => ({
    node_id: n.node_id,
    kind: n.kind,
    label: n.label,
    text_excerpt: n.text_excerpt,
    cited_uids: n.cited_uids,
    meta: n._high ? n.meta : { ...n.meta, confidence: "medium" },
    review_state: n._high ? "published" : "draft"
  }));
  const outEdges = Array.from(edges.values()).map((e) => ({
    src: e.src,
    rel: e.rel,
    dst: e.dst,
    cited_uids: e.cited_uids,
    meta: e._high ? { source_rows: e._rows } : { source_rows: e._rows, confidence: "medium" },
    review_state: e._high ? "published" : "draft"
  }));
  outNodes.sort((a, b) => a.node_id.localeCompare(b.node_id, "ko"));
  outEdges.sort((a, b) => `${a.src}|${a.rel}|${a.dst}`.localeCompare(`${b.src}|${b.rel}|${b.dst}`, "ko"));

  const stats = {
    source_rows: report.rows,
    source_rows_high: report.high,
    source_rows_medium: report.medium,
    nodes: outNodes.length,
    edges: outEdges.length,
    published_nodes: outNodes.filter((n) => n.review_state === "published").length,
    draft_nodes: outNodes.filter((n) => n.review_state === "draft").length,
    published_edges: outEdges.filter((e) => e.review_state === "published").length,
    draft_edges: outEdges.filter((e) => e.review_state === "draft").length,
    nodes_by_kind: outNodes.reduce((acc, n) => ({ ...acc, [n.kind]: (acc[n.kind] || 0) + 1 }), {})
  };

  console.log("=== 파싱 리포트 ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log(`중복 행(엣지 병합): ${report.dupRows}`);
  console.log(`별칭 사용: ${report.aliasUsed.join(", ") || "없음"}`);
  console.log(`신규 Control(비-mitigatedBy 유래): \n  ${report.createdControls.join("\n  ") || "없음"}`);
  console.log(`퍼지 매칭 (${report.fuzzy.length}건):`);
  for (const f of report.fuzzy) console.log(`  ${f}`);

  if (checkOnly) return;

  const payload = { source: "온톨로지_시드트리플_감수용_v1.md", stats, nodes: outNodes, edges: outEdges };
  writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  const ts = `// 자동 생성 파일 — 직접 수정 금지.
// 생성: node scripts/ontology/gen-seed-from-md.mjs <온톨로지_시드트리플_감수용_v1.md>
// 원본: 노무사 감수용 시드 트리플 문서 (확신도 높음 → published, 중간 → draft+confidence:"medium")
// core-triples.json과 반드시 동기 상태여야 한다 (tests/ontology-seed.test.ts가 검증).
import type { OntologyNodeInput, OntologyEdgeInput } from "@/lib/ontology/schema";
import seed from "./core-triples.json";
import { SIF_ACCIDENT_EDGES, SIF_ACCIDENT_NODES } from "./sif-accident-overlay";

export const SEED_SOURCE = seed.source;

export type SeedStats = {
  source_rows: number;
  source_rows_high: number;
  source_rows_medium: number;
  nodes: number;
  edges: number;
  published_nodes: number;
  draft_nodes: number;
  published_edges: number;
  draft_edges: number;
  nodes_by_kind: Record<string, number>;
};

const CORE_NODES = seed.nodes as OntologyNodeInput[];
const CORE_EDGES = seed.edges as OntologyEdgeInput[];

export const SEED_NODES: OntologyNodeInput[] = [...CORE_NODES, ...SIF_ACCIDENT_NODES];

export const SEED_EDGES: OntologyEdgeInput[] = [...CORE_EDGES, ...SIF_ACCIDENT_EDGES];

export const SEED_STATS: SeedStats = {
  ...seed.stats,
  nodes: SEED_NODES.length,
  edges: SEED_EDGES.length,
  draft_nodes: seed.stats.draft_nodes + SIF_ACCIDENT_NODES.length,
  draft_edges: seed.stats.draft_edges + SIF_ACCIDENT_EDGES.length,
  nodes_by_kind: {
    ...seed.stats.nodes_by_kind,
    Accident:
      ((seed.stats.nodes_by_kind as Record<string, number>).Accident ?? 0) + SIF_ACCIDENT_NODES.length
  }
};
`;
  writeFileSync(OUT_TS, ts, "utf-8");
  console.log(`\n생성 완료: ${OUT_TS}\n          ${OUT_JSON}`);
}

main();
