# KOSHA Exact Trust Registry Wave 2

## 판정

제품 요구사항, focused gate, 확장 34-file KOSHA/SIF/온톨로지 suite가 모두 통과했다. 이전 broad suite RED였던 KOSHA corpus audit 3건은 bridge-only preflight를 보강해 현재 master에서 해소했다. 이번 변경은 DB나 Supabase schema를 수정하지 않는다.

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

- Focused Vitest: 5 files, 80/80 tests PASS
- KOSHA corpus audit: 1 file, 110/110 tests PASS
- Broad Vitest: 31 files PASS, 3 files SKIP; 395 tests PASS, 4 SKIP
- Python acquisition: 19 tests PASS
- Strict TypeScript: PASS
- Production build: 28/28 static pages PASS
- Next NFT: 78 manifests 중 16 consumer manifests에만 두 exact JSON 포함
- Exact asset size: 147,724 bytes
- `git diff --check`: PASS

확장 34-file Vitest는 실행을 완료하고 최종 summary를 출력했으며, 현재 결과는 `31 passed / 3 skipped`, `395 passed / 4 skipped`이다. 이전 실패 원인은 bridge-only runner가 스냅샷 무결성/자격증명 부재를 판정하기 전에 Vite module server를 로드해 30초 timeout에 도달하던 구조였다. 현재는 bridge-only preflight가 current snapshot traversal, items/chunks/checkpoint hash, reproducibility hash, Supabase credential absence를 Vite 로드 전에 fail-closed로 판정하고 fatal code와 `audit.log`를 남긴다.

## 남은 경계

- 비차단 P3: 현재 회귀 테스트는 전역 `/*` 부재, 구성된 16개 consumer key 전체, 각 key의 exact asset membership을 고정한다. 다만 production build가 생성한 NFT manifest 총수와 실제 포함 manifest 수까지 회귀 테스트로 고정하지는 않는다. 이번 실제 build에서는 78개 manifest 중 정확히 16개가 두 exact asset을 포함했고 partial asset manifest는 0개였으며, 이 build 산출물 수치는 후속 durability 테스트 대상이다.
- D-C-7 tracked asset은 기존 생성본이라 `publishedAt` 필드가 없다. acquisition generator에는 필드를 추가했고 runtime은 immutable pin의 날짜를 사용한다. 다음 verified acquisition transaction에서 asset을 재생성한다.
- metadata-verified 234개 전체의 exact production 승격은 별도 wave다.
- Hermes 실제 runtime과 RLS 후속 감사는 이 변경 범위 밖이며 기존 북극성 계획에서 계속 진행한다.
