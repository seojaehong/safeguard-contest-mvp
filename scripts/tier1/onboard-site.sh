#!/usr/bin/env bash
# scripts/tier1/onboard-site.sh — SafeClaw Tier 1 사업장 온보딩 자동화
#
# Tier1_오라클_파일럿_런북.md §②~⑥을 자동화한다. 오라클 서버(또는 동등한
# Ubuntu/ARM64 호스트)에서, repo(safeguard-contest-mvp)가 체크아웃된 디렉터리
# 안에서 실행하는 것을 전제로 한다(scripts/issue-mcp-token.mjs가 Supabase
# service role로 mcp_tokens에 사이트 바인딩 토큰을 발급해야 하므로).
#
# 사용법:
#   scripts/tier1/onboard-site.sh <site-id> <사업장명> <telegram-chat-id> [--dry-run]
#
# 예:
#   scripts/tier1/onboard-site.sh bupyeong "부평공장" 123456789
#   scripts/tier1/onboard-site.sh bupyeong "부평공장" 123456789 --dry-run
#
# 사전조건:
#   - Node 22+ / openclaw@2026.6.11 이 ~/openclaw-runtime 에 pinned 설치됨
#     (런북 ①), PATH에 ~/openclaw-runtime/node_modules/.bin 추가됨
#   - .env.local 에 SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   - Supabase sites 테이블에 <사업장명>이 이미 등록되어 있음
#   - pm2 설치됨
#   - 사업장 전용 텔레그램 봇 토큰은 이 스크립트가 만들지 않는다(BotFather 수동
#     발급, 런북 ⑤). 스크립트 실행 전 TELEGRAM_BOT_TOKEN 환경변수로 넘긴다.
#
# 이 스크립트는 다음을 하지 않는다(런북에서 수동/별도로 처리):
#   - 사업장을 Supabase sites 테이블에 신규 등록
#   - 텔레그램 봇 생성(BotFather)
#   - Node/openclaw 설치(런북 ①)

set -euo pipefail

usage() {
  echo "Usage: $0 <site-id> <site-name> <telegram-chat-id> [--dry-run]" >&2
  exit 1
}

if [ "$#" -lt 3 ]; then
  usage
fi

