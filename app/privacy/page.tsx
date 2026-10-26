import type { Metadata } from "next";
import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | SafeClaw",
  description: "SafeClaw가 처리하는 개인정보 항목, 처리 목적, 보관 위치와 보유기간, 외부 전송을 안내합니다."
};

// 이 문구는 코드의 실제 데이터 흐름(2026-10-25 기준)에 맞춘다. 흐름을 바꾸면 여기도 함께 고친다.
// 근거: docs/privacy-launch-scope-2026-10-25.md

const roleItems = [
  ["처리 주체", "작업자 명부와 교육·전파 기록의 개인정보처리자는 SafeClaw를 쓰는 고객사(사업주)입니다. SafeClaw는 고객사의 위탁을 받아 처리하는 수탁자입니다."],
  ["관리자 계정", "관리자 계정은 초대·승인을 받은 사람만 작업공간을 만들 수 있습니다. 로그인에는 이메일 링크 또는 카카오 로그인을 씁니다."],
  ["운영 주체·보호책임자", "운영 주체와 개인정보 보호책임자 연락처는 정식 고지 전에 확정해 이 자리에 적습니다."]
];

const dataItems = [
  ["관리자", "이메일 주소, 로그인 식별자", "로그인·작업공간 소유 확인"],
  ["작업자 명부", "이름, 직무, 입사일, 경력 요약, 국적, 언어, 신규·외국인 여부, 교육 상태, 휴대폰 번호, 이메일", "안전교육 확인, 언어별 안내문 작성, 공유 링크 열람 확인"],
  ["공유 세션", "초대한 작업자의 명부 사본(연락처 포함)", "초대된 작업자만 링크를 열고 열람 확인을 남기도록 본인 확인"],
  ["열람 확인", "작업자 이름, 언어, 확인 시각 (2026-10-25부터 연락처는 저장하지 않습니다)", "교육·전파 이행 기록"],
  ["작업 설명·문서팩", "관리자가 입력한 작업 설명, 생성된 문서, 개선조치 사진", "위험성평가·TBM 등 안전 문서 작성과 이력 보관"],
  ["요청 보호", "접속 IP의 해시값(원문 IP는 보내지 않습니다)", "과도한 요청 차단(1분 단위 집계)"]
];

const retentionItems = [
  ["공유 링크", "만든 뒤 24시간 동안만 열립니다."],
  ["공유 세션의 작업자 연락처", "관리자가 공유를 중지하면 바로 지웁니다. 만료된 세션은 만료 뒤 30일이 지나면 매일 정리 작업이 지웁니다."],
  ["열람 확인 기록", "이름·언어·시각만 남기고 연락처는 저장하지 않습니다. 이 방침 시행 전에 연락처와 함께 저장된 기록은 확인 뒤 30일이 지나면 매일 정리 작업이 연락처를 지웁니다."],
  ["작업자 명부·문서팩", "고객사가 이용하는 동안 보관합니다. 화면에서 바로 지우는 기능은 아직 없으므로 삭제는 운영자에게 요청해 주십시오."],
  ["요청 보호 기록", "1분 창이 지나면 사라지는 집계값만 둡니다. 하루 AI 생성량 집계는 날짜별로 하루 남짓 남습니다."]
];

const transferItems = [
  ["비로그인 체험", "기본 문서(템플릿)만 만들고, 이때는 작업 설명을 외부 서비스로 보내지 않습니다."],
  ["AI 문서 생성", "로그인한 관리자가 AI 보강(강화·전체) 모드를 쓰면 작업 설명 문장이 Google Vertex AI(Gemini)와 OpenAI로, 설정에 따라 Anthropic으로 전송됩니다. 지식 검색 기능이 켜져 있으면 작업 설명(최대 1,000자)이 검색용 변환을 위해 OpenAI로도 전송됩니다. 작업자 명부는 보내지 않습니다."],
  ["사진 위험요인 분석", "사진 분석을 요청하면 그 사진이 OpenAI로 전송됩니다."],
  ["동영상 위험 점검", "원본 영상은 서버로 보내지 않습니다. 브라우저에서 장면 사진(최대 10장)만 골라 줄이고, 얼굴 흐림을 거친 장면 사진만 OpenAI로 전송됩니다. 브라우저가 얼굴 자동 찾기를 지원하지 않으면 보내기 전에 장면을 확인하고 동의를 받습니다."],
  ["공공 근거 조회", "AI 보강 모드에서는 기상청·한국산업안전보건공단(KOSHA)·법제처 공개 API에 근거 검색어와 지역을 보냅니다. 검색어에는 작업 설명의 일부가 그대로 들어갈 수 있으니 작업 설명에 이름·연락처를 적지 마십시오."],
  ["저장·실행 인프라", "데이터는 Supabase(데이터베이스·사진 저장소)에 저장되고, 서비스는 Vercel 서울 지역(icn1)에서 실행됩니다. 요청 보호 집계는 Upstash에 둡니다."],
  ["메일·문자", "이번 런칭에서는 메일·문자를 실제로 보내지 않습니다. 언어별 전송본은 미리보기 전용입니다."]
];

const unverifiedItems = [
  "AI 제공자(Google·OpenAI·Anthropic)가 전송받은 내용을 얼마나 보관하는지",
  "Supabase 프로젝트의 저장 지역과 백업 보관기간",
  "Vercel 실행 로그의 보관기간",
  "카카오 로그인 때 Supabase에 저장되는 카카오 계정 항목의 범위",
  "운영 환경에서 지식 검색(임베딩) 기능이 켜져 있는지"
];

export default function PrivacyPage() {
  return (
    <SafeClawModuleShell
      eyebrow="개인정보"
      title="개인정보 처리방침."
      description="SafeClaw가 어떤 개인정보를 왜 처리하고, 어디에 얼마 동안 두며, 누구에게 보내는지 안내합니다."
      status="partial"
      mappedTo="처리 주체 · 항목 · 보유기간 · 외부 전송"
      activeHref="/privacy"
      actions={<Link href="/trust">신뢰 기준</Link>}
    >
      <section className="safeclaw-module-grid two trust-grid privacy-grid">
        {roleItems.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <span className="eyebrow">처리 항목</span>
          <h2>무엇을 왜 처리하는가</h2>
        </div>
        <ul>
          {dataItems.map(([subject, fields, purpose]) => (
            <li key={subject}>
              <strong>{subject}</strong> · {fields} — {purpose}
            </li>
          ))}
        </ul>
      </section>

      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <span className="eyebrow">보유기간</span>
          <h2>얼마 동안 두는가</h2>
        </div>
        <ul>
          {retentionItems.map(([subject, body]) => (
            <li key={subject}>
              <strong>{subject}</strong> · {body}
            </li>
          ))}
        </ul>
      </section>

      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <span className="eyebrow">외부 전송</span>
          <h2>누구에게 보내는가</h2>
        </div>
        <ul>
          {transferItems.map(([subject, body]) => (
            <li key={subject}>
              <strong>{subject}</strong> · {body}
            </li>
          ))}
        </ul>
        <p>연차 도구(/tools/leave)는 파일과 붙여넣은 내용을 서버로 보내지 않고 브라우저 안에서만 처리합니다.</p>
      </section>

      <section className="safeclaw-module-panel">
        <div className="compact-head">
          <span className="eyebrow">확인 중</span>
          <h2>아직 확인하지 못한 사항</h2>
        </div>
        <p>아래 사항은 확인이 끝나는 대로 이 방침에 반영합니다.</p>
        <ul>
          {unverifiedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </SafeClawModuleShell>
  );
}
