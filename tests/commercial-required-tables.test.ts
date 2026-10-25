import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  COMMERCIAL_REQUIRED_TABLES,
  checkCommercialRequiredTables
} from "@/lib/commercial-required-tables";

function createTableProbeClient(errors: Record<string, Record<string, unknown> | undefined>) {
  return {
    from(table: string) {
      const result = { data: [], error: errors[table] ?? null };
      const query = {
        select() {
          return query;
        },
        limit() {
          return Promise.resolve(result);
        }
      };
      return query;
    }
  };
}

describe("commercial required tables check", () => {
  it("lists every table created by migration 010", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/010_commercial_operations.sql"),
      "utf8"
    );
    const created = Array.from(migration.matchAll(/create table if not exists (\w+)/giu), (match) => match[1]);
    expect([...COMMERCIAL_REQUIRED_TABLES].sort()).toEqual([...created].sort());
    expect(COMMERCIAL_REQUIRED_TABLES).toHaveLength(5);
  });

  it("passes when every required table answers", async () => {
    const result = await checkCommercialRequiredTables(createTableProbeClient({}) as never);
    expect(result).toMatchObject({ ok: true, missing: [], failed: [] });
    expect(result.tables).toHaveLength(5);
  });

  it("fails and names the table when PostgREST reports PGRST205", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await checkCommercialRequiredTables(createTableProbeClient({
      workpack_read_confirmations: {
        code: "PGRST205",
        message: "Could not find the table 'public.workpack_read_confirmations' in the schema cache"
      }
    }) as never);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["workpack_read_confirmations"]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("separates other probe errors from missing tables", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await checkCommercialRequiredTables(createTableProbeClient({
      workpack_improvements: { code: "57014", message: "canceling statement due to statement timeout" }
    }) as never);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual(["workpack_improvements"]);
    consoleSpy.mockRestore();
  });
});
