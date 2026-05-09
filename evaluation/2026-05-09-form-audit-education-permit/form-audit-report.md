# SafeClaw Form Audit - Education / Permit / Inspection / Emergency

Date: 2026-05-09

## Scope

- Reviewed `lib/ai-deliverables.ts` education structured prompt/parser.
- Reviewed `lib/xlsx-builder.ts` education structured XLSX path and generic/workpack XLSX behavior.
- Reviewed `app/api/export/xlsx/route.ts` routing only; no route change was needed.
- Did not intentionally touch WorkPlan/TBM behavior. During the session, unrelated `lib/xlsx-builder.ts` workPlan diff appeared in the same file, so it is called out as external/parallel-change risk.

## Status By Form

| Form | Current status | Evidence | Action taken |
| --- | --- | --- | --- |
| Safety education record | Schema-first | `educationRecordStructuredPrompt` asks for `educationRecordStructured`; `parseEducationRecordStructured` validates object shape; `buildEducationRecordStructuredXlsx` maps fields directly to sections. | Fixed attendee signature rows to follow `scenario.workerCount` with a bounded minimum/maximum instead of always rendering five rows. |
| Permit / inspection | Generic form layout | `workPermitDraft` is generated as text in `WorkpackEditor`; XLSX receives parsed rows with `profile.layout = "permit"`, not a dedicated permit schema. | Improved workpack generic XLSX sheets so permit/inspection exports keep scenario meta, checklist confirmation, approval/signature, and storage note. |
| Emergency response | Prose-only source, generic export | `freeFormPrompt` returns `emergencyResponseDraft` as a string; no structured emergency type/parser exists. | Generic workpack XLSX now preserves operational meta and sign-off rows for emergency sheets, but the source remains prose-only. |
| Photo / evidence and other safety forms | Prose-only or generic | `photoEvidenceDraft` and summary drafts are strings parsed into rows. | Generic workpack XLSX now carries confirmation and approval scaffolding for these sheets. |

## Highest-Impact Fix

The most broken path was the workpack XLSX path, because permit, emergency, evidence, and other non-risk sheets were flattened into a body table without the stronger form wrapper that single-document exports already had. This made permit and emergency sheets look less like signable safety forms.

Changes:

- Added workpack metadata rows: business/site, work summary, worker count, weather/condition.
- Added workpack confirmation checklist rows from each `SafetyFormProfile`.
- Added approval/signature and storage rows to non-risk workpack sheets.
- Adjusted education structured XLSX attendee rows to reflect the actual worker count, bounded for practical sheet size.

## Remaining Gaps

- Permit / inspection is still not schema-first. A dedicated `PermitInspectionStructured` type, AI prompt/parser, and XLSX builder would be needed for true schema-first status.
- Emergency response remains prose-only. A structured emergency schema should separate stop triggers, initial response, contacts, evacuation route, first aid, preservation, and recurrence prevention.
- `app/api/export/xlsx/route.ts` only exposes structured modes for workPlan, TBM briefing, and education. Permit/emergency cannot be exported through a dedicated structured mode yet.
- Parallel edits touched `lib/xlsx-builder.ts` in nearby workPlan code during this session; those should be reviewed by the owning agent before staging a combined commit.

## Verification

- `npm.cmd run typecheck` passed.

