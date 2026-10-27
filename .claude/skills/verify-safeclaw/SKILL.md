---
name: verify-safeclaw
description: SafeClaw(safeguard-contest-mvp, Next.js 웹 UI, www.safeclaw.kr)를 사용자처럼 돌려 증거를 남기는 검증 스킬. 격리 dev 인스턴스를 띄우거나(기본) 이미 떠 있는 주소(운영 포함)에 대해 첫 화면 입력 폼·예시 칩·작업공간 결과·내보내기 4형식·연차 도구를 Playwright 로 구동하고 스크린샷·내려받은 파일·report.md 를 남긴다. PR 병합 뒤 G5 운영 드라이런, UI 를 바꾼 PR 의 로컬 증명, 「화면에서 그렇게 보이나」를 물을 때 쓴다. 기능 지도 = features/README.md.
---

# verify-safeclaw — SafeClaw 를 사용자처럼 돌려 증명한다

이 스킬은 앱을 처음 보는 에이전트가 작업 중간에 읽는다는 전제로 쓴다. 명령은 전부 **저장소 루트**에서 실행한다. 합성 입력만 쓴다(실명·주민번호·급여·사건 자료 금지). 운영 주소에서는 **익명 template 경로만** 돈다 — 로그인 full(AI 생성)은 운영에서 돌리지 않는다(비용·정책). full 경로의 증명은 `scratch-final/run-*.test.ts` 류의 인프로세스 시험 키 실행으로 따로 한다.

## 표면

- 주 표면 = 웹 UI(Next.js 16, App Router). 사용자가 닿는 곳: `/`(첫 화면 입력 폼), `/workspace`(생성·결과·편집·내보내기), `/tools/leave`(연차 계산), `/tools/video-check`, `/documents`, `/share/[sessionId]`, `/login`.
- 부 표면 = API(`/api/ask`, `/api/export`, `/api/build-info` …)와 MCP(`/api/mcp`). 이 스킬은 UI 를 통해서만 건드린다.

## Launch — 격리 dev 인스턴스

`drive` 명령이 `--base` 없이 돌면 스스로 띄우고 끝나면 내린다. 별도 launch 명령은 없다(띄운 프로세스가 도우미 밖에서 살아남지 않도록).

- 구현 = `tests/helpers/isolated-next-browser-harness.ts`(CI 브라우저 시험과 같은 것). `%TEMP%\safeclaw-next-verify-safeclaw-*\` 에 `app·components·data·lib·types` 를 복사하고 `node_modules·public·templates` 를 정션으로 걸어 `distDir: dist` 로 Next dev 서버를 **127.0.0.1 의 20000~39999 빈 포트**에 띄운다. 한 기계에서 여러 개가 동시에 떠도 서로 섞이지 않는다.
- 준비 신호 = 서버 stdout 의 `SAFECLAW_TEST_SERVER_READY` 를 하네스가 기다린 뒤 `/` 를 한 번 예열한다. 도우미는 `LAUNCH 준비됨 http://127.0.0.1:<port>` 줄을 찍는다. 첫 `/workspace` 컴파일은 30~90초 더 걸린다 — 생성 대기는 240초로 잡혀 있다.
- 환경 변수 = 현재 셸의 것 + `.env.local`(Next 가 읽음). **익명 template 생성에는 외부 키가 필요 없다**(CI 가 비밀 없이 같은 시험을 통과한다). `.env.local` 에 `AI_DELIVERABLES_PROVIDER=claude` 가 있어도 익명은 template 로 강등된다.
- 시드 데이터 없음. 빈 상태에서 바로 쓸 수 있다.
- 종료 = 하네스 `stop()` 이 **자기가 띄운 PID 트리만** `taskkill /PID … /T /F`(윈도우) 또는 SIGTERM→SIGKILL 로 내리고 임시 디렉터리를 지운다. 이름으로 node 를 죽이지 않는다.

## Doctor — 이 인스턴스를 돌릴 가치가 있나(읽기 전용)

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .claude/skills/verify-safeclaw/scripts/verify.mts doctor --base https://www.safeclaw.kr
```

`GET /api/build-info`(Vercel 커밋 sha·environment) 와 `GET /` 를 읽어 다음을 JSON 으로 낸다 — build-info 200, 첫 화면 200, `form action="/workspace"` + `textarea name="q"`, 예시 칩 href `autogen=1` **3개**, 익명 안내 원문. 넷 다 맞아야 `DOCTOR OK`. `drive` 는 매번 이것을 먼저 돌리고 실패하면 구동하지 않는다. 운영 배포 확인은 build-info 의 `commitSha` 가 병합 커밋과 같은지 본다(병합 뒤 약 2~3분 걸린다).

## Drive — 기능 하나를 사용자처럼

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .claude/skills/verify-safeclaw/scripts/verify.mts list
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .claude/skills/verify-safeclaw/scripts/verify.mts drive --feature <id>                      # 격리 dev
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON .claude/skills/verify-safeclaw/scripts/verify.mts drive --feature <id> --base <URL>         # 떠 있는 주소(운영 G5)
```

기능 id 와 각 기능의 사용자 경로·안정 핸들·증명 기준은 [features/README.md](features/README.md) 와 기능 파일에 있다. 도우미가 쓰는 핸들은 전부 ARIA 라벨·`data-testid`·라우트다(좌표·탭 순서 없음):

