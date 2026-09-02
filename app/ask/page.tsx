import type { Metadata } from "next";
import { AskLivePage } from "./AskLivePage";

export const metadata: Metadata = {
  title: "안전 질의 | SafeClaw",
  description: "현장 상황을 질문하면 법령·기상·교육 근거와 함께 안전 조치 답변을 제공하는 안전 질의 페이지입니다."
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "하청 작업에서 원청의 안전보건 책임을 실무적으로 어떻게 확인해야 하나요?";
  return <AskLivePage question={q} />;
}
