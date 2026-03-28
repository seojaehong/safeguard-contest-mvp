import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";

export default function HomePage() {
  return (
    <main className="container grid">
      <section className="hero grid">
        <div className="row">
          <span className="badge">제품·서비스 개발 부문 MVP</span>
          <span className="badge">법제처 실증 가능 축 우선</span>
          <span className="badge">KOSHA 확장 준비</span>
        </div>
        <h1 className="title">산업안전 법령·판례 코파일럿</h1>
        <p className="subtitle">
          산업안전보건법, 중대재해처벌법, 관련 판례와 해석례를 검색하고,
          실무 질문에 대해 출처 기반으로 요약해주는 공공데이터·AI 활용 MVP.
        </p>
      </section>

      <SearchBox />

      <section className="two">
        <div className="card list">
          <div className="h2">내일 데모에서 보여줄 흐름</div>
          <ol>
            <li>질문 입력 또는 통합 검색</li>
            <li>관련 법령/판례 후보 자동 수집</li>
            <li>AI가 실무형 답변 + 체크포인트 생성</li>
            <li>모든 답변에 내부 상세 페이지와 근거 출처 연결</li>
          </ol>
          <div className="row">
            <Link href="/ask" className="button">질문형 데모 보기</Link>
            <Link href="/search" className="button secondary">통합 검색 보기</Link>
          </div>
        </div>
        <div className="card list">
          <div className="h2">범위</div>
          <ul>
            <li>오늘: 구조/화면/어댑터/모크 데이터 완성</li>
            <li>내일: Law.go 키 연결 후 실데이터 전환</li>
            <li>이후: KOSHA/기상청/에어코리아 순차 확장</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
