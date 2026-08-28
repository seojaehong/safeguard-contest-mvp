export function createPublicPageAdmissionRequest(
  path: string,
  incomingHeaders: Iterable<[string, string]>,
): Request {
  const requestHeaders = new Headers();
  for (const [name, value] of incomingHeaders) requestHeaders.set(name, value);
  return new Request(new URL(path, "https://safeclaw.invalid"), {
    headers: requestHeaders,
  });
}

export async function readPublicAdmissionMessage(response: Response): Promise<string> {
  const payload: unknown = await response.clone().json().catch(() => null);
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return "요청 보호 상태를 확인하는 동안 잠시 작업을 처리할 수 없습니다.";
}
