import fs from "node:fs";
import path from "node:path";

const outDir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
fs.mkdirSync(outDir, { recursive: true });

const endpoint = "https://www.safeclaw.kr/api/ask";
const build = await (await fetch("https://www.safeclaw.kr/api/build-info")).json();
const question = "서울 성수동 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 추락, 비계 전도, 지게차 자재 양중 동선 충돌을 반영해서 위험성평가표와 TBM을 작성해줘.";
const modes = ["template", "enhanced"];

function pickArray(value) {
  return Array.isArray(value) ? value : [];
}

function summarizePayload(mode, payload, elapsedMs, httpStatus) {
  const references = [
    ...pickArray(payload?.citations),
    ...pickArray(payload?.dbHarness?.directEvidence),
    ...pickArray(payload?.dbHarness?.supportingEvidence),
    ...pickArray(payload?.evidence)
  ];
  const referenceText = JSON.stringify(references).toLowerCase();
  const bodyText = [
    payload?.answer,
    payload?.deliverables?.riskAssessmentDraft,
    payload?.deliverables?.tbmBriefing,
    payload?.deliverables?.tbmLogDraft,
    payload?.status?.detail,
    payload?.dbHarness?.summary?.detail
  ].filter(Boolean).join("\n");
  const combinedText = `${bodyText}\n${JSON.stringify(payload).slice(0, 80_000)}`;
  const qualityItems = pickArray(payload?.qualityContract?.items);
  const rows = pickArray(payload?.structured?.riskAssessmentRows);
  const koshaMentions = (combinedText.match(/KOSHA|안전보건공단|기술지침|공식자료/gu) || []).length;
  const sifMentions = (combinedText.match(/SIF|고위험|사망사고|중대위험/gu) || []).length;
  const evidenceRefs = rows.flatMap((row) => pickArray(row?.evidenceRefs));
  return {
    mode,
    httpStatus,
    elapsedMs,
    ok: Boolean(payload?.answer || payload?.deliverables),
    statusDetail: payload?.status?.detail || null,
    sourceMix: payload?.sourceMix ? {
      total: payload.sourceMix.total ?? null,
      counts: payload.sourceMix.counts ?? null,
      koreanLawMcp: payload.sourceMix.koreanLawMcp ? {
        enabled: Boolean(payload.sourceMix.koreanLawMcp.enabled),
        configured: Boolean(payload.sourceMix.koreanLawMcp.configured),
        summary: payload.sourceMix.koreanLawMcp.summary || null
      } : null
    } : null,
    dbHarnessSummary: payload?.dbHarness?.summary || null,
    qualityOverall: payload?.qualityContract?.overall || null,
    qualityItems: qualityItems.map((item) => ({
      label: item?.label || null,
      status: item?.status || null,
      detail: item?.detail || null
    })),
    rowCount: rows.length,
    rowSample: rows.slice(0, 5).map((row) => ({
      process: row?.process || null,
      task: row?.task || null,
      hazard: row?.hazard || null,
      controls: row?.controls || null,
      evidenceRefs: row?.evidenceRefs || []
    })),
    referenceCount: references.length,
    directEvidenceCount: pickArray(payload?.dbHarness?.directEvidence).length,
    supportingEvidenceCount: pickArray(payload?.dbHarness?.supportingEvidence).length,
    hasKoshaReference: /kosha|안전보건공단|기술지침|공식자료/u.test(referenceText) || koshaMentions > 0,
    hasSifOrSeriousRiskSignal: /sif|사망사고|중대위험|고위험/u.test(referenceText) || sifMentions > 0,
    koshaMentions,
    sifMentions,
    evidenceRefs: [...new Set(evidenceRefs)].slice(0, 30),
    deliverableLengths: {
      riskAssessmentDraft: String(payload?.deliverables?.riskAssessmentDraft || "").length,
      tbmBriefing: String(payload?.deliverables?.tbmBriefing || "").length,
      tbmLogDraft: String(payload?.deliverables?.tbmLogDraft || "").length
    },
    textSnippets: {
      riskAssessmentDraft: String(payload?.deliverables?.riskAssessmentDraft || "").slice(0, 1200),
      tbmBriefing: String(payload?.deliverables?.tbmBriefing || "").slice(0, 1200)
    }
  };
}

const responses = [];

for (const aiMode of modes) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, aiMode })
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { parseError: text.slice(0, 1000) };
  }
  const elapsedMs = Date.now() - started;
  const rawPath = process.env.SAFECLAW_WRITE_LIVE_RAW === "1" ? path.join(outDir, `${aiMode}-raw.json`) : null;
  if (rawPath) fs.writeFileSync(rawPath, `${JSON.stringify(payload, null, 2)}\n`);
  responses.push({
    aiMode,
    rawPath,
    summary: summarizePayload(aiMode, payload, elapsedMs, response.status)
  });
}

const comparison = {
  checkedAt: new Date().toISOString(),
  endpoint,
  build,
  question,
  responses,
  findings: {
    enhancedAddsGrounding: responses.find((item) => item.aiMode === "enhanced")?.summary.referenceCount
      >= responses.find((item) => item.aiMode === "template")?.summary.referenceCount,
    enhancedHasKosha: Boolean(responses.find((item) => item.aiMode === "enhanced")?.summary.hasKoshaReference),
    enhancedHasSifOrSeriousRisk: Boolean(responses.find((item) => item.aiMode === "enhanced")?.summary.hasSifOrSeriousRiskSignal),
    modesDiffer: JSON.stringify(responses[0]?.summary.rowSample) !== JSON.stringify(responses[1]?.summary.rowSample)
      || responses[0]?.summary.statusDetail !== responses[1]?.summary.statusDetail
      || responses[0]?.summary.qualityOverall !== responses[1]?.summary.qualityOverall
  }
};

fs.writeFileSync(path.join(outDir, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);
