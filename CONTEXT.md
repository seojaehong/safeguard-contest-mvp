# SafeClaw Domain Context

## Terms

### Public Safety Document Rubric

SafeClaw uses a public safety document rubric as a product quality layer for generated safety document packs. Internally, the rubric checks whether generated documents contain common safety-document elements grounded in law, guidance, and public-sector inspection practice.

User-facing copy should call this `제출 전 점검` or `서식 완성도 점검`, not a score or legal certification.

### Required Confirmation

`필수 확인` means a document item that should be checked against safety law, official guidance, or common statutory document requirements. It does not mean SafeClaw guarantees legal compliance.

### Submission Quality Reinforcement

`제출 품질 보강` means a document item commonly expected in public-sector or owner-side safety document reviews, such as confirmer fields, improvement requests, evidence slots, and follow-up action fields.

### Field Operation Recommendation

`현장 운영 추천` means an operational item that improves execution in the field, such as multilingual worker notice, message transmission, photo evidence, and worker understanding checks.

### Remediation Generation

`보완 생성` means SafeClaw proposes missing text or fields for the user to review. The user remains responsible for final site-specific confirmation.

### Hazard Candidate

`위험요인 후보` means an unconfirmed hazard suggested from narrative input, field photos, SIF/KOSHA references, or past work history; it must be reviewed before becoming a risk-assessment row.

### KRAS Input Preparation Export

`KRAS 입력 준비 내보내기` means a SafeClaw export that prepares structured risk-assessment rows and review checklists for manual KRAS entry. It does not mean KRAS login, official integration, screen automation, API reverse engineering, or automatic submission.

### Evidence Harness

`근거 하네스` means the retrieval and validation layer that fixes SIF, KOSHA, legal, weather, and work-history evidence before an LLM rewrites it into user-facing documents. User-facing copy should not call this fine-tuning or model training.

### SafeClaw Brand System

SafeClaw uses a field-instrument brand system on public and worker-facing safety screens, not a soft demo landing-page style. Workspace screens may use a commercial Day/Night workbench theme when the structure, hierarchy, and safety semantics remain clear.

Worker-facing safety notices are the only exception to the no-pictogram rule. Limited safety pictograms may be used there when they improve comprehension for multilingual or low-literacy recipients.

## Relationships

- A **Hazard Candidate** can become a risk-assessment row only after **Required Confirmation**.
- A **KRAS Input Preparation Export** is generated from confirmed risk-assessment rows and should include **Public Safety Document Rubric** checks.
- The **Evidence Harness** supplies evidence to **Remediation Generation**, but the generated wording remains a reviewable draft.

## Flagged Ambiguities

- "KRAS 연동" is ambiguous and should be avoided unless an official integration exists. Use **KRAS Input Preparation Export** for the current product direction.
- "학습" or "파인튜닝" is ambiguous in product copy. Use **Evidence Harness** or "SIF/KOSHA 기반 근거 검색" unless the model is actually fine-tuned.
