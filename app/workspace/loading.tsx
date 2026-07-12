export default function Loading() {
  return (
    <main className="container grid">
      <section className="card list special-state" aria-live="polite" aria-busy="true">
        <div className="loading-spinner" aria-hidden="true" />
        <h1 className="special-state-title">작업 화면을 준비하고 있습니다</h1>
        <div className="muted">
          현장 정보와 문서팩 생성 환경을 불러오는 중입니다. AI 문서 생성은 최대 수십 초가 걸릴 수
          있습니다. 잠시만 기다려 주세요.
        </div>
      </section>
    </main>
  );
}
