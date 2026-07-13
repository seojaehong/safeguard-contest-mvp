# SafeClaw Workpack Document Editors v2

- 상태: implementation-ready design contract
- 기준일: 2026-07-13
- 기준 커밋: `d3ad86530bc786d8024206cc5b7c7db60c055278`
- 대상: `/documents`의 `WorkpackEditor` 12종 문서 편집 경험
- 산출물 소유 범위: 이 계약과 동등한 `spec.json`만

## 1. 결정 요약

현재 화면은 12개 `documentMeta` 항목, 데스크톱 탭, 모바일 선택기, 공통 `tabpanel`, 단일 `textarea`를 제공한다. 1440x1000과 390x844에서 잘리지 않는 것은 유지해야 할 geometry baseline이지만, 문서별 필드·행·검증·상호작용이 없으므로 문서별 편집기로 간주하지 않는다.

v2는 다음을 계약한다.

1. `input -> documents -> share` 흐름은 유지한다.
2. Wave 1에서 `위험성평가표`, `TBM/작업 전 안전점검회의`, `TBM 기록`을 실제 구조화 편집기로 만든다.
3. 12개 문서는 각각 별도 `DocumentEditorSpec`과 typed state를 가진다.
4. 12개 React 컴포넌트를 복제하지 않는다. 도메인 구조가 같은 부분만 primitive로 공유하고, 문서별 wrapper가 필드·검증·명령을 조합한다.
5. 근거 인용은 접힌 보조 패널에만 두지 않는다. 관련 필드와 행 옆에 항상 보이는 인용 요약을 둔다. SIF(중대사고 사례) -> KOSHA Guide(기술 지침) -> 법령(반드시 지켜야 하는 기준)의 출처 역할을 구분한다.
6. 개선조치는 Before/After 사진 쌍, 작업자 이해 확인, 공유 후 열람 확인과 연결한다. 전송 완료와 열람 확인은 같은 상태로 취급하지 않는다.
7. DB, 스키마, migration은 변경하지 않는다. 기존 string deliverable과 localStorage를 v2 draft로 올리는 adapter를 두고, 현재 저장·내보내기 계약에는 deterministic projection으로 연결한다.
8. Day/Night를 동등하게 지원하고, 모든 조작 컨트롤은 최소 44px, 인접 컨트롤 간격은 최소 8px로 한다. 페이지 수평 overflow, 장식용 중첩 카드, hover 전용 조작을 금지한다.

## 2. 현재 코드 근거

### 2.1 편집 표면

- `components/WorkpackEditor.tsx:19-33`: 12개 `DocumentKey`와 `Record<DocumentKey, string>`만 존재한다.
- `components/WorkpackEditor.tsx:158-231`: 12개 메타데이터는 제목·설명·파일명만 바꾼다.
- `components/WorkpackEditor.tsx:1670-1710`: 로컬 편집본은 `StoredEditorDraft` version 1의 string map과 `dirtyKeys`이다.
- `components/WorkpackEditor.tsx:1900-2170`: 모든 문서는 같은 `values`, 같은 dirty 처리, 같은 자동 저장 경로를 쓴다.
- `components/WorkpackEditor.tsx:2552-2647`: 하나의 `tabpanel` 안에서 제목만 바뀌고 하나의 `textarea`를 렌더링한다.
- `components/WorkpackEditor.module.css:1-205`: 2열 workbench와 단일 textarea geometry가 정의돼 있다.
- `components/WorkpackEditor.module.css:529-789`: 760px/900px/600px 축소와 reduced-motion 처리가 있다.

### 2.2 현재 structured 및 저장 계약

- `lib/risk-assessment-schema.ts:28-50`: 위험성평가 canonical row가 이미 존재한다.
- `lib/types.ts:99-277`: 작업계획, TBM 브리핑, TBM 기록, 안전보건교육, 안전작업허가 structured 타입이 존재한다.
- `lib/types.ts:582-621`: string deliverable, 일부 structured deliverable, `structured.riskAssessmentRows`가 함께 존재한다.
- `lib/current-workpack.ts:11-34`: canonical current workpack은 `AskResponse`와 generation fingerprint를 localStorage에 저장한다.
- `components/CurrentWorkpackModules.tsx:917-938`: 편집 string을 current workpack deliverables에 다시 투영한다.
- `lib/workpack-readiness.ts:49-68`: 사용자 편집은 품질·온톨로지·DB harness 검수 결과를 무효화한다.
- `app/api/workpacks/route.ts:160-229`: 서버 저장은 봉인된 `AskResponse` insert이며, 기존 workpack update 경로는 없다.
- `app/api/workpacks/[id]/route.ts:77-135`: 서버 아카이브는 저장된 JSON을 다시 연다.

### 2.3 현재 export 계약

- `components/WorkpackEditor.tsx:1269-1324`: string 본문은 `[section]`, `key: value`, 번호, bullet을 `SheetRow[]`로 파싱한다.
- `components/WorkpackEditor.tsx:2298-2359`: XLSX는 다섯 structured mode 또는 generic single mode를 쓴다.
- `app/api/export/xlsx/route.ts:122-230`: structured mode는 작업계획·허가·TBM 브리핑·TBM 기록·교육이며, 위험성평가는 single mode의 `structuredRiskRows`이다.
- `lib/xlsx-builder.ts:468-497`: 현재 `edited` structured 문서는 별도 "사용자 편집 반영" 행을 덧붙인다.
- `app/api/export/hwp/route.ts:278-287`: HWP는 편집 시 structured risk row를 버린다.
- `app/api/export/pdf/route.ts:1124-1174`: PDF는 structured risk row를 우선하고 나머지는 row/body text를 렌더링한다.
- `lib/risk-assessment-renderer.ts:65-159`: 여러 위험성평가 입력 모양을 canonical export row로 정규화한다.

### 2.4 보존해야 할 테스트 의미

- 12개 문서 탐색과 roving tabs: `tests/documents-editor-layout.test.ts:248-305`, `585-626`.
- 동일 fingerprint의 draft reload 복원: `tests/documents-editor-layout.test.ts:340-367`.
- save announcement와 `aria-live`: `tests/documents-editor-layout.test.ts:522-545`.
- 390px containment: `tests/documents-editor-layout.test.ts:791-845`.
- explicit empty `workPermitDraft`: `tests/editor-first-state.test.ts:60-76` 및 현재 브라우저 회귀 테스트.
- stale structured export보다 사용자 편집 우선: `tests/editor-export-integrity.test.ts:32-84`.
- 위험성평가에서 파생되는 deterministic TBM: `tests/tbm-deterministic-structures.test.ts:67-96`.
- 편집 후 공유 재검수: `tests/workpack-readiness.test.ts:168-184`.

## 3. 제품 및 화면 계약

### 3.1 정보 구조

데스크톱은 기존 2열 구조를 유지한다.

