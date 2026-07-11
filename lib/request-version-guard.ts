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
