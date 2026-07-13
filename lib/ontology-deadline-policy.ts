export const DEFAULT_ONTOLOGY_GRAPH_TIMEOUT_MS = 2_000;
export const DEFAULT_PHASE_A_GROUNDING_TIMEOUT_MS = 2_000;

function resolvePositiveTimeoutMs(
  explicit: number | undefined,
  configured: string | undefined,
  fallback: number,
): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const parsed = Number.parseInt(configured || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveOntologyGraphTimeoutMs(
  explicit: number | undefined,
  configured: string | undefined,
): number {
  return resolvePositiveTimeoutMs(
    explicit,
    configured,
    DEFAULT_ONTOLOGY_GRAPH_TIMEOUT_MS,
  );
}

export function resolvePhaseAGroundingTimeoutMs(
  explicit: number | undefined,
  configured: string | undefined,
): number {
  return resolvePositiveTimeoutMs(
    explicit,
    configured,
    DEFAULT_PHASE_A_GROUNDING_TIMEOUT_MS,
  );
}
