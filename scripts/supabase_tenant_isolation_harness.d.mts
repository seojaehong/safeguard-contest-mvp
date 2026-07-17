import type { Scenario, TenantIsolationManifest } from "./supabase_tenant_isolation_manifest.mjs";

export type { Scenario } from "./supabase_tenant_isolation_manifest.mjs";

export interface HarnessEnvironment extends Record<string, string | undefined> {
  SUPABASE_TENANT_TEST_PROJECT_REF?: string;
  SUPABASE_PRODUCTION_PROJECT_REF?: string;
  SUPABASE_TENANT_TEST_DISPOSABLE_ACK?: string;
  SUPABASE_TENANT_TEST_EXPECTED_HEAD?: string;
  SUPABASE_TENANT_TEST_ANON_KEY?: string;
  SUPABASE_TENANT_TEST_USER_A_JWT?: string;
  SUPABASE_TENANT_TEST_USER_B_JWT?: string;
}

export interface ScenarioObservation {
  readonly httpStatus: number;
  readonly affectedRows: number;
  readonly returnedRows: number;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly foreignUnchanged: boolean;
}

export interface ExecutorContext {
  readonly scenario: Scenario;
  readonly endpoint: string;
  readonly clients: {
    readonly tenantA: { readonly anonKey: string; readonly accessToken: string };
    readonly tenantB: { readonly anonKey: string; readonly accessToken: string };
  };
}

export interface CleanupObservation {
  readonly httpStatus: number;
  readonly affectedRows: number;
}

export interface ScenarioExecutor {
  executeScenario(context: ExecutorContext): Promise<ScenarioObservation>;
  cleanupScenario(context: ExecutorContext): Promise<CleanupObservation>;
}

export interface ForeignVerificationContext {
  readonly credential: "service_role_verifier";
  readonly scenario: Scenario;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
}

export interface ForeignVerificationObservation {
  readonly affectedRows: number;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly foreignUnchanged: boolean;
}

export interface ResidualVerificationContext {
  readonly credential: "service_role_verifier";
  readonly manifest: TenantIsolationManifest;
  readonly expectedTableRows: 0;
  readonly expectedStorageObjects: 0;
}

export interface ResidualVerificationObservation {
  readonly tableRows: number;
  readonly storageObjects: number;
}

export interface ServiceRoleVerifier {
  verifyForeignState(context: ForeignVerificationContext): Promise<ForeignVerificationObservation>;
  verifyResidualZero(context: ResidualVerificationContext): Promise<ResidualVerificationObservation>;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly passed: boolean; readonly message: string }[];
  readonly failedCheckIds: readonly string[];
}

export interface HarnessResult {
  readonly ok: boolean;
  readonly mode: "dry-run" | "execute";
  readonly expectedHead: string | null;
  readonly actualHead: string;
  readonly denyAssertionCount: number;
  readonly positiveControlCount: number;
  readonly manifestCount: number;
  readonly requestCount: number;
  readonly cleanupCount: number;
  readonly verifierCount: number;
  readonly preflight: ValidationResult;
  readonly results?: readonly {
    readonly id: string;
    readonly passed: boolean;
    readonly observation: ScenarioObservation | null;
    readonly validation: ValidationResult | null;
    readonly foreignVerification: ForeignVerificationObservation | null;
    readonly cleanupObservation: CleanupObservation | null;
  }[];
  readonly residualVerification?: { readonly tableRows: number | null; readonly storageObjects: number | null; readonly passed: boolean } | null;
  readonly error?: string;
}

export const DISPOSABLE_PROJECT_ACK: string;
export function redactSecrets(value: unknown, secrets?: readonly string[]): unknown;
export function evaluatePreflight(input: { env: HarnessEnvironment; actualHead: string }): ValidationResult;
export function validateScenarioObservation(scenario: Scenario, observation: ScenarioObservation): ValidationResult;
export function runTenantIsolationHarness(input?: {
  env?: HarnessEnvironment;
  actualHead?: string;
  mode?: "dry-run" | "execute";
  executor?: ScenarioExecutor;
  verifier?: ServiceRoleVerifier;
}): Promise<HarnessResult>;
