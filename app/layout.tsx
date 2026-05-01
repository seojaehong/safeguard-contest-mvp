import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SafeClaw | 안전 문서팩 생성",
  description: "작업 전 현장 설명을 위험성평가, TBM, 안전교육일지, 현장 공유 메시지로 정리하는 안전 문서팩 서비스"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
