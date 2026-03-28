export default function NotFound() {
  return (
    <main className="container grid">
      <section className="card list">
        <div className="h2">찾을 수 없는 문서</div>
        <div className="muted">내일 실데이터 연결 전이라 현재는 데모 시드 범위 안에서만 상세가 열립니다.</div>
        <a className="button" href="/search">검색으로 돌아가기</a>
      </section>
    </main>
  );
}
