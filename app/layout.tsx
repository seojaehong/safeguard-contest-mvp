import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import { GlobalBoundaryProbe } from "safeclaw-audit-error-escalation";
import { DeploymentFreshnessGuard } from "@/components/DeploymentFreshnessGuard";

// 제품 글꼴 — IBM Plex Sans KR 400·500·600 (DESIGN.md). CSS 는 --font-plex-kr 로 받는다.
// 700 이상은 불러오지 않는다. globals.css 의 font-synthesis-weight: none 으로 가짜 굵기를 막는다.
const plexSansKr = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-kr",
  preload: false
});

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

function currentBuildSha(): string | null {
  const value = process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  return value && COMMIT_SHA_PATTERN.test(value) ? value : null;
}

export const metadata: Metadata = {
  metadataBase: new URL("https://www.safeclaw.kr"),
  title: "SafeClaw | 안전 문서팩 생성",
  description: "작업 전 현장 설명을 위험성평가, TBM, 안전교육일지, 현장 공유 메시지로 정리하는 안전 문서팩 서비스",
  openGraph: {
    title: "SafeClaw | 안전 문서팩 생성",
    description: "작업 전 현장 설명을 위험성평가, TBM, 안전교육일지, 현장 공유 메시지로 정리하는 안전 문서팩 서비스",
    url: "https://www.safeclaw.kr",
    siteName: "SafeClaw",
    locale: "ko_KR",
    type: "website"
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={plexSansKr.variable}>
      <head>
        {/* Multilingual scripts remain CDN-backed; the product face (IBM Plex Sans KR) is self-hosted by next/font. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Noto Sans multilingual variants (below-fold /language section only) — lowest priority */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap"
        />

        {/* noscript fallback */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" />
        </noscript>
      </head>
      <body>
        <GlobalBoundaryProbe />
        <DeploymentFreshnessGuard currentBuildSha={currentBuildSha()} />
        {children}
      </body>
    </html>
  );
}
