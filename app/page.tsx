import { redirect } from "next/navigation";
import { SafeClawLanding } from "@/components/SafeClawLanding";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; scenario?: string }> }) {
  const params = await searchParams;
  if (params.q || params.scenario) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.scenario) query.set("scenario", params.scenario);
    redirect(`/workspace?${query.toString()}`);
  }

  return <SafeClawLanding />;
}
