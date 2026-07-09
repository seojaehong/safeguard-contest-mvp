# KOGAS Risk Standard Model Prep QA

- Source archive: `C:\Users\iceam\Downloads\한국가스공사_KOGAS 위험성평가 표준모델_20240909.zip`
- Generated at: `2026-07-09T22:57:48.353748+00:00`
- Parsed workbook members: `69`
- Skipped members: `2`
- Extracted risk-standard rows: `3101`

## Archive profile

- Total file members: `71`
- `.xls`: `42`
- `.xlsx`: `27`
- `.hwp`: `1`
- nested `.zip`: `1`
- Skipped reasons: `{"unsupported-hwp": 1, "nested-zip-offline-review-required": 1}`

## Representative extracted samples

### Sample 1

- Member: `1. 본사/본사-1 위험성평가 표준모델_미화작업(실내)_r1.xls`
- Process: `미화작업(실내)`
- Task: `점검 준비`
- Hazard category/cause: `작업환경요인` / ``
- Hazard detail: `계단 이동시 부주의로 인한 발목 접질림`
- Controls: `1. 작업장 정리정돈 2. 자재운반시 2인 1조 작업`
- Legal basis: ``
- Row id: `kogas-risk-standard-models-20240909::1. 본사/본사-1 위험성평가 표준모델_미화작업(실내)_r1.xls#row-0001`

### Sample 2

- Member: `2. 생산/생산-1 위험성평가_KRAS_생산_계전_특고압 변압기 분해정비공사.xls`
- Process: `특고압 변압기 분해정비공사`
- Task: `휴전조작 및 안전표지물 부착`
- Hazard category/cause: `전기적요인` / `감전(안전전압초과)`
- Hazard detail: `사선 및 활선구간 착각으로 인한 감전 위험`
- Controls: `1. 활선접근경보기 착용 2. 특별안전교육 실시`
- Legal basis: `안전보건규칙 제319조(정전전로에서의 전기작업)`
- Row id: `kogas-risk-standard-models-20240909::2. 생산/생산-1 위험성평가_KRAS_생산_계전_특고압 변압기 분해정비공사.xls#row-0001`

### Sample 3

- Member: `3. 공급/공급-1 [개정] 볼밸브 교체공사.xls`
- Process: `공급-1 [개정] 볼밸브 교체공사`
- Task: `(공사현장, 야적장) 자재운반`
- Hazard category/cause: `기계적요인` / `끼임(감김)`
- Hazard detail: `자재하역 시 작업자 협착`
- Controls: `1. 지게차, 크레인에 의한 작업 시, 작업반경내 접근금지 2. 지게차, 크레인에 의한 작업 시, 신호수 배치 3. 크레인에 의한 작업 시 유도로프 사용`
- Legal basis: ``
- Row id: `kogas-risk-standard-models-20240909::3. 공급/공급-1 [개정] 볼밸브 교체공사.xls#row-0001`

### Sample 4

- Member: `4. 건설/건설발주공사 위험성평가 표준모델/건설-1 배관설치.xlsx`
- Process: `배관 설치 작업`
- Task: `이동`
- Hazard category/cause: `6. 작업환경 요인` / `6.3 공간 및 이동통로`
- Hazard detail: `사무실(컨테이너) 문을 열고 나오던 중, 지면과 가설 사무실 출입구 단차를 보완하기 위한 발판으로 설치된 H빔을 왼발로 밟는 순간 왼발 종아리 하부 근육통증 호소`
- Controls: `1. 이동통로 단차 구간 경사로 또는 가설계단 사용`
- Legal basis: ``
- Row id: `kogas-risk-standard-models-20240909::4. 건설/건설발주공사 위험성평가 표준모델/건설-1 배관설치.xlsx#row-0001`

### Sample 5

- Member: `5. 수소/수소-1 위험성평가 표준모델(KRAS)_1. 튜브트레일러(TT) 교체.xls`
- Process: `1. 튜브트레일러(T/T) 교체`
- Task: `T/T 진출입`
- Hazard category/cause: `작업특성요인` / `근로자 실수(휴먼 에러)`
- Hazard detail: `운전원의 운전미숙으로 인한 설비, 구조물 및 근로자 충돌 위험`
- Controls: `1. 안전수칙, 작업표준 준수 2. 충전소 진출입 유도선 표시 3. 작업 중 신호수 배치`
- Legal basis: `안전보건법 제38조 (안전조치)`
- Row id: `kogas-risk-standard-models-20240909::5. 수소/수소-1 위험성평가 표준모델(KRAS)_1. 튜브트레일러(TT) 교체.xls#row-0001`

## Migration risks

1. `.hwp` 1건과 nested `.zip` 1건은 이번 오프라인 준비에서 의도적으로 스킵했다. 별도 파서 검토 없이는 동일 규칙으로 섞어 넣으면 안 된다.
2. 메인 표는 대체로 2단 헤더지만, 시트별로 `관련근거`, `현재안전보건조치`, `완료일` 유무가 달라서 DB 적재 전 null 허용 규칙을 다시 확인해야 한다.
3. 일부 행은 `세부 작업명`, `분류`, `원인`이 빈칸이고 윗행 값을 이어받아야 한다. 이번 산출물은 carry-forward 여부를 payload에 남겼으니, 이 플래그를 버리지 말아야 한다.
4. `공정명`과 파일명은 비슷하지만 완전히 같지 않은 경우가 있다. 검색 title은 workbook title, retrieval payload는 process_name과 member path를 함께 보존하는 편이 안전하다.
5. 동일하거나 유사한 감소대책 문구가 여러 템플릿에 반복된다. dedupe는 row ingest 이후 검색/embedding 단계에서 검토하고, raw text는 지금 그대로 보존해야 한다.

## Offline package artifacts

- JSON rows: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate\evaluation\northstar-72h-2026-07-10\kogas-risk-standard-model-prep\normalized-risk-standard-rows.json`
- Source profile: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate\evaluation\northstar-72h-2026-07-10\kogas-risk-standard-model-prep\source-profile.json`
- Upsert preview: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate\evaluation\northstar-72h-2026-07-10\kogas-risk-standard-model-prep\safety-reference-upsert-preview.json`
- Handoff: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\backend-harness-gate\evaluation\northstar-72h-2026-07-10\kogas-risk-standard-model-prep\db-migration-agent-handoff.md`
