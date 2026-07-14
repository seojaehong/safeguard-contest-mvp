import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createEmptyInputHazardPhotoAnalysis,
  runInputHazardPhotoAnalysis,
  type InputHazardPhotoAnalysisState
} from "@/lib/operation-improvements";
import {
  createBoundRequestGate,
  createLatestOnlyRequestGate,
  isAbortError,
} from "@/lib/request-version-guard";

describe("command center request lifecycle", () => {
  it("invalidates an in-flight generation when its input binding is edited", () => {
    const gate = createBoundRequestGate<string>();
    const generation = gate.begin("question:scaffold-a");

    gate.abortCurrent();

    expect(generation.signal.aborted).toBe(true);
    expect(gate.canCommit(generation, "question:scaffold-b")).toBe(false);
  });

  it("lets only the second generation commit after the first response is delayed", () => {
    const gate = createBoundRequestGate<string>();
    const first = gate.begin("question:first");
    const second = gate.begin("question:second");

    expect(first.signal.aborted).toBe(true);
    expect(gate.canCommit(first, "question:second")).toBe(false);
    expect(gate.canCommit(second, "question:second")).toBe(true);
  });

  it("ignores a delayed HTTP 500 from an obsolete save binding", async () => {
    const gate = createBoundRequestGate<string>();
    const first = gate.begin("generation:first");
    const second = gate.begin("generation:second");
    const mutate = vi.fn();

    await Promise.resolve({ ok: false, status: 500 }).then((response) => {
      if (gate.canCommit(first, "generation:second")) mutate(response.status);
    });

    expect(first.signal.aborted).toBe(true);
    expect(gate.canCommit(second, "generation:second")).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not mutate current state after an aborted request rejects", async () => {
    const gate = createBoundRequestGate<string>();
    const request = gate.begin("generation:first");
    const mutate = vi.fn();
    gate.abortCurrent();
    const abortError = new DOMException("aborted", "AbortError");

    await Promise.reject(abortError).catch(() => {
      if (gate.canCommit(request, "generation:first")) mutate();
    });

    expect(request.signal.aborted).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("rejects an old confirmation response after a new workpack binding", async () => {
    const gate = createBoundRequestGate<string>();
    const oldConfirmation = gate.begin("workpack:a@revision:1");
    const currentConfirmation = gate.begin("workpack:b@revision:1");
    const applyConfirmedWorkpack = vi.fn();

    await Promise.resolve({ workpackId: "a" }).then((payload) => {
      if (gate.canCommit(oldConfirmation, "workpack:b@revision:1")) {
        applyConfirmedWorkpack(payload);
      }
    });

    expect(oldConfirmation.signal.aborted).toBe(true);
    expect(gate.canCommit(currentConfirmation, "workpack:b@revision:1")).toBe(true);
    expect(applyConfirmedWorkpack).not.toHaveBeenCalled();
  });

  it("rejects a delayed server-report response after an explicit local selection", async () => {
    const gate = createBoundRequestGate<string>();
    const serverLoad = gate.begin("server:a:1");
    const applyServerAuthority = vi.fn();

    gate.abortCurrent();
    await Promise.resolve({ authority: "server:a" }).then((payload) => {
      if (gate.canCommit(serverLoad, "browser_local:2")) applyServerAuthority(payload);
    });

    expect(serverLoad.signal.aborted).toBe(true);
    expect(applyServerAuthority).not.toHaveBeenCalled();
  });

  it("wires save and confirmation fetches to bound request ownership", () => {
    const source = readFileSync(resolve(process.cwd(), "components/FieldOperationsWorkspace.tsx"), "utf8");
    const commandCenter = readFileSync(resolve(process.cwd(), "components/SafeGuardCommandCenter.tsx"), "utf8");
    const reports = readFileSync(resolve(process.cwd(), "components/ReportsDownloadCenter.tsx"), "utf8");

    expect(source).toContain("saveRequestGateRef");
    expect(source).toContain("confirmationRequestGateRef");
    expect(source).toContain("signal: request.signal");
    expect(source).toContain("canCommitWorkspaceRequest(request)");
    expect(source).toContain("canCommitConfirmationRequest(request)");
    expect(source).toContain("reusableServerSaved");
    expect(commandCenter).toContain("generationRequestGateRef.current.abortCurrent()");
    expect(commandCenter).toContain("workpackRevalidationGateRef.current.abortCurrent()");
    expect(commandCenter).toContain('current === "saving" ? "idle" : current');
    expect(commandCenter).toContain('data.phaseAReview?.humanConfirmation.status === "confirmed"');
    expect(reports).toContain("loadRequestGateRef");
    expect(reports).toContain("canCommitLoadRequest(request)");
    expect(reports).toContain('invalidateLoadRequest("browser_local")');
  });

  it("recognizes cross-runtime AbortError objects without depending on Error inheritance", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError({ name: "TimeoutError" })).toBe(false);
  });

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