- 왼쪽: 12개 문서 navigator, 완료/오류/dirty 상태, 현재 문서 표시.
- 오른쪽 상단: 문서 제목, 설명, 저장 상태, 검증 상태, undo/redo, 취소, 저장.
- 오른쪽 본문: 선택 문서의 실제 typed editor.
- 오른쪽 하단: 근거 상세, 품질, 그래프, export를 progressive disclosure로 유지.
- 필드와 행에 연결된 근거는 본문에서 숨기지 않는다. 하단 근거 패널은 전체 검색·교체·상세 확인용이다.

모바일은 하나의 세로 스크롤만 사용한다.

- 문서 선택은 현재 `<select>`를 유지한다.
- 문서 헤더 아래에 오류 요약과 핵심 섹션을 먼저 둔다.
- wide table을 수평 스크롤시키지 않는다. 같은 typed state를 행별 `<fieldset>` 목록으로 렌더링한다.
- 반복 행은 요약 헤더와 펼침 본문을 가진다. 한 번에 여러 행을 펼칠 수 있지만 기본값은 첫 오류 행 또는 첫 행 하나다.
- 저장 action bar는 safe-area를 고려한 sticky bottom이며 본문 마지막에 같은 명령을 중복 제공하지 않는다.

### 3.2 시각 규칙

- Linear/Codex 계열의 조용한 workbench: canvas, surface, divider, focus, status token으로만 계층을 만든다.
- section 자체를 떠 있는 카드로 만들지 않는다. 구분선과 여백을 쓴다.
- 카드 사용은 모바일 반복 행, modal, 파일/photo item에 한정한다. 카드 안에 카드를 넣지 않는다.
- radius는 8px 이하, letter-spacing은 `0`, viewport 폭 기반 font scaling은 금지한다.
- Day/Night에서 같은 정보 계층과 상태 의미를 유지한다. 색만으로 오류·완료·선택을 표시하지 않는다.
- 입력·버튼·select·행 action의 hit target은 최소 44x44px, 인접 target gap은 최소 8px다.
- icon action은 기존 icon library가 있으면 Lucide를 사용하며 tooltip과 `aria-label`을 모두 둔다.

## 4. TypeScript 데이터 계약

아래 타입은 구현 시 `lib/workpack-editor-draft.ts` 같은 순수 모듈에 둔다. `any`는 금지하고 외부·저장 데이터는 `unknown`에서 type guard로 좁힌다.

```ts
import type {
  AskResponse,
  EducationRecordStructured,
  PermitInspectionStructured,
  TbmBriefingStructured,
  TbmLogStructured,
  WorkPlanStructured
} from "@/lib/types";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";

export type DocumentKey =
  | "workpackSummaryDraft"
  | "riskAssessmentDraft"
  | "workPlanDraft"
  | "workPermitDraft"
  | "tbmBriefing"
  | "tbmLogDraft"
  | "safetyEducationRecordDraft"
  | "emergencyResponseDraft"
  | "photoEvidenceDraft"
  | "foreignWorkerBriefing"
  | "foreignWorkerTransmission"
  | "kakaoMessage";

export type EntityId = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type DraftOrigin = "generated-structured" | "legacy-string" | "stored-v1" | "stored-v2" | "empty";
export type DocumentPhase = "incomplete" | "ready-for-review" | "review-required" | "approved";
export type EvidenceSourceKind = "sif" | "kosha-guide" | "law" | "field" | "workpack";
export type EvidenceAuthority = "direct" | "technical-guidance" | "statutory-mandate" | "supporting";

export type EvidenceRef = {
  id: EntityId;
  sourceKind: EvidenceSourceKind;
  authority: EvidenceAuthority;
  title: string;
  citation: string;
  href: string | null;
  reviewed: boolean;
};

export type ApprovalFields = {
  author: string;
  reviewer: string;
  approver: string;
  authoredAt: IsoDateTime | null;
  reviewedAt: IsoDateTime | null;
  approvedAt: IsoDateTime | null;
};

export type WorkerConfirmation = {
  id: EntityId;
  workerId: string | null;
  displayName: string;
  languageCode: string;
  attendance: "expected" | "present" | "absent" | "late";
  understanding: "pending" | "understood" | "reexplain-required" | "interpreter-required";
  confirmationMethod: "signature" | "verbal-repeat" | "admin-mark" | "share-read";
  confirmedAt: IsoDateTime | null;
  evidenceRefs: EntityId[];
};

export type DocumentEnvelope<K extends DocumentKey, T> = {
  key: K;
  version: 2;
  origin: DraftOrigin;
  phase: DocumentPhase;
  revision: number;
  baseText: string;
  legacyUnparsedText: string;
  value: T;
  evidence: EvidenceRef[];
  updatedAt: IsoDateTime;
};

export type RiskEditorRow = Omit<RiskAssessmentRow, "likelihood" | "severity" | "riskLevel"> & {
  id: EntityId;
  order: number;
  likelihood: RiskAssessmentRow["likelihood"] | null;
  severity: RiskAssessmentRow["severity"] | null;
  riskLevel: RiskAssessmentRow["riskLevel"] | null;
};

export type PhotoAssetRef =
  | { kind: "stored"; assetId: EntityId; fileName: string; storagePath: string; mediaType: string }
  | { kind: "local-pending"; localId: EntityId; fileName: string; mediaType: string; needsReattach: boolean };

export type WorkpackEditorDraftV2 = {
  version: 2;
  baseGenerationFingerprint: string;
  revision: number;
  selectedKey: DocumentKey;
  documents: DocumentStateMap;
  committedDocuments: DocumentStateMap;
  dirtyKeys: DocumentKey[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type DocumentStateMap = {
  workpackSummaryDraft: DocumentEnvelope<"workpackSummaryDraft", WorkpackSummaryEditorValue>;
  riskAssessmentDraft: DocumentEnvelope<"riskAssessmentDraft", RiskAssessmentEditorValue>;
  workPlanDraft: DocumentEnvelope<"workPlanDraft", WorkPlanEditorValue>;
  workPermitDraft: DocumentEnvelope<"workPermitDraft", WorkPermitEditorValue>;
  tbmBriefing: DocumentEnvelope<"tbmBriefing", TbmBriefingEditorValue>;
  tbmLogDraft: DocumentEnvelope<"tbmLogDraft", TbmLogEditorValue>;
  safetyEducationRecordDraft: DocumentEnvelope<"safetyEducationRecordDraft", EducationEditorValue>;
  emergencyResponseDraft: DocumentEnvelope<"emergencyResponseDraft", EmergencyEditorValue>;
  photoEvidenceDraft: DocumentEnvelope<"photoEvidenceDraft", PhotoEvidenceEditorValue>;
  foreignWorkerBriefing: DocumentEnvelope<"foreignWorkerBriefing", ForeignPrintEditorValue>;
  foreignWorkerTransmission: DocumentEnvelope<"foreignWorkerTransmission", ForeignTransmissionEditorValue>;
  kakaoMessage: DocumentEnvelope<"kakaoMessage", FieldShareMessageEditorValue>;
};

export type AdapterResult<T> =
  | { ok: true; value: T; warnings: ValidationIssue[] }
  | { ok: false; fallback: T; issues: ValidationIssue[] };

export type ValidationIssue = {
  id: string;
  documentKey: DocumentKey;
  path: string;
  severity: "error" | "warning";
  gate: "draft" | "review" | "export" | "share";
  message: string;
};

export type ExportProjection = {
  deliverables: Pick<AskResponse["deliverables"], DocumentKey>;
  riskAssessmentRows: RiskAssessmentRow[];
  workPlanStructured: WorkPlanStructured;
  permitInspectionStructured: PermitInspectionStructured;
  tbmBriefingStructured: TbmBriefingStructured;
  tbmLogStructured: TbmLogStructured;
  educationRecordStructured: EducationRecordStructured;
};
```