SITE_ID="$1"
SITE_NAME="$2"
TELEGRAM_CHAT_ID="$3"
DRY_RUN=0
if [ "${4:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

if ! [[ "$SITE_ID" =~ ^[a-z0-9-]+$ ]]; then
  echo "ERROR: site-id는 영소문자/숫자/하이픈만 허용됩니다: '$SITE_ID'" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPENCLAW_BIN="${OPENCLAW_BIN:-$HOME/openclaw-runtime/node_modules/.bin/openclaw}"
PROFILE="site-${SITE_ID}"
PROFILE_HOME="$HOME/.openclaw-${PROFILE}"
SITE_DIR="$HOME/openclaw-sites/${PROFILE}"
SAFECLAW_MCP_URL="${SAFECLAW_MCP_URL:-https://www.safeclaw.kr/api/mcp/mcp}"

log() { echo "[onboard-site:${SITE_ID}] $*"; }

run() {
  # dry-run이면 실행할 커맨드를 출력만 하고 넘어간다.
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  DRY-RUN would run: $*"
  else
    "$@"
  fi
}

log "site-id=${SITE_ID} site-name=${SITE_NAME} telegram-chat-id=${TELEGRAM_CHAT_ID} dry-run=${DRY_RUN}"

if [ "$DRY_RUN" -eq 0 ] && ! command -v "$OPENCLAW_BIN" >/dev/null 2>&1 && [ ! -x "$OPENCLAW_BIN" ]; then
  echo "ERROR: openclaw 바이너리를 찾을 수 없습니다: $OPENCLAW_BIN (런북 ① 먼저 실행)" >&2
  exit 1
fi

if [ "$DRY_RUN" -eq 0 ] && [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN 환경변수가 필요합니다(BotFather에서 사업장 전용 봇 발급, 런북 ⑤-1)." >&2
  exit 1
fi

# ── ②-1 테넌트 토큰 발급 ────────────────────────────────────────────────
log "step 2-1: MCP 테넌트 토큰 발급 (issue-mcp-token.mjs)"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would run: node ${REPO_ROOT}/scripts/issue-mcp-token.mjs \"Tier1 파일럿 - ${SITE_NAME}\" \"${SITE_NAME}\""
  MCP_TOKEN="sclaw_DRYRUN_PLACEHOLDER"
else
  # stdout에는 평문 토큰만 한 줄, stderr에는 안내 로그(issue-mcp-token.mjs 계약).
  MCP_TOKEN="$(node "${REPO_ROOT}/scripts/issue-mcp-token.mjs" "Tier1 파일럿 - ${SITE_NAME}" "${SITE_NAME}")"
  if [ -z "$MCP_TOKEN" ]; then
    echo "ERROR: 토큰 발급 실패(stdout 비어있음). issue-mcp-token.mjs 로그를 확인하세요." >&2
    exit 1
  fi
fi

# ── ②-2 프로필 생성 ──────────────────────────────────────────────────
log "step 2-2: 프로필 생성 (--profile ${PROFILE})"
run "$OPENCLAW_BIN" --profile "$PROFILE" onboard --non-interactive

# ── ②-3 mcp add safeclaw ────────────────────────────────────────────
log "step 2-3: mcp add safeclaw"
run "$OPENCLAW_BIN" --profile "$PROFILE" mcp add safeclaw \
  --url "$SAFECLAW_MCP_URL" \
  --transport streamable-http \
  --header "Authorization=Bearer ${MCP_TOKEN}"

# ── ②-4 probe 검증 ──────────────────────────────────────────────────
log "step 2-4: mcp probe safeclaw"
run "$OPENCLAW_BIN" --profile "$PROFILE" mcp probe safeclaw --json

# ── ③ 보안 하드닝 ────────────────────────────────────────────────────
log "step 3: tools 하드닝 (messaging 프로필 + exec/browser deny)"
run "$OPENCLAW_BIN" --profile "$PROFILE" config set tools.profile '"messaging"' --strict-json
run "$OPENCLAW_BIN" --profile "$PROFILE" config set tools.deny \
  '["exec","process","code_execution","browser","canvas","group:runtime","group:ui"]' --strict-json

log "step 3: 프로필 디렉터리 권한 700"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would run: chmod 700 ${PROFILE_HOME}"
else
  chmod 700 "$PROFILE_HOME"
fi

log "step 3: 인스턴스별 .env (LLM 키는 여기 별도로 채워넣을 것 — 이 스크립트는 생성만 함)"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would create: ${SITE_DIR}/.env (chmod 600)"
else
  mkdir -p "$SITE_DIR"
  if [ ! -f "$SITE_DIR/.env" ]; then
    cat > "$SITE_DIR/.env" <<EOF
# ${SITE_NAME} (${SITE_ID}) 전용 — 여기에 ANTHROPIC_API_KEY 등을 채우고
# 절대 커밋하지 말 것.
ANTHROPIC_API_KEY=
EOF
    chmod 600 "$SITE_DIR/.env"
    log "  -> ${SITE_DIR}/.env 생성됨. ANTHROPIC_API_KEY를 채운 뒤 PM2를 시작하세요."
  else
    log "  -> ${SITE_DIR}/.env 이미 존재, 건드리지 않음."
  fi
fi

# ── ④ 페르소나 (SOUL.md) ────────────────────────────────────────────
log "step 4: SOUL.md 페르소나 배치"
WORKSPACE_DIR="${PROFILE_HOME}/workspace"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would write: ${WORKSPACE_DIR}/SOUL.md"
else
  mkdir -p "$WORKSPACE_DIR"
  cat > "$WORKSPACE_DIR/SOUL.md" <<EOF
# 클로(Claw) — ${SITE_NAME} 상주 AI 안전관리자

당신은 "클로(Claw)", ${SITE_NAME}의 상주 AI 안전관리자입니다. 산업안전보건법·중대재해처벌법
실무 관점으로 현장소장의 안전 질문에 답합니다.

원칙(클로 채팅 lib/agent-loop.ts BASE_SYSTEM_PROMPT와 동일):
- 사실 근거는 반드시 도구로 확인합니다. 법조문이 필요한 질문은 먼저 query_safety_knowledge로
  검증된 조문을 조회하고, 답변 전 validate_safety_citations로 검증합니다. 검증에서 제거된
  조문은 최종 답변에서 빼고 일반 표현으로 대체합니다.
- 비상 연락처를 답에 넣기 전에는 sanitize_emergency_contacts로 정화합니다.
- 모든 문서·답변은 초안이며 현장 확인이 필요함을 고지합니다.
- 존댓말로, 현장소장이 바로 이해할 쉬운 말로, 간결하게 답합니다.

이 인스턴스의 1순위 임무는 대화 창구가 아니라 결과물 검수(QA)입니다: 문서팩 생성 후
qa_review_docpack 도구로 온톨로지 대조·사업장 기억 대조를 수행하고, 누락/부정합이 있으면
통과시키지 말고 재생성을 요청하세요.

로컬 exec/browser 도구는 비활성화되어 있습니다. 모든 작업은 safeclaw MCP 도구로만 수행합니다.
EOF
fi

# ── ⑤ 텔레그램 채널 ──────────────────────────────────────────────────
log "step 5: 텔레그램 채널 설정 (allowlist)"
run "$OPENCLAW_BIN" --profile "$PROFILE" config set channels.telegram.enabled 'true' --strict-json
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would run: openclaw --profile ${PROFILE} config set channels.telegram.botToken '\"***\"' --strict-json"
else
  "$OPENCLAW_BIN" --profile "$PROFILE" config set channels.telegram.botToken "\"${TELEGRAM_BOT_TOKEN}\"" --strict-json
fi
run "$OPENCLAW_BIN" --profile "$PROFILE" config set channels.telegram.dmPolicy '"allowlist"' --strict-json
run "$OPENCLAW_BIN" --profile "$PROFILE" config set channels.telegram.allowFrom \
  "[\"${TELEGRAM_CHAT_ID}\"]" --strict-json

# ── ⑥ PM2 등록 ──────────────────────────────────────────────────────
log "step 6: PM2 ecosystem 파일 작성 + 등록"
ECOSYSTEM_FILE="${SITE_DIR}/ecosystem.config.js"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN would write: ${ECOSYSTEM_FILE}"
  echo "  DRY-RUN would run: SITE_ID=${SITE_ID} pm2 start ${ECOSYSTEM_FILE}"
  echo "  DRY-RUN would run: pm2 save"
else
  mkdir -p "$SITE_DIR"
  cat > "$ECOSYSTEM_FILE" <<EOF
module.exports = {
  apps: [
    {
      name: "openclaw-${PROFILE}",
      cwd: "${HOME}/openclaw-runtime",
      script: "${OPENCLAW_BIN}",
      args: "--profile ${PROFILE} gateway",
      env_file: "${SITE_DIR}/.env",
      max_memory_restart: "800M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "30s",
      autorestart: true,
      out_file: "${SITE_DIR}/out.log",
      error_file: "${SITE_DIR}/error.log",
    },
  ],
};
EOF
  SITE_ID="$SITE_ID" pm2 start "$ECOSYSTEM_FILE"
  pm2 save
fi

# ── ⑦ 아침 브리핑 cron ──────────────────────────────────────────────
log "step 7: 아침 브리핑 cron 등록 (06:00 Asia/Seoul)"
run "$OPENCLAW_BIN" --profile "$PROFILE" cron create "0 6 * * *" \
  "오늘 ${SITE_NAME} 현장 기상을 확인하고 TBM 포인트 3개를 정리해서 보내주세요." \
  --name "아침 브리핑 - ${SITE_NAME}" \
  --tz "Asia/Seoul" \
  --session isolated \
  --announce \
  --channel telegram \
  --to "${TELEGRAM_CHAT_ID}"

log "완료. 다음을 확인하세요:"
log "  - ${SITE_DIR}/.env 에 ANTHROPIC_API_KEY 채워졌는지"
log "  - pm2 status / pm2 logs openclaw-${PROFILE}"
log "  - openclaw --profile ${PROFILE} mcp probe safeclaw --json"
log "  - openclaw --profile ${PROFILE} cron list"
