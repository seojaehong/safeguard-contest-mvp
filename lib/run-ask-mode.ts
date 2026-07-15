import type { AiMode } from "./ai-deliverables";

const ALLOWED_MODES: AiMode[] = ["template", "enhanced", "full"];

export function resolveRunAskMode(input: {
  requestedMode?: string;
  envDefault?: string;
}): AiMode {
  const requestedMode = input.requestedMode || input.envDefault || "enhanced";
  return ALLOWED_MODES.includes(requestedMode as AiMode) ? (requestedMode as AiMode) : "enhanced";
}
