# OpenClaw Workspace Quality Probe

## Verdict

SafeClaw now supports both tracks:

- Web track: `/api/ask` with `aiMode: full` still returns live SafeClaw workpack output.
- OpenClaw track: MCP now exposes `generate_reviewed_safety_docpack`, a one-call tool that combines SafeClaw `/api/ask` workpack generation with `qa_review_docpack` QA evidence.

OpenClaw runtime caveat: the agent can still summarize loosely or pass vague task labels. Server-side task inference now corrects vague labels such as `일반 작업` to `용접` when the question contains welding work terms.

## Direct MCP Evidence

- HTTP status: 200
- Engine: safeclaw-runAsk
- Quality pipeline: generate_safety_docpack -> qa_review_docpack
- Review task after inference: 용접
- Document count: 11
- QA reviewable: True
- QA verdict: 미흡
- Missing controls: 가연성물질 별도 보관·격리, 용접방화포·불티비산방지덮개 설치, 차광보안면·방열복 착용

## `/api/ask full` Evidence

- Mode: live
- Status: 연결됨
- Elapsed: 135923 ms
- Deliverables: 19
- Risk chars: 5115
- TBM chars: 1970
- Education chars: 2335

## Evidence Files

- `evaluation/openclaw-workspace-quality-probe/direct-reviewed-docpack-call.json`
- `evaluation/openclaw-workspace-quality-probe/direct-reviewed-docpack-summary.json`
- `evaluation/openclaw-workspace-quality-probe/prod-api-ask-full-after-reviewed-tool.json`
- `evaluation/openclaw-workspace-quality-probe/prod-api-ask-full-summary.json`
- `evaluation/openclaw-workspace-quality-probe/openclaw-reviewed-docpack-tool-run-before-task-infer.txt`
- `evaluation/openclaw-workspace-quality-probe/openclaw-reviewed-docpack-tool-run-after-task-infer.txt`
