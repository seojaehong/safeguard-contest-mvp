type LabelMap = Readonly<Record<string, string>>;

const SIF_GATE_LABELS: LabelMap = {
  "apply-sif-only-migration": "SIF 전용 마이그레이션 적용",
  "prepare-runtime-env": "운영 환경 준비",
  "approve-embedding-generation": "임베딩 생성 승인",
  "approve-upload": "업로드 승인",
  "enable-vector-search": "벡터 검색 활성화",
  "disable-vector-flag": "벡터 검색 플래그 비활성화",
  complete: "완료"
};

const SIF_RUNTIME_STATUS_LABELS: LabelMap = {
  "migration-required": "마이그레이션 필요",
  verified_without_db_mutation: "DB 변경 없이 검증됨",
  "not-run": "미실행",
  unknown: "상태 확인 필요",
  unavailable: "사용할 수 없음",
  ready: "준비됨",
  complete: "완료",
  blocked: "차단됨",
  ok: "정상",
  error: "오류"
};

const SIF_CANARY_MODE_LABELS: LabelMap = {
  "embed-only": "임베딩만 생성",
  "corpus-only": "코퍼스만 준비",
  "upload-only": "업로드만 수행",
  full: "전체 실행",
  "not-run": "미실행"
};

const SIF_OPERATOR_GATE_STATUS_LABELS: LabelMap = {
  "approval-request-open": "승인 요청 열림",
  blocked: "차단됨",
  "ready-to-execute": "실행 준비됨",
  complete: "완료"
};

const SIF_CHECKLIST_STATUS_LABELS: LabelMap = {
  done: "완료",
  required: "확인 필요",
  blocked: "차단됨"
};

const SIF_APPROVAL_STEP_STATUS_LABELS: LabelMap = {
  done: "완료",
  ready: "가능",
  blocked: "대기",
  waiting: "승인 전"
};

const SIF_APPROVAL_DECISION_LABELS: LabelMap = {
  "Approve and apply the SIF-only embedding migration, or explicitly choose the broader 010_commercial_operations.sql gate.":
    "SIF 전용 임베딩 마이그레이션 적용을 승인하거나 010_commercial_operations.sql 범위를 명시적으로 선택합니다.",
  "Confirm OPENAI_API_KEY and Supabase service role are available in the execution environment.":
    "실행 환경에서 OPENAI_API_KEY와 Supabase 서비스 역할을 사용할 수 있는지 확인합니다.",
  "Run embedding generation only with --embed --approved-embedding.":
    "임베딩 생성은 --embed --approved-embedding 승인 플래그로만 실행합니다.",
  "Run embedding upload only with --embed --approved-embedding --upload --approved-upload.":
    "임베딩 업로드는 --embed --approved-embedding --upload --approved-upload 승인 플래그로만 실행합니다.",
  "Verify uploaded row count equals 6032 before enabling SAFETY_REFERENCE_VECTOR_SEARCH=1.":
    "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화 전에 업로드 행 수가 6,032건인지 확인합니다.",
  "Enable runtime vector retrieval after RPC smoke test passes.":
    "RPC 연결 점검을 통과한 뒤 운영 벡터 검색을 활성화합니다."
};

const SIF_ARTIFACT_LABELS: LabelMap = {
  "Preflight report": "사전 점검 보고서",
  "Batch manifest": "배치 목록",
  "SIF corpus JSONL": "SIF 코퍼스 JSONL",
  "SIF-only migration": "SIF 전용 마이그레이션",
  "Canary report": "소규모 검증 보고서",
  "Canary manifest": "소규모 검증 배치 목록",
  "Canary corpus": "소규모 검증 코퍼스",
  "Canary vectors": "소규모 검증 벡터"
};

const SIF_PREFLIGHT_LABELS: LabelMap = {
  sif_source_count: "SIF 원본과 코퍼스 수량 확인",
  manifest_matches_report: "배치 목록과 보고서 일치",
  corpus_jsonl_matches_report: "JSONL 코퍼스 라인 수 확인",
  corpus_quality_gate: "빈 텍스트/관리대책/중복 품질 게이트",
  no_embedding_generated_yet: "승인 전 임베딩 미생성",
  embedding_requires_explicit_cost_approval_flag: "임베딩 비용 승인 플래그 필요",
  upload_requires_explicit_approval_flag: "업로드 승인 플래그 필요",
  migration_contains_embedding_table_rpc_index: "마이그레이션에 테이블/RPC/인덱스 포함",
  migration_keeps_embeddings_server_side: "임베딩은 서버 측에서만 조회",
  migration_scope_is_sif_embedding_only: "SIF 전용 마이그레이션 범위 확인",
  vector_feature_flag_stays_off_until_upload_verified: "업로드 검증 전 벡터 기능 플래그 잠금"
};

