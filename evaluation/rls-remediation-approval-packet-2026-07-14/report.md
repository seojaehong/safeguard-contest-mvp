# Supabase RLS 개선 승인 패킷

- 기준일: 2026-07-14
- 패킷 기준 커밋: `2684cb99de944aa9f54d143f2ae40b4ad6104f02`
- 감사 원본: `evaluation/supabase-rls-audit-2026-07-14/report.json`
- 감사 Git blob: `7ad1dd2d27be946a2f84b0fc57c25246c0f47b00`
- 감사 대상 제품 커밋: `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`
- Evidence root: `d77205bb498080ac02b9f506d72bd44648f4a660`; 이 커밋 또는 packet-only descendant만 허용한다.
- 현재 결정: **HOLD**
- `launchReadiness=false`
- `noMutation=true`
- `implementationAllowedByThisPacket=false`
- 이 문서는 승인 전용이다. 구현, migration SQL, DB·스토리지 변경, live credential 사용, live 검증을 포함하지 않는다.

## 1. 승인 요약

현재 감사 산출물은 내부 수치와 참조를 일관되게 보존했지만 launch PASS는 아니다. 열려 있는 finding은 10건이고 분포는 `P0/P1/P2/P3=0/3/4/3`이다. 감사 원본은 14개 단방향 seed와 56개 기대 거부를 보존한다. 이 승인 패킷의 실행 계획은 각 boundary를 A-to-B와 B-to-A로 펼쳐 112개 foreign-tenant 거부와 28개 same-tenant positive control을 요구하며, 실행된 것은 0개다.

가장 작은 안전 단위는 다음과 같다.

1. **A 정책 전용**: 누락 RLS 의도, 역할, 명령별 CRUD, 새 행 검사(WITH CHECK 의도), 공개·운영자 경계를 한 change set으로 다룬다.
2. **B 라우트 스코프**: `service_role`을 쓰는 tenant/admin 경로에서 외부 ID를 다시 소유권 확인하고 organization/site 조건을 자식 조회에 전달한다.
3. **C FORCE RLS**: table owner 경로를 staging에서 확인한 뒤 테이블별로 결정한다. `service_role` 우회 통제 수단으로 보지 않는다.
4. **D Storage**: service-route-only 또는 direct-client 모델을 먼저 선택하고, path·metadata·tenant 일치를 staging에서 검증한다.
5. **E live 교차 tenant 검사**: 비운영 staging에만 A/B fixture를 만들고 pre/post 동일 행렬을 실행한다.

이 패킷 작성, 로컬 validator, diff/scope scan, secret-pattern scan, evaluation 로그, 문서 커밋·push에는 추가 승인이 필요하지 않다. A-E 구현 시작, DB 정책·권한·함수·FORCE 변경, route 코드 변경, staging/production fixture 또는 object 변경, live credential 사용에는 명시 승인이 필요하다. B가 route-only로 유지되면 DB 안전 게이트는 아니지만, 현재 지시는 packet-only이므로 별도 구현 지시가 있어야 한다.

## 2. 보존된 감사 사실

| 항목 | 감사 사실 |
|---|---:|
| Application tables | 22 |
| 전체 inventory boundary | 24 |
| RLS enabled application tables | 20 |
| RLS 누락 | 2: `documents`, `query_logs` |
| FORCE RLS | 0 |
| Policies | 20 |
| 명시 role이 있는 policy | 0 |
| Tenant tables | 13 |
| Findings | 10 |
| Severity | `P0/P1/P2/P3=0/3/4/3` |
| Tenant/admin service-role routes | 21: direct 19, broker-mediated 2 |
| Public/global service-role HTTP surfaces | 11: API 6, server page 5 |
| Negative cases | 14 |
| Expected deny assertions | 56 |
| Executed deny assertions | 0 |

감사 원본은 read-only source audit와 보존된 redacted HEAD 관찰을 포함한다. 이번 패킷은 원본을 다시 실행하지 않았다. 감사 원본은 base 커밋의 Git blob에서 읽고, 감사 대상 제품 커밋과 패킷 base 사이의 `app/`, `lib/`, `supabase/` diff가 비어 있는지 검증한다. 감사 seed accounting은 `14 x 4 = 56`이고, packet 실행 계획 accounting은 별도로 확장한다.

## 3. Audit SPEC PASS와 launch PASS가 다른 이유

Audit SPEC PASS는 감사 문서 validator가 다음을 확인했다는 뜻이다.

- JSON/Markdown 구조와 finding 제목이 일치한다.
- 10건과 `0/3/4/3`, 24개 boundary, 14개 case, 56개 expected deny가 맞는다.
- source reference가 존재하고 `noMutation=true`, `launchReadiness=false`가 보존된다.

그러나 다음은 증명하지 않는다.

- authenticated user A가 organization/site B의 행을 실제로 SELECT/INSERT/UPDATE/DELETE하지 못했다.
- 56개 음성 assertion이 실행되어 모두 거부됐다.
- live object privilege, default privilege, table owner, function reachability, FORCE 상태가 확인됐다.
- 21개 `service_role` tenant/admin route가 외부 tenant ID를 거부했다.
- `storage.objects`의 정책, grant, object owner, direct-client reachability가 확인됐다.
- finding이 하나라도 수정됐다.