`PhotoAssetRef.local-pending`에는 Blob URL이나 파일 bytes를 직렬화하지 않는다. reload 후 `needsReattach: true`가 되며, 기존 improvement photo 저장 경로가 반환한 asset만 `stored`로 취급한다.

## 5. 컴포넌트 경계

### 5.1 orchestration

| 컴포넌트 | 책임 | 금지 |
| --- | --- | --- |
| `WorkpackEditor` | hydrate, selection, state machine, history, local recovery, parent callback | 문서별 field JSX, export parsing |
| `DocumentNavigator` | 12개 상태·선택, roving tabs, mobile select | 문서 본문 편집 |
| `DocumentEditorShell` | heading, status, action bar, error summary, panel association | 문서별 schema 판단 |
| `DocumentEditorRegistry` | `DocumentKey -> spec + renderer` exhaustiveness | fallback textarea로 조용히 대체 |
| `DocumentEvidenceRail` | 전체 근거 검색·상세·교체 | 필드 inline citation을 대신함 |
| `DocumentExportBridge` | v2 state를 현재 export request로 projection | builder/route 재구현 |

### 5.2 document wrappers

문서 wrapper는 12개 `DocumentEditorSpec`을 제공하지만 JSX 복제본 12개가 아니다.

| wrapper | 전용 구조 | 공유 primitive |
| --- | --- | --- |
| `WorkpackSummaryEditor` | 위험·조치·문서상태 roll-up | `KeyValueFields`, `LinkedRowTable`, `ApprovalEditor` |
| `RiskAssessmentEditor` | 위험행, 자동 위험도, downstream link | `EditableDataTable`, `EvidenceRefs`, `RowActions` |
| `WorkPlanEditor` | 작업단계, 중지기준, 비상연락 | `OrderedRowEditor`, `RiskLinkPicker`, `ApprovalEditor` |
| `WorkPermitEditor` | 허가조건, 첨부, 종료 phase | `StatusSegment`, `AttachmentEditor`, `ApprovalEditor` |
| `TbmBriefingEditor` | 사전 위험/대책/확인질문 | `RiskLinkPicker`, `OrderedRowEditor`, `WorkerTargetEditor` |
| `TbmLogEditor` | 실제 참석, 이해확인, 미조치 | `WorkerConfirmationTable`, `FollowupTable`, `PhotoRefs` |
| `EducationRecordEditor` | 교육과정, 참여자 이해확인 | `CurriculumTable`, `WorkerConfirmationTable`, `EvidenceRefs` |
| `EmergencyProcedureEditor` | 발동조건, 순서, 보고·복구 | `OrderedRowEditor`, `ContactChainEditor`, `EvidenceRefs` |
| `PhotoEvidenceEditor` | 일반 증빙과 Before/After pair | `FileAssetPicker`, `PhotoPairEditor`, `EvidenceRefs` |
| `ForeignPrintEditor` | 쉬운 한국어와 병렬 언어 출력 | `LanguageVariantEditor`, `WorkerConfirmationTable` |
| `ForeignTransmissionEditor` | 언어·채널별 짧은 전송본 | `MessageComposer`, `LanguageVariantEditor`, `ChannelPreview` |
| `FieldShareMessageEditor` | 현장 공지·문서링크·확인 요청 | `MessageComposer`, `RecipientSummary`, `ChannelPreview` |

### 5.3 genuinely reusable primitives

- `LabeledField`: label, required marker, help, inline error, stable ID.
- `KeyValueFields`: 고정된 소수의 메타 필드.
- `EditableDataTable<T>`: 데스크톱 native table와 모바일 fieldset list가 같은 typed collection을 편집.
- `OrderedRowEditor<T>`: add, duplicate, move, delete, undo transaction.
- `EvidenceRefs`: 항상 보이는 source chips와 상세 popover. source role을 text로 병기.
- `RiskLinkPicker`: stable risk row ID를 선택하고 현재 hazard/control을 read-only preview.
- `WorkerConfirmationTable`: 참석과 이해 확인. TBM log, 교육, 외국인 출력본에서만 공유.
- `ApprovalEditor`: 작성·검토·승인 역할. permit은 별도 role mapping을 config로 주입.
- `PhotoPairEditor`: Before/After, 조치 내용, 확인자, 결과를 하나의 pair로 관리.
- `MessageComposer`: block reorder, channel preview, copy. 언어 관리와 수신자 권한은 wrapper 책임.

공유 기준은 DOM 모양이 아니라 데이터 구조와 interaction invariant다. 예를 들어 TBM 브리핑과 TBM 기록은 둘 다 위험행을 쓰지만 사전 계획과 실제 기록이 달라 하나의 `TbmEditor` config로 합치지 않는다. 외국인 전송본과 현장 공유 메시지도 composer만 공유하고 validation과 target model은 분리한다.

## 6. 12개 문서별 계약

모든 문서는 incomplete 상태 저장을 허용한다. 아래 `필수`는 `ready-for-review`, export, share gate에서 적용하며 local recovery를 막지 않는다.

### 6.1 점검결과 요약 (`workpackSummaryDraft`)

**상태**

```ts
export type WorkpackSummaryEditorValue = {
  documentNo: string;
  revisionLabel: string;
  siteName: string;
  workName: string;
  workDate: IsoDate | null;
  workerCount: number | null;
  conditions: string;
  executiveSummary: string;
  topRisks: Array<{
    id: EntityId;
    riskRowId: EntityId | null;
    hazard: string;
    riskLevel: RiskAssessmentRow["riskLevel"] | null;
    immediateAction: string;
    owner: string;
    status: "planned" | "done" | "needs-review";
    evidenceRefs: EntityId[];
  }>;
  documentStatuses: Array<{ documentKey: DocumentKey; phase: DocumentPhase; blockerCount: number }>;
  approvals: ApprovalFields;
};
```

**필수와 행**

- site, work, date, worker count, conditions, executive summary.
- top risk 한 행 이상. 각 행은 hazard, immediate action, owner, evidence 한 개 이상.
- 12개 문서 상태는 derived read-only row이며 수동으로 조작하지 않는다.

**상호작용**

- risk row와 document status를 누르면 해당 editor/row로 이동한다.
- derived hazard·status를 수정하려면 원본 문서로 이동한다.
- executive summary만 직접 서술 편집한다.
- 문서 상태가 바뀌면 summary는 dirty가 아니라 `derived-stale`로 표시되고 다음 save에서 재계산한다.

### 6.2 위험성평가표 (`riskAssessmentDraft`)

