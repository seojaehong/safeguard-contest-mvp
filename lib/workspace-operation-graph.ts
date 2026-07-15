import type { HarnessWorkpackMemory } from "@/lib/db-harness";
import { buildOperationMemoryGraph, type OperationMemoryGraph, type OperationMemoryGraphInput } from "@/lib/ontology/operation-memory";
import type { AskResponse } from "@/lib/types";

export type WorkspaceOperationConfirmation = OperationMemoryGraphInput["confirmations"][number];

export type WorkspaceOperationGraphOptions = {
  workpackId?: string | null;
  generatedAt: string;
  confirmations?: WorkspaceOperationConfirmation[];
};

function uniqueWorkpackMemory(items: HarnessWorkpackMemory[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id.trim() || item.question.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildWorkspaceOperationMemoryInput(
  response: AskResponse,
  options: WorkspaceOperationGraphOptions
): OperationMemoryGraphInput {
  const packet = response.dbHarness?.packet;
  const generatedAt = options.generatedAt;
  const references = packet
    ? [
      ...packet.directEvidence,
      ...packet.sifCases,
      ...packet.supportingEvidence
    ]
    : [];

  return {
    workpack: {
      id: options.workpackId?.trim() || `current-${response.scenario.workSummary || "workpack"}`,
      question: response.question,
      generatedAt,
      taskLabel: response.scenario.workSummary
    },
    references,
    improvements: packet?.improvementMemory || [],
    relatedWorkpacks: uniqueWorkpackMemory(packet?.workpackMemory || []),
    confirmations: options.confirmations || []
  };
}

export function buildWorkspaceOperationMemoryGraph(
  response: AskResponse,
  options: WorkspaceOperationGraphOptions
): OperationMemoryGraph {
  return buildOperationMemoryGraph(buildWorkspaceOperationMemoryInput(response, options));
}
