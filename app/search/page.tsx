import { SearchLivePage } from "./SearchLivePage";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  return <SearchLivePage query={q} />;
}