const SIF_EXACT_TEXT_LABELS: LabelMap = {
  "Canary 임베딩 완료 · 업로드 전": "소규모 검증 임베딩 완료 · 업로드 전",
  "Canary 임베딩 미실행": "소규모 검증 임베딩 미실행",
  "Vector 검색 차단": "벡터 검색 차단",
  "Vector 검색 활성": "벡터 검색 활성",
  "Vector 검색 활성 대기": "벡터 검색 활성 대기",
  "Vector 검색 잠금": "벡터 검색 잠금",
  "Vector feature flag 끄기": "벡터 검색 기능 플래그 끄기",
  "SIF-only DB migration 승인": "SIF 전용 DB 마이그레이션 승인",
  "Vector 검색 활성 승인": "벡터 검색 활성 승인",
  "SIF vector gate 완료": "SIF 벡터 승인 단계 완료",
  "Vector flag 차단": "벡터 기능 플래그 차단",
  "SIF vector 검색 활성": "SIF 벡터 검색 활성",
  "Vector 활성 승인 대기": "벡터 활성 승인 대기",
  "다음 승인 게이트가 열려 있습니다.": "다음 승인 단계가 열려 있습니다.",
  "SIF-only migration SQL을 운영 DB에 적용해도 되는지 승인해야 합니다.":
    "SIF 전용 마이그레이션 SQL을 운영 DB에 적용해도 되는지 승인해야 합니다.",
  "승인 패킷과 migration SQL diff 검토": "승인 패킷과 마이그레이션 SQL 변경 내용 검토",
  "runtime DB probe 재실행": "운영 DB 점검 재실행",
  "코퍼스/manifest/hash 재검증": "코퍼스/배치 목록/해시 재검증",
  "운영 DB migration 적용": "운영 DB 마이그레이션 적용",
  "Preflight 통과": "사전 점검 통과",
  "Canary embed-only 확인": "소규모 검증 임베딩 확인",
  "운영 DB migration 필요성 확인": "운영 DB 마이그레이션 필요성 확인",
  "Post-migration verifier 준비": "마이그레이션 후 검증 준비",
  "승인된 SIF-only migration을 운영 DB에 적용합니다.": "승인된 SIF 전용 마이그레이션을 운영 DB에 적용합니다.",
  "runtime probe로 table/RPC readiness를 다시 확인합니다.": "운영 DB 점검으로 테이블/RPC 준비 상태를 다시 확인합니다.",
  "--upload --approved-upload으로 DB upsert 후 row count를 검증합니다.": "--upload --approved-upload으로 DB upsert 후 행 수를 검증합니다.",
  "post-migration verifier로 row count, metadata sample, RPC smoke를 검증합니다.":
    "마이그레이션 후 검증으로 행 수, 메타데이터 표본, RPC 연결을 확인합니다.",
  "RPC smoke test 통과 후에만 SAFETY_REFERENCE_VECTOR_SEARCH=1을 켭니다.":
    "RPC 연결 점검 통과 후에만 SAFETY_REFERENCE_VECTOR_SEARCH=1을 켭니다.",
  "승인이 없으면 기존 safety_reference_items 기반 REST/ranked 검색 경로를 유지하고 vector retrieval은 계속 꺼둡니다.":
    "승인이 없으면 기존 safety_reference_items 기반 REST/순위 검색 경로를 유지하고 벡터 검색은 계속 꺼둡니다.",
  "SIF embedding table/RPC is not ready on the target DB. Apply approved migration before upload.":
    "SIF 임베딩 테이블과 RPC가 준비되지 않았습니다. 승인된 마이그레이션을 적용한 뒤 업로드해야 합니다.",
  "Apply the approved SIF-only migration before upload verification.":
    "승인된 SIF 전용 마이그레이션을 적용한 뒤 업로드 검증을 실행해야 합니다.",
  "임베딩 생성과 DB 업로드가 승인 전 보류되어 있으므로 vector 검색은 꺼진 상태를 유지합니다.":
    "임베딩 생성과 DB 업로드가 승인 전 보류되어 있으므로 벡터 검색은 꺼진 상태를 유지합니다.",
  "업로드 수량이 코퍼스와 일치해 runtime vector 검색을 사용할 수 있는 상태입니다.":
    "업로드 수량이 코퍼스와 일치해 운영 벡터 검색을 사용할 수 있는 상태입니다.",
  "업로드 검증이 끝났습니다. RPC smoke test 후 feature flag를 켤 수 있습니다.":
    "업로드 검증이 끝났습니다. RPC 연결 점검 후 기능 플래그를 켤 수 있습니다.",
  "업로드 수량 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 감지됐습니다. flag를 끄고 row count/RPC smoke test 후 다시 켜야 합니다.":
    "업로드 수량 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 감지됐습니다. 기능 플래그를 끄고 행 수/RPC 연결 점검 후 다시 켜야 합니다.",
  "SIF 코퍼스와 배치 manifest는 준비됐고, 임베딩 생성과 DB 업로드는 승인 전 보류 상태입니다.":
    "SIF 코퍼스와 배치 목록은 준비됐고, 임베딩 생성과 DB 업로드는 승인 전 보류 상태입니다.",
  "SIF 임베딩 승인 게이트 점검이 필요합니다.": "SIF 임베딩 승인 단계 점검이 필요합니다.",
  "승인 전 canary 임베딩 검증 산출물이 없습니다.": "승인 전 소규모 검증 임베딩 산출물이 없습니다.",
  "운영 DB에 safety_reference_embeddings table 또는 match_safety_reference_embeddings RPC가 없어 업로드 전 migration 승인이 먼저 필요합니다.":
    "운영 DB에 safety_reference_embeddings 테이블 또는 match_safety_reference_embeddings RPC가 없어 업로드 전 마이그레이션 승인이 먼저 필요합니다.",
  "SIF-only migration SQL을 승인 후 적용합니다.": "SIF 전용 마이그레이션 SQL을 승인 후 적용합니다.",
  "업로드 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 켜져 있어 runtime vector 검색을 차단했습니다.":
    "업로드 검증 전 SAFETY_REFERENCE_VECTOR_SEARCH=1이 켜져 있어 운영 벡터 검색을 차단했습니다.",
  "SAFETY_REFERENCE_VECTOR_SEARCH를 끄고 runtime probe를 다시 확인합니다.":
    "SAFETY_REFERENCE_VECTOR_SEARCH를 끄고 운영 DB 점검을 다시 확인합니다.",
  "DB runtime 표면은 준비됐지만 OpenAI key 또는 Supabase service role 확인이 필요합니다.":
    "DB 운영 표면은 준비됐지만 OpenAI 키 또는 Supabase 서비스 역할 확인이 필요합니다.",
  "OPENAI_API_KEY, Supabase URL, service role을 확인한 뒤 임베딩 생성 승인을 진행합니다.":
    "OPENAI_API_KEY, Supabase URL, 서비스 역할을 확인한 뒤 임베딩 생성 승인을 진행합니다.",
  "코퍼스와 DB runtime 표면이 준비됐습니다. 비용 발생 단계이므로 명시 승인 후에만 실행합니다.":
    "코퍼스와 DB 운영 표면이 준비됐습니다. 비용 발생 단계이므로 명시 승인 후에만 실행합니다.",
  "임베딩 벡터가 생성됐지만 DB row count 검증이 끝나지 않았습니다.":
    "임베딩 벡터가 생성됐지만 DB 행 수 검증이 끝나지 않았습니다.",
  "업로드 승인 플래그로 DB upsert 후 row count를 검증합니다.":
    "업로드 승인 플래그로 DB upsert 후 행 수를 검증합니다.",
  "업로드 수량 검증이 끝났습니다. RPC smoke test 후 feature flag를 켤 수 있습니다.":
    "업로드 수량 검증이 끝났습니다. RPC 연결 점검 후 기능 플래그를 켤 수 있습니다.",
  "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화 전 smoke test를 실행합니다.":
    "SAFETY_REFERENCE_VECTOR_SEARCH=1 활성화 전 연결 점검을 실행합니다.",
  "SIF vector retrieval 승인 게이트가 완료된 상태입니다.":
    "SIF 벡터 검색 승인 단계가 완료된 상태입니다.",
  "업로드 검증 전 vector 검색 flag가 켜져 있어 승인 게이트가 차단된 상태입니다.":
    "업로드 검증 전 벡터 검색 기능 플래그가 켜져 있어 승인 단계가 차단된 상태입니다.",
  "SIF 임베딩 생성, DB 업로드, vector 검색 활성화가 모두 끝난 상태입니다.":
    "SIF 임베딩 생성, DB 업로드, 벡터 검색 활성화가 모두 끝난 상태입니다.",
  "SIF 임베딩과 DB 업로드는 검증됐고, vector 검색 flag 활성 승인만 남았습니다.":
    "SIF 임베딩과 DB 업로드는 검증됐고, 벡터 검색 기능 플래그 활성 승인만 남았습니다.",
  "DB 표면은 준비됐지만 OpenAI key 또는 Supabase service role 확인 전이라 임베딩 실행을 보류합니다.":
    "DB 표면은 준비됐지만 OpenAI 키 또는 Supabase 서비스 역할 확인 전이라 임베딩 실행을 보류합니다.",
  "SIF 임베딩 벡터는 생성됐지만 DB 업로드와 row count 검증이 아직 끝나지 않았습니다.":
    "SIF 임베딩 벡터는 생성됐지만 DB 업로드와 행 수 검증이 아직 끝나지 않았습니다.",
  "SIF 코퍼스 임베딩, DB 업로드, vector 검색 활성화가 끝났습니다.":
    "SIF 코퍼스 임베딩, DB 업로드, 벡터 검색 활성화가 끝났습니다.",
  "SIF 임베딩 DB row count는 검증됐고, vector 검색 flag 활성 승인만 남았습니다.":
    "SIF 임베딩 DB 행 수는 검증됐고, 벡터 검색 기능 플래그 활성 승인만 남았습니다.",
  "SIF 임베딩 벡터는 생성됐지만 운영 DB 업로드와 row count 검증은 아직입니다.":
    "SIF 임베딩 벡터는 생성됐지만 운영 DB 업로드와 행 수 검증은 아직입니다.",
  "1. SIF-only DB migration 승인": "1. SIF 전용 DB 마이그레이션 승인",
  "운영 DB에서 safety_reference_embeddings table과 match RPC를 확인했습니다.":
    "운영 DB에서 safety_reference_embeddings 테이블과 match RPC를 확인했습니다.",
  "비용이 발생하는 단계라 --approved-embedding flag 없이는 실행하지 않습니다.":
    "비용이 발생하는 단계라 --approved-embedding 플래그 없이는 실행하지 않습니다.",
  "DB migration 적용과 runtime key 확인 후 진행합니다.": "DB 마이그레이션 적용과 운영 키 확인 후 진행합니다.",
  "3. 업로드와 row count 검증": "3. 업로드와 행 수 검증",
  "업로드 후 코퍼스 수량과 DB row count가 같아야 합니다.": "업로드 후 코퍼스 수량과 DB 행 수가 같아야 합니다.",
  "4. Vector 검색 flag": "4. 벡터 검색 기능 플래그",
  "canary 배치 수량과 corpus hash를 확인합니다.": "소규모 검증 배치 수량과 코퍼스 해시를 확인합니다.",
  "canary 임베딩 입력 텍스트를 검토합니다.": "소규모 검증 임베딩 입력 텍스트를 검토합니다.",
  "임베딩 배치 수량과 corpus hash를 고정합니다.": "임베딩 배치 수량과 코퍼스 해시를 고정합니다.",
  "운영 DB에 필요한 table, RPC, index 범위만 승인합니다.":
    "운영 DB에 필요한 테이블, RPC, 인덱스 범위만 승인합니다."
};

