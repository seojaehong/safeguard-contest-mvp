import type { SupabaseClient } from "@supabase/supabase-js";

/** Tables created by supabase/migrations/010_commercial_operations.sql. */
export const COMMERCIAL_REQUIRED_TABLES = [
  "workpack_share_sessions",
  "workpack_read_confirmations",
  "workpack_improvements",
  "workpack_improvement_photos",
  "safety_reference_embeddings"
] as const;

export type CommercialRequiredTable = (typeof COMMERCIAL_REQUIRED_TABLES)[number];

export type CommercialRequiredTableProbe = {
  table: CommercialRequiredTable;
  present: boolean;
  errorCode: string | null;
};

export type CommercialRequiredTablesResult = {
  ok: boolean;
  migration: "010_commercial_operations";
  tables: CommercialRequiredTableProbe[];
  missing: CommercialRequiredTable[];
  failed: CommercialRequiredTable[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** PostgREST answers PGRST205 when a table is absent from its schema cache (not applied, or cache not reloaded). */
export function isPostgrestMissingTableError(error: unknown): boolean {
  return isRecord(error) && error.code === "PGRST205";
}

type TableProbeClient = Pick<SupabaseClient, "from">;

/**
 * Probes each migration-010 table with a one-row select. A PGRST205 answer counts as
 * missing; any other error counts as failed. Either makes the check fail.
 */
export async function checkCommercialRequiredTables(client: TableProbeClient): Promise<CommercialRequiredTablesResult> {
  const tables = await Promise.all(COMMERCIAL_REQUIRED_TABLES.map(async (table): Promise<CommercialRequiredTableProbe> => {
    try {
      const { error } = await client.from(table).select("id").limit(1);
      if (!error) return { table, present: true, errorCode: null };
      const errorCode = isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
      console.error(
        isPostgrestMissingTableError(error)
          ? `commercial required table is missing: ${table}`
          : `commercial required table probe failed: ${table}`,
        error
      );
      return { table, present: false, errorCode };
    } catch (error) {
      console.error(`commercial required table probe failed: ${table}`, error);
      return { table, present: false, errorCode: "exception" };
    }
  }));
  const missing = tables.filter((probe) => probe.errorCode === "PGRST205").map((probe) => probe.table);
  const failed = tables.filter((probe) => !probe.present && probe.errorCode !== "PGRST205").map((probe) => probe.table);
  return {
    ok: missing.length === 0 && failed.length === 0,
    migration: "010_commercial_operations",
    tables,
    missing,
    failed
  };
}
