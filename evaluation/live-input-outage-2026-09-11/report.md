# Live Input Outage Recovery

Verdict: `PASS_LIVE_PRODUCTION_INPUT_RECOVERY`

## Failure reproduced

- Production `f91a8a52` reports distributed admission `configurationState=absent` and `mode=unavailable`.
- The workspace still selected enhanced generation by default, so the first generation request returned `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`.
- Weather refresh also returned HTTP 503.
- The request error was stored in component state but was not rendered on the input page, making the submit button appear inert.

## Bounded recovery

- The workspace reads the existing public admission readiness response.
- When provider admission is unavailable, the workspace switches to template generation and disables enhanced/full modes without weakening server-side provider admission.
- The input page exposes the current mode boundary and renders generation errors as an alert.
- Local production-mode browser verification accepted input and completed all 12 generated document surfaces.
- Live production `29c74783` automatically selected template mode, disabled enhanced/full modes, accepted the field input, and reached `안전 문서팩 3종 준비 완료`.
- The recovery status exists in the live DOM but the mobile density rule hid generic helpers, so a dedicated admission-status class now keeps this operational boundary visible on small screens.
- Live production `331dbb65` visibly renders the recovery boundary on the compact input surface.

## Verification

- Focused tests: 3 files, 20 tests passed.
- TypeScript strict typecheck: PASS.
- Next.js `15.5.25` production build: PASS, 29 static pages.
- Browser: input accepted, template generation completed, 12/12 document surfaces present.
- Production dependency audit after the patch upgrade: 0 critical, 0 high, 5 moderate findings. No automatic audit fix was applied.

## Boundary

This hotfix restores a usable no-provider path. It does not activate distributed admission or change Production secrets. No DB, provider dispatch, Share-session, vector, Wiki, or KOSHA registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`. Enhanced/full generation still requires separately approved Production Upstash configuration and a bounded connectivity probe.
