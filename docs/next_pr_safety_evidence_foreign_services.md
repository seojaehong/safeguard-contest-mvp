# Next PR: Safety Evidence and Foreign Worker Services

## Why This PR Exists
SafeGuard should move from contest demo quality to a commercial safety SaaS standard. The next PR should make three product claims visible in the code and UI:

- Law.go citations are reliable enough to explain which statute, precedent, or interpretation supports a generated workpack.
- KOSHA accident/disaster cases are treated as operational evidence, not just guide links.
- Foreign worker support is a first-class safety flow: simple Korean, translated briefing, education recommendation, and field distribution.

## Current Finding
There is no GitHub PR because recent work was pushed directly to `master` for speed. Slash review commands that expect a PR cannot run until we open a feature branch. A clean clone was created at:

`C:\Users\iceam\dev\safeguard-contest-mvp`

The active branch for the next reviewable work is:

`codex/safety-evidence-foreign-services`

## Data and API Candidates
### KOSHA Accident / Disaster Cases
Use KOSHA domestic accident case data as the next evidence axis.

Candidate source:
- `한국산업안전보건공단_국내재해사례`
- Public API family observed in official/public references: `B552468/disaster_api02`
- Expected role: match work type and risk factor to similar accident cases, then add "similar case warning" to TBM and education output.
- Research note: public references point to a 2025 KOSHA domestic disaster case API URL change notice. Before implementation, verify the exact current endpoint and response fields from the public data portal using the issued service key.

Implementation target:
- `lib/accident-cases.ts`
- `AskResponse.externalData.accidentCases`
- UI card: `유사 재해사례`
- Export appendix: `유사 재해사례 반영`

### Law.go Citation Quality
Current Law.go support searches statutes, precedents, and interpretations. Next PR should tighten citation labels and source URLs.

Implementation target:
- Remove loose `any` parsing in `lib/lawgo.ts`.
- Add normalized citation fields: title, source type, promulgation/decision/reply date, agency/court, Law.go URL.
- In UI, group citations by `법령`, `판례`, `해석례`.
- In generated documents, cite Law.go as "근거 초안" and avoid pretending it is final legal advice.

### Foreign Worker and Translation Flow
Translation should be productized as a safety briefing aid, not a generic language feature.

Candidate APIs:
- Naver Cloud Papago Translation API for Korean-to-foreign-language field briefing.
- Google Cloud Translation API with glossary support for safety terms.
- Gemini can also generate simple Korean and multilingual draft text, but official translation API is stronger for operational claims.
- Exclude old Kakao translation API as a primary candidate unless a current Kakao official replacement is confirmed.

Implementation target:
- `lib/translation.ts`
- `AskResponse.deliverables.foreignWorkerBriefing`
- UI card: `외국인 근로자 브리핑`
- Supported demo languages: English, Vietnamese, Chinese, Uzbek or Thai.
- Always include a disclaimer: "현장 통역 또는 관리자 확인 후 사용".

## Commercial SaaS Benchmark Themes
To compete with strong safety SaaS products, SafeGuard should not look like a search page. It should look like an operating workflow.

Target capabilities:
- Pre-work risk assessment
- TBM / toolbox talk
- Safety education record
- Incident and near-miss learning
- Corrective action tracking
- Worker communication
- Evidence and audit trail
- Multilingual worker support
- Admin-ready exports and audit logs
- Mobile-first field confirmation
- Offline or low-connectivity fallback for worksites

Near-term SafeGuard version:
- Input one work scenario.
- Generate document pack.
- Attach Law.go/KOSHA/weather/training evidence.
- Add similar accident cases.
- Create simple Korean and translated worker briefing.
- Send through n8n to field channels.

## Product-Level Implementation Roadmap
### PR 1: Evidence Layer
- Add `lib/accident-cases.ts` with KOSHA disaster case adapter, 20s timeout, 1 retry, fallback fixtures.
- Add typed `AccidentCase` and `AskResponse.externalData.accidentCases`.
- Render `유사 재해사례` on the home screen with work-risk mapping rationale.
- Append similar case warning to TBM and safety education records.

### PR 2: Citation Layer
- Replace loose Law.go JSON parsing with typed guards.
- Add stable source labels and direct Law.go links for statutes, precedents, and interpretations.
- Show a short "why this source matters" line per citation.
- Add tests or smoke scripts for statute, precedent, and interpretation retrieval.

### PR 3: Foreign Worker Layer
- Add simple Korean worker briefing.
- Add translation adapter with provider slots for Papago and Google Cloud Translation.
- Add glossary-preserving translation prompt/fallback for safety terms.
- Add foreign worker briefing to exports and n8n payload.

### PR 4: SaaS Operating Layer
- Add corrective action checklist and completion status.
- Add worker confirmation fields.
- Add incident/near-miss learning section.
- Add n8n provider routes for email/SMS/Kakao/BAND after public proxy is attached.

## First UI Shape
- Top card: "오늘 작업 위험"
- Evidence strip: Law.go, KOSHA disaster cases, weather, Work24 training
- Workpack editor: risk assessment, TBM, education, foreign worker briefing
- Dispatch panel: copy first, n8n automation second
- Audit note: generated time, sources, fallback status

## Evidence Quality Rules
- Do not say a document is legally final.
- Say "초안", "보조", "현장 확인 후 사용".
- Similar accident cases are examples for prevention, not proof that the same accident will happen.
- Translations are field briefing aids and require manager or interpreter confirmation.

## PR Scope
Recommended next PR title:

`feat: add accident evidence and foreign worker briefing plan`

Minimum acceptable implementation:
- Add typed accident case adapter with fallback fixtures.
- Add translation adapter with Gemini fallback and future Papago/Google env slots.
- Extend `AskResponse` types.
- Render accident case and foreign worker briefing cards on home.
- Add export support in `WorkpackEditor`.
- Add E2E scenario checks for foreign worker and accident case mapping.

Out of scope:
- Direct Kakao personal message sending.
- Full KOSHA crawling at scale.
- DB storage or Supabase migrations.
- Legal advice wording.

## Review Command Guidance
For `/codex:adversarial-review`, run it from:

```powershell
cd C:\Users\iceam\dev\safeguard-contest-mvp
```

For `/code-review:code-review`, open a GitHub PR from:

`codex/safety-evidence-foreign-services -> master`

## Operator Notes
- Keep `N8N_PUBLIC_BASE` empty until a public HTTPS proxy or tunnel is attached.
- Keep Oracle n8n SafeGuard target on `127.0.0.1:5678`.
- Do not commit `.env.local` or tokens.