따라서 **Audit SPEC PASS != launch PASS**다. launch PASS는 A/B/D 승인 변경 후 staging evidence, 112개 양방향 실제 거부, 28개 same-tenant positive control, data-integrity parity, rollback rehearsal까지 있어야 한다.

## 4. 역할과 신뢰 경계

### 역할

- `authenticated`: `auth.uid()`가 null이 아니며 최종 row의 organization 관계가 actor 소유일 때만 tenant 명령을 허용한다. RLS policy는 object command privilege를 부여하지 않는다.
- `anon`: tenant/operator 데이터는 모두 거부한다. 의도적으로 공개한 safety catalog와 published ontology read만 허용 후보이다.
- `service_role`: RLS를 우회한다. FORCE RLS도 `service_role` BYPASSRLS를 제한하지 않는다. 그러므로 caller 인증, 외부 ID 재소유권 확인, organization/site 복합 필터, same-tenant integrity가 필수 보완 통제다.

### 핵심 boundary

| Boundary | 현재 관찰 | 승인 후 불변식 | 근거 |
|---|---|---|---|
| Organization | `owner_id`가 ownership anchor이며 nullable이다. | actor가 소유한 최종 row만 접근하고 일반 UPDATE로 owner를 넘기지 않는다. | `supabase/migrations/002_workspace_productization.sql:3-9`, `supabase/migrations/002_workspace_productization.sql:99-113`, `lib/supabase-admin.ts:594-646` |
| Site | related `site_id`와 row organization 일치가 항상 증명되지 않는다. | non-null site는 같은 organization에 속해야 한다. | `supabase/migrations/002_workspace_productization.sql:11-57`, `supabase/migrations/002_workspace_productization.sql:115-164` |
| Workpack/children | owned workpack 확인 뒤 child를 `workpack_id`만으로 조회하는 경로가 있다. | child 조회·쓰기에는 organization/site/workpack을 함께 적용한다. | `app/api/workpacks/[id]/share-sessions/route.ts:34-55`, `app/api/workpacks/[id]/read-confirmations/route.ts:32-42`, `app/api/workpacks/[id]/improvements/route.ts:176-197` |
| Documents | body/citation을 가진 legacy table의 공개/운영자 의도가 분류되지 않았다. | 분류 전까지 anon/authenticated direct access를 fail closed로 둔다. | `supabase/migrations/001_init.sql:8-17` |
| Query logs | 민감할 수 있는 query text가 있고 RLS 선언이 없다. | 승인된 operator path만 read/write하고 tenant/public direct access는 없다. | `supabase/migrations/001_init.sql:1-6` |
| Dispatch | null organization 분기와 외부 `workpackId` 사용 경로가 있다. | tenant row는 organization이 필수이고 site/workpack은 같은 organization이어야 한다. | `supabase/migrations/002_workspace_productization.sql:76-90`, `supabase/migrations/002_workspace_productization.sql:183-200`, `app/api/dispatch-logs/route.ts:173-208` |
| MCP | token row의 site/org가 runtime auth context가 되고 memory read는 site만 비교한다. | token scope 조합이 유효하며 memory read는 site와 org를 모두 비교한다. | `supabase/migrations/007_mcp_tokens.sql:14-24`, `lib/mcp-auth.ts:134-163`, `app/api/mcp/[transport]/route.ts:134-189` |
| Storage | private bucket과 org prefix는 source로 보이나 live object enforcement는 미확인이다. | path, metadata, organization, workpack, improvement가 모든 object command에서 일치한다. | `supabase/migrations/010_commercial_operations.sql:7-15`, `lib/workpack-commercial.ts:411-433`, `app/api/workpacks/[id]/improvements/route.ts:86-173` |

## 5. Finding별 승인 맵

### P1-01: Two legacy exposed-schema tables have no RLS declaration

- Tables: `query_logs`, `documents`
- Routes: 감사에서 runtime table call을 찾지 못했다.
- Evidence: `supabase/migrations/001_init.sql:1-17`
- Exploit prerequisites: 해당 role에 object command privilege가 있고 relation이 API surface에서 reachable이며 유의미한 row가 있어야 한다.
- False-positive caveats: HEAD는 anon SELECT reachability와 zero rows만 관찰했다. row body, mutation privilege, effective grant source는 확인하지 않았다. Policy 부재 자체가 command privilege를 주는 것은 아니다.
- Owner: Supabase database security owner. Data classification owner와 application security reviewer가 지원한다.
- Batches: A, E

### P1-02: `dispatch_logs` has a role-agnostic global-null CRUD branch

- Table: `dispatch_logs`
- Routes: `/api/dispatch-logs` GET/POST (`app/api/dispatch-logs/route.ts:41-208`)
- Route correction: `/api/workflow/dispatch` validates the caller-owned workpack and active owned share session and does not access `dispatch_logs`; it is not evidence for P1-02.
- Boundary correction: `BND-DISPATCH` maps only to `/api/dispatch-logs`; `/api/workflow/dispatch` remains a separate owned-workpack/share-session authorization surface.
- Evidence: `supabase/migrations/002_workspace_productization.sql:76-90`, `supabase/migrations/002_workspace_productization.sql:183-200`
- Exploit prerequisites: direct attempt에는 object privilege가 필요하고, service route attempt에는 인증된 route reachability가 필요하다. null tenant row 또는 허용되는 입력과 사용할 수 있는 관련 ID가 있어야 한다.
- False-positive caveats: service-role 6 rows와 anon zero rows는 관찰했지만 null row 존재와 mutation privilege는 확인하지 않았다. Policy 분기는 object privilege를 대신하지 않는다.
- Owner: Supabase database security owner. Dispatch API owner와 operations data owner가 지원한다.
- Batches: A, B, E

