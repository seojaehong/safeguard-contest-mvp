import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SAFE_TEXT_PATTERN = /^[A-Za-z0-9._/@:+-]{1,160}$/u;

function readSafeText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !SAFE_TEXT_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function readCommitSha(): string | null {
  const candidates = [
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ];
  for (const candidate of candidates) {
    const normalized = candidate?.trim().toLowerCase();
    if (normalized && COMMIT_SHA_PATTERN.test(normalized)) return normalized;
  }
  return null;
}

export function GET() {
  const commitSha = readCommitSha();
  const branch = readSafeText(process.env.VERCEL_GIT_COMMIT_REF);
  const environment = readSafeText(process.env.VERCEL_ENV);
  const deploymentUrl = readSafeText(process.env.VERCEL_URL);

  return NextResponse.json({
    ok: true,
    configured: Boolean(commitSha),
    source: commitSha ? "vercel-system-env" : "unavailable",
    commitSha,
    branch,
    environment,
    deploymentUrl,
    message: commitSha
      ? "배포 커밋 식별자를 확인했습니다."
      : "배포 커밋 식별자가 런타임 환경에 노출되지 않았습니다."
  });
}
