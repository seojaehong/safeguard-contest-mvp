# KOSHA Exact Trust Registry Wave 2

## 판정

제품 요구사항과 focused gate는 통과했다. 다만 확장 34-file 실행에서 기존 KOSHA corpus audit 3건이 실패해 broad suite는 RED로 정직하게 유지한다. 이번 변경은 DB나 Supabase schema를 수정하지 않는다.

최종 독립 리뷰는 SPEC PASS / CODE QUALITY PASS / 통합 가능이며 차단 finding은 없다.

운영 exact trust pin은 1개에서 2개로 확장된다.

- D-C-13-2026 외벽도장보수공사 안전작업
- D-C-7-2026 비계 구조 및 안전작업

공식 본문 복구 보고서의 metadata-verified 후보는 234개지만, 이번 wave에서 production direct evidence로 승격되는 것은 위 2개뿐이다. 나머지 232개는 exact body, PDF, provenance, 사람 검토 receipt를 통과하기 전까지 직접 근거로 표시하지 않는다.

## 구현 경계

- D-C-13과 D-C-7 구성원 집합이 하나라도 누락·중복·손상되면 전체 exact registry를 차단한다.
- 레지스트리가 차단되면 remote 구성 여부나 local corpus 상태와 관계없이 KOSHA exact search를 원자적으로 차단한다.
- body/PDF/URL/file/publication/provenance SHA를 항목별 immutable pin과 정확히 비교한다.
- extraction snapshot과 portability ledger alias가 동시에 있으면 두 값 모두 pin과 같아야 한다.
- trusted remote row도 현재 질의에 적용되지 않으면 제거한다.
- D-C-7/D-C-13 질의 정책은 순수 policy module로 분리하고 상업·운영·혼합·무공백 합성어를 구분한다.
- Next file tracing의 전역 `/*`를 제거하고 실제 소비 경로 16개에만 두 JSON을 포함한다. 공식 PDF는 배포하지 않는다.
- 기존 단수 loader/merge API는 유지한다.

## 검증

- Focused Vitest: 5 files, 77 tests PASS
- Broad Vitest: 30 files PASS, 1 file FAIL, 3 files SKIP; 386 tests PASS, 3 FAIL, 4 SKIP
- Python acquisition: 19 tests PASS
- Strict TypeScript: PASS
- Production build: 28/28 static pages PASS
- Next NFT: 78 manifests 중 16 consumer manifests에만 두 exact JSON 포함
- Exact asset size: 147,724 bytes
- `git diff --check`: PASS

확장 34-file Vitest는 실행을 완료하고 최종 summary를 출력했으며, `tests/kosha-guide-corpus-audit.test.ts`의 3개 assertion에서 실패했다. 실패는 snapshot integrity/credential-order runner 출력이 비어 있거나 `audit.log`가 생성되지 않은 경로이며, 원인을 이번 exact registry product PASS로 재분류하지 않았다. 실패 stack과 최종 summary(`1 failed / 30 passed / 3 skipped`, `3 failed / 386 passed / 4 skipped`)는 `kosha-sif-ontology-tests.log`에 그대로 보존했다. 이 실행은 hang이나 summary 미출력으로 분류하지 않으며 broad suite PASS 근거로 사용하지 않는다.

## 남은 경계

- D-C-7 tracked asset은 기존 생성본이라 `publishedAt` 필드가 없다. acquisition generator에는 필드를 추가했고 runtime은 immutable pin의 날짜를 사용한다. 다음 verified acquisition transaction에서 asset을 재생성한다.
- metadata-verified 234개 전체의 exact production 승격은 별도 wave다.
- Hermes 실제 runtime과 RLS 후속 감사는 이 변경 범위 밖이며 기존 북극성 계획에서 계속 진행한다.