const SIF_SAFE_PHRASE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["건 canary 임베딩 벡터", "건 소규모 검증 임베딩 벡터"],
  ["SIF-only migration SQL", "SIF 전용 마이그레이션 SQL"],
  ["SIF-only DB migration", "SIF 전용 DB 마이그레이션"],
  ["DB row count", "DB 행 수"],
  ["row count", "행 수"],
  ["feature flag", "기능 플래그"],
  ["모델 파인튜닝도 전체 임베딩 생성도", "모델 가중치 변경이나 전체 임베딩 생성도"],
  ["모델 파인튜닝", "모델 가중치 변경"],
  ["파인튜닝", "모델 가중치 변경"],
  ["학습된 코퍼스", "검증 코퍼스"],
  ["vector 검색", "벡터 검색"],
  ["vector retrieval", "벡터 검색"],
  ["OpenAI key", "OpenAI 키"],
  ["Supabase service role", "Supabase 서비스 역할"],
  ["service role", "서비스 역할"],
  ["runtime key", "운영 키"],
  ["runtime 표면", "운영 표면"],
  ["corpus hash", "코퍼스 해시"],
  ["migration SQL", "마이그레이션 SQL"],
  ["manifest와", "목록과"],
  ["manifest는", "목록은"],
  ["table과", "테이블과"],
  ["table,", "테이블,"],
  ["RPC smoke test", "RPC 연결 점검"],
  ["RPC smoke", "RPC 연결 점검"]
];

