"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./LegalSearch.module.css";

export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  // form 으로 감싸 Enter 로도 검색한다. 빈 검색어는 보내지 않는다.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className={`safeclaw-module-panel ${styles.searchForm}`} role="search" onSubmit={submit}>
      <label className={styles.searchLabel} htmlFor="legal-search-query">통합 검색</label>
      <div className={styles.searchRow}>
        <input
          id="legal-search-query"
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 보호구 미지급, 하청 안전보건 책임, 중대재해 작업중지"
          enterKeyHint="search"
        />
        <button type="submit" className="button" disabled={!query.trim()}>검색</button>
      </div>
    </form>
  );
}
