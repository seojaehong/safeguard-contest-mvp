import { describe, expect, it } from "vitest";
import {
  evaluateAskResponse,
  findInternalCodeLeaks,
  summarizeAiSurvival
} from "../scripts/prod_ask_smoke.mjs";

function cleanBody(overrides: Record<string, unknown> = {}) {
  return {
    answer: "용접 화기작업 전 가연물을 치우고 소화기를 비치합니다.",
    practicalPoints: ["지게차 동선과 보행 동선을 분리합니다."],
    deliverables: {
      riskAssessmentDraft: "위험등급: 상\n화재·폭발 위험",
      tbmQuestions: ["오늘 화기작업 감시자는 누구입니까?"],
      foreignWorkerLanguages: ["vi", "en"]
    },
    // 기계용 필드에는 fallback·riskAssessmentDraft 가 정상적으로 들어 있다 — 노출로 세면 안 된다.
    generationTrace: {
      traceId: "t-1",
      askMode: "full",
      answer: { upstream: { usedInFinal: false, fallbackUsed: true } },
      deliverables: {
        modelPerDocument: {
          riskAssessmentDraft: { provider: "anthropic", model: "m", source: "provider", fallbackUsed: false },
          tbmQuestions: { provider: "safeclaw", model: null, source: "deterministic", fallbackUsed: true }
        }
      }
    },
    qualityContract: { overall: "degraded", fallback: { used: true } },
    structured: { rows: [{ severity: "high" }] },
    status: { summary: "연결됨", ai: "live" },
    ...overrides
  };
}

describe("prod ask smoke evaluator", () => {
  it("passes a clean template response and ignores machine fields and object keys", () => {
    const result = evaluateAskResponse({ httpStatus: 200, body: cleanBody(), mode: "template" });
    expect(result.leaks).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("finds internal codes in user-visible deliverable values", () => {
    const leaks = findInternalCodeLeaks(cleanBody({
      deliverables: {
        riskAssessmentDraft: "riskAssessmentDraft 미생성",
        workPlanDraft: ["high", "  needsReview  ", "low 소음은 아님"],
        tbmBriefing: { hazard: "struckBy", note: "SIF:sif-forklift-01 근거" },
        kakaoMessage: "Fallback 문구입니다",
        photoEvidenceDraft: "mock 사진"
      }
    }));
    expect(leaks.map((leak) => leak.rule).sort()).toEqual([
      "SIF:sif-",
      "fallback",
      "internal-enum",
      "internal-enum",
      "internal-enum",
      "mock",
      "riskAssessmentDraft"
    ]);
    // 문장 속 영어 단어(「low 소음」)는 enum 전체 일치가 아니므로 세지 않는다.
    expect(leaks.some((leak) => leak.sample.includes("소음"))).toBe(false);
  });

  it("reports leaks as a warning by default and fails only when the leak gate is enforced", () => {
    const leaky = cleanBody({ answer: "high" });
    const reported = evaluateAskResponse({ httpStatus: 200, body: leaky, mode: "template" });
    expect(reported.ok).toBe(true);
    expect(reported.checks.find((check) => check.name === "deliverables.internal_codes")).toMatchObject({ gate: "report", ok: false });
    const enforced = evaluateAskResponse({ httpStatus: 200, body: leaky, mode: "template", leakGate: "enforce" });
    expect(enforced.ok).toBe(false);
  });

  it("fails when qualityContract.overall is blocked or missing regardless of status labels", () => {
    expect(evaluateAskResponse({ httpStatus: 200, body: cleanBody({ qualityContract: { overall: "blocked" } }), mode: "full" }).ok).toBe(false);
    // items 없이 blocked 면 template 에서도 무엇이 막혔는지 모르므로 실패.
    expect(evaluateAskResponse({ httpStatus: 200, body: cleanBody({ qualityContract: { overall: "blocked" } }), mode: "template" }).ok).toBe(false);
    expect(evaluateAskResponse({ httpStatus: 200, body: cleanBody({ qualityContract: undefined }), mode: "template" }).ok).toBe(false);
    expect(evaluateAskResponse({ httpStatus: 503, body: cleanBody(), mode: "template" }).ok).toBe(false);
    expect(evaluateAskResponse({ httpStatus: 200, body: null, mode: "template" }).ok).toBe(false);
  });

  it("in template mode tolerates only the by-design blocked items (fallback, dbHarness)", () => {
    // 2026-10-25 운영 template 응답의 항목 상태 그대로.
    const productionTemplateContract = {
      overall: "blocked",
      items: [
        { key: "fallback", status: "blocked" },
        { key: "ontology", status: "degraded" },
        { key: "evidence", status: "ready" },
        { key: "structured", status: "degraded" },
        { key: "integrity", status: "ready" },
        { key: "dbHarness", status: "blocked" },
        { key: "persistence", status: "ready" }
      ]
    };
    const body = cleanBody({ qualityContract: productionTemplateContract });
    expect(evaluateAskResponse({ httpStatus: 200, body, mode: "template" }).ok).toBe(true);
    // 같은 계약을 full 로 받으면 실패.
    expect(evaluateAskResponse({ httpStatus: 200, body, mode: "full" }).ok).toBe(false);
    // template 에서도 그 밖의 항목(integrity)이 막히면 실패.
    const integrityBlocked = cleanBody({
      qualityContract: {
        ...productionTemplateContract,
        items: productionTemplateContract.items.map((item) => item.key === "integrity" ? { ...item, status: "blocked" } : item)
      }
    });
    const result = evaluateAskResponse({ httpStatus: 200, body: integrityBlocked, mode: "template" });
    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "qualityContract.overall")?.detail).toContain("그 밖 차단: integrity");
  });

  it("does not gate on status labels any more", () => {
    const body = cleanBody({ status: { summary: "일부 연결", ai: "fallback", detail: "x=fail(timeout)" } });
    expect(evaluateAskResponse({ httpStatus: 200, body, mode: "template" }).ok).toBe(true);
  });

  it("requires at least one AI-generated document to survive in full mode", () => {
    expect(summarizeAiSurvival(cleanBody())).toMatchObject({
      documentCount: 2,
      survivedDocuments: ["riskAssessmentDraft"],
      fallbackDocuments: ["tbmQuestions"]
    });
    expect(evaluateAskResponse({ httpStatus: 200, body: cleanBody(), mode: "full" }).ok).toBe(true);
    const allFallback = cleanBody({
      generationTrace: {
        deliverables: {
          modelPerDocument: {
            riskAssessmentDraft: { provider: "safeclaw", model: null, source: "deterministic", fallbackUsed: true }
          }
        }
      }
    });
    expect(evaluateAskResponse({ httpStatus: 200, body: allFallback, mode: "full" }).ok).toBe(false);
    // template 은 AI 를 부르지 않으므로 생존 판정을 하지 않는다.
    expect(evaluateAskResponse({ httpStatus: 200, body: allFallback, mode: "template" }).ok).toBe(true);
  });
});