const ARCHIVE_STATUS_LABELS: LabelMap = {
  checking: "확인 중",
  ready: "준비됨",
  partial: "일부 확인",
  empty: "기록 없음",
  "login-required": "로그인 필요",
  unconfigured: "연결 설정 필요",
  error: "오류"
};

const DISPATCH_PROVIDER_STATUS_LABELS: LabelMap = {
  sent: "전송 완료",
  delivered: "전달 완료",
  accepted: "접수 완료",
  queued: "전송 대기",
  pending: "전송 대기",
  partial: "일부 전송",
  unconfigured: "서비스 설정 필요",
  rejected: "요청 거절",
  failed: "전송 실패",
  error: "전송 오류",
  fixture: "점검용 전송",
  "validation-only": "검증만 수행",
  "idempotency-unsupported": "중복 방지 확인 필요",
  "provider-response-uncertain": "전송 결과 확인 필요"
};

const DISPATCH_PROVIDER_LABELS: LabelMap = {
  n8n: "전송 자동화",
  "safe-fixture": "점검용 전송 서비스",
  "solapi-alimtalk": "알림톡 전송 서비스",
  twilio: "문자 전송 서비스",
  sendgrid: "이메일 전송 서비스",
  "latest-sms": "문자 전송 서비스"
};

const DISPATCH_CHANNEL_LABELS: LabelMap = {
  email: "이메일",
  sms: "문자",
  kakao: "카카오 알림톡",
  alimtalk: "카카오 알림톡",
  band: "밴드",
  slack: "협업 채널",
  discord: "협업 채널"
};

