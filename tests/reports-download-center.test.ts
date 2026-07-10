import { describe, expect, it } from "vitest";

import type { OperationImprovement } from "@/lib/operation-improvement-history";
import { toggleReportPhotoApproval } from "@/lib/reporting-downloads";

const improvement: OperationImprovement = {
  id: "improvement-1",
  createdAt: "2026-07-08T08:30:00.000Z",
  siteName: "서울 성수동",
  workSummary: "외벽 도장",
  hazardLabel: "추락 위험",
  improvementText: "난간을 보강",
  reflectedDocuments: ["위험성평가표"],
  beforePhotoName: "before.jpg",
  afterPhotoName: "after.jpg"
};

describe("reports download center behavior", () => {
  it("toggles approval for one exact improvement and photo pair", () => {
    const approved = toggleReportPhotoApproval([], [improvement], improvement.id);

    expect(approved).toEqual([{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }]);
    expect(toggleReportPhotoApproval(approved, [improvement], improvement.id)).toEqual([]);
  });

  it("fails closed when an improvement id is duplicated or loses its photo pair", () => {
    const approval = [{
      improvementId: improvement.id,
      beforePhotoName: "before.jpg",
      afterPhotoName: "after.jpg"
    }];
    const duplicate = { ...improvement, afterPhotoName: "other-after.jpg" };
    const missingAfter = { ...improvement, afterPhotoName: undefined };

    expect(toggleReportPhotoApproval(approval, [improvement, duplicate], improvement.id)).toEqual([]);
    expect(toggleReportPhotoApproval(approval, [missingAfter], improvement.id)).toEqual([]);
  });
});
