import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "evaluation", "supabase-migration-check");
const outputPath = path.join(outputDir, "manual-supabase-apply.sql");

const migrationFiles = [
  "supabase/migrations/001_init.sql",
  "supabase/migrations/002_workspace_productization.sql",
  "supabase/migrations/003_knowledge_runtime.sql"
];

function hardenPolicyRecreation(sql) {
  const policyMatches = [...sql.matchAll(/create policy "([^"]+)"\s+on\s+([a-z_]+)/g)];
  const drops = policyMatches.map((match) => `drop policy if exists "${match[1]}" on ${match[2]};`);
  return `${drops.join("\n")}\n\n${sql}`.trim();
}

const sections = [];
sections.push([
  "-- SafeGuard Supabase manual apply SQL",
  "-- Paste this entire file into Supabase SQL Editor and run once.",
  "-- It is idempotent for tables/indexes and recreates RLS policies safely.",
  "begin;"
].join("\n"));

for (const relativePath of migrationFiles) {
  const sql = await readFile(path.join(root, relativePath), "utf8");
  const hardened = hardenPolicyRecreation(sql.trim());
  sections.push(`\n-- === ${relativePath} ===\n${hardened}\n`);
}

sections.push([
  "commit;",
  "",
  "-- Verification",
  "select",
  "  to_regclass('public.organizations') as organizations,",
  "  to_regclass('public.workpacks') as workpacks,",
  "  to_regclass('public.daily_entries') as daily_entries,",
  "  to_regclass('public.knowledge_events') as knowledge_events,",
  "  to_regclass('public.knowledge_regeneration_runs') as knowledge_regeneration_runs;"
].join("\n"));

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${sections.join("\n")}\n`, "utf8");
console.log(outputPath);
