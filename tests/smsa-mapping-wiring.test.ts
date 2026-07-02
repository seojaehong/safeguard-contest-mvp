import { describe, expect, it } from "vitest";

import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";

// Guards the actual wiring, not just the pure function: the workspace UI
// (components/SafeGuardCommandCenter.tsx) reads
// data.evidenceLabels[item.key] where item.key is one of the 12 DocumentKey
// values used for the document cards. If the alias table in
// lib/smsa-mapping.ts drifts from those exact keys, badges silently stop
// rendering while the pure-function unit tests keep passing.
const documentCardKeys = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
] as const;

describe("evidenceLabels wiring (mock/demo AskResponse path)", () => {
  const response = buildMockAskResponse("굴착 작업 위험성평가", mockSearchResults.slice(0, 3), "mock", "테스트");

  it("labels exactly the 10 document-card keys that map to a 중대재해처벌법 시행령 제4조 호, and none of the other 2", () => {
    const labeled = documentCardKeys.filter((key) => response.evidenceLabels?.[key]);
    expect(labeled.sort()).toEqual(
      [
        "riskAssessmentDraft",
        "workPlanDraft",
        "tbmBriefing",
        "tbmLogDraft",
        "safetyEducationRecordDraft",
        "emergencyResponseDraft",
        "photoEvidenceDraft",
        "foreignWorkerBriefing",
        "foreignWorkerTransmission",
        "kakaoMessage"
      ].sort()
    );
    expect(response.evidenceLabels?.workpackSummaryDraft).toBeUndefined();
    expect(response.evidenceLabels?.workPermitDraft).toBeUndefined();
  });
});
