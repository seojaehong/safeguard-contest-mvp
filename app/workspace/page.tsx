import type { Metadata } from "next";
import { SafeGuardCommandCenter } from "@/components/SafeGuardCommandCenter";
import { defaultFieldExample, fieldExamples } from "@/lib/field-examples";

export const metadata: Metadata = {
  title: "작업공간 | SafeClaw",
  description: "현장 설명 한 줄로 위험성평가, 작업계획, TBM, 안전교육일지까지 안전 문서팩을 생성하는 작업공간입니다."
};

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ q?: string; scenario?: string; theme?: string }> }) {
  const params = await searchParams;
  const selectedExample = fieldExamples.find((example) => example.id === params.scenario) || defaultFieldExample;
  const q = params.q || selectedExample.question;
  const workspaceTheme = params.theme === "field" || params.theme === "day" || params.theme === "light" ? "day" : "night";

  return (
    <SafeGuardCommandCenter
      examples={fieldExamples}
      initialScenarioId={selectedExample.id}
      initialQuestion={q}
      autoGenerate={Boolean(params.q)}
      workspaceTheme={workspaceTheme}
    />
  );
}
