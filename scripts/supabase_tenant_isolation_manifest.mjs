const TABLES = Object.freeze([
  "organizations",
  "sites",
  "workers",
  "workpacks",
  "education_records",
  "dispatch_logs",
  "daily_entries",
  "knowledge_events",
  "knowledge_regeneration_runs",
  "workpack_share_sessions",
  "workpack_read_confirmations",
  "workpack_improvements",
  "workpack_improvement_photos",
]);

const CLEANUP = Object.freeze({
  run: "always",
  credential: "fixture_owner",
  order: "children_before_parents",
});

const RESIDUAL = Object.freeze({
  expectedCount: 0,
  onMismatch: "fail_closed",
});

function scenario(resource, operation, actor, expected, control) {
  return Object.freeze({
    id: `${resource}:${operation}:${actor}`,
    resource,
    operation,
    actor,
    expected,
    control,
    cleanup: CLEANUP,
    residual: RESIDUAL,
  });
}

export const TABLE_SCENARIOS = Object.freeze(TABLES.flatMap((table) => [
  scenario(table, "insert_own_fixture", "tenant_a", "allow", "positive"),
  scenario(table, "select_own_fixture", "tenant_b", "allow", "positive"),
  scenario(table, "select_foreign_fixture", "tenant_b", "deny", "isolation"),
  scenario(table, "update_foreign_fixture", "tenant_b", "deny", "isolation"),
]));

export const STORAGE_SCENARIOS = Object.freeze([
  scenario("storage:safeclaw-improvement-photos", "upload_own_object", "tenant_a", "allow", "positive"),
  scenario("storage:safeclaw-improvement-photos", "read_own_object", "tenant_a", "allow", "positive"),
  scenario("storage:safeclaw-improvement-photos", "read_foreign_object", "tenant_b", "deny", "isolation"),
  scenario("storage:safeclaw-improvement-photos", "overwrite_foreign_object", "tenant_b", "deny", "isolation"),
]);

export const TENANT_ISOLATION_MANIFEST = Object.freeze({
  version: 1,
  tables: TABLES,
  storageBucket: "safeclaw-improvement-photos",
  scenarios: Object.freeze([...TABLE_SCENARIOS, ...STORAGE_SCENARIOS]),
  execution: Object.freeze({
    setup: "fixture_owner_credentials_only",
    cleanup: CLEANUP,
    residual: RESIDUAL,
    stopOnFailure: true,
  }),
});