**상태**

```ts
export type RiskAssessmentEditorValue = {
  assessmentDate: IsoDate | null;
  assessor: string;
  reviewCycle: string;
  rows: RiskEditorRow[];
  overallNotes: string;
  approvals: ApprovalFields;
};
```

**행 필드**

- identity/order: `id`, `order`.
- 작업: `location`, `process`, `task`, `equipment`.
- 위험: `hazard`, `fourM`, `accidentType`.
- 현재 상태: `currentControls`, `likelihood`, `severity`, derived `riskLevel`, `whyLikelihood`, `whySeverity`.
- 개선: `additionalControls`, `owner`, `due`.
- 확인: `verification`, `verificationStatus`, `verificationDate`, `verificationChecker`.
- 근거: `evidenceRefs` 한 개 이상.

**검증**

- 현재 `RiskAssessmentRow` validator의 enum, required field, 날짜, risk-level derivation을 그대로 사용한다.
- `riskLevel`은 직접 선택할 수 없다. likelihood와 severity로 순수 함수가 계산한다.
- row ID는 유일해야 하고 order는 저장 시 연속 정규화한다.
- downstream TBM/workplan/permit link가 있는 row 삭제는 영향 목록을 먼저 보여주고 `cancel`, `remove links and delete`만 제공한다.

**상호작용**

- add, duplicate, move up/down, delete, undo.
- core 열을 먼저 보이고 이유·검증·근거는 행의 "상세"에서 연다.
- evidence chip은 행 안에 항상 보인다.
- selected row들을 TBM 브리핑으로 보내는 명령은 복사가 아니라 stable row ID link를 만든다.

### 6.3 작업계획서 (`workPlanDraft`)

**상태**

```ts
export type WorkPlanEditorValue = Omit<WorkPlanStructured, "workOverview" | "workSteps"> & {
  workOverview: Omit<WorkPlanStructured["workOverview"], "workerCount"> & { workerCount: number | null };
  workSteps: Array<WorkPlanStructured["workSteps"][number] & {
    id: EntityId;
    relatedRiskRowIds: EntityId[];
    evidenceRefs: EntityId[];
  }>;
};
```

**필수와 행**

- overview: work name, description, location, worker count, condition, equipment.
- step 한 행 이상: order, action, equipment, safety measure, owner, linked risk, evidence, verification.
- stop criteria, emergency contact, evacuation route, first aid, author/reviewer/approver.

**상호작용**

- step add/duplicate/reorder/delete.
- risk row를 선택하면 hazard와 control preview를 보여주고 safety measure를 덮어쓰지 않는다.
- "위험성평가 감소대책 가져오기"는 사용자가 선택한 row에만 적용하며 이전 값은 undo transaction에 남긴다.
- emergency와 approvals는 기본 collapsed section이지만 blocker가 있으면 자동으로 연다.

### 6.4 안전작업허가 확인서 (`workPermitDraft`)

**상태**

```ts
export type WorkPermitEditorValue = Omit<PermitInspectionStructured, "basicInfo" | "conditions"> & {
  intentionallyEmpty: boolean;
  permitPhase: "draft" | "issued" | "closed";
  basicInfo: Omit<PermitInspectionStructured["basicInfo"], "workerCount"> & { workerCount: number | null };
  conditions: Array<PermitInspectionStructured["conditions"][number] & {
    id: EntityId;
    relatedRiskRowId: EntityId | null;
    evidenceRefs: EntityId[];
  }>;
};
```

**필수와 행**

- explicit empty와 missing을 구분한다. `intentionallyEmpty: true`면 자동 permit을 재생성하지 않는다.
- basic info, permit type, requester, approver.
- applicable condition마다 requirement, action, owner, status, verification, evidence.
- required attachment는 `첨부` 또는 명시적 `해당 없음`과 note가 있어야 한다.
- issue gate는 applicable condition의 `확인 전`/`보완 필요`를 막는다.
- close gate는 completion check와 completion checker를 요구한다.

**상호작용**

- permit type 변경 시 추천 조건을 diff로 제시한다. 기존 조건을 조용히 삭제하지 않는다.
- condition status는 segmented control, attachment는 checkbox가 아니라 status menu를 쓴다.
- issued 이후 basic info 변경은 review-required로 전환한다.
- closeout section은 `issued` 이후 펼치되며 draft에서는 progressive disclosure로 유지한다.

### 6.5 TBM/작업 전 안전점검회의 (`tbmBriefing`)

**상태**

```ts
export type TbmBriefingEditorValue = Omit<TbmBriefingStructured, "hazards" | "measures"> & {
  hazards: Array<TbmBriefingStructured["hazards"][number] & {
    id: EntityId;
    riskRowId: EntityId | null;
    evidenceRefs: EntityId[];
  }>;
  measures: Array<TbmBriefingStructured["measures"][number] & {
    id: EntityId;
    hazardId: EntityId;
    verification: string;
    evidenceRefs: EntityId[];
  }>;
  targetWorkerIds: string[];
  confirmationMethod: string;
};
```

**필수와 행**

- meta: date/time, location, target, attendance confirmation method.
- today work: name, location, time, equipment.
- linked hazard 한 행 이상. hazard마다 measure 한 행 이상.
- stop criteria, confirmation topics, photo evidence location.
- target workers 또는 명시적 target text.

**상호작용**

- risk assessment의 선택 row를 링크하고 최신 hazard/control을 preview한다.
- stale risk link는 경고와 "현재 값 다시 반영"을 제공하되 자동 덮어쓰지 않는다.
- confirmation topic은 checkbox 결과가 아니라 브리핑 질문 목록이다.
- "TBM 기록 시작"은 현재 briefing snapshot으로 log 초안을 만들고 source revision을 기록한다.

### 6.6 TBM 기록 (`tbmLogDraft`)

**상태**

```ts
export type TbmLogEditorValue = Omit<TbmLogStructured, "attendance" | "hazardsDiscussed"> & {
  sourceBriefingRevision: number | null;
  attendance: Omit<TbmLogStructured["attendance"], "expected" | "actual" | "attendees"> & {
    expected: number | null;
    actual: number | null;
    confirmations: WorkerConfirmation[];
  };
  hazardsDiscussed: Array<TbmLogStructured["hazardsDiscussed"][number] & {
    id: EntityId;
    relatedRiskRowId: EntityId | null;
    actionTaken: string;
    evidenceRefs: EntityId[];
  }>;
};
```

**필수와 행**

- actual meeting meta와 today work.
- expected/actual attendance, present worker names, absence/late reason.
- present worker마다 understanding과 confirmation method.
- discussed hazard, action taken, linked risk/evidence.
- education topic/key points/material, unresolved item owner/due, photo location/storage, signatures.

**상호작용**

- briefing에서 seed하되 actual 값은 별도 state다.
- present/absent/late를 행 단위로 표시하고 실제 참석 수는 present 행에서 derived한다.
- `reexplain-required` 또는 `interpreter-required`는 log completion을 막고 후속조치 row 생성을 제공한다.
- share-read confirmation은 별도 서버 이력의 read-only badge다. 회의 참석 서명을 대신하지 않는다.

