# AI generation gate plan

## Why this exists

SafeClaw must not generate safety documents by mixing a selected example with a newly typed field condition. The first AI step should produce a structured field context, and every document renderer should use that context as the single source of truth.

## Current finding

- The live AI path can improve narrative answers and evidence mapping.
- Scenario extraction and document pack rendering still rely on deterministic profile builders.
- If the deterministic profile falls back to an example, exports can inherit example values even when the user typed a new job.

## Recommended architecture

1. `FieldContext extraction`
   - Use a high-capability model once at the start when the input is ambiguous or non-standard.
   - Output strict JSON only.
   - Required fields: companyName, siteName, industry, workName, workerCount, nonRoutineWork, hazards, controls, weatherSensitivity, requiredPermits, educationTargets.

2. `Schema validation`
   - Validate the JSON with a strict runtime schema.
   - If required fields are missing, ask the user for a short clarification or use a conservative fallback with visible "확인 필요" markers.

3. `Deterministic document rendering`
   - Render risk assessment, work plan, permit/checklist, TBM, and education records from the validated `FieldContext`.
   - Do not let renderer code read selected demo examples after the user edits the textarea.

4. `Evidence and remediation pass`
   - Use Gemini or a fast model to map law, KOSHA, accident case, weather, and training evidence to specific document lines.
   - Remediation must remain user-controlled: AI suggestion -> user edit -> insert.

5. `Export`
   - Export PDF/HWPX/XLS from the same rendered document model.
   - HWPX should be labeled as a submission draft unless a verified template renderer is used.

## When to use the stronger model

- Non-standard work: leak repair, emergency maintenance, night work, confined spaces, chemical handling, live electrical work.
- Sparse input: missing site, worker count, equipment, or permit condition.
- Conflicting input: selected example and typed field condition disagree.

## When not to use it

- The user selects a known scenario and does not edit it.
- The input already maps cleanly to an existing scenario profile.
- The task is only a small wording improvement after documents are generated.

## Acceptance criteria

- A custom input cannot inherit company, site, worker count, or hazards from a selected example.
- The generated field context is visible enough for the user to correct before final export.
- Risk assessment and TBM contain the same primary hazards and controls.
- Exports use the same document source as the on-screen editor.
