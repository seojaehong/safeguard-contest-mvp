"use client";

// /tbm·/worker 화면 본문. 브라우저에 저장된 현재 작업팩이 있으면 그것을, 없으면 예시를
// 보여 주되 예시라는 사실을 배너로 먼저 알린다(런칭 깊이 점검 UI-01·UI-07).

import { useEffect, useMemo, useState } from "react";
import { CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import {
  PUBLIC_SAMPLE_BANNER_LABEL,
  PUBLIC_SAMPLE_BANNER_TEXT,
  resolveDisplayWorkpack,
  type DisplayWorkpack
} from "@/lib/public-screen-sample";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

function useDisplayWorkpack(): DisplayWorkpack {
  const sample = useMemo(() => buildSampleWorkpack(), []);
  const [display, setDisplay] = useState<DisplayWorkpack>(() => ({ data: sample, isSample: true, savedAt: null }));

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(CURRENT_WORKPACK_STORAGE_KEY);
    } catch (error) {
      console.warn("current workpack read failed", error);
    }
    setDisplay(resolveDisplayWorkpack(raw, sample));
  }, [sample]);

  return display;
}

function SampleBanner({ isSample }: { isSample: boolean }) {
  return (
    <section className={`safeclaw-current-workpack ${isSample ? "sample" : "live"}`} aria-live="polite">
      <span>{isSample ? PUBLIC_SAMPLE_BANNER_LABEL : "현재 작업 연결"}</span>
      <strong>{isSample ? PUBLIC_SAMPLE_BANNER_TEXT : "작업공간에서 생성한 최신 문서팩을 사용합니다."}</strong>
    </section>
  );
}

export function TbmSampleAwareBoard() {
  const { data, isSample } = useDisplayWorkpack();

  return (
    <>
      <SampleBanner isSample={isSample} />
      <section className="safeclaw-module-panel safeclaw-tbm-board">
        <span>{isSample ? "작업 전 확인 · 예시" : "작업 전 확인"}</span>
        <h2>{data.riskSummary.topRisk}</h2>
        <div>
          {data.deliverables.tbmQuestions.map((item, index) => (
            <article key={item}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function WorkerSampleAwareBoard() {
  const { data, isSample } = useDisplayWorkpack();
  const languageOptions = useMemo(() => ([
    {
      code: "ko",
      label: "한국어",
      nativeLabel: "한국어",
      lines: data.riskSummary.immediateActions
    },
    ...data.deliverables.foreignWorkerLanguages.map((language) => ({
      code: language.code,
      label: language.label,
      nativeLabel: language.nativeLabel,
      lines: language.lines
    }))
  ]), [data]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState("ko");
  const [acknowledged, setAcknowledged] = useState(false);
  const selectedLanguage = languageOptions.find((language) => language.code === selectedLanguageCode) || languageOptions[0];

  return (
    <>
      <SampleBanner isSample={isSample} />
      <section className="safeclaw-worker-phone">
        <article>
          <span>{isSample ? "오늘 작업 안전공지 · 예시 화면" : "오늘 작업 안전공지 · 열람 전용"}</span>
          <h2>{data.scenario.siteName}</h2>
          <strong>{data.riskSummary.topRisk}</strong>
          <div className="worker-language-switcher" aria-label="안전공지 언어 선택">
            {languageOptions.slice(0, 6).map((language) => (
              <button
                key={language.code}
                type="button"
                className={language.code === selectedLanguage.code ? "active" : ""}
                onClick={() => setSelectedLanguageCode(language.code)}
                aria-pressed={language.code === selectedLanguage.code}
              >
                <b>{language.label}</b>
                <small>{language.nativeLabel}</small>
              </button>
            ))}
          </div>
          <p className="worker-language-note">
            접속 환경의 언어를 우선 적용하되, 현장에서는 작업자가 직접 언어를 바꿀 수 있습니다.
          </p>
          <ul>
            {selectedLanguage.lines.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <button type="button" onClick={() => setAcknowledged(true)} disabled={acknowledged}>
            {acknowledged ? "확인함 · 미리보기" : "확인했습니다"}
          </button>
          <p className="worker-ack-note">
            이 화면은 미리보기이며 확인 결과는 저장되지 않습니다.
          </p>
        </article>
      </section>
    </>
  );
}