| 핸들 | 뜻 |
|---|---|
| `textarea[name=q]`, 단추 「보내기」 | 첫 화면 입력 폼 → `GET /workspace?q=` |
| `a[href*="autogen=1"]` ×3 | 예시 칩 → `/workspace?scenario=<id>&autogen=1` 무클릭 생성 |
| `[aria-label="Safety Brief Dashboard"]` | 생성 완료 신호(머리 「확인할 항목을 먼저 보세요」·핵심 위험 3개·위험성평가 상위) |
| `data-testid=anonymous-mode-notice` | 익명 안내(`lib/ask-mode-messages.ts` `ANONYMOUS_MESSAGE` 원문) |
| `data-testid=document-check-first` | review_required 알림·「편집본 재검증」 단추(없으면 분류 확정 상태) |
| 단추 「위험성평가표 편집」 → `data-testid=editor-export-panel` | 편집기와 내보내기(`data-server-export-readiness` checking→ready, 「Excel 표 양식(.xlsx)」·「한글 표 양식(.hwp)」 = download 이벤트, 「PDF(브라우저 인쇄)」 = 팝업 창 + 팝업의 `window.print`, 베타 「.hwpx 텍스트 초안」 = rhwp 로 브라우저 안 생성) |
| `data-testid=document-deep-review` → `[aria-label="문서 목록"]`, `.document-preview-pane` 「편집」 | 문서 깊게 보기(목록·미리보기). 문서별 조종석 `*-document-cockpit` 은 편집기 안 |
| `getByLabel("이름과 입사일 붙여넣기")`, 「N명 계산」, 결과 `table` | 연차 도구 |

뷰포트 기본 390×844(모바일 우선 — 넘침·숨김 결함이 먼저 드러난다). 데스크톱 확인이 필요하면 기능 파일의 Gotchas 를 따른다.

## Evidence — 무엇을 남기나

`evaluation/verify-safeclaw/<YYYYMMDD-HHMMSS>-<feature>/` (gitignore 됨, cleanup 이 지우지 않는다)

- `report.md`·`report.json` — base·build-info·검사별 OK/FAIL·콘솔/페이지 오류·검토어 문맥
- `NN-<label>.jpg` — 행동 전과 후(첫 화면 → 생성 결과, 내보내기 패널 → 완료). JPEG q55, 한 장 30~60KB. **여러 장을 Read 하지 말고 PIL 로 결합해 한 번에 본다**(CLAUDE.md 이미지 Read 규칙)
- `downloads/` — 내려받은 xlsx·hwp·hwpx 원본(크기>0 과 파일 머리 바이트로 판정)

증명 기준: ① 사용자 경로를 그대로 탄다(내부 setter·시험 전용 API 금지) ② 행동과 그 결과 상태를 둘 다 찍는다 ③ 부수 효과(내려받은 파일, `window.print` 호출)를 보이는 것과 함께 확인한다 ④ 금지어(노무사·적중률·확률 N·제품 자기 호칭)·Phase A 영문 관리번호 `RA-…`·대문자 enum 은 **본문 텍스트**에서 0 이어야 한다. 진단·판정·상담·자문·대리는 법정 복합어로 정당하게 나올 수 있어 **문맥만 보고**한다. ⑤ 운영 첫 화면 HTML 을 문자열로 셀 때 RSC 페이로드가 같은 문자열을 한 번 더 싣는다 — 칩 수 같은 단언은 `href="…"` 패턴이나 DOM 으로 센다(doctor 가 그렇게 한다).

PR 증거로 남길 때는 폴더를 `C:/Users/iceam/dev/sc-audit/evaluation/launch-depth-audit-2026-10-25/pr-evidence/<pr>/` 로 복사하고 PR 댓글에 요약을 적는다.

## Cleanup

`drive` 가 끝나면(실패해도) 자기가 띄운 인스턴스를 내리고 임시 디렉터리를 지운다. 중간에 죽어 남은 것이 있으면 `%TEMP%\safeclaw-next-verify-safeclaw-*` 디렉터리와 **그 디렉터리를 cwd 로 가진 node 프로세스만** 찾아 내린다(`wmic process where "commandline like '%safeclaw-next-verify-safeclaw%'" get processid` → `taskkill /PID`). `taskkill /IM node.exe` 금지. 증거 폴더는 지우지 않는다.

## Helpers

- `scripts/verify.mts` — 위 명령 전부. Node 24(타입 제거 기본) 와 저장소 `node_modules/playwright`(1.61, chromium headless shell 설치됨)를 쓴다. `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` 은 `package.json` 에 `type` 이 없어 나오는 모듈 형식 경고 하나만 가린다(다른 경고는 그대로 보인다).
- 끝 줄 = `RESULT PASS|FAIL — 검사 n/m 통과, 콘솔 오류 k` 와 `EVIDENCE <경로>`. exit 0 = PASS.

## 알려진 한계

- 운영 full(AI)·로그인·관리자 초대·공유 링크 발송·외국인 전송 실발송은 이 스킬 범위 밖이다(정책상 운영 금지 또는 사람 몫). 지도에 「아직 없음」으로 적혀 있다.
- 백그라운드 Bash 에서 `npx.cmd` 가 `'C:\Program'` 오류로 죽는 기계가 있다 — 이 스킬은 `node` 를 직접 부른다.
- 격리 dev 는 메모리를 많이 쓴다(Next dev + chromium). Playwright 시험과 동시에 돌리면 `frontend-audit-bundle-contract` 같은 다른 시험이 거짓 실패한다. 하나씩.

## 유지

UI 를 바꾼 PR 은 같은 PR 에서 기능 파일의 핸들·문구를 고친다. 주기 점검은 `/pstack:maintain-verification-skill`(기능별 소스 읽기 → 전 기능 1회 구동 → 교정 PR 1개).
