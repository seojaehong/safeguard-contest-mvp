export default function Loading() {
  return (
    <main className="container grid">
      <section className="card list">
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            border: "3px solid var(--line-strong)",
            borderTopColor: "var(--accent)",
            borderRadius: 999,
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div className="h2">작업 화면을 준비하고 있습니다</div>
        <div className="muted">
          현장 정보와 문서팩 생성 환경을 불러오는 중입니다. AI 문서 생성은 최대 수십 초가 걸릴 수
          있습니다. 잠시만 기다려 주세요.
        </div>
      </section>
    </main>
  );
}
