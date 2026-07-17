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

const OPERATIONS = Object.freeze(["SELECT", "INSERT", "UPDATE", "DELETE"]);
const TENANT_DIRECTIONS = Object.freeze([
  Object.freeze({ actor: "tenant_a", fixtureOwner: "tenant_b", direction: "a_to_b" }),
  Object.freeze({ actor: "tenant_b", fixtureOwner: "tenant_a", direction: "b_to_a" }),
]);
const STORAGE_RESOURCE = "safeclaw-improvement-photos";
const CLEANUP = Object.freeze({
  run: "always",
  phase: "scenario_finally",
  credential: "fixture_owner",
  order: "children_before_parents",
});

const STATUS_BY_EXPECTATION = Object.freeze({
  positive: Object.freeze({
    SELECT: Object.freeze([200]),
    INSERT: Object.freeze([200, 201]),
    UPDATE: Object.freeze([200, 204]),
    DELETE: Object.freeze([200, 204]),
  }),
  deny: Object.freeze({
    SELECT: Object.freeze([200]),
    INSERT: Object.freeze([401, 403]),
    UPDATE: Object.freeze([200, 204]),
    DELETE: Object.freeze([200, 204]),
  }),
});

function scenario(resource, resourceType, operation, expected, control, direction) {
  const positiveMutation = control === "positive" && operation !== "SELECT";
  const actor = control === "positive" ? direction.fixtureOwner : direction.actor;
  return Object.freeze({
    id: `${resourceType}:${resource}:${control}:${direction.direction}:${operation.toLowerCase()}`,
    resource,
    resourceType,
    operation,
    actor,
    fixtureOwner: direction.fixtureOwner,
    direction: control === "positive"
      ? (actor === "tenant_a" ? "a_to_a" : "b_to_b")
      : direction.direction,
    expected,
    control,
    expectedHttpStatuses: STATUS_BY_EXPECTATION[control === "positive" ? "positive" : "deny"][operation],
    expectedAffectedRows: positiveMutation ? 1 : 0,
    expectedReturnedRows: control === "positive" && operation === "SELECT" ? 1 : 0,
    expectedStateChange: positiveMutation,
    requiresServiceRoleVerification: control === "isolation" && (operation === "UPDATE" || operation === "DELETE"),
    cleanup: CLEANUP,
  });
}

const RESOURCES = Object.freeze([
  ...TABLES.map((resource) => Object.freeze({ resource, resourceType: "table" })),
  Object.freeze({ resource: STORAGE_RESOURCE, resourceType: "storage" }),
]);

export const CROSS_TENANT_DENY_ASSERTIONS = Object.freeze(RESOURCES.flatMap(({ resource, resourceType }) => (
  TENANT_DIRECTIONS.flatMap((direction) => OPERATIONS.map((operation) => (
    scenario(resource, resourceType, operation, "deny", "isolation", direction)
  )))
)));

export const OWN_TENANT_POSITIVE_CONTROLS = Object.freeze(RESOURCES.flatMap(({ resource, resourceType }) => (
  TENANT_DIRECTIONS.flatMap((direction) => OPERATIONS.map((operation) => (
    scenario(resource, resourceType, operation, "allow", "positive", direction)
  )))
)));

export const TENANT_ISOLATION_MANIFEST = Object.freeze({
  version: 3,
  tables: TABLES,
  storageBucket: STORAGE_RESOURCE,
  denyAssertionCount: CROSS_TENANT_DENY_ASSERTIONS.length,
  positiveControlCount: OWN_TENANT_POSITIVE_CONTROLS.length,
  scenarios: Object.freeze([...CROSS_TENANT_DENY_ASSERTIONS, ...OWN_TENANT_POSITIVE_CONTROLS]),
  execution: Object.freeze({
    setup: "fixture_owner_credentials_only",
    cleanup: CLEANUP,
    hiddenMutationVerifier: Object.freeze({
      credential: "service_role_verifier",
      operations: Object.freeze(["UPDATE", "DELETE"]),
      receivesClient: false,
    }),
    finalResidualVerification: Object.freeze({
      credential: "service_role_verifier",
      expectedTableRows: 0,
      expectedStorageObjects: 0,
      onMismatch: "fail_closed",
    }),
    stopOnFailure: true,
  }),
});
