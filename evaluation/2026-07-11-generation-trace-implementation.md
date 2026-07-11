# SafeClaw generation trace remediation

Date: 2026-07-11

## Scope

This remediation makes generation provenance describe the final `AskResponse`, preserves the signed trace across workpack save/reopen, and removes raw provider failures from logs, SSE events, diagnostics, ontology QA details, and safety-reference payloads/evidence. It does not change database schemas, migrations, database records, environment variables, credentials, or secrets.

## Final answer contract

`runAsk()` replaces the provider draft with a SafeClaw composition based on the DB harness and fixed integration results. The final trace now says so explicitly while retaining the successful upstream call as non-authoring evidence:

```json
{
  "answer": {
    "provider": "safeclaw",
    "model": null,
    "composition": "safeclaw_db_harness",
    "upstream": {
      "provider": "openai",
      "model": "gpt-4.1-mini",
      "fallbackUsed": false,
      "usedInFinal": false
    }
  }
}
```

This prevents a successful model call from being reported as the author of an answer that SafeClaw subsequently replaced.

## Final document contract

`deliverables.modelPerDocument` uses final DTO keys, not provider call-group labels. Every surfaced final document records either accepted provider output or deterministic SafeClaw assembly. Partial provider responses preserve both sides of the result:

```json
{
  "foreignWorkerBriefing": {
    "provider": "anthropic",
    "model": "claude-haiku-4-5",
    "source": "provider",
    "fallbackUsed": false
  },
  "foreignWorkerTransmission": {
    "provider": "safeclaw",
    "model": null,
    "source": "deterministic",
    "fallbackUsed": true
  }
}
```

- Provider provenance is attached only to keys returned by a successful parser.
- Missing keys in a partially accepted group retain deterministic fallback provenance.
- Final deterministic documents absent from the provider execution map are added after final response assembly.
- `deliverables.provider` summarizes the final document map and can be `anthropic`, `vertex`, `safeclaw`, `mixed`, or `null`.
- Rejected calls and catastrophic provider exceptions preserve whether a call was actually attempted and whether deterministic fallback was used.

## Persistence and evidence

`buildWorkpackEvidenceSummary()` stores the top-level `generationTrace` in the existing `evidence_summary` JSONB document. `buildReopenData()` restores it from that field, with the signed evidence snapshot as a compatibility fallback. No schema change is required.

The reopened `AskResponse` can be passed directly to `verifyAskResponseGenerationEvidence()`. The response content digest includes the restored top-level trace, and the signed snapshot contains the same trace without introducing an evidence-envelope cycle.

## Availability compatibility

Deliverables diagnostics retain the existing `geminiAvailable` field with its literal meaning: Vertex/Gemini credentials are available. They add:

- `providerAvailable`: the selected deliverables provider can run.
- `configuredProvider`: `anthropic`, `vertex`, or `null`.

An Anthropic-only deployment therefore reports `providerAvailable: true`, `configuredProvider: "anthropic"`, and `geminiAvailable: false` without removing or redefining the compatibility field.

## Failure privacy

- Provider parse failures log output length only, never model output head/tail snippets.
- Provider and pipeline exceptions log error type and timeout state only; raw exception messages are not logged by the generation path.
- Rejected deliverable diagnostics use `deliverable_generation_failed` and a fixed message instead of retaining provider exception text.
- Ask-progress stage failures use `ask_stage_failed` and a fixed continuation message. The SSE serializer never receives the rejected value.
- Safety-reference query failures use `safety_reference_search_failed`; vector degradation uses `safety_reference_vector_failed`. HTTP response bodies and exception text are discarded before final DTO assembly.
- A safety-reference failure is represented as `fallback`, not `unconfigured`, and the same safe failure code/message is preserved in the signed DB harness retrieval contract.
- Ontology QA exceptions use `ontology_qa_failed`; `ontologyQa.result.message`, `ontologyQa.detail`, and structured warning logs contain no raw exception text.
- The streaming route's terminal error remains a stable generic Korean message and does not return internal exception text, PII, credentials, or secret markers.
- Final trace logs contain trace ID, mode, provider/model provenance, fallback state, and evidence-sealed state, but no question, prompt, generated body, or raw failure text.

