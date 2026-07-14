export type ClawChatRequestSessionCallbacks = {
  resetTurns: () => void;
  setBusy: (busy: boolean) => void;
};

export type ClawChatRequestSession = {
  synchronizeContext: (authToken: string | undefined, siteId: string | null) => void;
  beginRequest: () => AbortController;
  isCurrent: (controller: AbortController) => boolean;
  completeRequest: (controller: AbortController) => void;
  dispose: () => void;
};

export type ClawContextStatus = "login-required" | "loading" | "ready" | "unavailable";
export type ClawContextSiteOption = { id: string; name: string; organizationId: string };
export type ClawContextViewState = {
  authToken: string | null;
  siteOptions: ClawContextSiteOption[];
  selectedSiteId: string | null;
  status: ClawContextStatus;
};

export type ClawContextRequest = {
  authToken: string;
  generation: number;
  signal: AbortSignal;
};

export type ClawContextRequestSession = {
  begin: (authToken: string) => ClawContextRequest;
  commit: (request: ClawContextRequest, action: () => void) => boolean;
  cancel: (request: ClawContextRequest) => void;
  dispose: () => void;
};

export const CLAW_CONTEXT_LOAD_FAILED_EVENT = "CLAW_CONTEXT_LOAD_FAILED";

export function reportClawContextLoadFailure(): void {
  console.warn(CLAW_CONTEXT_LOAD_FAILED_EVENT);
}

export function resolveClawContextViewState(
  authToken: string | undefined,
  state: ClawContextViewState,
): ClawContextViewState {
  const currentAuthToken = authToken ?? null;
  if (state.authToken === currentAuthToken) return state;
  return {
    authToken: currentAuthToken,
    siteOptions: [],
    selectedSiteId: null,
    status: currentAuthToken ? "loading" : "login-required",
  };
}

export function createClawContextRequestSession(): ClawContextRequestSession {
  let generation = 0;
  let active: { request: ClawContextRequest; controller: AbortController } | null = null;

  return {
    begin: (authToken) => {
      active?.controller.abort();
      generation += 1;
      const controller = new AbortController();
      const request = { authToken, generation, signal: controller.signal };
      active = { request, controller };
      return request;
    },
    commit: (request, action) => {
      if (!active || active.request !== request || request.signal.aborted) return false;
      active = null;
      action();
      return true;
    },
    cancel: (request) => {
      if (!active || active.request !== request) return;
      active.controller.abort();
      active = null;
    },
    dispose: () => {
      active?.controller.abort();
      active = null;
    },
  };
}

export function createClawChatRequestSession(
  callbacks: ClawChatRequestSessionCallbacks,
): ClawChatRequestSession {
  let initialized = false;
  let currentAuthToken: string | undefined;
  let currentSiteId: string | null = null;
  let activeController: AbortController | null = null;

  return {
    synchronizeContext: (authToken, siteId) => {
      if (initialized && authToken === currentAuthToken && siteId === currentSiteId) return;
      initialized = true;
      currentAuthToken = authToken;
      currentSiteId = siteId;
      activeController?.abort();
      activeController = null;
      callbacks.resetTurns();
      callbacks.setBusy(false);
    },
    beginRequest: () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      callbacks.setBusy(true);
      return controller;
    },
    isCurrent: (controller) => activeController === controller && !controller.signal.aborted,
    completeRequest: (controller) => {
      if (activeController !== controller) return;
      activeController = null;
      callbacks.setBusy(false);
    },
    dispose: () => {
      activeController?.abort();
      activeController = null;
    },
  };
}
