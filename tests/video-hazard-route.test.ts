import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/input-videos/hazard-analysis/route";
import { analyzeHazardPhotos, HAZARD_PHOTO_FILE_VALIDATION } from "@/lib/photo-vision-analysis";
import { createPendingHazardPhotoUserDecision } from "@/lib/photo-vision-analysis-policy";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import { MSD_POSSIBILITY_PHRASE } from "@/lib/video-hazard-report";

vi.mock("@/lib/photo-vision-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/photo-vision-analysis")>();
  return { ...actual, analyzeHazardPhotos: vi.fn() };
});

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseAdminClient: vi.fn(),
  getWorkspaceUser: vi.fn()
}));

let requestCounter = 0;

function sceneFile(name: string, size = 2048) {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function videoRequest(input: {
  fields?: Record<string, string>;
  scenes?: File[];
  sceneTimes?: unknown;
  extra?: (form: FormData) => void;
  contentLength?: number;
}): NextRequest {
  const form = new FormData();
  const fields = input.fields ?? { site: "물류센터 B동 통로", task: "세척 호스 정리", concern: "호스에 걸려 넘어질까 걱정" };
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  const scenes = input.scenes ?? [sceneFile("scene-01_00m04s.jpg"), sceneFile("scene-02_00m47s.jpg")];
  scenes.forEach((scene) => form.append("scenes", scene, scene.name));
  form.set("sceneTimes", JSON.stringify(input.sceneTimes ?? scenes.map((scene, index) => ({ name: scene.name, time: [4, 47, 52, 58, 60][index] }))));
  form.set("durationSec", "62");
  form.set("sceneCount", "6");
  input.extra?.(form);
  requestCounter += 1;
  return {
    headers: new Headers({
      authorization: "Bearer route-test-token",
      "content-length": String(input.contentLength ?? 8192),
      "content-type": "multipart/form-data; boundary=contract-test",
      "x-forwarded-for": `video-route-test-${requestCounter}`
    }),
    formData: async () => form,
    signal: new AbortController().signal
  } as unknown as NextRequest;
}

function analysisWithCandidates() {
  const candidate = (id: string, scene: string, label: string, observation: string) => ({
    id,
    label,
    detail: observation,
    severity: "review" as const,
    evidence: observation,
    reflectedDocuments: ["위험성평가표"],
    sourcePhotoNames: [scene],
    observation,
    inference: "현장 확인 필요",
    modelRole: "hazard_candidate" as const,
    harness: {
      authority: "safeclaw-db-mcp" as const,
      status: "confirmed" as const,
      evidence: [{
        sourceId: "law-21",
        sourceType: "safeclaw-db" as const,
        title: "산업안전보건기준에 관한 규칙 제21조(통로의 조명)",
        excerpt: "통로에 75럭스 이상의 채광 또는 조명시설을 하여야 한다."
      }, {
        sourceId: "law-3",
        sourceType: "safeclaw-db" as const,
        title: "산업안전보건기준에 관한 규칙 제3조(전도의 방지)",
        excerpt: "넘어지거나 미끄러지는 등의 위험이 없도록 작업장 바닥 등을 안전하고 청결한 상태로 유지하여야 한다."
      }],
      confirmedControls: [{ text: "호스를 통로 밖으로 정리한다.", evidenceSourceIds: ["law-3"] }],
      confirmedAt: "2026-10-25T00:00:00.000Z",
      errorMessage: null
    },
    userDecision: createPendingHazardPhotoUserDecision("confirmed")
  });
  const candidates = [
    candidate("photo-1-candidate-1", "scene-01_00m04s.jpg", "통로 호스 걸림", "바닥에 호스가 놓여 걸림 위험, 좁은 통로"),
    candidate("photo-2-candidate-1", "scene-02_00m47s.jpg", "작업 자세 부담", "허리를 구부린 채 호스를 감는다")
  ];
  return {
    status: "analyzed" as const,
    provider: "mock",
    providerMode: "mock" as const,
    model: "mock",
    providerResponses: [],
    fileValidation: HAZARD_PHOTO_FILE_VALIDATION,
    summary: "",
    observations: [],
    candidates,
    ocrText: "",
    siteSignals: [],
    photoCount: 2,
    images: [],
    counts: { submitted: 2, analyzed: 2, rejected: 0, failed: 0, unconfigured: 0, candidates: 2, harnessConfirmed: 2, harnessInsufficient: 0 },
    harness: {
      modelRole: "candidate_only" as const,
      authority: "safeclaw-db-mcp" as const,
      status: "confirmed" as const,
      confirms: ["evidence", "confirmedControls"] as ["evidence", "confirmedControls"],
      confirmedAt: "2026-10-25T00:00:00.000Z",
      errorMessage: null
    }
  };
}

describe("video scene hazard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyzeHazardPhotos).mockReset();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(getWorkspaceUser).mockResolvedValue({ id: "route-user" } as never);
  });

  it("requires login before reading the body", async () => {
    vi.mocked(getWorkspaceUser).mockResolvedValue(null);
    const response = await POST(videoRequest({}));
    expect(response.status).toBe(401);
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("rejects bodies above the Vercel-safe request budget", async () => {
    const response = await POST(videoRequest({ contentLength: 5 * 1024 * 1024 }));
    expect(response.status).toBe(413);
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("rule 4: requires site, task and concern", async () => {
    const response = await POST(videoRequest({ fields: { site: "물류센터", task: "", concern: "" } }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("video_check_fields_required");
    expect(body.missing).toEqual(["task", "concern"]);
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("refuses raw video uploads and more than 4 scenes per request", async () => {
    const withVideo = await POST(videoRequest({
      extra: (form) => form.append("video", new File(["x"], "clip.mp4", { type: "video/mp4" }))
    }));
    expect((await withVideo.json()).code).toBe("video_upload_not_accepted");
    const scenes = [1, 2, 3, 4, 5].map((n) => sceneFile(`scene-0${n}_00m0${n}s.jpg`));
    const tooMany = await POST(videoRequest({ scenes, sceneTimes: scenes.map((scene, index) => ({ name: scene.name, time: index })) }));
    expect((await tooMany.json()).code).toBe("video_scenes_too_many");
    expect(analyzeHazardPhotos).not.toHaveBeenCalled();
  });

  it("rejects scene times that do not match the scene files", async () => {
    const response = await POST(videoRequest({ sceneTimes: [{ name: "other.jpg", time: 3 }, { name: "scene-02_00m47s.jpg", time: 47 }] }));
    expect((await response.json()).code).toBe("video_scene_times_invalid");
  });

  it("returns a time-ordered report with filtered articles and MSD possibility wording", async () => {
    vi.mocked(analyzeHazardPhotos).mockResolvedValue(analysisWithCandidates() as never);
    const response = await POST(videoRequest({}));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    const [call] = vi.mocked(analyzeHazardPhotos).mock.calls;
    expect(call[0].question).toContain("장소: 물류센터 B동 통로");
    expect(call[0].question).toContain("0:04, 0:47");
    expect(body.report.rows.map((row: { timeLabel: string }) => row.timeLabel)).toEqual(["0:04", "0:47"]);
    expect(body.report.rows[0].articles).toEqual(["산업안전보건기준에 관한 규칙 제3조"]);
    expect(body.report.rows[1].msdNote).toContain(MSD_POSSIBILITY_PHRASE);
    expect(body.report.flowOpinion).toContain("장면 6개");
    expect(body.report.disclaimer).toContain("위험성평가를 대신하지 않습니다");
    expect(body.analysis).toEqual(expect.objectContaining({ status: "analyzed" }));
    expect(body.analysis.candidates).toBeUndefined();
  });
});
