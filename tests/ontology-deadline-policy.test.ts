import { describe, expect, it } from "vitest";

import {
  DEFAULT_ONTOLOGY_GRAPH_TIMEOUT_MS,
  DEFAULT_PHASE_A_GROUNDING_TIMEOUT_MS,
  resolveOntologyGraphTimeoutMs,
  resolvePhaseAGroundingTimeoutMs
} from "@/lib/ontology-deadline-policy";

describe("ontology deadline policy", () => {
  it("keeps graph and grounding budgets on ontology-specific defaults", () => {
    expect(resolveOntologyGraphTimeoutMs(undefined, undefined)).toBe(DEFAULT_ONTOLOGY_GRAPH_TIMEOUT_MS);
    expect(resolvePhaseAGroundingTimeoutMs(undefined, undefined)).toBe(DEFAULT_PHASE_A_GROUNDING_TIMEOUT_MS);
  });

  it("uses explicit request budgets before ontology-specific env values", () => {
    expect(resolveOntologyGraphTimeoutMs(25, "900")).toBe(25);
    expect(resolvePhaseAGroundingTimeoutMs(30, "800")).toBe(30);
  });

  it("accepts only positive ontology env integers and never inherits provider budgets", () => {
    expect(resolveOntologyGraphTimeoutMs(undefined, "750")).toBe(750);
    expect(resolvePhaseAGroundingTimeoutMs(undefined, "650")).toBe(650);
    expect(resolveOntologyGraphTimeoutMs(undefined, "0")).toBe(DEFAULT_ONTOLOGY_GRAPH_TIMEOUT_MS);
    expect(resolvePhaseAGroundingTimeoutMs(undefined, "not-a-number")).toBe(DEFAULT_PHASE_A_GROUNDING_TIMEOUT_MS);
  });
});
