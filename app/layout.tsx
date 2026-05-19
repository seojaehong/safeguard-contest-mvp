import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SafeClaw | 안전 문서팩 생성",
  description: "작업 전 현장 설명을 위험성평가, TBM, 안전교육일지, 현장 공유 메시지로 정리하는 안전 문서팩 서비스",
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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Non-blocking font loading:
            1. Each font <link> uses rel="preload" as="style" to start download immediately
            2. onLoad callback switches rel to "stylesheet" (non-blocking — does not block render)
            3. <noscript> fallback for no-JS environments */}

        {/* Pretendard (primary KR font) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
          media="print"
          // @ts-expect-error — string onLoad handler is valid for non-blocking font swap
          onLoad="this.media='all'"
        />

        {/* Geist Mono + Noto Sans core (above-fold fonts) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&display=swap"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&display=swap"
          media="print"
          // @ts-expect-error — string onLoad handler is valid for non-blocking font swap
          onLoad="this.media='all'"
        />

        {/* Noto Sans multilingual variants (below-fold /language section only) — lowest priority */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap"
          media="print"
          // @ts-expect-error — string onLoad handler is valid for non-blocking font swap
          onLoad="this.media='all'"
        />

        {/* noscript fallback */}
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Khmer:wght@400;600;700;800&family=Noto+Sans+Myanmar:wght@400;600;700;800&family=Noto+Sans+Thai:wght@400;600;700;800&display=swap" />
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
