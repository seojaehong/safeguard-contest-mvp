# SafeClaw Document Editor Product Gap Audit

Generated: 2026-07-14
Source SHA: `920c7f360688352156de4854b4957a9f2f1f0e43`
Branch: `audit/document-editor-product-gap-main-20260714`

## Scope

Read-only audit of the current document editing product surface, export paths, structured DTOs, tests/evaluation, and prior editor/share contract artifacts. No product code, tests, DB schema, migrations, packages, or lockfiles were modified.

## Executive Finding

The current product has a coherent Linear-style work-document surface for all 12 document keys, but it is not a document-specific structured editor. All 12 documents edit through one shared text area. The export/render layer is more advanced than the editor: several document-specific layouts and schema-first XLSX paths exist, and the core 3 can already use existing structured risk rows and TBM structured data for deterministic exports when the selected document has not been edited as free text.

This means the smallest safe post Share/Ontology integration slice should not introduce DB requirements. It should add a bounded, client-side structured editing shell for the core 3 only, keep the other 9 as section-based text editing, preserve current export fallbacks, and make the copy truthful about source authority and one-to-one format limits.

## Counts

| Metric | Count | Basis |
| --- | ---: | --- |
| Document keys | 12 | `DocumentKey` union and `documentMeta` both enumerate 12 keys. |
| Structured document-specific editors | 0 | The only body editor is one `<textarea>` bound to `selectedText` for every selected document. |
| Shared textarea documents | 12 | The tab/select changes `selected.key`; the same textarea edits `values[selected.key]`. |
| Document-specific rendered/printed layouts | 7 | Risk, work plan, permit, TBM log, TBM briefing, and education builders cover 7 documents; the remaining 5 use generic section rendering. |

## Document-by-Document Facts

| Key | Current UI | Render/Export | Body vs Provenance |
| --- | --- | --- | --- |
| `workpackSummaryDraft` | Shared textarea | Generic layout | Evidence rail is separate UI, not embedded editable body. |
| `riskAssessmentDraft` | Shared textarea | Risk layout; XLSX/HWP/PDF can use structured risk rows when not edited | Core candidate for structured row editor without DB. |
| `workPlanDraft` | Shared textarea | Work plan layout; XLSX has `workPlanStructured` path if present | Secondary for Phase A UI; structured DTO exists. |
| `workPermitDraft` | Shared textarea | Permit layout; XLSX can synthesize/use permit structured payload unless intentionally empty | Secondary; useful export path but not default product focus. |
| `tbmBriefing` | Shared textarea | TBM briefing layout; XLSX has `tbmBriefingStructured`; render bridges risk rows/weather | Core candidate for structured TBM editor without DB. |
| `tbmLogDraft` | Shared textarea | TBM log layout; XLSX has `tbmLogStructured`; render bridges risk rows/weather | Core candidate for structured TBM editor without DB. |
| `safetyEducationRecordDraft` | Shared textarea | Education layout; XLSX has `educationRecordStructured` | Secondary section-based editor is acceptable. |
| `emergencyResponseDraft` | Shared textarea | Generic layout | Secondary section-based editor is acceptable. |
| `photoEvidenceDraft` | Shared textarea | `photo` profile token exists, but current safety-form renderer falls through to generic sections | Secondary; true photo table is Phase B unless needed for launch copy. |
| `foreignWorkerBriefing` | Shared textarea | Reuses education layout | Secondary; localization/share authority remains separate. |
| `foreignWorkerTransmission` | Shared textarea | Generic layout | Secondary; share/localization authority work is approval/server gated. |
| `kakaoMessage` | Shared textarea | Generic layout | Secondary; section text/message editor is acceptable. |

## Persistence, Revalidation, Authority

