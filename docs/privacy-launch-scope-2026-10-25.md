# 개인정보·가입·비용 상한 런칭 범위 (PR-19, 2026-10-25)

근거: `launch-depth-audit-2026-10-25/inventory.md` 원인 N, 결정 19~24 (2026-10-25 추천안대로 승인).
대상 발견: SEC-02·03·04·05·06·07·12·13.

## 결정과 코드 위치

| 결정 | 내용 | 코드 |
|---|---|---|
| 19 | 공유 세션 중지 시 즉시, 만료·중지 뒤 30일 지나면 스냅숏 연락처(phone·email) 정리. 새 열람 확인 기록에는 연락처를 남기지 않고, 그 전에 쌓인 열람 확인 기록도 확인 뒤 30일이 지나면 같은 cron 이 연락처를 지움. SafeClaw = 고객사의 수탁자 | `lib/workpack-commercial.ts`(strip·count), `app/api/workpacks/[id]/share-sessions/route.ts` DELETE, `lib/share-contact-retention.ts`, `app/api/share-sessions/contact-retention/route.ts`(cron, `vercel.json` 매일 03:30 KST) |
| 20 | 관리자 계정 초대·승인제. 조직이 없는 계정은 `SAFECLAW_ADMIN_INVITED_EMAILS`(또는 `SAFECLAW_PLATFORM_OPERATOR_USER_IDS`)에 있어야 작업공간 생성. 기존 조직 소유자는 그대로. 이메일 OTP 는 `shouldCreateUser: false` | `lib/admin-invite.ts`, `lib/supabase-admin.ts` ensureWorkspaceContext, 호출 라우트 5곳(403 `WORKSPACE_INVITE_REQUIRED`) |
| 20(SEC-05) | 브리핑 자리 선점 차단: 이미 `MAX_BRIEFING_SITES`(10)곳이 켜져 있으면 새로 켜는 저장을 409 `BRIEFING_SITE_CAP_REACHED` 로 거절 | `app/api/briefing/settings/route.ts` |
| 21 | 익명은 template 만(enhanced/full 요청은 template 으로 강등, 응답 `aiModeNotice`·헤더 `X-SafeClaw-AI-Mode-Downgraded`). 로그인 사용자는 사이트 전체 하루 작업 단위 상한(기본 600 = full 50건 또는 enhanced 300건, KST 날짜 기준, Upstash 카운터). 상한 초과·카운터 장애 시 template 강등 + 안내 | `lib/ask-mode-admission.ts`, `lib/ai-daily-cost-cap.ts`, `app/api/ask/route.ts`, `app/api/ask/stream/route.ts` |
| 22 | 메일·문자 실발송은 런칭 범위 밖 → 미리보기 전용. 서버 실발송 경로는 `SAFEGUARD_RUN_LIVE_DISPATCH=1` 이 아니면 꺼짐(기본 off), 켜져도 `PROVIDER_DISPATCH_IDEMPOTENCY_SUPPORTED=false` 로 provider 호출 차단(기존 잠금 유지). 화면 문구 5곳 수정 | 문구: `components/CurrentWorkpackModules.tsx`(4곳: 외국인 안내·전파 대기·제출 기준 채널·예시 연락처), `components/WorkflowSharePanel.tsx`(언어 안내), `app/settings/page.tsx`(발송 채널), 동의 문구 2곳 |
| 23 | `bot_chat_sessions` 분리: SafeClaw 코드(app·lib·components·supabase)는 이 테이블을 읽거나 쓰지 않는다(시험으로 고정). 같은 Supabase 프로젝트에 있는 것은 감사 스크립트로 확인됨. 실제 분리는 DB 작업이라 이 PR 범위 밖 — **미확인/미실행** | `tests/privacy-cost-cap-pr19.test.ts` |
| 24 | Upstash 장애 때 공유 링크 열람(GET)은 인스턴스 한도로 허용하고 오류 로그를 남긴다. 열람 확인(POST)·AI 생성·내보내기는 그대로 503 | `lib/public-distributed-rate-limit.ts`(`instanceFallbackOnOutage`), `app/api/share-sessions/[sessionId]/route.ts` |
| SEC-04 | `/privacy` 처리방침 페이지 신설(실제 데이터 흐름 기준, 확인 못 한 사항 명시) | `app/privacy/page.tsx`, `app/sitemap.ts`, 로그인·동의 문구에서 연결 |

## 처리방침 문구의 근거(코드에서 확인한 데이터 흐름)

- 작업자 명부 필드: `workers` 테이블(`lib/supabase-admin.ts`) — 이름·직무·입사일·경력·국적·언어·신규/외국인·교육 상태·phone·email.
- 공유 세션 스냅숏: `buildServerShareRecipients` 가 phone·email 을 포함해 `recipients_snapshot` 에 복사. 열람 본인 확인(`verifyShareRecipientContact`)에 쓴다. 링크 유효기간 24시간(`SHARE_SESSION_TTL_MS`).
- template 모드: `runAsk` 의 template 분기는 외부 호출이 없다(`lib/search.ts`).
- AI 전송: 답변 OpenAI(`lib/ai.ts`)·Vertex Gemini, 문서 Vertex 또는 Anthropic(`lib/ai-provider-policy.ts`), 사진 OpenAI(`lib/photo-vision-analysis.ts`), 임베딩 OpenAI(`SAFETY_REFERENCE_VECTOR_SEARCH=1` 일 때, 질문 최대 1,000자).
- 요청 보호: IP 는 SHA-256 앞 32자만 Upstash 키로 쓴다(`buildRateLimitKey`).
- 인프라: Vercel `icn1`(`vercel.json`), Supabase(DB·Storage 버킷 `safeclaw-improvement-photos`), Upstash.

## 확인하지 못한 사항(처리방침에도 명시)

- AI 제공자의 전송 데이터 보관기간, Supabase 저장 지역·백업 보관기간, Vercel 로그 보관기간, 카카오 로그인 시 저장 항목, 운영 환경 임베딩 사용 여부.
- 운영 Supabase Auth `enable_signup` 설정(카카오 OAuth 는 클라이언트 옵션으로 신규 가입을 막을 수 없다).
- 작업자 명부·문서팩의 삭제 기능은 아직 화면에 없다(운영자 요청으로 처리).
- 운영 주체·개인정보 보호책임자 연락처는 처리방침에 아직 비어 있다.

## 재홍님 조치 항목(운영 환경, 이 PR 은 건드리지 않음)

| 이름 | 제안값 | 이유 |
|---|---|---|
| `SAFECLAW_ADMIN_INVITED_EMAILS` | 초대할 관리자 이메일(쉼표 구분) | 미설정이면 조직이 없는 신규 계정은 작업공간을 못 만든다(기존 소유자는 영향 없음) |
| `SAFECLAW_AI_DAILY_WORK_UNITS` | `600`(미설정 시 기본값과 같음) | 하루 비용 상한. full 12·enhanced 2 단위 |
| `SAFEGUARD_RUN_LIVE_DISPATCH` | 설정하지 않음(off 유지) | 미리보기 전용 런칭 |
| Supabase Auth `Enable sign ups` | 끔(또는 카카오 provider 신규 가입 차단) | 공개 가입 차단을 인증 계층에서도 막는다 |
| `CRON_SECRET` | 기존 값 유지 | 새 cron(연락처 정리)도 같은 비밀값으로 인증 |
