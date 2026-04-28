import { SafeGuardCommandCenter } from "@/components/SafeGuardCommandCenter";
import { defaultFieldExample, fieldExamples } from "@/lib/field-examples";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; scenario?: string }> }) {
  const params = await searchParams;
  const selectedExample = fieldExamples.find((example) => example.id === params.scenario) || defaultFieldExample;
  const q = params.q || selectedExample.question;

  return (
    <SafeGuardCommandCenter
      examples={fieldExamples}
      initialScenarioId={selectedExample.id}
      initialQuestion={q}
      autoGenerate={Boolean(params.q)}
    />
  );
}
