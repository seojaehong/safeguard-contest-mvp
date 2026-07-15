import "./globals.css";
import type { Metadata } from "next";
import { GlobalBoundaryProbe } from "safeclaw-audit-error-escalation";

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
    <html lang="ko">
      <head>
        {/* Preconnect to font CDNs — cuts 300-600ms DNS+TCP setup from critical path */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Font loading keeps standard stylesheet links so React dev overlay stays clean. */}

        {/* Geist Mono + Noto Sans core/KR (above-fold fonts) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Noto+Sans+KR:wght@500;600;700;800;900&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Noto+Sans+KR:wght@500;600;700;800;900&display=swap"
        />

        {/* Noto Sans multilingual variants (below-fold /language section only) — lowest priority */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap"
        />

        {/* noscript fallback */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Noto+Sans+KR:wght@500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" />
        </noscript>
      </head>
      <body>
        <GlobalBoundaryProbe />
        {children}
      </body>
    </html>
  );
}
