# SafeGuard Final Launch Checklist

## 제출 전 필수 확인

- [ ] Vercel Production 환경변수에 `N8N_INTERNAL_BASE`가 들어 있지 않다.
- [ ] Vercel Production에는 공개 relay가 준비된 경우에만 `N8N_PUBLIC_BASE`를 넣는다.
- [ ] `LAWGO_OC`, `GEMINI_API_KEY`, `DATA_GO_KR_SERVICE_KEY`, `WORK24_AUTH_KEY`가 배포 환경에 들어 있다.
- [ ] 홈 화면에 `데모`, `공모전`, `mock`, `fallback` 같은 내부 용어가 보이지 않는다.
- [ ] 대표 입력 1건에서 문서팩 11종이 모두 생성된다.
- [ ] 외국인 메시지 언어 선택 후 미리보기와 전파 payload의 언어가 일치한다.
- [ ] XLS/CSV/TSV 다운로드 시 7개 시트 구조가 유지된다.
- [ ] Law.go 근거, KOSHA 자료, 재해사례가 문서팩의 확인 근거로 붙는다.
- [ ] n8n 전파는 최소 메일 채널 성공, 문자 채널은 Solapi credential과 발신번호 상태를 확인한다.

## 로컬 검증

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run audit:launch
```

## 운영 스모크

```powershell
$env:SAFETYGUARD_BASE_URL="https://safeguard-contest-mvp.vercel.app"
$env:SAFETYGUARD_AUDIT_OUTPUT="vercel-prod-smoke.json"
npm.cmd run audit:launch
```

## 발표 직전 리허설

- [ ] 현장 상황 입력 후 첫 결과가 생성되는 시간을 확인한다.
- [ ] 위험성평가표, 작업계획서, TBM, 교육기록을 각각 수정해 본다.
- [ ] HWPX, PDF/JPG, DOC/XLS/CSV/TXT 출력 버튼이 깨지지 않는지 확인한다.
- [ ] 근거 출처에서 법령·판례·해석례·KOSHA·재해사례가 구분되는지 확인한다.
- [ ] 현장 전파 메시지를 관리자용 한국어와 외국인용 언어 중 하나로 복사해 본다.
- [ ] n8n 전파 결과 메시지가 사용자에게 이해 가능한 문장으로 표시되는지 확인한다.
