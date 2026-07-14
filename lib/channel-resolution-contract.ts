export const WORKFLOW_SHARE_CHANNELS = ["email", "sms", "kakao"] as const;

export type WorkflowShareChannel = typeof WORKFLOW_SHARE_CHANNELS[number];

export type ChannelResolutionRequestDto = {
  workpackId: string;
  canonicalWorkpackRevision: string;
  recipients: string[];
  requestedChannels: WorkflowShareChannel[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkflowShareChannels(value: unknown): WorkflowShareChannel[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const channels = value.filter((item): item is WorkflowShareChannel => (
    typeof item === "string" && WORKFLOW_SHARE_CHANNELS.includes(item as WorkflowShareChannel)
  ));
  if (channels.length !== value.length || new Set(channels).size !== channels.length) return null;
  return channels;
}

export function parseChannelResolutionRequest(value: unknown): ChannelResolutionRequestDto | null {
  if (!isRecord(value)) return null;
  const workpackId = typeof value.workpackId === "string" ? value.workpackId.trim() : "";
  const canonicalWorkpackRevision = typeof value.canonicalWorkpackRevision === "string"
    ? value.canonicalWorkpackRevision.trim()
    : "";
  const recipients = Array.isArray(value.recipients)
    ? value.recipients.filter((item): item is string => typeof item === "string").map((item) => item.trim())
    : [];
  const requestedChannels = parseWorkflowShareChannels(value.requestedChannels);
  if (
    !uuidPattern.test(workpackId)
    || !digestPattern.test(canonicalWorkpackRevision)
    || recipients.length !== (Array.isArray(value.recipients) ? value.recipients.length : 0)
    || recipients.length === 0
    || recipients.some((recipient) => !uuidPattern.test(recipient))
    || new Set(recipients).size !== recipients.length
    || !requestedChannels
  ) return null;
  return { workpackId, canonicalWorkpackRevision, recipients, requestedChannels };
}

export function buildChannelResolutionRequest(input: ChannelResolutionRequestDto): ChannelResolutionRequestDto {
  const parsed = parseChannelResolutionRequest(input);
  if (!parsed) throw new Error("채널 확인 요청의 서버 binding이 올바르지 않습니다.");
  return parsed;
}
