# Public Provider Admission

## Verdict

`PARTIAL_LIVE_PRODUCTION_WEIGHTED_INSTANCE_ADMISSION_DISTRIBUTED_ACTIVATION_PENDING`

Product commit: `e364220eae35e6700127e8e72f8bc32659c19e5b`

This bounded wave addresses corrected scan findings `csf_f5dd7b0bac8e0b7c7e531b29` and `csf_a0ac317d9f81776462e0441a` without altering the canonical scan.

## Contracts

- Public ask provider work supports a distributed weighted lease. Template mode consumes no provider work units, enhanced consumes 2, and full consumes the complete 12-unit capacity before its provider fan-out begins.
- JSON requests release the lease after work. SSE requests hold it through stream completion or consumer cancellation.
- Weather and knowledge match share distributed fixed-window admission when configured. Current production has no Upstash configuration, so process-instance fallback remains active and distributed activation is still open.
- Weather questions are limited to 240 characters. Knowledge GET and POST share a 900-character question limit, and POST retains its 16 KiB body budget.

## Verification

- Focused Vitest after the availability hotfix: 7 files / 38 tests, 0 failures.
- Focused and adjacent Vitest: 10 files / 52 tests, 0 failures.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Governed-path compatibility: 23 files / 215 tests, 0 failures. This companion re-proves the existing JSON body-budget, improvement-photo admission, provider-cancellation, and earlier three-finding security-remediation contracts after the bounded ask/weather/knowledge admission changes; it does not rewrite their original evidence.
- Production marker: `e364220eae35e6700127e8e72f8bc32659c19e5b` on `master`, deployment `safeguard-contest-6x4xnqzot-seojaehongs-projects.vercel.app`.
- Live no-provider probes: template ask 200 with `workUnit=0`; weather and knowledge oversized requests 413 with `PUBLIC_WORK_BUDGET_EXCEEDED`. All three report `X-SafeClaw-Rate-Limit: instance`.
- The preceding `b4828513` deployment briefly failed weather and knowledge closed with 503 because Upstash is not configured. The hotfix restored availability while retaining distributed-ready code and an explicit open activation boundary.

## Boundaries

No live provider-backed ask, weather provider call, DB mutation, provider dispatch, Share-session creation, vector runtime mutation, wiki publication, or KOSHA registry mutation was performed. Distributed production activation remains open and the two canonical findings are not claimed closed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Security-complete remains false and a fresh follow-up scan is required.
