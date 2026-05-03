# SafeClaw Quality Rubric Gap Report

## Scope

Confucius ownership is limited to quality rubric, reporting, and gap analysis. Matrix runner execution remains outside this report.

The code artifact is `lib/safeclaw-quality-rubric.ts`. It provides importable TypeScript data and pure evaluation helpers for runner-side checks.

## Rubric Structure

Verdict values are intentionally limited to:

- `pass`: Required signals are present.
- `notice`: Some signals are present, but operator review or prompt/output improvement is needed.
- `blocker`: A required safety input or core document structure is missing.

Tracks:

- `input`: Checks whether the scenario has enough operational detail before generation.
- `document`: Checks whether generated outputs look like usable safety documents.
- `evidence`: Checks whether source material is reflected as position and reason, not pasted as raw text.

## Input Rubric

Runner targets:

- `siteName`: 현장명.
- `companyName`: 회사명.
- `region`: 지역.
- `industry`: 업종.
- `workSummary`: 작업.
- `equipment`: 장비.
- `workerCount`: 인원.
- `newWorkerSignal`: 신규 투입.
- `foreignWorkerSignal`: 외국인.
- `weather`: 날씨.
- `workStopCriteria`: 작업중지 기준.

Current gap:

- `equipment`, `newWorkerSignal`, and `foreignWorkerSignal` can be inferred from scenario examples, but the canonical `AskResponse.scenario` shape does not expose them as first-class fields.
- `workStopCriteria` may be generated in outputs even when not present in inputs. Runner should check both the input and final document body.

## Document Rubric

Runner targets:

- `riskAssessment`: 작업활동, 위험요인, 감소대책, 담당자, 잔여위험 확인.
- `workPlan`: 작업순서, 장비, 인원, 신호/통제, 작업중지 기준.
- `permit`: 허가대상, 사전조건, 승인자, 유효시간, 해제/종료.
- `tbm`: 오늘 작업, 핵심 위험, 금지 행동, 이해 확인, 참석자.
- `safetyEducation`: 교육대상, 교육내용, 교육방법, 이해 확인, 후속교육.
- `foreignNotice`: 쉬운 문장, 핵심 행동, 멈춤 기준, 관리자 확인, 전송 문구.
- `emergencyResponse`: 작업중지, 초기조치, 보고, 현장보존, 재발방지.
- `photoEvidence`: 촬영 대상, 전후 비교, 촬영자, 확인자, 보관 위치.

Current gap:

- `permit` is required for a big-tech SaaS quality bar, but the current deliverables do not expose a dedicated permit draft. Runner should evaluate it from a dedicated future document or a permit section inside `workPlanDraft`.
- `foreignNotice` spans `foreignWorkerBriefing` and `foreignWorkerTransmission`; runner mapping should merge both before judging.
- `photoEvidence` should remain a record form, not just a narrative evidence checklist.

## Evidence Rubric

Runner targets:

- `law`: 법령 source, reflected document position, and reason.
- `kosha`: KOSHA source, reflected control position, and prevention reason.
- `accident-case`: similar risk, reflected position, and prevention reason.
- `knowledge-db`: internal match, primary document position, and selection reason.

Current gap:

- Evidence objects across external data do not share a single normalized `reflectedIn` and `reason` shape.
- Some existing source records contain useful `impact`, `appliedTo`, `templateHints`, or `primaryDocuments`; runner should normalize those into `SafeClawEvidenceLinkInput`.
- The quality gate should block raw source dumping. Source text should be converted into document location plus reason.

## Runner Integration Notes

Suggested import:

```ts
import {
  evaluateSafeClawDocuments,
  evaluateSafeClawEvidenceLinks,
  evaluateSafeClawInputs,
  safeclawQualityRunnerChecks,
  summarizeSafeClawQuality
} from "@/lib/safeclaw-quality-rubric";
```

Suggested mapping:

- Map `AskResponse.scenario` and field example metadata into `evaluateSafeClawInputs`.
- Map generated deliverables into `evaluateSafeClawDocuments`.
- Normalize citations, KOSHA references, accident cases, and safety knowledge matches into `SafeClawEvidenceLinkInput[]`.
- Use `summarizeSafeClawQuality` for the final gate, but preserve item-level results in runner reports.

## Remaining Gap

- Add a dedicated permit output or a stable work-plan permit section.
- Add canonical input fields for equipment, new worker signal, foreign worker signal, and work-stop criteria.
- Add a shared evidence linkage adapter so each source has `sourceType`, `title`, `reflectedIn`, and `reason`.
- Add runner report output that groups `blocker`, `notice`, and `pass` items without numeric scoring.
