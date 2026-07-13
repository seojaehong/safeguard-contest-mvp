export type OntologyDeadlineCode =
  | "ontology_deadline_exceeded"
  | "ontology_request_aborted";

export class OntologyDeadlineError extends Error {
  readonly code: OntologyDeadlineCode;

  constructor(code: OntologyDeadlineCode) {
    super(code === "ontology_deadline_exceeded"
      ? "Ontology operation deadline exceeded."
      : "Ontology operation aborted.");
    this.name = "OntologyDeadlineError";
    this.code = code;
  }
}

export function isOntologyDeadlineError(error: unknown): error is OntologyDeadlineError {
  return error instanceof OntologyDeadlineError;
}

export async function withOntologyDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<T> {
  if (options.signal?.aborted) {
    throw new OntologyDeadlineError("ontology_request_aborted");
  }

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let removeExternalAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    const stop = (code: OntologyDeadlineCode) => {
      reject(new OntologyDeadlineError(code));
      controller.abort();
    };
    timeoutHandle = setTimeout(
      () => stop("ontology_deadline_exceeded"),
      Math.max(1, options.timeoutMs),
    );
    if (options.signal) {
      const onAbort = () => stop("ontology_request_aborted");
      options.signal.addEventListener("abort", onAbort, { once: true });
      removeExternalAbort = () => options.signal?.removeEventListener("abort", onAbort);
    }
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      deadline,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    removeExternalAbort?.();
  }
}