### P1-03: Tenant policies do not enforce same-organization relationships and service-role child queries trust them

- Tables: `workers`, `workpacks`, `education_records`, `dispatch_logs`, `daily_entries`, `knowledge_events`, `knowledge_regeneration_runs`, `workpack_share_sessions`, `workpack_read_confirmations`, `workpack_improvements`, `workpack_improvement_photos`
- Routes: `/api/education-records`, `/api/dispatch-logs`, `/api/workpacks/[id]/share-sessions`, `/api/workpacks/[id]/read-confirmations`, `/api/workpacks/[id]/improvements`
- Evidence: `supabase/migrations/002_workspace_productization.sql:21-90`, `supabase/migrations/002_workspace_productization.sql:132-200`, `supabase/migrations/003_knowledge_runtime.sql:1-63`, `supabase/migrations/003_knowledge_runtime.sql:77-126`, `supabase/migrations/010_commercial_operations.sql:21-86`, `supabase/migrations/010_commercial_operations.sql:161-227`, `app/api/education-records/route.ts:31-56`, `app/api/dispatch-logs/route.ts:184-187`, `app/api/dispatch-logs/route.ts:192-208`, `app/api/workpacks/[id]/share-sessions/route.ts:34-55`, `app/api/workpacks/[id]/read-confirmations/route.ts:32-42`, `app/api/workpacks/[id]/improvements/route.ts:187-197`
- Exploit prerequisites: foreign valid UUID를 알고, caller-owned organization과 foreign relation을 결합한 row가 받아들여지거나 이미 존재하며, privileged child query가 그 row를 포함해야 한다. Direct table attempt는 object privilege가 필요하다. Dispatch route는 client DB INSERT privilege가 없어도 service role로 쓰지만 usable foreign workpack UUID가 필요하다.
- False-positive caveats: foreign UUID knowledge, mismatch acceptance, cross-tenant response inclusion을 재현하지 않았다. 일부 route는 owned parent를 이미 확인하며, 문제는 child relation/filter의 추가 tenant 조건 부재다.
- Owner: Backend tenant-authorization owner. Database security, commercial workpack, dispatch owner가 지원한다.
- Batches: B, D, E

### P2-01: History-like tenant tables receive unrestricted owner UPDATE and DELETE

- Tables: `education_records`, `dispatch_logs`, `daily_entries`, `knowledge_events`, `knowledge_regeneration_runs`, `workpack_read_confirmations`
- Routes: `/api/education-records`, `/api/dispatch-logs`, `/api/workpacks/[id]/read-confirmations`
- Evidence: `supabase/migrations/002_workspace_productization.sql:166-200`, `supabase/migrations/003_knowledge_runtime.sql:77-126`, `supabase/migrations/010_commercial_operations.sql:178-193`
- Exploit prerequisites: authenticated role에 UPDATE/DELETE object privilege가 있고 row가 owner predicate를 만족해야 한다.
- False-positive caveats: effective grants와 mutation은 확인하지 않았고 현재 UI가 해당 command를 노출하지 않을 수 있다.
- Owner: Data lifecycle owner. Database security와 backend API owner가 지원한다.
- Batches: A, E

### P2-02: Ingestion-run operational metadata has an unrestricted SELECT row policy

- Table: `safety_reference_ingestion_runs`
- Route: `/api/safety-reference/status` GET (`app/api/safety-reference/status/route.ts:6`)
- Evidence: `supabase/migrations/004_safety_reference_catalog.sql:34-45`, `supabase/migrations/004_safety_reference_catalog.sql:70-72`
- Exploit prerequisites: anon/authenticated에 SELECT object privilege가 있고 `report_path` 또는 `details`가 채워져 있으며 raw table 또는 unsanitized response에 도달해야 한다.
- False-positive caveats: policy가 SELECT privilege를 부여하지 않는다. HEAD는 두 row를 관찰했지만 body와 effective grant를 확인하지 않았다.
- Owner: Safety reference operations owner. Database security와 public API owner가 지원한다.
- Batches: A, E

### P2-03: `mcp_tokens` tenant binding is not schema-enforced

- Table: `mcp_tokens`
- Routes: `/api/mcp/[transport]` GET/POST/DELETE (`app/api/mcp/[transport]/route.ts:134-189`), `/api/mcp-tokens` GET/POST (`app/api/mcp-tokens/route.ts:189-253`), `/api/mcp-tokens/[id]` PATCH/DELETE (`app/api/mcp-tokens/[id]/route.ts:33-116`)
- Evidence: `supabase/migrations/007_mcp_tokens.sql:14-24`, `lib/mcp-auth.ts:134-143`, `lib/mcp-auth.ts:155-163`, `app/api/mcp/[transport]/route.ts:134-146`, `app/api/mcp-tokens/route.ts:214-253`
- Exploit prerequisites: privileged path가 orphan/mismatched token row를 만들고, token이 foreign valid siteId를 가지며, 허용 scope로 memory tool에 제시되어야 한다.
- False-positive caveats: 정상 issuance API는 한 owned context에서 site/org를 함께 설정한다. 잘못 묶인 token과 cross-tenant memory read는 만들거나 재현하지 않았다.
- Owner: MCP authentication owner. Database security와 backend tenant-authorization owner가 지원한다.
- Batches: B, E