const DISPATCH_LANGUAGE_LABELS: LabelMap = {
  ko: "한국어",
  en: "영어",
  vi: "베트남어",
  zh: "중국어",
  ja: "일본어",
  th: "태국어"
};

const DRYRUN_QUALITY_NOTE_LABELS: LabelMap = {
  "All document dry-run cases returned output, but quality may still be generic.":
    "모든 문서 생성 점검이 응답을 반환했지만, 내용은 추가 검토가 필요합니다.",
  "One or more document dry-run cases failed or returned weak output.":
    "문서 생성 점검 중 실패했거나 응답이 부족한 사례가 있습니다."
};

const CUSTOMER_FACING_LABELS: LabelMap = {
  "SafeClaw Harness Agent": "SafeClaw 근거 고정",
  "DB 하네스 계약": "검증 근거",
  "관리자 원본 JSON": "현재 조회 결과 데이터",
  "다음 생성용 MD": "재사용 검토 문서",
  "하네스 JSONL": "재사용 검토 데이터",
  "Obsidian MD": "연결형 작업 메모",
  "작업 이력 MD": "작업 이력 문서"
};

const CUSTOMER_FACING_PHRASES: ReadonlyArray<readonly [string, string]> = [
  ["MD/JSONL export", "재사용 검토 파일"],
  ["MD/JSONL 내보내기", "재사용 검토 파일"],
  ["하네스 JSONL", "재사용 검토 데이터"],
  ["DB/MCP 하네스", "검증 체계"],
  ["DB/MCP", "검증 체계"],
  ["source ID", "근거 출처"],
  ["DB 하네스 근거", "검증 근거"],
  ["품질 계약을", "품질 검수를"],
  ["DB 하네스", "검증 체계"],
  ["품질 계약", "품질 검수"]
];

const PHOTO_FILE_VALIDATION_MODE_LABELS: LabelMap = {
  signature_only: "파일 시그니처 확인"
};

