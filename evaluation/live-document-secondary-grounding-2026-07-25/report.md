# Live Secondary Document Grounding Contract

- Verdict: `PASS_LIVE_PRODUCTION_SECONDARY_DOCUMENT_GROUNDING_CONTRACT`
- Source HEAD: `9c46d60dee1ef7c319269953a3145a3a2359e9f7`
- Production commit: `9c46d60dee1ef7c319269953a3145a3a2359e9f7`
- Base URL: `https://www.safeclaw.kr`
- Live calls: five `/api/ask` requests
- DB mutation: `false`
- Share session creation: `false`
- Provider dispatch: `false`
- Exact saved Share: `MISSING_EVIDENCE`

## Result

| Stage | Cases | Secondary documents | Cross-scenario leakage | Verdict |
|---|---:|---:|---:|---|
| Exact-term contract probe | 4/5 | 28/30 | 0 | RED |
| Calibrated live contract | 5/5 | 30/30 | 0 | PASS |

The initial contract probe found two 제주 electrical documents that used valid field synonyms such as `배전반` and `정전전로` instead of the exact configured strings `분전반` and `전기설비`. The calibrated contract remains fail-closed: each secondary document must contain either one exact scenario fingerprint or at least two supporting region, work-type, hazard, or worker signals. Document-specific semantic groups must all be present, and another scenario is flagged only when at least two terms from the same foreign profile appear.

The authoritative after-live rows preserve the matched primary/supporting terms, missing semantic groups, and cross-scenario leakage per document in `after-live-current-contract/report.json`.

## Scope

The measured secondary documents are:

- `workpackSummaryDraft`
- `workPermitDraft`
- `photoEvidenceDraft`
- `foreignWorkerBriefing`
- `foreignWorkerTransmission`
- `kakaoMessage`

The existing six-document synthetic wording gate remains unchanged. This deterministic supporting-document contract does not replace broad human wording review, mutate the database, create a Share session, dispatch a provider, or reproduce an exact saved `/share/[sessionId]`.
