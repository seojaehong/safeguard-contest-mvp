# Tier 1 파일럿 온보딩 스크립트

`onboard-site.sh`는 SafeClaw 2 Tier 1 파일럿 런북(Obsidian:
`스파크클로/Tier1_오라클_파일럿_런북.md`)의 ②~⑦ 단계를 자동화하는 bash
스크립트다. 오라클 서버(또는 동등한 Ubuntu/ARM64 호스트)에서, 이 repo가
체크아웃된 디렉터리 안에서 실행한다.

전체 절차(서버 준비, 보안 하드닝 근거, 트러블슈팅)는 런북 원문을 참고할 것 —
이 스크립트는 런북의 실행 자동화일 뿐, 절차 설명은 런북이 1차 소스다.

## 사전조건

- Node 22+ / `openclaw@2026.6.11`이 `~/openclaw-runtime`에 pinned 설치됨 (런북 ①)
- `.env.local`에 `SUPABASE_URL`(또는 `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`
- Supabase `sites` 테이블에 대상 사업장이 이미 등록됨
- `pm2` 설치됨
- BotFather에서 사업장 전용 텔레그램 봇 토큰을 미리 발급받아 `TELEGRAM_BOT_TOKEN` 환경변수로 전달

## 사용법

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-..."
scripts/tier1/onboard-site.sh <site-id> "<사업장명>" <telegram-chat-id>
```

Dry-run(실행할 커맨드만 출력, 아무것도 건드리지 않음):

```bash
scripts/tier1/onboard-site.sh bupyeong "부평공장" 123456789 --dry-run
```

## 이 스크립트가 하는 일

1. `scripts/issue-mcp-token.mjs`로 사이트 바인딩 MCP 토큰 발급
2. `openclaw --profile site-<id>` 프로필 생성
3. `mcp add safeclaw` + `mcp probe safeclaw`로 연결 검증
4. `tools.profile=messaging` + exec/browser `tools.deny`로 보안 하드닝
5. 프로필 디렉터리 `chmod 700`, 인스턴스별 `.env` 스캐폴딩
6. `SOUL.md` 페르소나 배치(클로 채팅 `lib/agent-loop.ts` BASE_SYSTEM_PROMPT 인용)
7. 텔레그램 채널 allowlist 설정
8. PM2 `ecosystem.config.js` 생성 + `pm2 start` + `pm2 save`
9. 06:00 Asia/Seoul 아침 브리핑 cron 등록(isolated session, 텔레그램 announce)

## 이 스크립트가 하지 않는 일

- Supabase `sites` 테이블 신규 등록
- 텔레그램 봇 생성(BotFather, 수동)
- Node/openclaw 설치(런북 ①, 수동)
- 인스턴스 해지/제거(런북 ⑧ 참고, `pm2 delete` + 디렉터리 삭제 + 토큰 revoke)

## npm 테스트 영향

없음. 셸 스크립트와 마크다운만 추가되며 기존 빌드/테스트 대상 파일을 변경하지 않는다.
