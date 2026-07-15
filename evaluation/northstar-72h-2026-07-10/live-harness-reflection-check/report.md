# Live Harness Reflection Check

Date: 2026-07-10 KST

## Scenario

Production `/api/ask` was checked with an enhanced-mode field scenario:

`부산 해운대 시설관리 현장 지하 기계실 배수펌프 점검, 작업자 4명, 밀폐공간 진입 전 환기와 산소농도 측정, 배수펌프 전원 차단 및 LOTO, 누수 바닥 미끄럼 위험, 감시인 배치 필요. 지난번 누수부 임시 배수로 설치 개선사항을 오늘 위험성평가와 TBM에 반영해줘.`

Harness memory included one previous improvement:

- 누수부 임시 배수로 설치
- 미끄럼 방지 매트 보강
- 위험성평가표, TBM 브리핑, TBM 기록 반영 대상

## Pre-Fix Production Evidence

Source artifacts:

- `prod-api-ask-harness-summary.json`
- `prod-api-ask-harness-full.json`

Result:

- mode: `live`
- generationMode: `enhanced`
- quality: `ready`
- ontology QA: `통과`
- DB harness mode: `db_harness_first`
- LLM role: `naturalize_only`
- evidence authority: `db_harness`
- retrieval mode: `rest-ilike`
- direct evidence: 8
- SIF cases: 0
- supporting evidence: 0
- improvement memory: 1
- risk rows: 5
- TBM risk links: 5
- improvement reflected in risk assessment: yes
- improvement reflected in TBM briefing: yes
- improvement reflected in TBM log: yes
- internal debug terms in user-facing status: no

## Findings

The good part: the improvement loop is real. The previous drainage improvement entered the harness memory and was reflected in the generated risk assessment, TBM briefing, and TBM log.

The blocking product issue: the answer said `SIF 유사사례` still needed reinforcement, but `qualityContract.overall` was `ready`. That meant the UI could present a ready workpack even when the DB harness still had a required evidence gap.

The second product issue: the scenario inference treated a basement pump/confined-space inspection as a generic `천장 누수 유지보수 작업`, causing some structured risk rows to feel off-target.

The third issue: `/api/safety-reference/search?itemType=sif-case` returned relevant SIF rows for pump/confined-space queries, but `/api/ask` did not call the SIF-specific bucket. The ask path merged technical support regulations, technical guidelines, and general catalog search only.

## Fix

1. `/api/ask` safety reference merge now includes a dedicated `itemType=sif-case` search bucket.
2. DB harness summary now surfaces `ontologyChecklist.missing`, so missing SIF is visible to quality/readiness surfaces.
3. Quality contract now refuses `ready` when the harness ontology status is not ready.
4. Scenario inference now has a dedicated basement pump/confined-space profile:
   - `지하 기계실 배수펌프 점검`
   - 밀폐공간 환기 and oxygen/gas measurement
   - pump power isolation and LOTO
   - leakage floor slip controls
   - external attendant/communication/rescue readiness

## Verification

```powershell
npm.cmd test -- tests\pump-confined-scenario.test.ts tests\quality-contract.test.ts tests\commercial-harness.test.ts tests\workpack-readiness.test.ts
npm.cmd run build
npm.cmd run typecheck
```

Result:

- 4 focused test files passed.
- 26 focused tests passed after the document-label regression test was added.
- Production build passed.
- Typecheck passed.

## Post-Deploy Production Evidence

Source artifacts:

- `postdeploy-api-ask-harness-summary.json`
- `postdeploy-api-ask-harness-full.json`

Result:

- mode: `live`
- generationMode: `enhanced`
- quality: `ready`
- ontology QA: `통과`
- DB harness mode: `db_harness_first`
- LLM role: `naturalize_only`
- evidence authority: `db_harness`
- retrieval mode: `rest-ilike`
- vector search: `disabled`
- direct evidence: 7
- SIF cases: 3
- supporting evidence: 3
- improvement memory: 1
- similar workpack memory: 1
- missing evidence: none
- document coverage: risk assessment, TBM briefing, and TBM log all covered by direct evidence, SIF case, supporting evidence, and improvement memory
- risk rows: 5
- TBM risk links: 5
- improvement reflected in risk assessment: yes
- improvement reflected in TBM briefing: yes
- improvement reflected in TBM log: yes
- basement pump/confined-space scenario detected: yes
- ceiling-leak template bleed: no

