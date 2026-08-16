import { pickOfficialSafetyResources, type OfficialSafetyResource } from "./official-safety-resources";
import { readBoundedResponseText } from "./server/upstream-http";
import { IntegrationMode } from "./types";

type VerifiedOfficialResource = OfficialSafetyResource & {
  sourceKind: Exclude<OfficialSafetyResource["kind"], "press"> | "board";
  appliedTo: string[];
  verified?: boolean;
};

const REQUEST_TIMEOUT_MS = 5_000;
const OFFICIAL_RESOURCE_CHECK_RESPONSE_MAX_BYTES = 64 * 1_024;
const RETRY_COUNT = 1;

async function wait(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function fetchWithTimeout(url: string, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.throwIfAborted();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("official safety resource timeout")), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SafeClaw safety-workpack official-resource-check"
      }
    });
    const text = await readBoundedResponseText(response, {
      label: "official safety resource check response",
      maxBytes: OFFICIAL_RESOURCE_CHECK_RESPONSE_MAX_BYTES,
    });
    return response.ok && (text.length > 0 || response.headers.has("content-type"));
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

function toSourceKind(kind: OfficialSafetyResource["kind"]): VerifiedOfficialResource["sourceKind"] {
  return kind === "press" ? "board" : kind;
}

async function verifyReference(reference: OfficialSafetyResource, signal?: AbortSignal): Promise<VerifiedOfficialResource> {
  let verified = false;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      verified = await fetchWithTimeout(reference.url, signal);
      if (verified) break;
    } catch (error) {
      signal?.throwIfAborted();
      lastError = error;
      if (attempt < RETRY_COUNT) await wait(400, signal);
    }
  }

  if (lastError && !verified) {
    console.warn("Official safety resource verification failed", reference.url, lastError);
  }

  return {
    ...reference,
    sourceKind: toSourceKind(reference.kind),
    appliedTo: reference.appliesTo,
    verified
  };
}

export async function fetchKoshaReferences(question: string, signal?: AbortSignal): Promise<{
  source: "kosha";
  mode: IntegrationMode;
  detail: string;
  references: VerifiedOfficialResource[];
}> {
  const selected = pickOfficialSafetyResources(question);
  const verifiedReferences = await Promise.all(selected.map((reference) => verifyReference(reference, signal)));
  const verifiedCount = verifiedReferences.filter((reference) => reference.verified).length;

  return {
    source: "kosha",
    mode: verifiedCount ? "live" : "fallback",
    detail: verifiedCount
      ? `KOSHA·고용노동부 공식 자료 URL ${verifiedCount}건 확인. 확인된 자료의 서식 힌트와 반영 위치를 위험성평가·TBM·교육 기록에 적용했습니다.`
      : "공식 자료 URL 확인에 실패해 사전 매핑된 KOSHA·고용노동부 자료 요약을 사용했습니다.",
    references: verifiedReferences
  };
}
