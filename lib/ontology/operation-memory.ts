import type { HarnessImprovement } from "@/lib/db-harness";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

export type OperationMemoryNodeKind = "Workpack" | "Hazard" | "Control" | "Improvement" | "Evidence" | "Ack";

export type OperationMemoryNode = {
  id: string;
  kind: OperationMemoryNodeKind;
  label: string;
  detail?: string;
  meta: Record<string, string | number | boolean | null>;
};

export type OperationMemoryEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  relation: "usesEvidence" | "mentionsHazard" | "mitigatedBy" | "hasImprovement" | "addressesHazard" | "confirmedBy";
  label: string;
};

export type OperationMemoryGraph = {
  nodes: OperationMemoryNode[];
  edges: OperationMemoryEdge[];
  summary: {
    workpackId: string;
    hazardCount: number;
    controlCount: number;
    improvementCount: number;
    evidenceCount: number;
    ackCount: number;
    reflectedDocumentCount: number;
  };
};

export type OperationMemoryGraphInput = {
  workpack: {
    id: string;
    question: string;
    generatedAt: string;
    taskLabel?: string;
  };
  references: SafetyReferenceItem[];
  improvements: HarnessImprovement[];
  confirmations: Array<{
    displayName: string;
    languageCode: string;
    readAt: string;
  }>;
};

function slugSegment(value: string, fallback: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣._-]+/g, "")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function pushUniqueNode(nodes: Map<string, OperationMemoryNode>, node: OperationMemoryNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function pushUniqueEdge(edges: Map<string, OperationMemoryEdge>, edge: Omit<OperationMemoryEdge, "id">) {
  const id = `${edge.sourceId}|${edge.relation}|${edge.targetId}`;
  if (!edges.has(id)) edges.set(id, { ...edge, id });
}

function firstNonEmpty(values: string[], fallback: string) {
  return values.find((value) => value.trim()) || fallback;
}

export function buildOperationMemoryGraph(input: OperationMemoryGraphInput): OperationMemoryGraph {
  const nodes = new Map<string, OperationMemoryNode>();
  const edges = new Map<string, OperationMemoryEdge>();
  const reflectedDocuments = new Set<string>();
  const workpackId = `workpack:${slugSegment(input.workpack.id, "current")}`;

  pushUniqueNode(nodes, {
    id: workpackId,
    kind: "Workpack",
    label: input.workpack.taskLabel?.trim() || input.workpack.question.trim() || "현장 작업",
    detail: input.workpack.question,
    meta: {
      sourceId: input.workpack.id,
      generatedAt: input.workpack.generatedAt
    }
  });

  for (const reference of input.references) {
    const evidenceId = `evidence:${slugSegment(reference.id, "reference")}`;
    pushUniqueNode(nodes, {
      id: evidenceId,
      kind: "Evidence",
      label: reference.title,
      detail: reference.short_summary || reference.summary,
      meta: {
        referenceItemId: reference.id,
        itemType: reference.item_type,
        evidenceRole: reference.evidence_role || "supporting"
      }
    });
    pushUniqueEdge(edges, {
      sourceId: workpackId,
      targetId: evidenceId,
      relation: "usesEvidence",
      label: "오늘 문서 근거"
    });

    for (const document of [...reference.primary_documents, ...(reference.reflected_documents || [])]) {
      if (document.trim()) reflectedDocuments.add(document.trim());
    }

    const hazardLabels = reference.risk_tags.length ? reference.risk_tags : reference.keywords.slice(0, 2);
    for (const hazardLabel of hazardLabels) {
      const hazardId = `hazard:${slugSegment(hazardLabel, "hazard")}`;
      pushUniqueNode(nodes, {
        id: hazardId,
        kind: "Hazard",
        label: hazardLabel,
        meta: {
          source: "safety_reference_items"
        }
      });
      pushUniqueEdge(edges, {
        sourceId: evidenceId,
        targetId: hazardId,
        relation: "mentionsHazard",
        label: "언급한 위험"
      });

      for (const controlLabel of reference.controls.slice(0, 4)) {
        const controlId = `control:${slugSegment(controlLabel, "control")}`;
        pushUniqueNode(nodes, {
          id: controlId,
          kind: "Control",
          label: controlLabel,
          meta: {
            source: "safety_reference_items"
          }
        });
        pushUniqueEdge(edges, {
          sourceId: hazardId,
          targetId: controlId,
          relation: "mitigatedBy",
          label: "감소대책"
        });
      }
    }
  }

  for (const improvement of input.improvements) {
    const improvementId = `improvement:${slugSegment(improvement.id, "improvement")}`;
    const hazardLabel = firstNonEmpty([improvement.hazardLabel, ...(improvement.detectedHazards || [])], "개선 위험요인");
    const hazardId = `hazard:${slugSegment(hazardLabel, "hazard")}`;

    pushUniqueNode(nodes, {
      id: hazardId,
      kind: "Hazard",
      label: hazardLabel,
      meta: {
        source: improvement.sourceType
      }
    });
    pushUniqueNode(nodes, {
      id: improvementId,
      kind: "Improvement",
      label: improvement.improvementText,
      detail: improvement.visionSummary || improvement.observedImprovement,
      meta: {
        improvementId: improvement.id,
        sourceType: improvement.sourceType,
        visionStatus: improvement.visionStatus || null,
        visionModel: improvement.visionModel || null
      }
    });
    pushUniqueEdge(edges, {
      sourceId: workpackId,
      targetId: improvementId,
      relation: "hasImprovement",
      label: "오늘 개선사항"
    });
    pushUniqueEdge(edges, {
      sourceId: improvementId,
      targetId: hazardId,
      relation: "addressesHazard",
      label: "개선 대상 위험"
    });
    for (const document of improvement.reflectedDocuments) {
      if (document.trim()) reflectedDocuments.add(document.trim());
    }
  }

  for (const confirmation of input.confirmations) {
    const ackId = `ack:${slugSegment(`${confirmation.displayName}-${confirmation.readAt}`, "read")}`;
    pushUniqueNode(nodes, {
      id: ackId,
      kind: "Ack",
      label: confirmation.displayName,
      detail: confirmation.readAt,
      meta: {
        languageCode: confirmation.languageCode,
        readAt: confirmation.readAt
      }
    });
    pushUniqueEdge(edges, {
      sourceId: workpackId,
      targetId: ackId,
      relation: "confirmedBy",
      label: "열람 확인"
    });
  }

  const nodeList = [...nodes.values()];
  return {
    nodes: nodeList,
    edges: [...edges.values()],
    summary: {
      workpackId: input.workpack.id,
      hazardCount: nodeList.filter((node) => node.kind === "Hazard").length,
      controlCount: nodeList.filter((node) => node.kind === "Control").length,
      improvementCount: nodeList.filter((node) => node.kind === "Improvement").length,
      evidenceCount: nodeList.filter((node) => node.kind === "Evidence").length,
      ackCount: nodeList.filter((node) => node.kind === "Ack").length,
      reflectedDocumentCount: reflectedDocuments.size
    }
  };
}
