"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  return (
    <div className="card">
      <div className="h3">통합 검색</div>
      <div className="row">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 보호구 미지급, 하청 안전보건 책임, 중대재해 작업중지"
        />
        <button className="button" onClick={() => router.push(`/search?q=${encodeURIComponent(query)}`)}>검색</button>
      </div>
    </div>
  );
}
