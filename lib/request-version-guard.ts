export type LatestOnlyRequestHandle = {
  requestId: number;
  signal: AbortSignal;
};

export type LatestOnlyRequestGate = {
  begin: () => LatestOnlyRequestHandle;
  isCurrent: (requestId: number) => boolean;
  finish: (requestId: number) => void;
  abortCurrent: () => void;
};

export type BoundRequestHandle<Binding> = LatestOnlyRequestHandle & {
  binding: Binding;
};

export type BoundRequestGate<Binding> = {
  begin: (binding: Binding) => BoundRequestHandle<Binding>;
  canCommit: (handle: BoundRequestHandle<Binding>, currentBinding: Binding) => boolean;
  finish: (handle: BoundRequestHandle<Binding>) => void;
  abortCurrent: () => void;
};

export function createLatestOnlyRequestGate(): LatestOnlyRequestGate {
  let currentRequestId = 0;
  let currentController: AbortController | null = null;

  return {
    begin() {
      currentController?.abort();
      currentRequestId += 1;
      currentController = new AbortController();
      return {
        requestId: currentRequestId,
        signal: currentController.signal
      };
    },
    isCurrent(requestId) {
      return requestId === currentRequestId && currentController !== null && !currentController.signal.aborted;
    },
    finish(requestId) {
      if (requestId === currentRequestId) currentController = null;
    },
    abortCurrent() {
      currentController?.abort();
      currentController = null;
    }
  };
}

export function createBoundRequestGate<Binding>(): BoundRequestGate<Binding> {
  let currentRequestId = 0;
  let currentController: AbortController | null = null;

  return {
    begin(binding) {
      currentController?.abort();
      currentRequestId += 1;
      currentController = new AbortController();
      return {
        requestId: currentRequestId,
        signal: currentController.signal,
        binding
      };
    },
    canCommit(handle, currentBinding) {
      return handle.requestId === currentRequestId
        && currentController !== null
        && handle.signal === currentController.signal
        && !currentController.signal.aborted
        && Object.is(handle.binding, currentBinding);
    },
    finish(handle) {
      if (handle.requestId === currentRequestId && handle.signal === currentController?.signal) {
        currentController = null;
      }
    },
    abortCurrent() {
      currentController?.abort();
      currentController = null;
    }
  };
}

export function isAbortError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && Reflect.get(error, "name") === "AbortError";
}
