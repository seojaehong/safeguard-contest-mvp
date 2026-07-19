# SafeClaw Share Recipient + Before/After Photo Loop Current Master Check

Date: 2026-07-19
Authoritative local HEAD: `3ed2e5ff62ff542be8a4842b36163481f73b624c`
Live build-info commit: `3ed2e5ff62ff542be8a4842b36163481f73b624c`

## Verdict

The prior read-only handoff that said there is no recipient portal is stale for the current master. Current master includes both:

- `app/share/[sessionId]/page.tsx`
- `app/api/share-sessions/[sessionId]/route.ts`

The recipient flow is not a public anonymous link. It is an invited-worker link that requires the share session id plus the worker identity from the manager-created recipient snapshot. That matches the current safety contract: `anonymousAllowed=false` by default and worker snapshot is authoritative.

The Before/After photo improvement loop is also present as a product contract, not only a plan. Current master supports:

- initial workspace photo attachment up to 10 files,
- OpenAI Vision/OCR readiness through `/api/input-photos/hazard-analysis`,
- Before/After improvement candidate storage through `/api/workpacks/[id]/improvements`,
- Supabase storage metadata for `before` and `after` photos,
- operation-memory graph nodes for photo-analysis improvements,
- reports/download surfaces that include approved `개선 전/개선 후 사진` items only.

## Live Checks

### Build Identity

Command:

```powershell
Invoke-RestMethod -Uri 'https://www.safeclaw.kr/api/build-info' -TimeoutSec 20
```

Result:

- `ok=true`
- `branch=master`
- `environment=production`
- `commitSha=3ed2e5ff62ff542be8a4842b36163481f73b624c`

### Photo Vision Readiness

Command:

```powershell
Invoke-RestMethod -Uri 'https://www.safeclaw.kr/api/input-photos/hazard-analysis' -TimeoutSec 20
```

Result:

- `status=ready`
- `provider=openai`
- `model=gpt-4.1-mini`
- `apiKeyPresent=true`
- `maxInputPhotos=10`
- `beforeAfterSupported=true`
- `ocrSupported=true`
- export targets include `위험성평가표`, `TBM 브리핑`, `TBM 기록`, `사진/증빙`, `작업 이력 MD`, `하네스 JSONL`

### Recipient Portal Chrome

Command:

```powershell
node -e "... playwright mobile check ..."
```

Target:

```text
https://www.safeclaw.kr/share/not-a-session?lang=vi
```

Result on 390x844:

- `clientWidth=390`
- `scrollWidth=390`
- horizontal overflow: `false`
- Vietnamese chrome visible: `true`
- Korean `문서팩 검토` visible: `false`
- invalid session remains fail-closed and does not expose documents.

Visible Vietnamese sample:

```text
Kiểm tra gói tài liệu
Màn hình xác nhận chỉ dành cho công nhân được mời.
Công việc hiện tại
Trạng thái: Đang chia sẻ
Phạm vi: Chỉ công nhân được chỉ định
```

## Focused Tests

### Share Recipient API/Portal Contract

Command:

```powershell
npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: `1 passed | 1 skipped`
- Tests: `37 passed | 4 skipped`

Note: `share-recipient-portal-browser.test.ts` is gated by a production build existing in `.next`. It skipped in this quick pass because the local worktree did not have the required build artifacts. This is not a product failure. The route and API contract tests passed.

### Before/After + Improvement + Reports Contract

Command:

```powershell
npm.cmd test -- tests\workpack-commercial.test.ts tests\workpack-improvement-route.test.ts tests\workspace-operation-graph.test.ts tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\reports-design-remediation.test.ts -t "before/after|Before/After|photo|사진|개선|share recipient portal|public recipient|worker confirmation|worker and reflected|photo approval|개선 전/개선 후" --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: `2 passed | 4 skipped`
- Tests: `7 passed | 56 skipped`

Command:

```powershell
npm.cmd test -- tests\photo-vision-analysis.test.ts tests\photo-vision-analysis-route.test.ts tests\sif-embedding-approval-packet.test.ts tests\reports-design-remediation.test.ts -t "maxInputPhotos|beforeAfterSupported|OPENAI_API_KEY|photo|사진|vision|OCR|개선 전/개선 후|photo approval|approval" --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: `3 passed | 1 skipped`
- Tests: `46 passed | 12 skipped`

## Product Boundaries For Demo

### What Can Be Shown Now

- Workspace input supports `+` photo attachment up to 10 images.
- Live photo analysis readiness is `ready`.
- Before/After improvements can become reviewable improvement candidates.
- The operation graph preserves `sourceType=photo_analysis`, `photoPairAttached=true`, source photo names, detected hazards, and observed improvement.
- Reports can summarize weekly/monthly/custom-period improvements by process/task/risk level/document and include approved photo-pair names in exports.
- `/share/[sessionId]` is the worker-facing confirmation page, with Vietnamese and English chrome.

### What Still Needs Care

- A real recipient portal demo requires a valid manager-created share session and worker id. `/share/not-a-session?lang=vi` only proves the localized fail-closed shell.
- Provider dispatch remains preview-only until the approved idempotency/dispatch migration is applied.
- The recipient portal is designed for invited worker confirmation, not arbitrary public anonymous access.
- The actual image-analysis quality depends on the OpenAI vision provider response at runtime; current readiness proves configuration, not semantic quality of every image.

## Conclusion

Current master is stronger than the stale handoff implied. The core demo claim should be:

> SafeClaw can attach up to 10 field photos, extract hazard/improvement candidates through a DB-grounded vision harness, store Before/After improvement memory, return it to risk assessment/TBM/report exports, and send an invited worker link where the worker reviews the localized document pack and leaves a read confirmation.

Avoid claiming:

- anonymous public portal,
- live provider dispatch completion,
- legal proof completion,
- model learning/fine-tuning.