### P2-04: Published ontology edges do not require published endpoint nodes

- Tables: `safety_ontology_edges`, `safety_ontology_nodes`
- Route: `/api/ontology/graph` GET (`app/api/ontology/graph/route.ts:10-11`)
- Evidence: `supabase/migrations/008_safety_ontology.sql:20-29`, `supabase/migrations/008_safety_ontology.sql:43-45`
- Exploit prerequisites: published edge가 unpublished endpoint를 참조하고 caller가 SELECT object privilege를 가져야 한다.
- False-positive caveats: service-role/anon count 차이는 invalid endpoint를 증명하지 않는다. Endpoint consistency와 violating edge는 확인하지 않았다.
- Owner: Ontology publication owner. Database security와 public graph API owner가 지원한다.
- Batches: A, E

### P3-01: Tenant policies omit explicit roles and FORCE RLS

- Tables: 13 tenant tables 전체
- Evidence: `supabase/migrations/002_workspace_productization.sql:99-200`, `supabase/migrations/003_knowledge_runtime.sql:73-126`, `supabase/migrations/004_safety_reference_catalog.sql:58-72`, `supabase/migrations/007_mcp_tokens.sql:32-33`, `supabase/migrations/008_safety_ontology.sql:35-45`, `supabase/migrations/010_commercial_operations.sql:155-231`
- Exploit prerequisites: broader role에 object privilege가 있거나 table-owner equivalent SQL path가 있어야 한다. Dispatch null case에는 reachable null row가 필요하다.
- False-positive caveats: unauthenticated null identity는 일반 owner predicate에서 false다. FORCE는 `service_role` BYPASSRLS를 막지 않는다. Live role, owner, grant, FORCE는 확인하지 않았다.
- Owner: Supabase database security owner. Platform operations와 application security reviewer가 지원한다.
- Batches: A, C, E

### P3-02: Service-only RPC intent is not reflected in grants or function hardening

- Tables: `safety_reference_embeddings`, `safety_reference_items`
- Route: `/api/safety-reference/search` GET (`app/api/safety-reference/search/route.ts:7-18`)
- Evidence: `supabase/migrations/010_commercial_operations.sql:109-153`, `supabase/migrations/010_commercial_operations.sql:229-231`
- Exploit prerequisites: 의도하지 않은 role에 function execution privilege가 있고 RPC가 reachable해야 한다.
- False-positive caveats: 현재 invoker behavior에서는 non-bypass caller가 table RLS를 받는다. Embedding endpoint는 preserved probe에서 404였고 execution grants는 확인하지 않았다.
- Owner: Supabase database security owner. Safety reference search와 platform operations owner가 지원한다.
- Batches: A, E

### P3-03: Ontology publication policy does not require provenance

- Tables: `safety_ontology_nodes`, `safety_ontology_edges`
- Route: `/api/ontology/graph` GET (`app/api/ontology/graph/route.ts:10-11`)
- Evidence: `supabase/migrations/008_safety_ontology.sql:9-29`, `supabase/migrations/008_safety_ontology.sql:35-45`, `lib/ontology/graph-store.ts:73-115`, `lib/ontology/graph-store.ts:253-276`
- Exploit prerequisites: service-role 또는 BYPASSRLS path가 empty provenance 상태의 published row를 쓰고 public caller가 SELECT reachability를 가져야 한다.
- False-positive caveats: 정상 application path는 empty provenance를 거부하거나 drop한다. Direct privileged write와 current violating row는 확인하지 않았다.
- Owner: Ontology publication owner. Database security와 evidence integrity reviewer가 지원한다.
- Batches: A, E

## 6. 승인 결정표

| Batch | 최소 범위 | 명시 사용자 승인 | DB/데이터 hard gate | 현재 권고 | Rollback 단위 |
|---|---|---|---|---|---|
| A | Missing RLS 의도, explicit role, CRUD 분리, new-row check, dispatch null 제거, 공개/운영자 경계 | 필요 | 필요 | Staging 설계·리허설만 승인, production 별도 | Policy/grant/function metadata를 포함한 단일 DB change set |
| B | Route-only ID re-ownership, org/site child filter, dispatch/MCP scope | 필요 | route-only이면 아님 | 별도 code batch로 승인 | 단일 application deployment commit |
| C | Table owner inventory 후 FORCE table-by-table 결정 | 필요 | 필요 | A와 분리하고 owner path 확인 전 enablement 보류 | 테이블별 FORCE 상태 |
| D | Storage access model, path/metadata tenant agreement, staging object test | 필요 | 필요 | Staging inspection 승인, 기본안은 service-route-only | Storage policy snapshot + app deployment |
| E | Staging A/B users, rows, tokens, objects로 pre/post 실행 | 필요 | 필요 | Launch PASS 전 필수 | Fixture ID allowlist와 cleanup manifest |

