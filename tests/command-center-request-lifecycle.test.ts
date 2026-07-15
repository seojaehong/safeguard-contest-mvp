import { describe, expect, it, vi } from "vitest";

import {
  createEmptyInputHazardPhotoAnalysis,
  runInputHazardPhotoAnalysis,
  type InputHazardPhotoAnalysisState
} from "@/lib/operation-improvements";
import { createLatestOnlyRequestGate } from "@/lib/request-version-guard";

describe("command center request lifecycle", () => {
  it("aborts the previous photo-analysis request when a newer 1-10 photo set starts", () => {
    const gate = createLatestOnlyRequestGate();

    const first = gate.begin();
    const second = gate.begin();

    expect(first.signal.aborted).toBe(true);
    expect(gate.isCurrent(first.requestId)).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(gate.isCurrent(second.requestId)).toBe(true);
  });

  it("does not let a stale request finish clear the latest request guard", () => {
    const gate = createLatestOnlyRequestGate();

    const first = gate.begin();
    const second = gate.begin();
    gate.finish(first.requestId);

    expect(gate.isCurrent(second.requestId)).toBe(true);
    gate.finish(second.requestId);
    expect(gate.isCurrent(second.requestId)).toBe(false);
  });

  it("ignores a stale response after a newer 10-photo analysis resolves first", async () => {
    const photosOne = [createPhoto("single-scaffold.jpg")];
    const photosTen = Array.from({ length: 10 }, (_, index) => createPhoto(`deck-zone-${index + 1}.jpg`));
    const firstResponse = createDeferred<ResponseLike>();
    const secondResponse = createDeferred<ResponseLike>();
    const fetchAnalysis = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      return fetchAnalysis.mock.calls.length === 1
        ? firstResponse.promise
        : secondResponse.promise;
    });
    const store = createHarnessStore();

    const firstRun = runInputHazardPhotoAnalysis({
      question: "비계 작업 점검",
      photos: photosOne,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: async () => "token-alpha",
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    await Promise.resolve();

    const secondRun = runInputHazardPhotoAnalysis({
      question: "비계 작업 점검",
      photos: photosTen,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: async () => "token-beta",
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    secondResponse.resolve(createJsonResponse(buildWorkspaceAnalysisPayload({
      message: "10장 사진에서 최신 후보를 찾았습니다.",
      photoNames: photosTen.map((photo) => photo.name),
      candidateLabel: "최신 10장 후보"
    })));
    await secondRun;

    expect(store.state.candidates).toHaveLength(1);
    expect(store.state.candidates[0]?.label).toBe("최신 10장 후보");
    expect(store.uiMessage).toContain("위험요인 후보를 도출");

    firstResponse.resolve(createJsonResponse(buildWorkspaceAnalysisPayload({
      message: "오래된 1장 응답입니다.",
      photoNames: photosOne.map((photo) => photo.name),
      candidateLabel: "오래된 1장 후보"
    })));
    await firstRun;

    expect(store.state.candidates).toHaveLength(1);
    expect(store.state.candidates[0]?.label).toBe("최신 10장 후보");
    expect(store.state.message).toBe("10장 사진에서 최신 후보를 찾았습니다.");
    expect(store.uiMessage).toContain("위험요인 후보를 도출");
  });

  it("ignores a stale token wait so the aborted 1-photo analysis never fetches or rewrites the newer 10-photo state", async () => {
    const photosOne = [createPhoto("single-signal.jpg")];
    const photosTen = Array.from({ length: 10 }, (_, index) => createPhoto(`line-check-${index + 1}.jpg`));
    const firstToken = createDeferred<string | null>();
    const secondResponse = createDeferred<ResponseLike>();
    const store = createHarnessStore();
    const fetchAnalysis = vi.fn(async () => secondResponse.promise);

    const firstRun = runInputHazardPhotoAnalysis({
      question: "통로 점검",
      photos: photosOne,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: () => firstToken.promise,
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    await Promise.resolve();

    const secondRun = runInputHazardPhotoAnalysis({
      question: "통로 점검",
      photos: photosTen,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: async () => "token-latest",
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    secondResponse.resolve(createJsonResponse(buildWorkspaceAnalysisPayload({
      message: "최신 10장 통로 분석 완료",
      photoNames: photosTen.map((photo) => photo.name),
      candidateLabel: "통로 최신 후보"
    })));
    await secondRun;

    firstToken.resolve("token-stale");
    await firstRun;

    expect(fetchAnalysis).toHaveBeenCalledTimes(1);
    expect(store.state.candidates[0]?.label).toBe("통로 최신 후보");
    expect(store.state.message).toBe("최신 10장 통로 분석 완료");
  });

  it("ignores a stale error and stale finally while the newer 10-photo request keeps loading and then succeeds", async () => {
    const photosOne = [createPhoto("single-forklift.jpg")];
    const photosTen = Array.from({ length: 10 }, (_, index) => createPhoto(`forklift-lane-${index + 1}.jpg`));
    const firstResponse = createDeferred<ResponseLike>();
    const secondResponse = createDeferred<ResponseLike>();
    const store = createHarnessStore();
    const fetchAnalysis = vi.fn(async () => {
      return fetchAnalysis.mock.calls.length === 1
        ? firstResponse.promise
        : secondResponse.promise;
    });

    const firstRun = runInputHazardPhotoAnalysis({
      question: "지게차 동선 점검",
      photos: photosOne,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: async () => "token-old",
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    await Promise.resolve();

    const secondRun = runInputHazardPhotoAnalysis({
      question: "지게차 동선 점검",
      photos: photosTen,
      requestGate: store.requestGate,
      clearCandidateDecisions: store.clearCandidateDecisions,
      setAnalysis: store.setAnalysis,
      setMessage: store.setMessage,
      readAccessToken: async () => "token-new",
      fetchAnalysis,
      mapCandidate: (candidate) => ({ ...candidate, source: "vision" })
    });

    expect(store.state.status).toBe("analyzing");

    firstResponse.reject(new Error("stale provider failure"));
    await firstRun;

    expect(store.state.status).toBe("analyzing");
    expect(store.state.candidates).toHaveLength(0);
    expect(store.uiMessage).toBe("");

    secondResponse.resolve(createJsonResponse(buildWorkspaceAnalysisPayload({
      message: "최신 지게차 동선 후보 확정",
      photoNames: photosTen.map((photo) => photo.name),
      candidateLabel: "지게차 최신 후보"
    })));
    await secondRun;

    expect(store.state.status).toBe("analyzed");
    expect(store.state.candidates[0]?.label).toBe("지게차 최신 후보");
    expect(store.state.message).toBe("최신 지게차 동선 후보 확정");
    expect(store.uiMessage).toContain("위험요인 후보를 도출");
  });
});

type ResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type VisionCandidate = {
  label: string;
  detail: string;
  source: "vision";
  severity?: "high" | "medium" | "low" | "review";
  evidence?: string;
  reflectedDocuments?: readonly string[];
  sourcePhotoNames?: readonly string[];
};

function createPhoto(name: string): { name: string; file: File } {
  return {
    name,
    file: new File(["image"], name, { type: "image/jpeg" })
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function createJsonResponse(body: unknown, status = 200): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function buildWorkspaceAnalysisPayload(input: {
  message: string;
  photoNames: string[];
  candidateLabel: string;
}) {
  return {
    ok: true,
    message: input.message,
    analysis: {
      status: "analyzed",
      provider: "openai",
      providerMode: "live",
      model: "gpt-4.1-mini",
      providerResponses: [{
        photoId: input.photoNames[0] || "photo-1",
        responseId: `resp-${input.candidateLabel}`,
        model: "gpt-4.1-mini",
        createdAt: Date.now()
      }],
      summary: `${input.candidateLabel} 요약`,
      ocrText: "",
      siteSignals: input.photoNames,
      candidates: [{
        label: input.candidateLabel,
        detail: `${input.candidateLabel} 상세`,
        severity: "review",
        sourcePhotoNames: input.photoNames
      }],
      counts: {
        submitted: input.photoNames.length,
        analyzed: input.photoNames.length,
        rejected: 0,
        failed: 0,
        unconfigured: 0,
        candidates: 1,
        harnessConfirmed: 0,
        harnessInsufficient: 0
      },
      images: []
    }
  };
}

function createHarnessStore() {
  const requestGate = createLatestOnlyRequestGate();
  const store = {
    state: createEmptyInputHazardPhotoAnalysis<VisionCandidate>(),
    uiMessage: "",
    clears: 0
  };

  return {
    requestGate,
    get state() {
      return store.state;
    },
    get uiMessage() {
      return store.uiMessage;
    },
    clearCandidateDecisions() {
      store.clears += 1;
    },
    setAnalysis(update: InputHazardPhotoAnalysisState<VisionCandidate> | ((current: InputHazardPhotoAnalysisState<VisionCandidate>) => InputHazardPhotoAnalysisState<VisionCandidate>)) {
      store.state = typeof update === "function"
        ? update(store.state)
        : update;
    },
    setMessage(message: string) {
      store.uiMessage = message;
    }
  };
}