The remaining product issue after the first deployment was that `documentReflectionLabel` still exposed internal document keys such as `riskAssessment`, `tbmBriefing`, and `safetyEducation` inside user-facing appendices. The safety knowledge data can keep those stable internal keys, but generated documents must render them as Korean document labels only.

## Follow-Up Fix

1. Added a user-facing document key label map in `lib/safety-knowledge.ts`.
2. Converted safety knowledge reflection labels from internal keys to Korean document labels before they are appended to generated documents.
3. Added a regression test to ensure `riskAssessment`, `tbmBriefing`, `safetyEducation`, and `workpackSummary` do not leak into safety knowledge reflection labels.

## Final Deployment Requirement

The label fix changes runtime server code. It must be committed, pushed, deployed, and then checked again against `https://www.safeclaw.kr/api/ask`.

## Final Production Evidence

Source artifacts:

- `postdeploy-final-api-ask-harness-summary.json`
- `postdeploy-final-api-ask-harness-full.json`

Deployment:

- commit: `cfa4b8e`
- production deployment: `https://safeguard-contest-ald1p8aus-seojaehongs-projects.vercel.app`
- alias: `https://www.safeclaw.kr`

Result:

- HTTP status: 200
- mode: `live`
- generationMode: `enhanced`
- quality: `ready`
- DB harness quality: `ready`
- ontology QA: `통과`
- DB harness mode: `db_harness_first`
- LLM role: `naturalize_only`
- evidence authority: `db_harness`
- retrieval mode: `rest-ilike`
- vector search: `disabled`
- direct evidence: 7
- SIF cases: 3
- supporting evidence: 3
- improvement memory: 1
- similar workpack memory: 1
- missing evidence: none
- document coverage: risk assessment, TBM briefing, and TBM log all covered by direct evidence, SIF case, supporting evidence, and improvement memory
- risk rows: 6
- TBM risk links: 6
- Before/After improvement reflected in risk assessment: yes
- Before/After improvement reflected in TBM briefing: yes
- Before/After improvement reflected in TBM log: yes
- basement pump/confined-space scenario detected: yes
- ceiling-leak template bleed: no
- internal document keys in user-facing answer/deliverables: no

Remaining product-quality note: several retrieved direct evidence rows are still broad KOSHA support-regulation matches rather than highly specific pump/confined-space-only rows. The core harness loop now works, but the next quality lift should rerank evidence so 밀폐공간/LOTO/배수펌프-specific SIF and standards appear ahead of generic safety support regulations.

## Task-Specific Rerank Evidence

Source artifacts:

- `postdeploy-rerank-api-ask-harness-summary.json`
- `postdeploy-rerank-api-ask-harness-full.json`

Deployment:

- commits: `5c968cc`, `ffcdb9e`
- production deployment: `https://safeguard-contest-neroaj60w-seojaehongs-projects.vercel.app`
- alias: `https://www.safeclaw.kr`

Local verification:

```powershell
npm.cmd test -- tests\safety-reference-hybrid.test.ts tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\pump-confined-scenario.test.ts
npm.cmd run build
npm.cmd run typecheck
```

Result:

- focused tests: 4 files / 30 tests passed
- build: passed
- typecheck: passed
- production API status: 200
- mode: `live`
- generationMode: `enhanced`
- quality: `ready`
- DB harness quality: `ready`
- ontology QA: `통과`
- safety reference message includes: `작업특화 rerank 적용`
- retrieval mode: `rest-ilike`
- vector search: `disabled`
- first safety reference item: SIF case `1919 / 기타의사업 / 시설관리및사업지원서비스업`
- first safety reference item is pump/confined-space specific: yes
- first safety reference item is broad support-only material: no
- risk rows: 6
- TBM risk links: 6
- first risk row is pump/LOTO specific: yes
- improvement memory: 1
- similar workpack memory: 1
- Before/After improvement reflected in risk assessment: yes
- Before/After improvement reflected in TBM briefing: yes
- Before/After improvement reflected in TBM log: yes
- ceiling-leak template bleed: no
- internal document keys in user-facing answer/deliverables: no

The previous product-quality note is resolved for ordering: SIF/confined-space/LOTO-specific evidence now appears before broad KOSHA support material in the safety reference surface and is preserved when deterministic risk rows are built. Remaining long-term quality lift: enrich SIF titles/summaries so the evidence labels themselves are more human-readable than archive row numbers.