승인 문구는 batch와 환경을 분명히 해야 한다. 예: “Batch A의 staging 설계 및 rehearsal을 승인하며 production 적용은 승인하지 않는다.” Production window, target project, rollback owner가 없는 승인은 production 승인으로 해석하지 않는다.

## 7. 정책 의미 제안: pseudocode only

아래는 의도 정의이며 실행 가능한 SQL이 아니다. `service_role`은 RLS를 우회하므로 마지막 열의 application boundary가 반드시 함께 필요하다.

| Table | SELECT | INSERT + new-row check | UPDATE + final-row check | DELETE | Service-role boundary |
|---|---|---|---|---|---|
| `organizations` | actor owns row | `owner_id=actor` | owner 유지, 일반 transfer 금지 | 직접 거부, retirement workflow | user ownership filter 유지 |
| `sites` | actor owns organization | final organization owned | final organization owned | retirement workflow만 | owned organization predicate |
| `workers` | actor owns organization | org owned + site same org | 같은 조건 반복 | lifecycle workflow만 | worker IDs 재소유권 확인 |
| `workpacks` | actor owns organization | org owned + site same org + attribution rule | final org/site 일치 | archive/retention only | id + owned org로 parent load, child에 org/site 전달 |
| `education_records` | actor owns organization | site/workpack/worker 모두 same org | append-only, 별도 correction만 | retention only | body의 workpack/worker IDs 재소유권 확인 |
| `dispatch_logs` | non-null owned org | non-null owned org + related IDs same org | 직접 거부 | retention only | 외부 workpackId 재소유권 확인 |
| `daily_entries` | actor owns organization | site/workpack same org + attribution | generic update 거부 | retention only | privileged path에 org/site 명시 |
| `knowledge_events` | actor owns organization | site/workpack/daily entry same org | event history update 거부 | retention only | ingest relation IDs 재검증 |
| `knowledge_regeneration_runs` | actor owns organization | scalar relations와 모든 raw event same org | run history update 거부 | retention only | 전체 source event set 검증 |
| `workpack_share_sessions` | actor owns organization | workpack/site/recipient same org | status/expiry transition만 | revoke/expire 사용 | child query에 workpack/org/site 적용 |
| `workpack_read_confirmations` | actor owns organization | share/worker/workpack/site same org | history update 거부 | retention only | active share와 recipient 재소유권 확인 |
| `workpack_improvements` | actor owns organization | workpack/site same org + attribution | review-state transition만 | reject/retention only | child/MCP read에 org/site/workpack 적용 |
| `workpack_improvement_photos` | owned org + metadata relation 일치 | org/site/workpack/improvement/bucket/path 일치 | direct metadata update 거부 | service cleanup only | object operation 전 relation/path 재검증 |

Operator/public 의미는 다음과 같다.

- `query_logs`: anon/authenticated direct CRUD 모두 deny. 승인된 operator path만 redaction·retention 조건으로 사용한다.
- `documents`: 분류 전 anon/authenticated direct CRUD 모두 deny. Public read 추가는 A와 분리된 새 결정이 필요하다.
- `safety_reference_sources/items`: anon/authenticated는 deliberate public fields SELECT만, write는 server operator만.
- `safety_reference_ingestion_runs`: raw table은 operator-only. Public status는 `report_path`와 raw `details`를 제외한 sanitized shape만.
- `safety_ontology_nodes/edges`: published, non-empty provenance, published endpoints 조건을 만족하는 subgraph만 public SELECT.
- `safety_reference_embeddings`와 retrieval RPC: anon/authenticated reachability deny, server-only caller set과 namespace를 명시한다.
- `mcp_tokens`: anon/authenticated direct table command deny. Token admin route가 site/org consistency를 검증한다. Unscoped legacy env token은 tenant isolation evidence가 아니다.
- `storage.objects`: 기본 제안은 anon/authenticated direct deny + approved service route. Direct-client 요구가 승인되면 별도 path predicate 설계와 검증이 필요하다.

## 8. Service-role surface inventory

### Tenant/admin routes: 21