const PHOTO_FLOW_STEP_LABELS: LabelMap = {
  attach: "1단계",
  analyze: "2단계",
  ground: "3단계",
  review: "4단계",
  export: "5단계"
};

const PHOTO_FLOW_LABELS: LabelMap = {
  attach: "현장 사진 첨부",
  analyze: "사진 분석/OCR 후보 도출",
  ground: "검증 근거 확정",
  review: "사용자 채택·기각",
  export: "운영 메모리 보존"
};

export type DryrunPresentationHighlight = {
  id: string;
  label: string;
  ok: boolean;
  answerPreview: string;
  elapsedMs: number;
  answerLength: number;
  citations: number;
};

export type DryrunPresentationSnapshot = {
  runId: string;
  okCount: number;
  totalRuns: number;
  avgMs: number;
  p95Ms: number;
  qualityNote: string;
  summaryPath: string;
  reportPath: string;
  highlights: DryrunPresentationHighlight[];
};

export type PhotoFlowPresentation = {
  key: string;
  step: string;
  label: string;
  detail: string;
};

export type PhotoVisionPresentationPayload = {
  ok: boolean;
  status: unknown;
  model: string;
  maxInputPhotos: unknown;
  fileValidationMode: unknown;
  acceptedOnly: boolean;
  ocrSupported: boolean;
  flow: unknown;
  hazardAnalysisMethod: string;
  hazardAnalysisEndpoint: string;
  improvementEndpointPattern: string;
  exportTargets: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function readFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMappedValue(value: unknown, labels: LabelMap, fallback: string): string {
  const text = readNonEmptyString(value);
  return text ? labels[text] ?? fallback : fallback;
}

export function formatSifGateIdForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_GATE_LABELS, "상태 확인 필요");
}

export function formatSifRuntimeStatusForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_RUNTIME_STATUS_LABELS, "상태 확인 필요");
}

export function formatSifCanaryModeForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_CANARY_MODE_LABELS, "분류 검토 필요");
}

export function formatSifOperatorGateStatusForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_OPERATOR_GATE_STATUS_LABELS, "상태 확인 필요");
}

export function formatSifChecklistStatusForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_CHECKLIST_STATUS_LABELS, "상태 확인 필요");
}

export function formatSifApprovalStepStatusForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_APPROVAL_STEP_STATUS_LABELS, "상태 확인 필요");
}

export function formatSifApprovalDecisionForPresentation(value: unknown): string {
  return formatMappedValue(value, SIF_APPROVAL_DECISION_LABELS, "결정 내용 확인 필요");
}

export function formatSifArtifactLabelForPresentation(value: unknown): string {
  const text = readNonEmptyString(value);
  return text ? SIF_ARTIFACT_LABELS[text] ?? formatSifTextForPresentation(text) : "산출물 확인 필요";
}

export function formatSifPreflightLabelForPresentation(id: unknown, label: unknown): string {
  const key = readNonEmptyString(id);
  if (key && SIF_PREFLIGHT_LABELS[key]) return SIF_PREFLIGHT_LABELS[key];
  return formatSifTextForPresentation(label, "점검 항목 확인 필요");
}

export function formatSifTextForPresentation(value: unknown, fallback = "상태 확인 필요"): string {
  const text = readNonEmptyString(value);
  if (!text) return fallback;

  const exactLabel = SIF_EXACT_TEXT_LABELS[text];
  if (exactLabel) return exactLabel;

  const canaryEvidence = /^Canary는 ([\d,]+)건 embed-only로 확인했고 DB 업로드는 ([\d,]+)건입니다\.$/u.exec(text);
  if (canaryEvidence) {
    return `소규모 검증은 ${canaryEvidence[1]}건 임베딩만 생성 방식으로 확인했고 DB 업로드는 ${canaryEvidence[2]}건입니다.`;
  }

  const runtimeEvidence = /^Runtime DB probe는 ([^ ]+)이며 table (ready|missing), RPC (ready|missing)입니다\.$/u.exec(text);
  if (runtimeEvidence) {
    return `운영 DB 점검은 ${formatSifRuntimeStatusForPresentation(runtimeEvidence[1])}이며 테이블 ${runtimeEvidence[2] === "ready" ? "준비됨" : "없음"}, RPC ${runtimeEvidence[3] === "ready" ? "준비됨" : "없음"}입니다.`;
  }

  const verifierEvidence = /^Post-migration verifier는 ([^ ]+)이며 업로드 ([\d,]+) \/ ([\d,]+)건을 보고합니다\.$/u.exec(text);
  if (verifierEvidence) {
    return `마이그레이션 후 검증은 ${formatSifRuntimeStatusForPresentation(verifierEvidence[1])}이며 업로드 ${verifierEvidence[2]} / ${verifierEvidence[3]}건을 보고합니다.`;
  }

  const verifierPath = /^(evaluation[\\/].+) · 현재 ([^ ]+)$/u.exec(text);
  if (verifierPath) {
    return `${verifierPath[1]} · 현재 ${formatSifRuntimeStatusForPresentation(verifierPath[2])}`;
  }

  const localized = SIF_SAFE_PHRASE_REPLACEMENTS.reduce(
    (localized, [source, replacement]) => localized.replaceAll(source, replacement),
    text
  );
  return localized.replace(
    /로 corpus hash, 모델\/차원, migration SQL을 고정합니다\.$/u,
    "로 코퍼스 해시, 모델/차원, 마이그레이션 SQL을 고정합니다."
  );
}

