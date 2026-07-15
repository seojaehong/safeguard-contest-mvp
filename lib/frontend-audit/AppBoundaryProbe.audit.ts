export function triggerAppErrorBoundary(boundary: string | undefined): void {
  if (boundary === "error") {
    throw new Error("SafeClaw deterministic frontend audit error boundary probe");
  }
}

export function confirmAppErrorBoundaryProbe(boundary: string | null): void {
  if (boundary === "error") {
    console.error("SafeClaw deterministic frontend audit error boundary confirmed");
  }
}