| Kind | HTTP surface | Methods | Source |
|---|---|---|---|
| direct | `/api/briefing/settings` | GET, POST | `app/api/briefing/settings/route.ts:52-136` |
| direct | `/api/dispatch-logs` | GET, POST | `app/api/dispatch-logs/route.ts:41-208` |
| direct | `/api/education-records` | POST | `app/api/education-records/route.ts:15-56` |
| direct | `/api/workers` | GET, POST | `app/api/workers/route.ts:7-80` |
| direct | `/api/workpacks` | GET, POST | `app/api/workpacks/route.ts:26-229` |
| direct | `/api/workpacks/[id]` | GET | `app/api/workpacks/[id]/route.ts:11-81` |
| direct | `/api/workflow/dispatch` | POST | `app/api/workflow/dispatch/route.ts:218-310` |
| direct | `/api/workpacks/[id]/share-sessions` | GET, POST | `app/api/workpacks/[id]/share-sessions/route.ts:23-154` |
| direct | `/api/workpacks/[id]/read-confirmations` | GET, POST | `app/api/workpacks/[id]/read-confirmations/route.ts:21-145` |
| direct | `/api/workpacks/[id]/improvements` | GET, POST | `app/api/workpacks/[id]/improvements/route.ts:176-338` |
| direct | `/api/workpacks/[id]/operation-graph` | GET | `app/api/workpacks/[id]/operation-graph/route.ts:97-138` |
| direct | `/api/workpacks/[id]/learning-export` | GET | `app/api/workpacks/[id]/learning-export/route.ts:99-141` |
| direct | `/api/knowledge/ingest` | POST | `app/api/knowledge/ingest/route.ts:15-96` |
| direct | `/api/knowledge/regenerate` | POST | `app/api/knowledge/regenerate/route.ts:59-131` |
| direct | `/api/input-photos/hazard-analysis` | POST | `app/api/input-photos/hazard-analysis/route.ts:50-68` |
| direct | `/api/mcp/[transport]` | GET, POST, DELETE | `app/api/mcp/[transport]/route.ts:483-543` |
| direct | `/api/mcp-tokens` | GET, POST | `app/api/mcp-tokens/route.ts:68-253` |
| direct | `/api/mcp-tokens/[id]` | PATCH, DELETE | `app/api/mcp-tokens/[id]/route.ts:49-116` |
| direct | `/api/briefing/run` | GET | `app/api/briefing/run/route.ts:103-149` |
| broker-mediated | `/api/agent/context` | GET | `app/api/agent/context/route.ts:1-9` |
| broker-mediated | `/api/agent/chat` | POST | `app/api/agent/chat/route.ts:1-8` |

`/api/workflow/dispatch` POST는 caller-owned workpack operation context와 active owned share session을 검증하며 `dispatch_logs`를 읽거나 쓰지 않는다. `/api/input-photos/hazard-analysis`에서 GET is public readiness; service-role authentication applies to POST only. GET 근거는 `app/api/input-photos/hazard-analysis/route.ts:46-48`, POST 인증 근거는 `app/api/input-photos/hazard-analysis/route.ts:50-68`이다.

각 service-role route의 postcondition은 같다. 인증이 없거나 broker identity가 유효하지 않으면 privileged client 사용 전에 deny한다. Tenant A identity가 tenant B의 org/site/workpack/worker/share/improvement/token/object ID를 넣으면 존재 여부를 노출하지 않고 deny한다. Tenant A의 정상 ID는 product-required behavior를 유지한다. 이 21 route case는 아직 실행하지 않았다.

### Public/global HTTP surfaces: 11

| Kind | Surface | Postcondition | Source |
|---|---|---|---|
| API | `/api/safety-reference/search` | deliberate public catalog fields only | `app/api/safety-reference/search/route.ts:7-18` |
| API | `/api/safety-reference/status` | sanitized status only | `app/api/safety-reference/status/route.ts:6` |
| API | `/api/ontology/graph` | published, cited graph with published endpoints | `app/api/ontology/graph/route.ts:10-11` |
| API | `/api/ask` | no tenant/admin row leakage | `app/api/ask/route.ts:21` |
| API | `/api/ask/stream` | same boundary as `/api/ask` | `app/api/ask/stream/route.ts:25` |
| API | `/api/workpack/remediate` | no cross-tenant persistence/disclosure | `app/api/workpack/remediate/route.ts:177` |
| Page | `/ask` | global evidence boundary only | `app/ask/page.tsx:13-14` |
| Page | `/ontology` | published, cited ontology only | `app/ontology/page.tsx:35-36` |
| Page | `/evidence` | no tenant/admin data | `app/evidence/page.tsx:9` |
| Page | `/knowledge` | no tenant/admin data | `app/knowledge/page.tsx:140` |
| Page | `/ops/api` | no secrets, credentials, tenant row bodies | `app/ops/api/page.tsx:13` |

## 9. Exact pre/post test matrix

### Fixture contract

- Organization A는 authenticated user A가 소유하고 site A는 organization A에 속한다.
- Organization B는 authenticated user B가 소유하고 site B는 organization B에 속한다.
- `anon`에는 user identity가 없다.
- `service_role` credential은 staging 실행 시에만 주입하며 artifact/log에 기록하지 않는다.
- 모든 fixture에는 `rls-remediation-2026-07-14` tag와 exact cleanup manifest를 둔다.
- Pre와 post는 같은 ID, command, payload shape를 사용한다. 현재 pre/post status는 모두 `not_executed`다.

### Cross-tenant negative matrix

| Direction | Actor | Own tenant | Foreign tenant |
|---|---|---|---|
| A-to-B | `authenticatedA` | organization A / site A | organization B / site B |
| B-to-A | `authenticatedB` | organization B / site B | organization A / site A |

감사 원본의 단방향 inventory는 `14 x 4 = 56`으로 보존한다. 실행 계획은 각 boundary를 두 방향으로 펼쳐 `14 x 2 x 4 = 112` foreign-tenant deny assertions를 만든다. 각 boundary/direction에는 own-tenant control 하나가 있어 `same-tenant positive controls=28`이고, phase별 matrix 총계는 140이다. 모두 `not_executed`다.

