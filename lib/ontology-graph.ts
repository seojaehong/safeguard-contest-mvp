import {
  assembleGraph,
  type GraphLoadResult,
  type GraphScope,
} from "@/lib/ontology/graph-store";
import { readBoundedResponseText } from "@/lib/server/upstream-http";

export const PUBLIC_ONTOLOGY_GRAPH_MAX_ROWS_PER_TABLE = 5_000;
export const PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE = 1_000;
export const PUBLIC_ONTOLOGY_GRAPH_UPSTREAM_MAX_BYTES = 6 * 1_024 * 1_024;
export const PUBLIC_ONTOLOGY_GRAPH_OUTPUT_MAX_BYTES = 4 * 1_024 * 1_024;

type SupabaseConfig = {
  serviceRoleKey: string;
  url: string;
};

export class PublicOntologyGraphBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicOntologyGraphBudgetError";
  }
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { serviceRoleKey, url: url.replace(/\/$/u, "") };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseContentRange(
  value: string | null,
  expectedOffset: number,
  rowCount: number,
): { nextOffset: number; total: number } {
  const emptyMatch = value?.match(/^\*\/(\d+)$/u);
  if (emptyMatch) {
    const total = Number(emptyMatch[1]);
    if (expectedOffset !== 0 || rowCount !== 0 || total !== 0) {
      throw new Error("ontology graph upstream returned an inconsistent empty Content-Range");
    }
    return { nextOffset: 0, total };
  }

  const match = value?.match(/^(\d+)-(\d+)\/(\d+)$/u);
  if (!match) {
    throw new Error("ontology graph upstream omitted an exact Content-Range");
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || !Number.isSafeInteger(total)
    || start !== expectedOffset
    || end < start
    || end - start + 1 !== rowCount
    || end >= total
  ) {
    throw new Error("ontology graph upstream returned an inconsistent Content-Range");
  }
  return { nextOffset: end + 1, total };
}

async function fetchPublishedRows(
  config: SupabaseConfig,
  table: string,
  signal: AbortSignal,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  const order = table === "safety_ontology_nodes"
    ? "node_id.asc"
    : "src.asc,rel.asc,dst.asc";
  let expectedTotal: number | undefined;
  let offset = 0;
  let remainingBytes = PUBLIC_ONTOLOGY_GRAPH_UPSTREAM_MAX_BYTES;

  while (expectedTotal === undefined || offset < expectedTotal) {
    signal.throwIfAborted();
    const params = new URLSearchParams({
      limit: String(PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE),
      offset: String(offset),
      order,
      review_state: "eq.published",
      select: "*",
    });
    const response = await fetch(`${config.url}/rest/v1/${table}?${params.toString()}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
      signal,
    });
    const body = await readBoundedResponseText(response, {
      label: `${table} response`,
      maxBytes: remainingBytes,
    });
    remainingBytes -= byteLength(body);
    if (!response.ok) {
      throw new Error(`${table} 조회 실패: ${response.status} ${body}`);
    }
    const parsed = JSON.parse(body) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${table} 조회 응답이 배열이 아닙니다.`);
    }
    if (parsed.length > PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE) {
      throw new Error(`${table} exceeded the ${PUBLIC_ONTOLOGY_GRAPH_PAGE_SIZE}-row page budget`);
    }

    const range = parseContentRange(response.headers.get("content-range"), offset, parsed.length);
    if (range.total > PUBLIC_ONTOLOGY_GRAPH_MAX_ROWS_PER_TABLE) {
      throw new PublicOntologyGraphBudgetError(
        `${table} exceeded the ${PUBLIC_ONTOLOGY_GRAPH_MAX_ROWS_PER_TABLE}-row public graph budget`,
      );
    }
    if (expectedTotal !== undefined && range.total !== expectedTotal) {
      throw new Error(`${table} row count changed during paginated graph read`);
    }
    expectedTotal = range.total;
    rows.push(...parsed);
    offset = range.nextOffset;
  }

  if (rows.length !== expectedTotal) {
    throw new Error(`${table} paginated graph read was incomplete`);
  }
  return rows;
}

function enforceOutputBudget(result: GraphLoadResult): GraphLoadResult {
  const outputBytes = byteLength(JSON.stringify(result));
  if (outputBytes > PUBLIC_ONTOLOGY_GRAPH_OUTPUT_MAX_BYTES) {
    throw new PublicOntologyGraphBudgetError(
      `ontology graph output exceeded the ${PUBLIC_ONTOLOGY_GRAPH_OUTPUT_MAX_BYTES}-byte budget`,
    );
  }
  return result;
}

export async function loadPublicOntologyGraph(signal: AbortSignal): Promise<GraphLoadResult> {
  const scope: GraphScope = "published";
  const config = getSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      scope,
      graph: null,
      message: "Supabase service role key가 없어 온톨로지 그래프를 조회하지 않았습니다.",
    };
  }

  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort(signal.reason);
  if (signal.aborted) abortFromCaller();
  else signal.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const [rawNodes, rawEdges] = await Promise.all([
      fetchPublishedRows(config, "safety_ontology_nodes", controller.signal),
      fetchPublishedRows(config, "safety_ontology_edges", controller.signal),
    ]);
    controller.signal.throwIfAborted();
    return enforceOutputBudget({
      ok: true,
      configured: true,
      scope,
      graph: assembleGraph(rawNodes, rawEdges),
      message: `안전 온톨로지 그래프 조회 완료 (scope=${scope}).`,
    });
  } catch (error) {
    controller.abort(error);
    if (signal.aborted) throw signal.reason;
    return {
      ok: false,
      configured: true,
      scope,
      graph: null,
      message: error instanceof Error ? error.message : "온톨로지 그래프 조회 중 오류가 발생했습니다.",
    };
  } finally {
    signal.removeEventListener("abort", abortFromCaller);
  }
}
