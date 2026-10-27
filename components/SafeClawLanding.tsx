import type { Route } from "next";
import Link from "next/link";
import { ANONYMOUS_MESSAGE } from "@/lib/ask-mode-messages";
import { LANDING_EXAMPLE_CHIPS } from "@/lib/workspace-autogenerate";

// SafeClawLanding 은 Server Component 다 — 클라이언트 JS 0.
// 첫 화면 = 입력 폼 하나 (UX 권고 PR-1 · ux-direction-261026.md ⑤, 재홍님 결정 261026 ①).
// 폼은 GET /workspace?q= 로 넘어가고, /workspace 는 ?q= 를 받으면 즉시 생성한다(lib/workspace-autogenerate.ts).

const COMPOSER_PLACEHOLDER = "예: 서울 ○○현장, 비계 해체 6명, 강풍 예보, 외국인 2명";

const howItWorks = [
  { step: "①", title: "입력", body: "작업 장소·내용·인원·날씨를 한 줄로 적습니다." },
  { step: "②", title: "근거 대조", body: "법령·KOSHA 자료·기상 정보와 문장을 맞춥니다." },
  { step: "③", title: "작업팩", body: "위험성평가표·작업 전 회의 기록·안전교육 기록을 만듭니다." },
  { step: "④", title: "인쇄", body: "확인할 항목을 먼저 보고 PDF 로 인쇄합니다." }
] as const;

export function SafeClawLanding() {
  return (
    <main className="safeclaw-landing" aria-label="SafeClaw 첫 화면">
      <header className="safeclaw-landing-nav safeclaw-home-nav safeclaw-shared-header">
        <span className="safeclaw-os-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark.svg" alt="" className="safeclaw-os-mark" width={28} height={28} />
          <strong>safeclaw/<em>os</em></strong>
        </span>
        <nav className="safeclaw-shared-navigation" aria-label="SafeClaw 메뉴">
          <Link href="/workspace">작업공간</Link>
        </nav>
        <div className="safeclaw-landing-actions">
          <Link href="/login" className="safeclaw-login safeclaw-shared-action">로그인</Link>
        </div>
      </header>

      <section className="safeclaw-home-hero" id="composer" aria-labelledby="home-title">
        <div className="safeclaw-home-column">
          <span className="safeclaw-os-tag">산업안전 · 현장 문서</span>
          <h1 id="home-title" className="safeclaw-shared-page-title safeclaw-home-title">
            오늘 작업을 한 줄로 적으면
            <br />
            안전 서식을 만들고 근거와 맞춥니다.
          </h1>

          <form className="safeclaw-home-composer" action="/workspace" method="get">
            <label className="safeclaw-home-composer-label" htmlFor="home-composer-q">
              오늘 작업을 한 줄로 적어 주세요.
            </label>
            <textarea
              id="home-composer-q"
              className="safeclaw-home-textarea"
              name="q"
              maxLength={600}
              rows={3}
              required
              placeholder={COMPOSER_PLACEHOLDER}
            />
            <div className="safeclaw-home-composer-foot">
              <small className="safeclaw-home-hint">사진은 문서를 만든 뒤 작업공간에서 첨부할 수 있습니다.</small>
              <button type="submit" className="safeclaw-home-submit safeclaw-shared-action">보내기</button>
            </div>
          </form>

          <p className="safeclaw-home-notice" data-testid="anonymous-mode-notice">{ANONYMOUS_MESSAGE}</p>

          <div className="safeclaw-home-examples" aria-label="예시로 해보기">
            <span className="safeclaw-home-examples-label">예시로 해보기</span>
            <ul className="safeclaw-home-chip-row">
              {LANDING_EXAMPLE_CHIPS.map((chip) => (
                <li key={chip.id}>
                  <Link href={chip.href as Route} className="safeclaw-home-chip">{chip.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="safeclaw-hero-position safeclaw-home-position safeclaw-shared-description">
            현장관리자의 문서 준비를 돕습니다 — 안전 판단과 최종 확인은 사람이 맡습니다.
          </p>
        </div>
      </section>

      <section className="safeclaw-os-section safeclaw-home-how" id="how" aria-labelledby="home-how-title">
        <div className="safeclaw-home-column">
          <h2 id="home-how-title" className="safeclaw-section-title">어떻게 만들어지나</h2>
          <ol className="safeclaw-home-steps">
            {howItWorks.map((item) => (
              <li key={item.title}>
                <article className="safeclaw-shared-card safeclaw-home-step">
                  <span>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="safeclaw-landing-footer safeclaw-home-footer">
        <div className="safeclaw-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark-Inverse.svg" alt="" width={26} height={26} />
          <strong>safeclaw/<em>os</em></strong>
          <p>현장관리자를 위한 산업안전 문서 작업공간</p>
        </div>
        <nav aria-label="푸터 메뉴">
          <Link href="/workspace">작업공간</Link>
          <Link href="/evidence">근거 원문</Link>
          <Link href="/privacy">개인정보</Link>
        </nav>
        <p className="safeclaw-footer-note">© {new Date().getFullYear()} safeclaw · 안전 문서는 사람의 검토를 전제로 합니다.</p>
      </footer>
    </main>
  );
}
