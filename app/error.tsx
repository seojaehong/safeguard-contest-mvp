"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container grid">
      <section className="card list special-state" data-audit-boundary="error">
        <h1 className="special-state-title">일시적인 오류가 발생했습니다</h1>
        <div className="muted">
          요청을 처리하는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.
          문제가 계속되면 새로고침하거나 처음 화면에서 다시 시작해 주세요.
        </div>
        {error.digest ? <div className="muted">오류 코드: {error.digest}</div> : null}
        <button className="button" type="button" onClick={() => reset()}>
          다시 시도
        </button>
      </section>
    </main>
  );
}
