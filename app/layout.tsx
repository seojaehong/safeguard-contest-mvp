import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "산업안전 법령·판례 코파일럿",
  description: "공공 법령/판례 데이터와 AI를 활용한 산업안전 실무 리서치 MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
