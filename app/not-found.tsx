export default function NotFound() {
  return (
    <main className="container grid">
      <section className="card list special-state" data-audit-boundary="not-found">
        <h1 className="special-state-title">찾을 수 없는 문서</h1>
        <div className="muted">현재 열 수 없는 문서입니다. 검색 화면에서 근거를 다시 선택해 주세요.</div>
        <a className="button" href="/search">검색으로 돌아가기</a>
      </section>
    </main>
  );
}
