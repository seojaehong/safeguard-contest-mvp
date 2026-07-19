# Share / Foreign Worker Dispatch Capture Readiness

Date: 2026-07-19
Verified product base: `895462484b86508d48cdb94d3fa7b654f793766b`
Live target: `https://www.safeclaw.kr/workspace`

## Summary

The current launch-facing flow for video capture is:

1. `/workspace`
2. document pack ready
3. `공유`
4. `언어별 전송본 미리보기`
5. select `베트남어 · Tiếng Việt`
6. show `메시지 미리보기`
7. open `작업자 화면 미리보기` when a share session exists

The share panel is now intentionally scoped to the send job. It no longer tries to own the full history/report/improvement workflow in the default sharing surface.

## Browser Evidence

Focused browser gate:

```powershell
npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

Generated screenshots:

- `evaluation/share-mobile-p1/screenshots/desktop-day-vietnamese.png`
- `evaluation/share-mobile-p1/screenshots/desktop-night-vietnamese.png`
- `evaluation/share-mobile-p1/screenshots/mobile-390-day-vietnamese.png`
- `evaluation/share-mobile-p1/screenshots/mobile-390-night-vietnamese.png`

The browser gate verifies:

- one primary share CTA
- no horizontal overflow
- full Vietnamese paragraph rendering
- no hidden inner scrollbar in the message preview
- mobile theme controls remain at least 44px

## Important Capture Note

The generated screenshots above are from the isolated Next.js dev harness. A black circular `N` indicator can appear in those screenshots because it is the Next.js development indicator, not SafeClaw product UI.

For submission or demo video capture, use the live production URL after confirming `/api/build-info` reports the target commit. The current live production build reports:

```text
commitSha: 895462484b86508d48cdb94d3fa7b654f793766b
environment: production
```

The production page should not show the Next.js dev indicator.

## Current Verified Support Boundaries

- Worker recipient portal route exists at `/share/[sessionId]`.
- Public recipient confirmation is invited-session based, not anonymous open sharing.
- Recipient confirmation uses the worker id from the share link as authoritative when present.
- Vietnamese recipient chrome and document labels are covered by `tests/share-recipient-portal-browser.test.ts`.
- Share session creation and dispatch remain manager-side authority flows.
- `작업자 화면 미리보기` appears only after a share session exists. This is intentional because the recipient page is session-scoped and invited-only.
- If provider dispatch channels are not configured, the share surface correctly falls back to `언어별 전송본 미리보기` / preview-only mode instead of pretending that an external send occurred.

## Capture Checklist

- Use production `https://www.safeclaw.kr/workspace`, not a local dev harness.
- Confirm `/api/build-info` is at `895462484b86508d48cdb94d3fa7b654f793766b` or newer.
- Start with the input/document result already prepared to avoid spending the video on generation wait time.
- Show the share panel only after document readiness allows sharing.
- In the language preview, select `베트남어 · Tiếng Việt`.
- Show that the message body is real Vietnamese paragraph content, not a label-only language switch.
- If the video must show the recipient portal, first create or reuse a share session while logged in; then open `작업자 화면 미리보기` in a new tab and show the recipient confirmation button.
- If no share session is available during capture, keep the video focused on the manager-side language preview and do not imply that worker confirmation has already been recorded.
- Avoid using generated dev-harness screenshots as final product screenshots because of the Next.js `N` development indicator.