| Boundary | 각 actor가 시도할 foreign target / WITH CHECK case | Pre source risk | Post expected | Status |
|---|---|---|---|---|
| `organizations` | foreign organization row, foreign owner_id | owner가 auth predicate | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `sites` | foreign site 또는 foreign organization 아래 새 site | organization ownership boundary | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workers` | foreign worker, own organization + foreign site | site agreement 미검사 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workpacks` | foreign workpack, own organization + foreign site/actor | organization만 검사, attribution 별도 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `education_records` | own organization + foreign workpack/worker/site | related IDs 재소유권 미검사 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `dispatch_logs` | null organization, foreign row, own organization + foreign workpack/site | null branch와 external workpackId | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `daily_entries` | own organization + foreign site/workpack/actor | organization만 검사, FOR ALL | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `knowledge_events` | own organization + foreign daily entry/workpack/site | organization만 검사, FOR ALL | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `knowledge_regeneration_runs` | own organization + foreign scalar relation 또는 foreign/nonexistent raw event | array relation 미강제 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workpack_share_sessions` | own organization + foreign workpack/recipient/site | child read가 workpack only | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workpack_read_confirmations` | own organization + foreign share/worker/workpack | organization만 검사, FOR ALL | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workpack_improvements` | own organization + foreign workpack/site/actor | child/MCP query 추가 scope 필요 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `workpack_improvement_photos` | own organization + foreign improvement/workpack/object prefix | storage live enforcement 미확인 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |
| `storage.objects` | foreign list/read/write/delete, forged prefix, metadata mismatch | policy/grant/owner/reachability 미확인 | 양방향 네 command deny + own control preserve | pre/post `not_executed` |

### WITH CHECK 집중 cases

1. Actor의 own organization과 foreign site/workpack/worker/share/improvement를 하나씩 결합해 INSERT한다.
2. 정상 own row의 organization을 foreign organization으로 바꾸는 UPDATE를 시도한다.
3. Organization은 own으로 유지하고 related ID만 foreign으로 바꾸는 UPDATE를 시도한다.
4. 신뢰하기로 승인된 `created_by`/`approved_by`를 foreign actor로 바꾼다.
5. `dispatch_logs.organization_id`를 null로 INSERT/UPDATE한다.
6. Empty provenance 또는 unpublished endpoint를 가진 ontology row를 published 상태로 전환한다.
7. MCP scope를 null, orphan, 또는 site/org mismatch로 만든다.
8. Storage object path와 metadata tenant를 다르게 만들거나 own object를 foreign prefix로 move한다.

### Role, service-role, public positive/negative controls

- `authenticatedA`: own-tenant required SELECT/INSERT와 승인된 state transition은 allow, foreign tenant 네 command는 deny.
- `authenticatedB`: A와 대칭으로 실행하여 fixture 방향에 따른 우연한 통과를 배제한다.
- `anon`: tenant/operator table은 deny. Deliberate catalog와 완전히 published/cited ontology만 allow.
- `service_role` direct DB call: bypass가 예상되므로 RLS PASS 증거로 세지 않는다. 대신 21 route에서 foreign ID deny와 own ID allow를 확인한다.
- Public 11 surfaces: anon response shape, authenticated context가 public result를 넓히지 않는지, raw tenant/operator fields 부재, error existence leak 부재를 pre/post 비교한다.

## 10. Staging-first, backup, rollback

### 승인 전 준비

1. App revision, migration history, target project ID를 고정하되 credential은 기록하지 않는다.
2. Staging의 policy target role, object/default privilege, table owner, function, FORCE, storage policy metadata를 access-controlled operations record에 보관한다.
3. Encrypted staging backup과 schema-only authorization snapshot을 만들고 restore owner/expiry를 repo 밖에 기록한다.
4. 13 tenant table의 전체/per-organization row count와 public/operator count를 기록한다.
5. Fixture mutation 전에 exact ID cleanup manifest를 만든다.

### Data integrity checks

- `dispatch_logs` null organization rows를 count하고 tenant/operator 의도를 분류한다.
- Organization/site/workpack/worker/share/improvement mismatch count를 read-only로 구한다.
- 모든 `mcp_tokens` site/org pair 일치와 plaintext token 부재를 확인한다.
- Published ontology의 empty provenance와 unpublished endpoint edge를 count한다.
- 승인된 staging access에서 storage metadata와 object prefix ownership을 비교한다.
- 각 batch 전후 non-fixture row count와 per-organization distribution이 같아야 한다.
- 정상 same-tenant row가 orphan되거나 owner에게 조용히 숨겨지면 stop한다.

### Rehearsal order

1. Isolated sanitized staging restore를 검증한다.
2. E 승인 후 tagged A/B fixtures를 만든다.
3. Pre matrix를 실행해 actual 결과를 기록한다. Known weak behavior는 PASS가 아니다.
4. A만 적용하고 policy/public/data-integrity/rollback을 실행한다.
5. B만 적용하고 21 routes와 data integrity를 실행한다.
6. 선택한 access model로 D를 적용·rollback한다.
7. C는 owner/maintenance inventory 뒤 별도로 평가한다.
8. Post matrix, positive controls, rollback, reapply를 모두 마친 뒤 launch gate를 다시 판정한다.

### Rollback

- A: captured policy/role/privilege/function metadata로 staging rollback한다. 진단을 위해 broad access를 열지 않고 fail closed를 우선한다.
- B: prior application commit을 재배포한다. 노출이 증명된 credential만 operations record에 따라 rotate한다.
- C: 실패한 table의 FORCE 상태만 되돌리고 ordinary RLS와 A semantics는 유지한다.
- D: storage policy snapshot과 prior app deployment를 복원하고 tagged object만 정리한다.
- E: exact fixture IDs만 staging에서 제거하고 pre-fixture count와 비교한다. Production cleanup은 금지다.

## 11. Telemetry와 launch gate

Telemetry event 후보는 `tenant_scope_denied`, `service_role_scope_mismatch`, `mcp_scope_binding_rejected`, `storage_scope_mismatch`, `public_shape_violation`, `rls_policy_error`다. Route, method, role class, batch, redacted reason, correlation ID만 남긴다. Authorization header, bearer token, service key, row body, query text, foreign UUID는 남기지 않는다.

다음 중 하나라도 생기면 rollout을 중단한다.

- Cross-tenant command가 row/object를 반환하거나 변경한다.
- Denial이 foreign resource 존재를 드러낸다.
- Required same-tenant/public positive control이 깨진다.
- 계획하지 않은 row-count 또는 relationship-integrity 변화가 생긴다.
- Artifact/log에서 credential-like 값이 발견된다.

Launch PASS 최소 조건은 다음과 같다.

- 10 findings에 승인된 disposition이 있고 launch 시 P1 open이 없다.
- A/B staging rehearsal과 non-fixture data parity가 통과한다.
- C는 enable/defer를 포함한 table별 결정과 owner-path evidence가 있다.
- D access model과 storage cross-tenant denial evidence가 있다.
- 14 boundary cases를 A-to-B/B-to-A로 펼친 112 command assertions가 post에서 실제 실행되어 모두 deny이고, 28개 own-tenant matrix control이 보존된다.
- Same-tenant positive controls, new-row checks, 21 service-role routes, 11 public surfaces가 postcondition을 만족한다.
- Rollback/reapply가 silent row/object loss 없이 staging에서 반복된다.
- Fresh approval에 target revision, evidence, production window, rollback owner, go/no-go가 기록된다.

현재는 위 조건을 충족했다고 주장하지 않는다.

## 12. 기계 검증 계약

Validator: `evaluation/rls-remediation-approval-packet-2026-07-14/validate_packet.py`

Execution log: `evaluation/rls-remediation-approval-packet-2026-07-14/logs/validator.log`

TDD RED log: `evaluation/rls-remediation-approval-packet-2026-07-14/logs/tdd-red.log`

Validator는 다음만 검증한다.

- 감사 원본을 base Git blob에서 읽고 전체 immutable count object를 비교
- 감사 제품 commit, packet base, evidence root, descendant HEAD, 제품 source zero-delta
- Base부터 evidence descendant까지 실제 Git changed path가 evaluation-only 5개 output과 정확히 일치
- 10 finding의 ID/severity/title/table/evidence exact parity
- Finding별 prerequisite, caveat, owner, required approval, finding/batch exact bidirectional set
- 고정된 43개 Git source path set과 line bounds
- 13 tenant CRUD/new-row-check semantics
- Service-role 21 = direct 19 + broker 2, public 11 = API 6 + page 5, 두 route의 method/access 의미
- Immutable audit seed 14 x 4 = 56, executed 0
- Symmetric packet matrix 14 x 2 x 4 = 112 foreign denies + 28 same-tenant controls, executed 0
- Markdown parity와 no-execution 문구
- Report/pseudocode에 executable DDL/DML/privilege/transaction/procedural/psql statement가 없는지

Pre-fix candidate `d77205bb498080ac02b9f506d72bd44648f4a660`에서 expanded RED replay는 exit 1이었다. 13 attacks 중 4개만 reject되고 9개가 잘못 accept됐다. 정확한 결과는 다음과 같다.

- `attack.stale-finding-count=REJECTED errors=1`
- `attack.stale-policy-count-with-mutated-audit=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.missing-approval-flag=REJECTED errors=1`
- `attack.deleted-required-db-approval-action=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.accidental-migration-path=REJECTED errors=2`
- `attack.undeclared-output-path=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.create-policy-pseudocode=REJECTED errors=1`
- `attack.drop-table-pseudocode=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.base-revision-mutation=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.asymmetric-finding-batch-map=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.workflow-dispatch-dispatch-logs-misclassification=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.hazard-get-service-role-misclassification=ACCEPTED_UNEXPECTEDLY errors=0`
- `attack.missing-b-to-a-negative-direction=ACCEPTED_UNEXPECTEDLY errors=0`

Expanded self-test는 위 취약점, B-to-A positive-control 삭제, JSON/Markdown DDL/DML/privilege/procedural/psql 변이를 포함한 25 attacks를 모두 reject하고, quoted explanatory SQL prose control 1개를 accept해야 PASS다. 이 validator PASS도 runtime isolation, DB enforcement, finding closure, 또는 launch readiness를 의미하지 않는다.

Latest local result: baseline `PASS`, attacks rejected `25/25`, explanatory-prose control accepted `1/1`, exit code 0. 실행 출력은 `evaluation/rls-remediation-approval-packet-2026-07-14/logs/validator.log`에 보존한다. `launchReadiness=false`는 변하지 않는다.