export function formatArchiveStatus(value: unknown): string {
  return formatMappedValue(value, ARCHIVE_STATUS_LABELS, "상태 확인 필요");
}

export function formatDispatchProviderStatus(value: unknown): string {
  if (value === null || value === undefined || value === "") return "결과 확인 필요";
  return formatMappedValue(value, DISPATCH_PROVIDER_STATUS_LABELS, "상태 확인 필요");
}

export function formatDispatchProvider(value: unknown): string {
  if (value === null || value === undefined || value === "") return "전송 서비스 미기록";
  return formatMappedValue(value, DISPATCH_PROVIDER_LABELS, "분류 검토 필요");
}

export function formatDispatchChannel(value: unknown): string {
  return formatMappedValue(value, DISPATCH_CHANNEL_LABELS, "분류 검토 필요");
}

export function formatDispatchLanguage(value: unknown): string {
  if (value === null || value === undefined || value === "") return "언어 미기록";
  return formatMappedValue(value, DISPATCH_LANGUAGE_LABELS, "분류 검토 필요");
}

export function formatDispatchFailureReason(value: unknown): string {
  return value === null || value === undefined || value === "" ? "" : "실패 사유 확인 필요";
}

export function formatWorkflowRunId(value: unknown): string {
  const runId = readNonEmptyString(value);
  return runId ? `실행 ID ${runId}` : "실행 기록 없음";
}

export function formatDryrunQualityNote(value: unknown): string {
  if (value === null || value === undefined || value === "") return "최근 점검 결과가 없습니다.";
  return formatMappedValue(value, DRYRUN_QUALITY_NOTE_LABELS, "상태 확인 필요");
}

export function formatCustomerFacingLabel(value: string): string {
  return CUSTOMER_FACING_LABELS[value] ?? value;
}

export function formatCustomerFacingText(value: string): string {
  return CUSTOMER_FACING_PHRASES.reduce(
    (text, [operational, customerFacing]) => text.replaceAll(operational, customerFacing),
    value
  );
}

export function toDryrunPresentationSnapshot(value: unknown): DryrunPresentationSnapshot | null {
  if (!isRecord(value)) return null;
  const highlights = Array.isArray(value.highlights)
    ? value.highlights.flatMap((item, index): DryrunPresentationHighlight[] => {
        if (!isRecord(item)) return [];
        return [{
          id: readNonEmptyString(item.id) ?? `case-${index + 1}`,
          label: readNonEmptyString(item.label) ?? "케이스 이름 확인 필요",
          ok: item.ok === true,
          answerPreview: readNonEmptyString(item.answerPreview) ?? "미리보기 없음",
          elapsedMs: readFiniteNumber(item.elapsedMs),
          answerLength: readFiniteNumber(item.answerLength),
          citations: readFiniteNumber(item.citations)
        }];
      })
    : [];

  return {
    runId: readNonEmptyString(value.runId) ?? "실행 ID 확인 필요",
    okCount: readFiniteNumber(value.okCount),
    totalRuns: readFiniteNumber(value.totalRuns),
    avgMs: readFiniteNumber(value.avgMs),
    p95Ms: readFiniteNumber(value.p95Ms),
    qualityNote: formatDryrunQualityNote(value.qualityNote),
    summaryPath: readNonEmptyString(value.summaryPath) ?? "경로 확인 필요",
    reportPath: readNonEmptyString(value.reportPath) ?? "경로 확인 필요",
    highlights
  };
}

