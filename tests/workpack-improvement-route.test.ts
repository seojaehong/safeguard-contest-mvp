import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { parseOperationImprovements } from "@/lib/operation-improvement-history";

const mocks = vi.hoisted(() => ({
  insert: vi.fn()
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: () => {
    const query = {
      insert(value: unknown) {
        mocks.insert(value);
        return query;
      },
      select() {
        return query;
      },
      async single() {
        return { data: { id: "improvement-db-1" }, error: null };
      }
    };
    return {
      from: () => query,
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null })
        })
      }
    };
  },
  getWorkspaceUser: async () => ({ id: "user-1", email: "user@example.com" }),
  toJson: (value: unknown) => value
}));

vi.mock("@/lib/workpack-commercial-store", () => ({
  loadOwnedWorkpackOperationContext: async () => ({
    ok: true,
    context: {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "workpack-1",
      question: "성수동 외벽 도장"
    }
  })
}));

vi.mock("@/lib/photo-vision-analysis", () => ({
  analyzeImprovementPhotos: async () => ({
    status: "unconfigured",
    provider: "none",
    model: "none",
    summary: "수동 개선사항",
    observedImprovement: "난간 보강",
    detectedHazards: [],
    ocrText: "",
    sourcePhotoNames: [],
    photoCount: 0,
    siteSignals: [],
    visionEvidence: "",
    reflectedDocuments: ["위험성평가표"],
    errorMessage: ""
  }),
  buildImprovementAnalysisPayload: () => ({
    sourcePhotoNames: [],
    photoCount: 0,
    siteSignals: [],
    visionEvidence: "",
    photoPairAttached: false,
    analysisMode: "manual_text",
    userLabel: "관리자 메모",
    exportable: true
  })
}));

describe("workpack improvement POST status contract", () => {
  it("returns the canonical DB review status for lossless local snapshot persistence", async () => {
    const { POST } = await import("@/app/api/workpacks/[id]/improvements/route");
    const response = await POST(new NextRequest(
      "http://localhost/api/workpacks/workpack-1/improvements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskLabel: "외벽 도장",
          hazardLabel: "추락",
          improvementText: "난간 보강",
          reflectedDocuments: ["위험성평가표"]
        })
      }
    ), { params: Promise.resolve({ id: "workpack-1" }) });
    const body = await response.json() as {
      improvementId: string;
      reviewStatus: string;
    };

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      review_status: "candidate"
    }));
    expect(body).toMatchObject({
      improvementId: "improvement-db-1",
      reviewStatus: "candidate"
    });

    const localSnapshot = parseOperationImprovements(JSON.stringify([{
      id: body.improvementId,
      createdAt: "2026-07-11T00:00:00.000Z",
      siteName: "성수동 현장",
      workSummary: "외벽 도장",
      hazardLabel: "추락",
      improvementText: "난간 보강",
      reflectedDocuments: ["위험성평가표"],
      status: body.reviewStatus
    }]));
    expect(localSnapshot[0]?.status).toBe("candidate");
  });
});