- Browser draft persistence exists via `safeclaw-workpack:*` localStorage and restores dirty drafts.
- Edited deliverables update the current workpack local snapshot, and `requiresRevalidation` clears ontology QA, quality contract, and DB harness fields in the in-memory response.
- Share readiness blocks when revalidation is required, when ontology/quality/DB harness evidence is missing, or when approval placeholders remain.
- Authenticated Supabase persistence exists for workpacks/workers/education records, but this audit did not claim new DB semantics.
- Server share-session creation re-loads the owned workpack operation context and refuses session creation unless server-side `shareAuthority.readiness.canShare` is true.
- A prior share-v2 contract explicitly states localStorage is only cache, not authority, and nonce/binding/RLS/localization envelope work remains implementation-blocked until approved.

## Mobile/Desktop Implications

- Desktop uses tabs plus the same editor body and secondary tool panels.
- Mobile uses a document select and a core launcher for the approved focus documents: 위험성평가표, TBM 브리핑, TBM 기록.
- Current tests assert 12 options, no horizontal overflow, core 3 visible on mobile, and the 9 secondary documents hidden behind a details disclosure.
- The product direction is already aligned with default focus on core 3 and secondary access for the other 9.

## HWPX/PDF/XLS Limitations

- HWPX is labelled as an rhwp text draft and explicitly not a one-to-one source-form reproduction.
- Browser PDF is a print-ready HTML path with fallback to local HTML rendering if the server print source fails.
- XLS legacy is HTML-compatible `.xls`, not binary XLSX.
- XLSX is the primary OOXML export. It is deterministic for structured paths, but if a document is edited as prose, manual edit rows are appended or structured risk rows are suppressed to avoid stale structured output.
- Customer original XLSX/HWPX form mapping is only described as a future onboarding/mapping flow; it is not implemented as cell-level one-to-one reproduction.

## Classification

### 1. Launch Blockers Fixable Without DB/Schema

1. Core 3 editor truthfulness gap: UI presents a work-document editor, but not structured row/table editing. Add a core-3 structured shell or make the copy explicitly say text editing plus structured export.
2. Photo profile mismatch: `photoEvidenceDraft` has a `photo` profile token but renders through generic sections. Either add a small photo evidence section builder or label it as generic evidence notes.
3. Provenance/audit separation copy: evidence/rubric/graph panels are separate from body, but exports still include readiness and one-to-one limitation notes. Tighten labels so users understand what is editable body and what is audit/provenance context.

### 2. Launch-Acceptable Bounded Limitations With Truthful Copy

1. The other 9 documents remain section-based text editing, not structured tables.
2. PDF remains browser print or HTML-backed print, not a signed official PDF renderer.
3. HWPX remains text draft; HWP is a generated table form, not source-cell recreation.
4. Customer-specific original form mapping is an onboarding/QA workflow, not current automatic template overwrite.

### 3. Approval-Blocked Server/Nonce/RLS/DB Work

1. Server nonce/binding/idempotency authority for share-session and dispatch.
2. RLS hardening and production policy verification beyond the current code contract.
3. Localization review envelope persistence and signature rotation.
4. Any DB schema/migration or large data mutation for template mapping, document versions, or editor field storage.

### 4. Phase B Enhancements

1. Full structured field/table editor for all 12 documents.
2. Customer uploaded XLSX/HWPX templates with reviewed cell mapping and repeatable one-to-one QA.
3. Photo evidence table with before/after attachments and OCR-bound evidence cells.
4. Direct PDF binary parity checks across all document-specific layouts.
5. Multi-language worker-facing editor surfaces tied to reviewed localization envelopes.

## Smallest Safe Implementation Slice After Share/Ontology Integration

Implement only the core 3 structured editor affordance:

1. `components/WorkpackEditor.tsx`: add a core-3 structured editing panel above the textarea for `riskAssessmentDraft`, `tbmBriefing`, and `tbmLogDraft`. It should edit local component state and serialize back into the existing document text/deliverables shape, without new DB schema.
2. Reuse existing data:
   - `data.structured?.riskAssessmentRows` for 위험성평가.
   - `data.deliverables.tbmBriefingStructured` and `data.deliverables.tbmLogStructured` for TBM.
   - Existing `selectedUsesEditedText` and `edited` export behavior must remain fail-safe.