### 6.7 안전보건교육 기록 (`safetyEducationRecordDraft`)

**상태**

```ts
export type EducationEditorValue = EducationRecordStructured & {
  participants: WorkerConfirmation[];
  curriculum: Array<EducationRecordStructured["curriculum"][number] & {
    id: EntityId;
    evidenceRefs: EntityId[];
  }>;
  materials: Array<{ id: EntityId; label: string; asset: PhotoAssetRef | null; evidenceRefs: EntityId[] }>;
};
```

**필수와 행**

- education name/type/date/time/location/target/instructor/confirmer.
- curriculum 한 행 이상: topic, legal citation, key points, visible evidence.
- understanding method, TBM link, follow-up recommendation.
- participant마다 attendance, understanding, confirmation method. 외국인 참여자는 language code를 요구한다.

**상호작용**

- TBM key point를 선택적으로 import한다.
- participant bulk select는 가능하지만 understanding 결과는 개별 수정 가능해야 한다.
- `reexplain-required`는 follow-up recommendation과 연결된다.
- 첨부 material은 file 자체와 citation을 구분해 표시한다.

### 6.8 비상대응 절차 (`emergencyResponseDraft`)

**상태**

```ts
export type EmergencyEditorValue = {
  title: string;
  scope: string;
  activationTriggers: Array<{ id: EntityId; signal: string; condition: string; sourceRiskRowId: EntityId | null; evidenceRefs: EntityId[] }>;
  immediateActions: Array<{ id: EntityId; order: number; action: string; ownerRole: string; prohibitedAction: string }>;
  reportingChain: Array<{ id: EntityId; order: number; role: string; contact: string; alternateContact: string }>;
  evacuationRoute: string;
  assemblyPoint: string;
  firstAid: string;
  externalReporting: string;
  sitePreservation: string;
  restartCriteria: string[];
  recurrenceActions: Array<{ id: EntityId; action: string; owner: string; due: IsoDate | null; verification: string }>;
  approvals: ApprovalFields;
};
```

**필수와 행**

- trigger, ordered immediate action, report chain, evacuation/assembly, first aid, site preservation, restart criteria.
- contact placeholder는 review/export/share blocker다. 시스템이 실제 연락처를 추정하지 않는다.
- recurrence action은 owner, due, verification을 가진다.

**상호작용**

- actions/report chain reorder.
- risk stop criteria를 trigger 후보로 가져온다.
- contact chain test는 "확인됨/확인 필요" 상태만 기록하며 실제 발신하지 않는다.
- 사고 종류별 subsection은 user choice로 추가하고 기본 화면에서는 접는다.

### 6.9 사진/증빙 (`photoEvidenceDraft`)

**상태**

```ts
export type PhotoEvidenceEditorValue = {
  entries: Array<{
    id: EntityId;
    category: "before" | "after" | "tbm" | "education" | "permit" | "inspection" | "other";
    pairId: EntityId | null;
    asset: PhotoAssetRef;
    caption: string;
    altText: string;
    capturedAt: IsoDateTime | null;
    location: string;
    photographer: string;
    checker: string;
    relatedDocumentKey: DocumentKey | null;
    relatedEntityId: EntityId | null;
    evidenceRefs: EntityId[];
  }>;
  improvementPairs: Array<{
    id: EntityId;
    beforeEntryId: EntityId | null;
    afterEntryId: EntityId | null;
    observedCondition: string;
    improvementAction: string;
    owner: string;
    completedAt: IsoDateTime | null;
    checker: string;
    outcome: string;
  }>;
  storageLocation: string;
};
```

**필수와 행**

- 모든 entry는 asset, caption/alt, time, location, photographer, checker, related target을 가진다.
- improvement pair는 Before와 After 모두 있어야 complete다.
- pair는 observed condition, action, owner, completion, checker, outcome을 요구한다.
- pending local file은 reload 후 reattach blocker를 표시한다. 저장되지 않은 파일을 저장됐다고 표시하지 않는다.

**상호작용**

- browse/camera/drop은 동일 file picker command의 대안이며 drag 전용이 아니다.
- pair create, before/after assign, swap, unpair, delete with undo.
- existing `/improvements` photo route의 stored path를 재사용할 수 있지만 이 editor task에서 업로드 API나 DB는 바꾸지 않는다.
- 썸네일은 고정 aspect ratio와 크기를 가져 layout shift를 막는다.

### 6.10 외국인 근로자 출력본 (`foreignWorkerBriefing`)

**상태**

```ts
export type LanguageVariant = {
  id: EntityId;
  languageCode: string;
  languageLabel: string;
  nativeLabel: string;
  title: string;
  lines: Array<{ id: EntityId; sourceLineId: EntityId; text: string }>;
  reviewStatus: "unreviewed" | "review-required" | "human-reviewed";
  reviewer: string;
};

export type ForeignPrintEditorValue = {
  title: string;
  siteName: string;
  workName: string;
  targetWorkerIds: string[];
  easyKoreanLines: Array<{ id: EntityId; kind: "work" | "hazard" | "control" | "ppe" | "stop" | "ask"; text: string; evidenceRefs: EntityId[] }>;
  variants: LanguageVariant[];
  confirmations: WorkerConfirmation[];
  interpreter: string;
  approvals: ApprovalFields;
};
```

**필수와 행**

- easy Korean base에 work, hazard, control, PPE, stop, ask line이 모두 존재한다.
- 외국인 target이 있으면 해당 worker language variant가 있어야 한다.
- source line과 translated line은 stable ID로 일대일 연결한다.
- `human-reviewed`는 reviewer가 있을 때만 선택할 수 있다.

**상호작용**

- language tabs는 roving keyboard와 mobile select를 제공한다.
- 한 언어를 편집해 다른 언어를 자동 변경하지 않는다.
- 출력 preview는 쉬운 한국어와 선택 언어를 병렬 또는 연속 레이아웃으로 보여준다.
- worker confirmation은 출력용 빈 서명란과 현재 확인 상태를 구분한다.

### 6.11 외국인 근로자 전송본 (`foreignWorkerTransmission`)

**상태**

```ts
export type ForeignTransmissionEditorValue = {
  sourcePrintRevision: number | null;
  targetWorkerIds: string[];
  variants: Array<LanguageVariant & {
    channelBodies: Array<{
      channel: "sms" | "kakao" | "email";
      subject: string;
      body: string;
      callToAction: string;
      acknowledgmentRequired: boolean;
    }>;
  }>;
  senderRole: string;
  contactInstruction: string;
};
```

**필수와 행**

- target worker/language, sender role, contact instruction.
- 각 언어·채널 body에 work, top hazard/control, stop/ask instruction, acknowledgment request가 있어야 한다.
- source print revision이 바뀌면 stale 표시를 한다.

**상호작용**

- print editor에서 선택 line을 가져와 channel별 body를 만든다.
- channel preview와 copy는 editor 안에서 가능하지만 provider send는 실행하지 않는다.
- 실제 전송은 `/dispatch` share flow로 이동하며 saved workpack, recipients, revalidation gate를 따른다.
- message 길이 경고는 channel serializer 결과를 사용하고 임의의 UI 문자수 기준을 새로 만들지 않는다.

