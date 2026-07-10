# Production commercial tables probe

- Checked at: 2026-07-10 KST
- Target: Vercel Production에 연결된 Supabase REST
- Method: service-role read-only `GET`, `select=id`, `limit=1`, exact count preference
- Database mutation: none

| Table | HTTP status | Runtime conclusion |
| --- | ---: | --- |
| `workpack_share_sessions` | 404 | 실제 공유 세션 저장 불가 |
| `workpack_read_confirmations` | 404 | 작업자 열람 확인 이력 저장 불가 |
| `workpack_improvements` | 404 | 사진/텍스트 개선 이력의 서버 저장 불가 |

## Decision

애플리케이션의 인증·소유권·준비도 계약은 구현되어 있지만, Production DB에는
`supabase/migrations/010_commercial_operations.sql`이 아직 적용되지 않았다. 따라서 배포 후에도
공유 UI의 실제 서버 저장 경로는 migration 전까지 준비되지 않은 상태로 취급해야 한다.

스키마 변경은 이 probe에서 실행하지 않았다. migration 적용 전에는 SQL 검토, RLS 정책 검토,
중복 확인 방지를 위한 unique 제약, rollback/검증 쿼리를 함께 승인해야 한다.

## Pre-approval findings

- 현재 draft `010_commercial_operations.sql`은 공유/개선 테이블과 pgvector 임베딩 테이블·RPC를
  한 migration에 묶고 있다. 상업 운영 저장소와 SIF 임베딩 승인을 분리하는 편이 안전하다.
- `workpack_read_confirmations`에는 동일 공유 세션·동일 작업자의 중복 확인을 막는 unique 제약이
  없다. 현재 API의 사전 조회만으로는 동시 요청 race를 막을 수 없다.
- 사진 storage bucket은 생성하지만 object policy는 migration에 없다. 업로드가 service-role route만을
  통하는지, 사용자 직접 업로드가 필요한지 확정한 뒤 최소 권한 정책을 검토해야 한다.
