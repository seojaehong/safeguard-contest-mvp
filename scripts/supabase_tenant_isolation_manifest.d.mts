export type CrudOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
export type ScenarioControl = "positive" | "isolation";
export type ScenarioExpectation = "allow" | "deny";
export type ResourceType = "table" | "storage";

export interface Scenario {
  readonly id: string;
  readonly resource: string;
  readonly resourceType: ResourceType;
  readonly operation: CrudOperation;
  readonly actor: "tenant_a" | "tenant_b";
  readonly fixtureOwner: "tenant_a";
  readonly expected: ScenarioExpectation;
  readonly control: ScenarioControl;
  readonly expectedHttpStatuses: readonly number[];
  readonly expectedAffectedRows: number;
  readonly expectedReturnedRows: number;
  readonly expectedStateChange: boolean;
  readonly requiresServiceRoleVerification: boolean;
  readonly cleanup: {
    readonly run: "always";
    readonly phase: "scenario_finally";
    readonly credential: "fixture_owner";
    readonly order: "children_before_parents";
  };
}

export interface TenantIsolationManifest {
  readonly version: 2;
  readonly tables: readonly string[];
  readonly storageBucket: string;
  readonly denyAssertionCount: number;
  readonly positiveControlCount: number;
  readonly scenarios: readonly Scenario[];
  readonly execution: {
    readonly setup: "fixture_owner_credentials_only";
    readonly cleanup: Scenario["cleanup"];
    readonly hiddenMutationVerifier: {
      readonly credential: "service_role_verifier";
      readonly operations: readonly ["UPDATE", "DELETE"];
      readonly receivesClient: false;
    };
    readonly finalResidualVerification: {
      readonly credential: "service_role_verifier";
      readonly expectedTableRows: 0;
      readonly expectedStorageObjects: 0;
      readonly onMismatch: "fail_closed";
    };
    readonly stopOnFailure: true;
  };
}

export const CROSS_TENANT_DENY_ASSERTIONS: readonly Scenario[];
export const OWN_TENANT_POSITIVE_CONTROLS: readonly Scenario[];
export const TENANT_ISOLATION_MANIFEST: TenantIsolationManifest;
