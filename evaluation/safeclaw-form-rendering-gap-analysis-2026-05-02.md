# SafeClaw Form Rendering Gap Analysis

Date: 2026-05-02
Scope: `components/WorkpackEditor.tsx`, `lib/mock-data.ts`, related docs/evaluation
Change policy: analysis only; no product code changed.

## Current Commonized Points

- `AskResponse.deliverables` stores each document as plain text strings. `WorkpackEditor` converts those strings into a shared `SheetRow` shape with only `document`, `section`, `item`, and `content`.
- `getSafetyFormProfile()` changes only shallow labels such as form code, subtitle, column names, confirmation rows, and approval labels.
- HTML, Word, XLS, JPG, PDF print, preview, and HWPX all reuse the same section/table renderer. The actual table contract is effectively `No. / primaryColumn / actionColumn / confirmation`.
- `parseSheetRows()` infers rows from headings, bullets, numbered lines, and key-value lines. This is useful for quick demos, but it cannot preserve official form columns such as frequency, severity, permit number, attendee signature, or evidence reference.
- `lib/mock-data.ts` already writes more field-like text for risk assessment, work plan, TBM briefing, and TBM log, but these are still serialized as prose before rendering.

## Document-Specific Branching Needed

- Work permit should be separated from the generic work plan shape. It needs permit type, permit number, work date/time, issuer/approver, isolation/LOTO, fire watch, gas measurement, PPE, pre-work checklist, attachments, and cancellation/closeout fields.
- Work plan needs its own plan schema: project/site metadata, work area, task sequence, manpower/equipment, permit/attachment links, stop-work criteria, emergency contact, and sign-off. It should not be rendered through the same two-content-column table as risk assessment.
- Risk assessment needs a row model, not text parsing. Required fields are task activity, hazard, accident type, existing control, frequency, severity, risk level, additional control, owner, due date, residual risk, confirmation/evidence, and worker participation/sign-off.
- TBM log should branch from TBM briefing. The briefing can stay short and shareable, but the log needs meeting date/time, leader, attendees, agenda/hazards/actions, understanding confirmation, unresolved items, photo/video evidence slots, and signature rows.

## Risk Assessment First Implementation Schema

```ts
type RiskAssessmentForm = {
  meta: {
    companyName: string;
    siteName: string;
    workName: string;
    processName: string;
    workLocation: string;
    workerCount: number;
    assessmentDate: string;
    assessmentMethod: "4M" | "frequencySeverity" | "checklist";
    participants: string[];
  };
  rows: Array<{
    id: string;
    taskActivity: string;
    hazard: string;
    accidentType: string;
    currentControl: string;
    frequency: "low" | "medium" | "high";
    severity: "low" | "medium" | "high";
    riskLevel: "low" | "medium" | "high";
    additionalControl: string;
    owner: string;
    dueDate: string;
    residualRiskLevel: "low" | "medium" | "high";
    confirmationEvidence: string;
    relatedSources: string[];
  }>;
  signOff: {
    assessor: string;
    supervisor: string;
    workerRepresentative: string;
    approvalDate: string;
  };
};
```

Priority mapping:

- Existing `profile.hazards[]` becomes one or more `rows[].hazard`.
- Existing `profile.actions[]` becomes `rows[].additionalControl` and partially `currentControl` where the action is already in place.
- Existing `profile.riskLevel` becomes initial `riskLevel`, but frequency/severity should be explicit fields rather than embedded prose.
- Citations and KOSHA references should map to `confirmationEvidence` or `relatedSources`, not only the side evidence panel.

## Minimum Change File List

- `lib/types.ts`: add structured deliverable types while preserving current string deliverables for backwards compatibility.
- `lib/mock-data.ts`: generate `structuredDeliverables.riskAssessment`, then derive the current text draft from that structure during migration.
- `components/WorkpackEditor.tsx`: replace `parseSheetRows()`-first rendering with a document renderer registry keyed by `DocumentKey`; keep the generic renderer as fallback.
- New or existing helper under `lib/`: add form builders such as `buildRiskAssessmentForm`, `buildWorkPlanForm`, `buildPermitForm`, and `buildTbmLogForm` only if the component becomes too large.
- `lib/safety-document-rubric.ts`: update rubric checks to inspect structured fields such as owner, due date, evidence, and sign-off rather than only text content.
- `docs/` or `evaluation/`: add fixture/smoke documentation for the four official-form renders before expanding all document pack tabs.

## Suggested Order

1. Introduce `structuredDeliverables.riskAssessment` behind the existing API response.
2. Add a dedicated risk assessment renderer for preview, HTML, XLS, and HWPX text.
3. Derive the old `riskAssessmentDraft` string from the structured model so current editor/autosave/export flows keep working.
4. Add work plan, permit, and TBM log schemas once the renderer registry pattern is proven.