### 6.12 현장 공유 메시지 (`kakaoMessage`)

**상태**

```ts
export type FieldShareMessageEditorValue = {
  title: string;
  siteName: string;
  workName: string;
  workTime: string;
  blocks: Array<{
    id: EntityId;
    kind: "risk" | "control" | "stop" | "document" | "contact" | "acknowledgment";
    text: string;
    sourceDocumentKey: DocumentKey | null;
    sourceEntityId: EntityId | null;
    evidenceRefs: EntityId[];
  }>;
  targetWorkerIds: string[];
  channels: Array<"sms" | "kakao" | "email">;
  acknowledgmentRequired: boolean;
  senderRole: string;
  validUntil: IsoDateTime | null;
};
```

**필수와 행**

- site/work/time, top risk, control, stop criteria, sender/contact, acknowledgment block.
- source document revision과 stable row link를 각 block에 보관한다.
- recipients와 channels는 preview용이며 실제 권한·provider result를 조작하지 않는다.

**상호작용**

- risk/TBM/workplan block import, reorder, edit, remove, undo.
- channel preview, copy, "공유 화면으로 이동" 제공.
- 공유 후 dispatch result와 read confirmation은 read-only 상태로 표시한다.
- provider sent와 worker read를 별도 label로 유지한다.

## 7. Adapter와 하위 호환

### 7.1 hydrate 우선순위

`hydrateWorkpackEditorDraft(input: unknown): AdapterResult<WorkpackEditorDraftV2>`는 아래 우선순위를 따른다.

1. 같은 `baseGenerationFingerprint`의 valid v2 local draft.
2. 기존 `StoredEditorDraft` version 1의 `values`와 `dirtyKeys`.
3. generated structured fields: risk rows, work plan, permit, TBM briefing, TBM log, education.
4. 현재 12개 string deliverable의 deterministic parser.
5. scenario, risk summary, worker snapshot으로 만든 empty defaults.

v1 -> v2 migration은 원본 string을 각 envelope의 `baseText`에 그대로 남긴다. parser가 인식하지 못한 line/section은 `legacyUnparsedText`에 순서와 줄바꿈을 보존한다. 손실이 있으면 warning을 보여주며 조용히 버리지 않는다.

### 7.2 missing, empty, generated의 구분

- key missing: legacy data로 보고 generated fallback을 허용한다.
- key present + empty string: 사용자 또는 upstream이 의도적으로 비운 값으로 보존한다.
- 특히 `workPermitDraft`의 explicit empty는 `intentionallyEmpty: true`로 migration한다.
- generated structured가 있어도 v1 dirty string이 있으면 dirty string migration이 우선한다.

### 7.3 dual projection

`projectEditorDraft(draft)`는 같은 입력에서 같은 정규화 결과를 내는 순수 함수다.

- 12개 string deliverable: canonical section 순서, canonical field 순서, `\n` line ending.
- 위험성평가: current `RiskAssessmentRow[]`로 projection.
- 작업계획·허가·TBM 2종·교육: current structured type으로 projection.
- stable entity ID는 UI link용이며 current export payload의 index reference는 array order에서 계산한다.
- projection 중 현재 날짜, locale 시간, random ID를 생성하지 않는다. 시간과 ID는 state transition 시 한 번 생성해 draft에 저장한다.
- `legacyUnparsedText`는 "이전 편집 원문" section으로 projection해 보존하되 structured field를 덮어쓰지 않는다.

### 7.4 local persistence

- 기존 generation-scoped key를 유지하고 payload version만 2로 올린다.
- parser는 version 1과 2를 모두 읽는다.
- `CURRENT_WORKPACK_STORAGE_KEY`에는 기존 `AskResponse.deliverables` string projection을 계속 쓴다.
- v2 typed state는 editor key에 저장한다. 서버 DB 저장을 성공으로 표시하지 않는다.
- local recovery write는 마지막 변경 후 500ms debounce, unload 시 best-effort flush다.
- `storage` event로 다른 tab의 같은 fingerprint/revision을 감지한다. 양쪽이 dirty면 conflict state로 전환하고 자동 merge하지 않는다.
- quota/serialization 오류는 console warning과 visible error를 함께 남긴다.

### 7.5 현재 export와의 호환

이 계약은 export route/builder를 수정하지 않는다. 구현 wave의 bridge는 현재 API에 다음 payload를 보낸다.

| 문서 | 현재 mode | v2 projection |
| --- | --- | --- |
| 위험성평가 | `single` | 현재 editor rows를 `structuredRiskRows`, legacy rows를 fallback으로 전달 |
| 작업계획 | `workPlanStructured` | 현재 `WorkPlanStructured` |
| 허가 | `permitInspectionStructured` | 현재 `PermitInspectionStructured` |
| TBM 브리핑 | `tbmBriefingStructured` | 현재 `TbmBriefingStructured` |
| TBM 기록 | `tbmLogStructured` | 현재 `TbmLogStructured` |
| 교육 | `educationRecordStructured` | 현재 `EducationRecordStructured` |
| 나머지 6종 | `single` | deterministic string -> existing `SheetRow[]` |

bridge는 stale generated structured payload를 보내지 않는다. 현재 editor state에서 projection한 payload만 보낸다. 위험성평가의 `edited` flag가 structured rows를 제거하는 현재 의미와 충돌하므로 bridge 테스트는 current route가 editor-projected rows를 실제 cell에 쓰는지 sentinel로 확인해야 한다.

여기서 deterministic은 동일 draft가 동일 normalized request content와 field order를 만든다는 뜻이다. existing builders가 workbook 생성시각 등 runtime metadata를 쓰므로 binary byte identity는 이 범위에서 보장하지 않는다.

## 8. 상태 전이와 명령

### 8.1 상태 타입

```ts
export type EditorRuntimeState =
  | { status: "loading" }
  | { status: "ready"; dirtyKeys: DocumentKey[]; offline: boolean }
  | { status: "validating"; documentKey: DocumentKey }
  | { status: "saving-local"; documentKey: DocumentKey }
  | { status: "saved-local"; documentKey: DocumentKey; savedAt: IsoDateTime }
  | { status: "save-error"; documentKey: DocumentKey; message: string }
  | { status: "migration-warning"; issues: ValidationIssue[] }
  | { status: "conflict"; localRevision: number; incomingRevision: number }
  | { status: "fatal"; message: string };
```

### 8.2 전이

- `loading -> ready`: v2/v1/generated/string hydrate 완료.
- `loading -> migration-warning`: data를 보존했지만 일부 line을 typed field로 해석하지 못함.
- `ready -> ready(dirty)`: field/row transaction.
- `ready(dirty) -> saving-local -> saved-local -> ready(clean for document)`: explicit Save 또는 `Ctrl+S`.
- `ready(dirty) -> ready(clean for document)`: Cancel confirmation 후 committed document 복원.
- `saving-local -> save-error`: localStorage 실패. working state는 메모리에 유지.
- `ready -> conflict`: 다른 tab의 higher revision 감지. `keep mine`, `load incoming`, `download recovery text`만 제공.
- network offline은 local edit/save를 막지 않는다. upload/share/server reopen은 disabled와 복구 action을 제공한다.

