export type SifVectorVerificationExpectation = {
  model?: string;
  dimensions?: number;
};

export type SifVectorRuntimeExpectation = SifVectorVerificationExpectation & {
  fingerprint?: string;
};

export function inspectSifVectorVerificationReceipt(
  reportValue: unknown,
  expected?: SifVectorVerificationExpectation,
): { evidenceValid: boolean; fingerprint: string };

export function createSifVectorRuntimeEvidence(
  reportValue: unknown,
  expected?: SifVectorVerificationExpectation,
): Record<string, unknown>;

export function evaluateSifVectorRuntimeReceipt(
  reportValue: unknown,
  expected: SifVectorRuntimeExpectation,
): {
  ok: boolean;
  evidenceValid: boolean;
  declaredValid: boolean;
  environmentValid: boolean;
  fingerprint: string;
  reason:
    | "verification-evidence-invalid"
    | "verification-receipt-invalid"
    | "verification-fingerprint-missing-or-mismatched"
    | "verified";
};
