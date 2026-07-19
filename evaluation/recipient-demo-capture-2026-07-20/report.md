# Recipient Portal Demo Capture

Generated at: 2026-07-20 KST

## Verdict

**PASS for non-mutating demo capture.**

This artifact captures the worker-facing Vietnamese recipient portal and confirmation action without creating production share sessions, inserting production read confirmations, or sending provider messages.

The demo uses a local production Next.js server and Playwright route interception for `/api/share-sessions/*`. The UI under test is the real `/share/[sessionId]` route; only the share-session API payload is a fixture.

## Captured Flow

1. Open `/share/{sessionId}?workerId={workerId}&lang=vi`.
2. Load an invited Vietnamese worker session.
3. Verify Vietnamese chrome and notice text.
4. Click `Tôi đã xem`.
5. Verify saved-confirmation message.

## Evidence

- Video: `evaluation/recipient-demo-capture-2026-07-20/recipient-portal-vietnamese-confirmation.webm`
- Before confirmation screenshot: `evaluation/recipient-demo-capture-2026-07-20/01-recipient-portal-vietnamese-before-confirm.png`
- After confirmation screenshot: `evaluation/recipient-demo-capture-2026-07-20/02-recipient-portal-vietnamese-after-confirm.png`
- Metrics: `evaluation/recipient-demo-capture-2026-07-20/metrics.json`
- Script: `evaluation/recipient-demo-capture-2026-07-20/run-recipient-demo-capture.mjs`

## Browser Metrics

Before confirmation:

- viewport width: 390
- scroll width: 390
- horizontal overflow: false
- outside elements: 0
- minimum control height: 44
- Vietnamese chrome present: true
- Vietnamese safety notice present: true
- Korean `문서팩 검토` leakage: false
- confirmation button present: true

After confirmation:

- viewport width: 390
- scroll width: 390
- horizontal overflow: false
- outside elements: 0
- minimum control height: 44
- saved confirmation present: true

## Boundary

This is a safe recording path for demo/video preparation. It is not a production send canary.

Production canary still requires explicit approval because it would create or mutate:

- `workpack_share_sessions`
- `workpack_read_confirmations`
- external provider sends and dispatch logs
