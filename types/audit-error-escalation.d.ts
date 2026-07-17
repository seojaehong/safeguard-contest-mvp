declare module "safeclaw-audit-error-escalation" {
  export function GlobalBoundaryProbe(): React.ReactNode;
}

declare module "safeclaw-audit-app-error-escalation" {
  export function confirmAppErrorBoundaryProbe(boundary: string | null): void;
  export function triggerAppErrorBoundary(boundary: string | undefined): void;
}