Injected regression fixtures cover resident-number-shaped data, Bearer/API-key-shaped secrets, provider error bodies, rejected promises, and ontology review exceptions. Assertions inspect serialized SSE frames, final `AskResponse`, sealed generation evidence, diagnostics, and captured structured logs.

## Authority boundary

SafeClaw MCP/DB remains the system of record. Hermes and OpenClaw consume the final response and trace; they do not issue trace IDs, replace the DB harness packet, authorize MCP operations, or become evidence/workpack authorities.

## TDD evidence

RED was observed before production edits:

- `npm.cmd test -- tests/ask-progress.test.ts`
  - 2 tests failed and 9 passed. The received stage events contained `boom`, a resident-number-shaped value, a Bearer token, and the raw string rejection.
- `npm.cmd test -- tests/generation-trace-privacy.test.ts`
  - 1 test failed. The safety-reference final payload reported `unconfigured`, had no stable code, and did not preserve a failure contract in signed evidence.
- `npm.cmd test -- tests/workpack-ontology-qa.test.ts`
  - 1 test failed and 5 passed. The raw resident-number-shaped value and Bearer token appeared in `ontologyQa.result.message` and `ontologyQa.detail`.
- `npm.cmd test -- tests/safety-reference-hybrid.test.ts`
  - 1 test failed and 16 passed. A provider error body appeared in the final search message and `vectorSearch.message`.
- `npm.cmd test -- tests/ai-deliverables-generation-trace.test.ts`
  - 1 test failed and 6 passed. Every rejected provider group retained the raw resident-number-shaped value and API-key-shaped secret in `diagnostics.groupResults.reason`.
- `npm.cmd test -- tests/ai-deliverables-generation-trace.test.ts tests/ask-generation-evidence-routes.test.ts tests/commercial-harness.test.ts tests/workpack-store.test.ts`
  - 4 files failed; 9 tests failed and 36 passed.
  - Failures covered final answer authorship, final document keys/partial fallback, workpack restore verification, provider availability, malformed provider fallback truth, log redaction, and SSE sanitization.
- `npm.cmd test -- tests/ai-generation-trace.test.ts`
  - 1 test failed and 1 passed after a provider exception containing PII markers was introduced.
  - The failing assertion showed the same raw marker in the model-chain and fallback-transition logs.

GREEN verification before final commit:

- `npm.cmd test -- tests/ask-progress.test.ts tests/safety-reference-hybrid.test.ts tests/generation-trace-privacy.test.ts tests/workpack-ontology-qa.test.ts tests/ai-deliverables-generation-trace.test.ts tests/ai-generation-trace.test.ts`
  - 6 files passed; 45 tests passed.
- `npm.cmd test -- tests/ask-generation-evidence-routes.test.ts tests/generation-evidence.test.ts tests/generation-evidence-operation-routes.test.ts tests/workpack-generation-evidence-route.test.ts tests/workpack-store.test.ts`
  - 5 files passed; 29 tests passed.
- `npm.cmd test -- tests/commercial-harness.test.ts`
  - 1 file passed; 28 tests passed.
- Total non-overlapping focused verification: 12 files passed; 102 tests passed.
- The new full-mode integration fixture verifies that a successful OpenAI draft is absent from the final answer, the final author remains `safeclaw_db_harness`, upstream is `usedInFinal: false`, and successful Vertex document provenance remains intact.
- TypeScript: `npm.cmd run typecheck` passed with `tsc --noEmit --incremental false`.
- The targeted raw-exception pattern scan returned no matches in the ask, safety-reference, ontology QA, AI, and deliverables generation paths.
- `git diff --check` passed; only the repository's Windows line-ending warnings were emitted.

## Residual notes

- Existing stored workpacks without `generationTrace` remain reopenable because the public fields are optional; they cannot retroactively prove provenance that was never recorded.
- If `SAFECLAW_GENERATION_EVIDENCE_SECRET` is absent, the response trace remains visible but the existing save/share evidence gate remains unsealed.
- Structured logs intentionally retain non-sensitive error type, timeout, status, stage/task, trace ID, and stable failure code fields for operations. Raw exception text and provider response bodies are not retained in these generation paths.
- No live provider or deployed API call was made as part of this remediation.
