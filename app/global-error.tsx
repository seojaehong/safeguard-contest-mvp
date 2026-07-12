"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main className="container grid">
          <section className="card list special-state" data-audit-boundary="global-error">
            <h1 className="special-state-title">서비스에 일시적인 문제가 발생했습니다</h1>
            <div className="muted">
              화면을 표시하는 중 오류가 발생했습니다. 아래 버튼으로 다시 시도해 주세요.
            </div>
            {error.digest ? <div className="muted">오류 코드: {error.digest}</div> : null}
            <button className="button" type="button" onClick={() => reset()}>
              다시 시도
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
