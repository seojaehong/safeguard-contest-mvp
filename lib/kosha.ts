import { pickOfficialSafetyResources, type OfficialSafetyResource } from "./official-safety-resources";
import { IntegrationMode } from "./types";

type VerifiedOfficialResource = OfficialSafetyResource & {
  sourceKind: Exclude<OfficialSafetyResource["kind"], "press"> | "board";
  appliedTo: string[];
  verified?: boolean;
};

const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_COUNT = 1;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SafeGuard contest MVP official-resource-check"
      }
    });
    const text = await response.text().catch(() => "");
    return response.ok && (text.length > 0 || response.headers.has("content-type"));
  } finally {
    clearTimeout(timeout);
  }
}

function toSourceKind(kind: OfficialSafetyResource["kind"]): VerifiedOfficialResource["sourceKind"] {
  return kind === "press" ? "board" : kind;
}

async function verifyReference(reference: OfficialSafetyResource): Promise<VerifiedOfficialResource> {
  let verified = false;
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      verified = await fetchWithTimeout(reference.url);
      if (verified) break;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_COUNT) await wait(400);
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

export async function fetchKoshaReferences(question: string): Promise<{
  source: "kosha";
  mode: IntegrationMode;
  detail: string;
  references: VerifiedOfficialResource[];
}> {
  const selected = pickOfficialSafetyResources(question);
  const verifiedReferences = await Promise.all(selected.map((reference) => verifyReference(reference)));
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
