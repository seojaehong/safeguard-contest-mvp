import { loadGraph } from "@/lib/ontology/graph-store";
import { withPublicSafetyReferenceStatusAdmission } from "@/lib/public-distributed-rate-limit";
import {
  getSafetyReferenceStats,
  type SafetyReferenceStats,
} from "@/lib/safety-reference-catalog";

type PublicStatusReadResult<T> =
  | { ok: true; admissionHeaders: Headers; data: T }
  | { ok: false; response: Response };

async function runPublicStatusRead<T>(
  request: Request,
  work: () => Promise<T>,
): Promise<PublicStatusReadResult<T>> {
  let completed = false;
  let data: T | undefined;
  const admissionResponse = await withPublicSafetyReferenceStatusAdmission(request, async () => {
    data = await work();
    completed = true;
    return new Response(null, { status: 204 });
  });
  if (!completed) return { ok: false, response: admissionResponse };
  return {
    ok: true,
    admissionHeaders: new Headers(admissionResponse.headers),
    data: data as T,
  };
}

export function applyPublicStatusAdmissionHeaders<T extends Response>(
  response: T,
  admissionHeaders: Headers,
): T {
  for (const name of ["X-SafeClaw-Rate-Limit", "X-SafeClaw-Work-Unit"]) {
    const value = admissionHeaders.get(name);
    if (value) response.headers.set(name, value);
  }
  return response;
}

export function unavailableSafetyReferenceStats(message: string): SafetyReferenceStats {
  return {
    ok: false,
    configured: true,
    status: "degraded",
    sources: 0,
    items: 0,
    expectedTechnicalTotal: 0,
    technicalTotal: 0,
    technicalSupportRegulations: 0,
    technicalGuidelines: 0,
    technicalSplitOk: false,
    catalogSearchOk: false,
    ingestionRuns: 0,
    itemTypes: [],
    samples: [],
    message,
  };
}

export function runPublicSafetyReferenceStatsRead(request: Request) {
  return runPublicStatusRead(request, getSafetyReferenceStats);
}

export function runPublicOntologyGraphRead(request: Request) {
  return runPublicStatusRead(request, () => loadGraph("published"));
}