### 8.3 undo, cancel, save

- history는 문서별 transaction stack이며 field edit, add, duplicate, reorder, delete, bulk import를 모두 포함한다.
- 연속 text input은 750ms 동안 한 transaction으로 합친다.
- 최대 50 transaction을 보관한다.
- `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`를 지원하되 native text selection과 IME composition을 깨지 않는다.
- save 후 undo는 이전 committed 값으로 돌아가는 새 dirty transaction이다.
- Cancel은 현재 문서의 마지막 committed snapshot으로만 되돌린다. 다른 문서는 건드리지 않는다.
- dirty Cancel은 modal로 확인한다. `Escape`는 modal만 닫고 데이터를 버리지 않는다.
- "생성본으로 되돌리기"는 overflow의 별도 destructive command이며 `baseText`와 generated structured source로 되돌린다.
- incomplete draft도 local Save 가능하다. Save 후 review/export/share blocker를 inline과 summary에 표시한다.
- save status는 `role=status`, `aria-live=polite`로 완료/실패만 알린다. keystroke마다 읽지 않는다.

## 9. Validation 계약

### 9.1 레벨

- field: blur 또는 section exit에서 표시.
- row: row collapse, reorder, delete, document save에서 표시.
- document: Save와 ready-for-review transition에서 계산.
- cross-document: risk link, briefing revision, worker/share target, evidence asset 상태.
- share: 기존 `applyWorkpackDeliverablesChange(...requiresRevalidation: true)` 의미를 유지한다.

### 9.2 gate

- `draft`: 타입/shape가 깨져 explicit Save projection을 만들 수 없는 오류만.
- `review`: required field, evidence, approval, confirmation 미완료.
- `export`: 현재 export type으로 안전하게 projection할 수 없는 상태.
- `share`: review 완료, 재검수 완료, saved workpack authority, recipient, dispatch policy.

오류 summary는 문서 상단에서 field anchor link를 제공하고 Save/Review 실패 후 첫 오류로 focus를 이동한다. 색상 외에 icon과 text를 함께 쓴다.

## 10. Empty, loading, error, offline

| 상태 | 화면 | 허용 action |
| --- | --- | --- |
| loading | header와 editor 높이를 예약한 skeleton, 상태 text | 문서 전환·편집 disabled |
| empty generated document | 문서별 empty state와 "기본 구조 만들기" | create, legacy text 보기 |
| migration warning | 보존한 원문과 인식 못한 section 수, field anchor | 계속 편집, 원문 비교, 복구 text |
| local save error | field state 유지, 원인과 retry | retry, recovery text export |
| offline | persistent compact banner | edit/local save/copy 가능; upload/share/server action disabled |
| evidence load error | inline source error와 retry | field edit 유지; evidence-required gate는 blocked |
| photo needs reattach | filename과 missing badge | reattach/remove; stored로 표시 금지 |
| conflict | revision 비교 dialog | keep mine/load incoming/recovery text |
| fatal parse | read-only legacy text와 recovery action | 원문 보존, 새 draft 시작 |

## 11. 접근성 계약

- desktop tabs는 현재 roving tabindex, Arrow, Home, End를 유지한다.
- mobile select와 tab selection은 같은 `selectedKey`를 쓴다.
- `tabpanel`은 현재 tab ID로 `aria-labelledby`되고 문서 설명/오류 summary로 `aria-describedby`된다.
- field는 visible `<label>`, help ID, error ID를 가진다. placeholder는 label을 대신하지 않는다.
- repeat collection은 desktop native `<table>`의 caption, `th scope`, row action label을 사용한다.
- mobile repeat collection은 `<fieldset><legend>`로 렌더링한다. ARIA grid를 새로 만들지 않는다.
- icon-only command는 44px hit area, tooltip, `aria-label`, visible focus ring을 가진다.
- drag/reorder는 pointer와 함께 위/아래 버튼 및 keyboard command를 제공한다.
- dialog open 시 첫 heading 또는 error로 focus, close 시 trigger로 focus를 돌린다.
- async status는 polite, blocking error는 `role=alert`. toast는 focus를 가져가지 않는다.
- Day/Night normal text contrast는 WCAG AA, focus indicator와 non-text control은 각 theme에서 별도 검사한다.
- `prefers-reduced-motion`에서 section/row transition을 제거한다.
- 200% zoom, Korean IME, screen reader reading order에서 action bar가 content를 가리지 않는다.

## 12. Responsive 계약

### desktop 1440x1000

- sidebar `minmax(208px, 240px)`, editor `minmax(0, 1fr)`를 유지한다.
- form content max measure는 field 종류별로 제한하되 table은 editor 폭을 사용한다.
- document header action은 wrap 가능하며 어떤 label도 잘리지 않는다.
- dense table에서 secondary fields는 row details로 숨기되 핵심 위험/대책/담당/상태는 첫 화면에 보인다.

### mobile 390x844

- page `scrollWidth <= viewportWidth + 1`.
- desktop tabs와 table은 숨기고 select와 fieldset list를 표시한다.
- control width는 `min-width: 0`, text는 wrap, 긴 source title은 `overflow-wrap:anywhere`.
- sticky action bar는 `env(safe-area-inset-bottom)`을 포함하고 본문에 같은 높이의 padding을 예약한다.
- photo pair는 1열 Before -> After 순서, message preview는 full width.
- nested scroll region과 horizontal swipe interaction을 사용하지 않는다.

### intermediate

- 768x1024 portrait: navigator select + 1열 editor.
- 1024x768 landscape: sidebar 허용, action wrap 검증.
- 844x390 landscape: safe-area와 sticky action overlap 검증.

## 13. 구현 wave와 TDD gate

### Wave 0: adapter와 shell

**RED**

- v1 string fixture, explicit empty permit, malformed JSON, unknown section, stored photo metadata fixture.
- 12-key registry exhaustiveness compile test.
- same fingerprint reload, cross-tab conflict, bounded localStorage writes.

**GREEN**

- `WorkpackEditorDraftV2`, parser/type guards, serializer, local repository.
- generic shell/navigator/action bar/error summary/inline evidence primitive.
- 기존 textarea는 adapter comparison용 hidden fallback이 아니라 explicit legacy-source panel로만 남긴다.

**gate**

- v1 sentinel과 unknown lines가 round-trip 후 남아 있음.
- explicit empty permit가 비어 있음.
- production code·export output은 아직 변하지 않음.

### Wave 1: 위험성평가 + TBM 브리핑 + TBM 기록

**RED**

- risk row add/edit/duplicate/reorder/delete/undo.
- risk level derivation과 current validator parity.
- visible evidence per row.
- selected risk -> TBM hazard/measure stable link.
- TBM briefing -> log snapshot, actual attendance, understanding state, unresolved action.
- current editor state -> current XLSX/PDF/HWP request payload에 stale structured sentinel 없음.
- Day/Night 1440x1000 및 390x844에서 세 문서 overflow 없음.

