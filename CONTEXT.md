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

### Agent Runtime Consumer

`에이전트 런타임 소비자` means an external agent runtime such as OpenClaw, Codex, or a future Hermes PoC that calls SafeClaw MCP tools. It can decide when to call tools, but it must not become the source of truth for safety evidence, tenant data, or generated workpack state.

### Public Reference Corpus

`공용 안전 reference corpus` means reviewed public or shareable safety knowledge such as law, KOSHA material, SIF cases, and approved anonymized patterns. Customer work history is not promoted into this corpus automatically.

### Tenant Operation Memory

`테넌트 작업 이력 메모리` means private organization/site-scoped workpack history, improvement notes, before/after photos, read confirmations, and dispatch history. It can be retrieved into the Evidence Harness for the same tenant, but it must not leak into another tenant or public corpus.

### Operation Graph

`작업 이력 그래프` means the graph for a specific workpack or repeated field operation: Workpack, Hazard, Control, Improvement, Evidence, Ack, photo evidence, and dispatch events. It is distinct from the domain ontology of law, hazards, controls, and obligations.

### Knowledge Promotion Candidate

`지식 승격 후보` means a proposed update derived from tenant operation memory, public safety events, or evidence review. It can be stored, compared, and reviewed, but it is not part of the **Public Reference Corpus** until an explicit approval step promotes it.

### Operator Wiki Export

`운영자 위키 내보내기` means a Markdown/JSONL review surface generated from published ontology, public reference material, or tenant-scoped operation memory. It helps operators inspect and curate knowledge, but it is not the production source of truth.

### SafeClaw Brand System

SafeClaw uses a field-instrument brand system on public and worker-facing safety screens, not a soft demo landing-page style. Workspace screens may use a commercial Day/Night workbench theme when the structure, hierarchy, and safety semantics remain clear.

Worker-facing safety notices are the only exception to the no-pictogram rule. Limited safety pictograms may be used there when they improve comprehension for multilingual or low-literacy recipients.

## Relationships

- A **Hazard Candidate** can become a risk-assessment row only after **Required Confirmation**.
- A **KRAS Input Preparation Export** is generated from confirmed risk-assessment rows and should include **Public Safety Document Rubric** checks.
- The **Evidence Harness** supplies evidence to **Remediation Generation**, but the generated wording remains a reviewable draft.
- An **Agent Runtime Consumer** calls SafeClaw MCP tools and must treat the **Evidence Harness** packet as the fixed fact boundary.
- A **Tenant Operation Memory** item may feed the **Evidence Harness** only inside its organization/site scope.
- A **Tenant Operation Memory** item may become part of the **Public Reference Corpus** only after explicit review and promotion.
- An **Operation Graph** visualizes field history and improvements; it should not be used as a substitute term for the domain ontology.
- A **Knowledge Promotion Candidate** may be proposed from **Tenant Operation Memory**, but it remains review-only until approved for the **Public Reference Corpus**.
- An **Operator Wiki Export** may summarize **Operation Graph** and ontology material for review, but SafeClaw runtime decisions still come from the DB, MCP tools, and **Evidence Harness**.

## Flagged Ambiguities

- "KRAS 연동" is ambiguous and should be avoided unless an official integration exists. Use **KRAS Input Preparation Export** for the current product direction.
- "학습" or "파인튜닝" is ambiguous in product copy. Use **Evidence Harness** or "SIF/KOSHA 기반 근거 검색" unless the model is actually fine-tuned.
- "LLM Wiki" is ambiguous in product copy. Use **Public Reference Corpus** for reviewed common knowledge and **Tenant Operation Memory** for private work history.
- "에이전트 내재화" is ambiguous. Use **Agent Runtime Consumer** when OpenClaw/Codex/Hermes calls SafeClaw MCP tools, and reserve "core engine migration" for an approved backend rewrite.
- "자동 지식 업데이트" is ambiguous. Use **Knowledge Promotion Candidate** when an agent proposes a change, and reserve "published corpus update" for an explicitly approved promotion.