export function formatPhotoInputLimit(value: unknown): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return "첨부 한도 확인 필요";
  }
  return `${value.toLocaleString("ko-KR")}장`;
}

export function formatPhotoFileValidationMode(value: unknown): string {
  return formatMappedValue(value, PHOTO_FILE_VALIDATION_MODE_LABELS, "분류 검토 필요");
}

export function formatPhotoVisionStatus(value: unknown): string {
  if (value === "ready") return "사진 분석/OCR 실행 환경이 준비되어 있습니다.";
  if (value === "unconfigured") {
    return "OPENAI_API_KEY가 없어 사진은 첨부·저장되지만 사진 분석/OCR은 보류됩니다.";
  }
  return "상태 확인 필요";
}

function fallbackPhotoFlow(index: number): PhotoFlowPresentation {
  return {
    key: `unknown-${index}`,
    step: "상태 확인 필요",
    label: "흐름 정보 확인 필요",
    detail: "사진 분석/OCR 흐름을 확인해야 합니다."
  };
}

function photoFlowDetail(step: string, maxInputPhotos: unknown): string {
  if (step === "attach") {
    const limit = formatPhotoInputLimit(maxInputPhotos);
    return limit === "첨부 한도 확인 필요"
      ? "입력 화면의 첨부 허용 수량을 확인해야 합니다."
      : `입력 화면의 첨부 기능에서 최대 ${limit}까지 받습니다.`;
  }
  if (step === "analyze") return "OpenAI Responses API가 관찰 내용과 추론을 분리한 위험 후보만 구조화합니다.";
  if (step === "ground") return "SafeClaw 검증 체계가 후보별 근거 출처와 현장 통제를 확정하거나 근거 부족으로 잠급니다.";
  if (step === "review") return "검증된 후보를 사용자가 채택하거나 기각하고, 채택한 항목만 개선 메모리에 들어갑니다.";
  if (step === "export") return "채택된 후보와 개선 전/개선 후 사항은 재사용 검토 파일과 다음 검증 입력에 보존됩니다.";
  return "사진 분석/OCR 흐름을 확인해야 합니다.";
}

export function buildPhotoFlowPresentation(flow: unknown, maxInputPhotos: unknown): PhotoFlowPresentation[] {
  if (!Array.isArray(flow) || flow.length === 0) return [fallbackPhotoFlow(0)];
  return flow.map((item, index) => {
    if (!isRecord(item)) return fallbackPhotoFlow(index);
    const step = readNonEmptyString(item.step);
    if (!step || !PHOTO_FLOW_STEP_LABELS[step] || !PHOTO_FLOW_LABELS[step]) {
      return fallbackPhotoFlow(index);
    }
    return {
      key: `${step}-${index}`,
      step: PHOTO_FLOW_STEP_LABELS[step],
      label: PHOTO_FLOW_LABELS[step],
      detail: photoFlowDetail(step, maxInputPhotos)
    };
  });
}

export function readPhotoVisionPresentationPayload(value: unknown): PhotoVisionPresentationPayload | null {
  if (!isRecord(value)) return null;
  const fileValidation = isRecord(value.fileValidation) ? value.fileValidation : {};
  const exportTargets = Array.isArray(value.exportTargets)
    ? value.exportTargets.flatMap((item): string[] => {
        const target = readNonEmptyString(item);
        return target ? [formatCustomerFacingText(formatCustomerFacingLabel(target))] : [];
      })
    : [];

  return {
    ok: value.ok === true,
    status: value.status,
    model: readNonEmptyString(value.model) ?? "모델 확인 필요",
    maxInputPhotos: value.maxInputPhotos,
    fileValidationMode: fileValidation.mode,
    acceptedOnly: value.acceptedOnly === true,
    ocrSupported: value.ocrSupported === true,
    flow: value.flow,
    hazardAnalysisMethod: readNonEmptyString(value.hazardAnalysisMethod) ?? "요청 방식 확인 필요",
    hazardAnalysisEndpoint: readNonEmptyString(value.hazardAnalysisEndpoint) ?? "경로 확인 필요",
    improvementEndpointPattern: readNonEmptyString(value.improvementEndpointPattern) ?? "경로 확인 필요",
    exportTargets
  };
}