**GREEN**

- `RiskAssessmentEditor`, `TbmBriefingEditor`, `TbmLogEditor`.
- `EditableDataTable`, `RiskLinkPicker`, `WorkerConfirmationTable`, `EvidenceRefs`.
- deterministic adapters to existing risk/TBM types and current export modes.

**gate**

- 세 문서는 textarea가 없어야 한다.
- browser에서 field/row를 바꾸고 reload 후 같은 structured state가 복원된다.
- export workbook 실제 cell에 edited sentinel이 있고 stale generated sentinel이 없다.
- 편집 후 share readiness는 재검수 전 blocked다.

### Wave 2: 작업계획 + 허가 + 교육

**RED**

- existing structured fixtures를 field별로 hydrate/projection.
- work step/relevant risk link, permit condition phase, education participant confirmation.
- explicit empty permit, permit generated fallback, structured nonempty permit 회귀.

**GREEN**

- 세 wrapper와 shared ordered rows/approval/attachment/curriculum primitive.

**gate**

- current structured XLSX modes와 실제 workbook section 이름/field 값 일치.
- partial save는 가능하나 review/export/share blocker가 정확히 표시.

### Wave 3: summary + emergency + photo/evidence

**RED**

- summary derived status와 source jump.
- emergency trigger/action/report/restart validation.
- Before/After pair, unpaired blocker, reload reattach state, alt text.

**GREEN**

- 세 wrapper, `PhotoPairEditor`, contact/action primitives.
- existing improvement photo API는 adapter로만 사용하고 schema를 바꾸지 않는다.

**gate**

- local pending photo를 stored로 오표시하지 않음.
- improvement pair가 source risk와 evidence를 잃지 않음.

### Wave 4: 외국인 출력 + 외국인 전송 + 현장 공유

**RED**

- language/source-line alignment, missing worker language, review status.
- channel preview/copy와 provider send 분리.
- sent/read state 분리와 share authority gate.

**GREEN**

- 세 wrapper와 language/message primitives.

**gate**

- worker language별 preview가 source line을 보존.
- editor에서 provider를 호출하지 않음.
- `/dispatch` 이동 전 saved authority/revalidation blocker가 보임.

### Wave 5: full regression 및 legacy removal decision

- 12개 문서 전수 geometry, keyboard, screen reader, local persistence, export projection.
- legacy textarea 제거 여부는 migration telemetry/evidence 후 별도 결정한다. 숨은 fallback으로 유지하지 않는다.
- 기존 export route/builder 변경이 필요하면 별도 scope와 evidence를 가진다.

## 14. Browser matrix

| 엔진/브라우저 | viewport | theme | 필수 검증 |
| --- | --- | --- | --- |
| Chromium/Chrome | 1440x1000 | Day, Night | 12 docs, keyboard, export request, no overflow |
| Chromium mobile emulation | 390x844 | Day, Night | 12 docs, fieldset mode, sticky bar, 44px controls |
| Firefox | 1440x1000 | Day, Night | native controls, table layout, focus, wrap |
| WebKit | 390x844 | Day, Night | select/input zoom, safe-area, file/photo control |
| Chromium | 768x1024 | Day, Night | breakpoint and progressive disclosure |
| Chromium | 1024x768, 844x390 | Day, Night | landscape containment and action overlap |

추가 접근성 matrix: keyboard-only, reduced motion, 200% zoom, forced-colors smoke, Korean IME composition. CI 필수 browser suite는 serial isolated harness로 실행해 `.next` contention을 피한다.

## 15. Regression gates

1. 12개 registry key와 `documentMeta` key가 정확히 일치한다.
2. 모든 key는 서로 다른 field contract 또는 validation contract를 가진다.
3. 선택 문서만 편집되며 다른 문서 committed state를 바꾸지 않는다.
4. v1 dirty string과 unknown text가 유실되지 않는다.
5. explicit empty permit가 자동 재생성되지 않는다.
6. generation fingerprint는 사용자 편집으로 바뀌지 않는다.
7. localStorage write loop와 maximum update depth가 없다.
8. undo/cancel/save가 add/delete/reorder/bulk import에서도 동작한다.
9. inline evidence가 모든 risk/control/curriculum/procedure/message source row에 보인다.
10. Before/After, 참석, 이해, dispatch, read confirmation 상태가 서로 혼합되지 않는다.
11. same draft -> same normalized projection.
12. current export mode의 실제 output cell에 최신 editor value가 있고 stale generated value가 없다.
13. 편집 후 revalidation 전 share는 blocked다.
14. Day/Night 1440x1000, 390x844에서 page horizontal overflow와 incoherent overlap이 없다.
15. 모든 actionable control은 44px 이상, 간격은 8px 이상이다.
16. 12개 편집기 내부에 장식용 nested card가 없다.
17. roving tab, mobile select, focus return, error focus, `aria-live`가 유지된다.
18. 기존 full serial Vitest, strict typecheck, production build, frontend browser audit가 통과한다.

## 16. 수용 기준과 비목표

### 수용 기준

- 사용자가 12개 문서를 열었을 때 제목뿐 아니라 field, row, validation, command가 문서 목적에 맞게 달라야 한다.
- Wave 1 세 문서는 실제 structured state를 직접 편집하고 current export payload로 projection해야 한다.
- 같은 구조만 primitive로 공유하고 domain rule은 wrapper/spec에 남겨야 한다.
- 저장, export, share의 실제 상태를 과장하지 않아야 한다.

### 비목표

- DB schema/migration, workpack update API, export builder/route 변경.
- PDF/HWP/XLSX 레이아웃 재설계.
- provider 전송 실행 또는 read-confirmation API 재설계.
- AI 재생성 prompt 변경.
- 기존 evidence/quality/ontology 데이터의 수정.
- 12개의 독립적인 시각 디자인 또는 12개의 복제된 component tree.

## 17. 위험과 명시적 해석

- **문자열 parser 손실**: 원문과 unparsed section을 보존하고 warning을 띄운다.
- **risk row index drift**: UI는 stable ID, current export는 projection 시 array index로 변환한다.
- **두 저장소 혼동**: editor draft recovery와 canonical current workpack을 dual-write하되 서버 저장으로 표시하지 않는다.
- **사진 지속성**: local file bytes는 localStorage에 넣지 않는다. reload 후 reattach 또는 existing stored asset을 요구한다.
- **structured/prose divergence**: v2 structured state를 authoritative로 하고 string은 deterministic projection으로만 만든다.
- **export stale data**: export bridge는 `data.deliverables.*Structured`가 아니라 current editor state에서 payload를 만든다.
- **binary determinism**: 이 계약의 deterministic은 normalized content/payload다. byte-for-byte 동일 파일은 existing builder timestamp 때문에 별도 export scope다.

차단 ambiguity는 없다. 다만 "deterministic export"를 byte-for-byte binary identity로 요구하는 경우에는 export implementation 변경이 필요하므로 이 범위와 분리해야 한다.
