# SafeGuard Data Layer Refactor

## 원칙

SafeGuard의 데이터 레이어는 Hybrid 저장 전략을 사용합니다. 비회원은 브라우저 임시 저장으로 즉시 사용성을 확보하고, 로그인 사용자는 Supabase에 현장, 작업자, 문서팩, 교육, 전파, 감사 이력을 저장합니다.

외부 API 호출부는 변경하지 않습니다. 기상청, Law.go, Work24, KOSHA 응답은 받은 뒤 스냅샷으로 동결합니다.

## 저장 계층

| 사용자 상태 | 저장 위치 | 저장 대상 | 고지 |
|---|---|---|---|
| 비회원 | localStorage | 최근 작업, SharedContext, 편집 초안, 마지막 작성 시각 | 브라우저 단위 임시 저장 |
| 로그인 | Supabase | Site, DailyEntry, Workpack, Worker, EducationRecord, DispatchLog, AuditTrail | 관리자 계정 이력 저장 |

비회원 저장은 재방문 경험을 돕는 편의 기능입니다. 브라우저 삭제, 기기 변경, 시크릿 모드에서는 유지되지 않을 수 있음을 화면에 표시합니다.

## 기존 테이블 재사용

현재 Supabase migration에 있는 다음 테이블은 유지합니다.

- `organizations`
- `sites`
- `workers`
- `workpacks`
- `education_records`
- `dispatch_logs`

이 테이블들은 Phase 1에서 삭제하거나 대체하지 않습니다. DailyEntry와 AuditTrail은 이 위에 추가되는 레이어입니다.

## 신규 엔티티

### SharedContext

문서팩의 단일 진실 원천입니다.

문서상 필드:

- site: 현장명, 주소, 업종, 공정, 원청.
- people: 작업자 수, 신규 투입자 수, 외국인 근로자 요약.
- environment: 날씨, 풍속, 강수, 시간대, 작업조건.
- risks: 4M 위험요인, 위험도, 즉시조치, 통제대책.
- evidenceRefs: 문서 문장과 연결된 법령, KOSHA 자료, 재해사례, 교육 후보.

### DailyEntry

Site의 하루 작업 단위입니다.

문서상 필드:

- siteId.
- workDate.
- inputDelta.
- sharedContext.
- weatherSnap.
- legalEvidenceSnap.
- trainingSnap.
- koshaSnap.
- accidentCaseSnap.
- docPack.
- editState.
- saveState.

### AuditTrail

사용자 편집과 저장 이벤트를 append-only로 남깁니다.

문서상 필드:

- organizationId.
- siteId.
- dailyEntryId.
- actorId.
- eventType.
- targetPath.
- beforeValue.
- afterValue.
- createdAt.

### EvidenceLibraryItem

증빙 라이브러리의 기본 단위입니다.

문서상 필드:

- dailyEntryId.
- kind: photo, kosha, accidentCase, training, dispatch, manual.
- title.
- sourceUrl.
- fileRef.
- capturedAt.
- reflectedIn.
- memo.

## API 스냅샷 정책

문서팩 생성 시 다음 스냅샷을 DailyEntry에 저장합니다.

- `weatherSnap`: 기상청 현재, 초단기, 단기, 특보, 영향예보 요약.
- `legalEvidenceSnap`: Law.go와 korean-law-mcp의 법령, 판례, 해석례 결과.
- `trainingSnap`: Work24와 KOSHA 교육 추천.
- `koshaSnap`: KOSHA 공식자료, 스마트검색, 자료 링크, 재해사례.

같은 DailyEntry에서 문서를 다시 열 때는 스냅샷을 먼저 사용합니다. 사용자가 명시적으로 “현재 근거 다시 확인”을 누를 때만 외부 API를 다시 호출합니다.

## Diff 정책

어제 DailyEntry와 오늘 DailyEntry를 비교해 다음 항목이 바뀌었을 때만 사용자에게 변경 뱃지를 보여줍니다.

- 작업명 또는 공정.
- 작업자 수.
- 신규 또는 외국인 근로자 수.
- 날씨 위험 신호.
- 4M 위험요인.
- 통제대책.
- 법령 또는 KOSHA 근거 스냅샷.

Diff는 문서 재생성 여부를 결정하는 보조 신호입니다. 사용자가 직접 확인하지 않은 변경은 자동 확정하지 않습니다.

## 금지 변경

다음은 본 리팩토링 범위에서 건드리지 않습니다.

- `lib/weather.ts` 호출 방식.
- `lib/lawgo.ts` 호출 방식.
- `lib/work24.ts` 호출 방식.
- `lib/kosha*.ts` 호출 방식.
- 기존 API 응답 파싱 규칙.

## 후속 구현 순서

1. localStorage 기반 최근 DailyEntry 복원.
2. Supabase migration으로 `daily_entries`, `audit_trails`, `evidence_items` 추가.
3. `/api/daily-entries` 저장/조회 API 추가.
4. SharedContext 편집 패널 연결.
5. EvidenceLibrary와 AuditTimeline UI 연결.
