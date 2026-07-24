# Live 12-Deliverable Broad Review

- Verdict: `RED_LIVE_PRODUCTION_12_DELIVERABLE_BROAD_REVIEW`
- Source mode: `live-production`
- Base URL: `https://www.safeclaw.kr`
- Source HEAD: `181414b9eef76178a86d02962aa4a8472525d9e1`
- Production commit: `181414b9eef76178a86d02962aa4a8472525d9e1`
- Cases: 5, pass 0, fail 5
- UI document count: 12
- Integrity required count: 12
- Reviewed document count: 12
- Missing unexpected: 0
- Explicit not applicable: 0
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch called: `false`
- Secondary document grounding: 30/30
- Cross-scenario leakage findings: 0
- Seed-profile leakage findings: 90
- Exact saved Share reproduced: `false`

| Case | Deliverable | Classification | Required | Characters | Grounding terms | Cross-scenario leakage | Forbidden seed fragments | Verdict | Failures |
|---|---|---|---:|---:|---|---|---|---:|---|
| ulsan-chemical-cleaning-sds__stress | workpackSummaryDraft | presentNonEmpty | yes | 752 | SDS, 울산, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | riskAssessmentDraft | presentNonEmpty | yes | 3462 | - | - | 공장 바닥 세척 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | workPlanDraft | presentNonEmpty | yes | 1010 | - | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | workPermitDraft | presentNonEmpty | yes | 1194 | 화학세척, SDS, 울산, 화학세척, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | tbmBriefing | presentNonEmpty | yes | 1963 | - | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | tbmLogDraft | presentNonEmpty | yes | 1981 | - | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | safetyEducationRecordDraft | presentNonEmpty | yes | 2315 | - | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | emergencyResponseDraft | presentNonEmpty | yes | 1580 | - | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | photoEvidenceDraft | presentNonEmpty | yes | 1174 | SDS, 울산, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | foreignWorkerBriefing | presentNonEmpty | yes | 3201 | 화학세척, SDS, 울산, 화학세척, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | foreignWorkerTransmission | presentNonEmpty | yes | 3533 | 화학세척, SDS, 울산, 화학세척, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| ulsan-chemical-cleaning-sds__stress | kakaoMessage | presentNonEmpty | yes | 672 | 화학세척, SDS, 울산, 화학세척, 미확인 화학물질, SDS, GHS 경고표지, 환기, 비산 | - | 공장 바닥 세척, 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | workpackSummaryDraft | presentNonEmpty | yes | 684 | 동시작업, 동시작업, 상하부 작업, 낙하물, 양중, 신호수 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | riskAssessmentDraft | presentNonEmpty | yes | 3948 | - | - | 고중량 박스 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | workPlanDraft | presentNonEmpty | yes | 1436 | - | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | workPermitDraft | presentNonEmpty | yes | 1205 | 동시작업, 크레인 양중, 배관 화기작업, 동시작업, 상하부 작업, 낙하물, 화기작업, 양중, 신호수 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | tbmBriefing | presentNonEmpty | yes | 2266 | - | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | tbmLogDraft | presentNonEmpty | yes | 2158 | - | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | safetyEducationRecordDraft | presentNonEmpty | yes | 2788 | - | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | emergencyResponseDraft | presentNonEmpty | yes | 1944 | - | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | photoEvidenceDraft | presentNonEmpty | yes | 1130 | 동시작업, 동시작업, 상하부 작업, 낙하물, 양중, 신호수 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | foreignWorkerBriefing | presentNonEmpty | yes | 3527 | 동시작업, 크레인 양중, 배관 화기작업, 동시작업, 상하부 작업, 낙하물, 화기작업, 양중, 신호수 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | foreignWorkerTransmission | presentNonEmpty | yes | 3907 | 동시작업, 크레인 양중, 배관 화기작업, 동시작업, 낙하물, 화기작업, 양중 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| pyeongtaek-simultaneous-overhead-hotwork__stress | kakaoMessage | presentNonEmpty | yes | 629 | 동시작업, 크레인 양중, 배관 화기작업, 동시작업, 상하부 작업, 낙하물, 화기작업, 양중, 신호수 | - | 고중량 박스, 폭염주의 수준, 온열질환과 근골격계 부담 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | workpackSummaryDraft | presentNonEmpty | yes | 851 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | riskAssessmentDraft | presentNonEmpty | yes | 3738 | - | - | - | PASS | - |
| daejeon-vulnerable-night-maintenance__stress | workPlanDraft | presentNonEmpty | yes | 1150 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | workPermitDraft | presentNonEmpty | yes | 1268 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | tbmBriefing | presentNonEmpty | yes | 2032 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | tbmLogDraft | presentNonEmpty | yes | 2021 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | safetyEducationRecordDraft | presentNonEmpty | yes | 2404 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | emergencyResponseDraft | presentNonEmpty | yes | 1602 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | photoEvidenceDraft | presentNonEmpty | yes | 1196 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | foreignWorkerBriefing | presentNonEmpty | yes | 6808 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | foreignWorkerTransmission | presentNonEmpty | yes | 7853 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| daejeon-vulnerable-night-maintenance__stress | kakaoMessage | presentNonEmpty | yes | 792 | 컨베이어, 조도, 대전, 야간 컨베이어 정비, 야간, 조도, 끼임, 의사소통, 피로, 고령, 청각장애, 신규 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | workpackSummaryDraft | presentNonEmpty | yes | 783 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동, LOTO | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | riskAssessmentDraft | presentNonEmpty | yes | 3619 | - | - | - | PASS | - |
| gumi-kosha-guidance-boundary__stress | workPlanDraft | presentNonEmpty | yes | 1117 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | workPermitDraft | presentNonEmpty | yes | 1249 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동, LOTO | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | tbmBriefing | presentNonEmpty | yes | 1999 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | tbmLogDraft | presentNonEmpty | yes | 1990 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | safetyEducationRecordDraft | presentNonEmpty | yes | 2350 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | emergencyResponseDraft | presentNonEmpty | yes | 1545 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | photoEvidenceDraft | presentNonEmpty | yes | 1156 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동, LOTO | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | foreignWorkerBriefing | presentNonEmpty | yes | 3482 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동, LOTO | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | foreignWorkerTransmission | presentNonEmpty | yes | 3785 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| gumi-kosha-guidance-boundary__stress | kakaoMessage | presentNonEmpty | yes | 699 | 방호장치, 자동화설비, 기동, 방호장치 개선·정비, 방호장치, 끼임, 예기치 않은 기동, LOTO | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | workpackSummaryDraft | presentNonEmpty | yes | 776 | 전기설비, 제주, 야간, 조도, 감전, 피로, 단독작업, 야간조, 인수인계 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | riskAssessmentDraft | presentNonEmpty | yes | 4048 | - | - | - | PASS | - |
| jeju-overnight-electrical-repair__stress | workPlanDraft | presentNonEmpty | yes | 1676 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | workPermitDraft | presentNonEmpty | yes | 1206 | 제주, 야간, 조도, 감전, 피로, 단독작업, 야간조, 인수인계 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | tbmBriefing | presentNonEmpty | yes | 2314 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | tbmLogDraft | presentNonEmpty | yes | 2279 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | safetyEducationRecordDraft | presentNonEmpty | yes | 2999 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | emergencyResponseDraft | presentNonEmpty | yes | 2135 | - | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | photoEvidenceDraft | presentNonEmpty | yes | 1146 | 전기설비, 제주, 야간, 조도, 감전, 피로, 단독작업, 야간조, 인수인계 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | foreignWorkerBriefing | presentNonEmpty | yes | 3358 | 제주, 야간, 조도, 감전, 피로, 단독작업, 야간조, 인수인계 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | foreignWorkerTransmission | presentNonEmpty | yes | 3656 | 전기설비, 제주, 야간, 조도, 감전, 피로, 단독작업 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |
| jeju-overnight-electrical-repair__stress | kakaoMessage | presentNonEmpty | yes | 696 | 전기설비, 제주, 야간, 조도, 감전, 피로, 단독작업, 야간조, 인수인계 | - | 우천 후 바닥 젖음 | RED | seedProfileLeakage |

## Classification Contract

- `presentNonEmpty`: raw API deliverable contains a substantive visible document.
- `explicitNotApplicable`: raw API deliverable visibly states `해당 없음` and includes a user-readable reason.
- `missingUnexpected`: the raw deliverable is absent, blank, or says `해당 없음` without a reason. UI fallback text never upgrades this state.
- Permit-like chemical, hot-work, confined-space, height, electrical, heavy-equipment, and maintenance scenarios require a non-empty `workPermitDraft`.
- The six secondary deliverables must reflect the current scenario, satisfy their document-specific semantic groups, and contain no other scenario fingerprint.

## Boundary

This gate enumerates all 12 UI deliverables and keeps the existing six-document wording review as a separate supporting check. It does not create or mutate a saved Share session, dispatch a provider, mutate the database, or reproduce an exact saved `/share/[sessionId]` user session.
