import { NextResponse } from "next/server";

// 관리자 계정 초대·승인제(2026-10-25 결정 20).
// 로그인(Supabase Auth)은 클라이언트에서 일어나므로, 서버의 「가입 순간」은 작업공간(조직)을
// 처음 만드는 ensureWorkspaceContext 다. 이미 조직을 가진 계정은 그대로 쓰고, 조직이 없는
// 계정은 초대 명단(이메일)이나 운영자 명단에 있을 때만 조직을 만든다.
export const ADMIN_INVITED_EMAILS_ENV = "SAFECLAW_ADMIN_INVITED_EMAILS";
const PLATFORM_OPERATOR_IDS_ENV = "SAFECLAW_PLATFORM_OPERATOR_USER_IDS";

type Environment = Record<string, string | undefined>;

export class WorkspaceInviteRequiredError extends Error {
  readonly code = "WORKSPACE_INVITE_REQUIRED";
  constructor() {
    super("workspace creation requires an admin invitation");
    this.name = "WorkspaceInviteRequiredError";
  }
}

function readList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isInvitedAdmin(
  user: { id: string; email: string | null },
  environment: Environment = process.env
): boolean {
  if (readList(environment[PLATFORM_OPERATOR_IDS_ENV]).includes(user.id.toLowerCase())) return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return readList(environment[ADMIN_INVITED_EMAILS_ENV]).includes(email);
}

export const WORKSPACE_INVITE_REQUIRED_MESSAGE =
  "초대받은 관리자 계정만 작업공간을 만들 수 있습니다. 사용 신청은 SafeClaw 운영자에게 문의해 주세요.";

export function workspaceInviteRequiredResponse(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({
    ok: false,
    configured: true,
    ...extra,
    code: "WORKSPACE_INVITE_REQUIRED",
    message: WORKSPACE_INVITE_REQUIRED_MESSAGE
  }, { status: 403 });
}
