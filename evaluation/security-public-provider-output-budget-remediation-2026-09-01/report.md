# Public provider output budget remediation

## Verdict

`PASS_CURRENT_SOURCE_PUBLIC_PROVIDER_OUTPUT_BUDGET_LIVE_PENDING`

Product commit `e9934679` adds deterministic provider and application output
budgets to every free-text generation path shared by public Ask, knowledge
regeneration, and workpack remediation.

## Contract

| Surface | Provider tokens | Accepted characters |
| --- | ---: | ---: |
| Ask answer | 2,048 | 8,000 |
| Citation mapping | 1,024 | 4,000 |
| Knowledge candidate | 2,048 | 8,000 |
| Workpack remediation | 1,024 | 4,000 |

OpenAI receives `max_output_tokens`; Vertex receives
`generationConfig.maxOutputTokens`. Output beyond the application character
ceiling fails closed instead of being silently truncated into an incomplete
safety instruction.

## Verification

- Focused provider/route contracts: 4 files, 41 tests passed.
- Adjacent Ask and knowledge orchestration: 5 files, 76 tests passed.
- Strict TypeScript typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- Dependency audit after lock-based install: 0 vulnerabilities.

## Live state

Production still reported `48d7c3a9` when checked. Product commit `e9934679`
is pushed to `master` but is not yet live-proven, so this receipt remains
current-source PASS and live-pending.

## Boundaries

The sealed 14-finding scan remains immutable and this receipt does not
reclassify its finding. Five approval-free findings remain after this bounded
source remediation, and seven database/RLS/atomicity findings remain
approval-gated. No DB, provider-dispatch, Share-session, vector, Wiki, or KOSHA
registry mutation occurred. Exact saved `/share/[sessionId]` remains
`MISSING_EVIDENCE`; security-complete is false.
