# Public Provider Admission

## Verdict

`PASS_CURRENT_SOURCE_PUBLIC_PROVIDER_ADMISSION_LIVE_PENDING`

Product commit: `b4828513c5fc0fb46198684b85a7c9dd11a4e19a`

This bounded wave addresses corrected scan findings `csf_f5dd7b0bac8e0b7c7e531b29` and `csf_a0ac317d9f81776462e0441a` without altering the canonical scan.

## Contracts

- Public ask provider work uses a distributed weighted lease in production. Template mode consumes no provider work units, enhanced consumes 2, and full consumes the complete 12-unit capacity before its provider fan-out begins.
- JSON requests release the lease after work. SSE requests hold it through stream completion or consumer cancellation.
- Weather and knowledge match use distributed fixed-window admission in production and fail closed when durable admission is unavailable.
- Weather questions are limited to 240 characters. Knowledge GET and POST share a 900-character question limit, and POST retains its 16 KiB body budget.

## Verification

- Focused Vitest: 4 files / 25 tests, 0 failures.
- Focused and adjacent Vitest: 10 files / 52 tests, 0 failures.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Production marker remains `e5ce29142344699bf814cfa0e56f03055d80d69d`; live-after-deployment verification is pending.

## Boundaries

No live provider-backed ask, weather provider call, DB mutation, provider dispatch, Share-session creation, vector runtime mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Security-complete remains false and a fresh follow-up scan is required.