3. Keep the other 9 documents as section-based textarea editing, with secondary navigation unchanged.
4. Export gates:
   - `tests/editor-export-integrity.test.ts`
   - `tests/xlsx-export-route.test.ts`
   - `tests/document-export-localization.test.ts`
   - `tests/documents-editor-layout.test.ts`
5. Browser gates after implementation:
   - desktop document editor first state
   - mobile core 3 launcher and secondary 9 disclosure
   - no horizontal overflow on document editor and export panels
   - edited risk prose must not leak stale structured rows into XLSX
6. Likely conflict paths:
   - `components/WorkpackEditor.tsx`
   - `components/WorkpackEditor.module.css`
   - `components/SafeGuardCommandCenter.tsx`
   - `components/FieldOperationsWorkspace.tsx`
   - `app/api/export/xlsx/route.ts`
   - `app/api/export/pdf/route.ts`
   - `app/api/export/hwp/route.ts`
   - `lib/xlsx-builder.ts`
   - `tests/documents-editor-layout.test.ts`
   - `tests/xlsx-export-route.test.ts`

## Verification Performed

- `git rev-parse HEAD` confirmed source SHA `920c7f360688352156de4854b4957a9f2f1f0e43`.
- `git status --short --branch` confirmed the worktree was clean before artifact creation.
- `rg` and targeted file reads were used for component, route, DTO, tests, and prior evaluation/spec evidence.
- `git fetch origin` completed. Plain `git pull --rebase` reported no upstream for this audit branch; the source SHA was not rebased away from the exact requested main.
- No browser/build run was performed because the request said no browser/build unless essential, and this is an evidence-only audit.

## Evidence Paths

- `components/WorkpackEditor.tsx:19`
- `components/WorkpackEditor.tsx:158`
- `components/WorkpackEditor.tsx:540`
- `components/WorkpackEditor.tsx:1092`
- `components/WorkpackEditor.tsx:1269`
- `components/WorkpackEditor.tsx:1915`
- `components/WorkpackEditor.tsx:2070`
- `components/WorkpackEditor.tsx:2165`
- `components/WorkpackEditor.tsx:2298`
- `components/WorkpackEditor.tsx:2503`
- `components/WorkpackEditor.tsx:2638`
- `components/WorkpackEditor.tsx:2857`
- `components/FieldOperationsWorkspace.tsx:1024`
- `components/FieldOperationsWorkspace.tsx:1085`
- `components/FieldOperationsWorkspace.tsx:1210`
- `components/SafeGuardCommandCenter.tsx:200`
- `components/SafeGuardCommandCenter.tsx:216`
- `components/SafeGuardCommandCenter.tsx:1106`
- `components/SafeGuardCommandCenter.tsx:1140`
- `components/SafeGuardCommandCenter.tsx:2281`
- `app/api/export/xlsx/route.ts:170`
- `app/api/export/hwp/route.ts:208`
- `app/api/export/pdf/route.ts:50`
- `app/api/workpacks/[id]/share-sessions/route.ts:83`
- `app/api/workpacks/[id]/share-sessions/route.ts:93`
- `lib/types.ts:135`
- `lib/types.ts:238`
- `lib/types.ts:582`
- `lib/workpack-readiness.ts:49`
- `lib/workpack-readiness.ts:71`
- `lib/xlsx-builder.ts:468`
- `lib/xlsx-builder.ts:961`
- `lib/xlsx-builder.ts:1020`
- `lib/xlsx-builder.ts:1252`
- `tests/editor-export-integrity.test.ts:33`
- `tests/xlsx-export-route.test.ts:103`
- `tests/documents-editor-layout.test.ts:292`
- `tests/documents-editor-layout.test.ts:687`
- `evaluation/ui-ux-browser-check-2026-07-08/report.md:22`
- `evaluation/ui-ux-browser-check-2026-07-08/report.md:79`
- `evaluation/workpack-share-v2-2026-07-13/spec.md:47`
- `evaluation/workpack-share-v2-2026-07-13/spec.md:217`
