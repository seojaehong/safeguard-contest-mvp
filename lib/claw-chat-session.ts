export type ClawChatRequestSessionCallbacks = {
  resetTurns: () => void;
  setBusy: (busy: boolean) => void;
};

export type ClawChatRequestSession = {
  synchronizeContext: (authToken: string | undefined, siteId: string | null) => void;
  beginRequest: () => AbortController;
  completeRequest: (controller: AbortController) => void;
  dispose: () => void;
};

export const CLAW_CONTEXT_LOAD_FAILED_EVENT = "CLAW_CONTEXT_LOAD_FAILED";

export function reportClawContextLoadFailure(): void {
  console.warn(CLAW_CONTEXT_LOAD_FAILED_EVENT);
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
