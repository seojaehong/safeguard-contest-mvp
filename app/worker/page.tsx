"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function WorkerMobilePage() {
  const data = useMemo(() => buildSampleWorkpack(), []);
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
  const [selectedLanguageCode, setSelectedLanguageCode] = useState(languageOptions[0]?.code || "ko");
  const [acknowledged, setAcknowledged] = useState(false);
  const selectedLanguage = languageOptions.find((language) => language.code === selectedLanguageCode) || languageOptions[0];

  return (
    <SafeClawModuleShell
      eyebrow="작업자 모바일"
      title="작업자 모바일."
      description="작업자는 긴 문서 대신 오늘의 핵심 위험, 필수조치, 이해 확인만 봅니다."
      status="planned"
      mappedTo="작업자 공지 · 이해 확인 · 언어별 안내"
      activeHref="/worker"
      actions={<Link href="/dispatch">전파 메시지 보기</Link>}
    >
      <section className="safeclaw-worker-phone">
        <article>
          <span>오늘 작업 안전공지 · 열람 전용</span>
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
            {acknowledged ? "확인함 · 관리자 화면에 기록 예정" : "확인했습니다"}
          </button>
          <p className="worker-ack-note">
            이 확인은 작업자 표시명 기준으로 저장되며, 제출 전 현장 확인이 필요합니다.
          </p>
        </article>
      </section>
    </SafeClawModuleShell>
  );
}
