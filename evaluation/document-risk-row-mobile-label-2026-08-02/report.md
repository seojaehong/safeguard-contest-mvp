# Document Risk Row Mobile Label

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_RISK_ROW_MOBILE_LABEL`
- Product/live commit: `ca908cf8bbc1db1ee1a1054575921025c6c2e621`
- Deployment: `safeguard-contest-9fcnetygf-seojaehongs-projects.vercel.app`

## Result

The previous live build passed desktop but failed both 390x723 Day/Night cases because long hazard labels were visually clipped without a compact discriminator. The current live build keeps the full hazard text on desktop and shows a two-line mobile selector with accident type plus a hazard cue.

| State | Result | Desktop | Mobile |
|---|---:|---|---|
| Before live `e150bfcc` | 2/4 | PASS | RED |
| After local `ca908cf8` | 4/4 | PASS | PASS |
| After live `ca908cf8` | 4/4 | PASS | PASS |

At 390x723 the three selectors now read as distinct rows such as `01 추락 / 이동식 비계`, `02 추락 / 강풍 시 비계`, and `03 충돌·맞음 / 지게차 동선`. Compact labels have zero clipping, the full hazard remains in the accessible name and title, body height remains 728px, shell ratio remains 2.11, and the first hazard field ends at 703px.

## Verification

- `tests/documents-editor-layout.test.ts`: 37/37 PASS
- focused mobile Day/Night launcher contract: 2/2 PASS
- focused incomplete risk-row reload/export contract: PASS
- `tests/northstar-open-gate-audit.test.ts`: 48/48 PASS
- strict typecheck: PASS
- Next.js 15.5.22 build: PASS, 28 static pages

## Boundary

No DB, provider, Share-session, vector, wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; this scoped Documents improvement does not close that approval boundary or claim that route splitting alone solves long-form IA.
