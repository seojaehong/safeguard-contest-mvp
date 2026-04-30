import { V2DemoExperience } from "@/components/V2DemoExperience";
import { defaultFieldExample, fieldExamples } from "@/lib/field-examples";

type DemoSearchParams = {
  scenario?: string;
  step?: string;
  mode?: string;
  speed?: string;
};

function readStep(value?: string) {
  const parsed = Number(value || "0");
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function readMode(value?: string): "live" | "offline" {
  return value === "offline" ? "offline" : "live";
}

function readSpeed(value?: string): "fast" | "normal" | "slow" {
  if (value === "fast" || value === "slow") return value;
  return "normal";
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<DemoSearchParams> }) {
  const params = await searchParams;
  const selected = fieldExamples.find((example) => example.id === params.scenario) || defaultFieldExample;

  return (
    <V2DemoExperience
      examples={fieldExamples}
      initialScenarioId={selected.id}
      initialStep={readStep(params.step)}
      initialMode={readMode(params.mode)}
      initialSpeed={readSpeed(params.speed)}
    />
  );
}
