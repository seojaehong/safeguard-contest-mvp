# SafeClaw full provider runtime probe

- Run date: 2026-07-15 KST
- Target: `https://www.safeclaw.kr/api/ask`
- Mode: `full`
- Scenario: exterior painting, mobile scaffold, five workers, two Vietnamese workers, strong wind, and overlapping forklift/pedestrian routes
- Database mutation: none

## Result

The request completed in 148.9 seconds. The response used the SafeClaw evidence harness for the answer and a mixed provider/deterministic document pipeline.

- Provider-generated document entries: 15
- Deterministic document entries: 4
- Answer upstream: OpenAI `gpt-4.1-mini` (not used as the final answer authority)
- TBM structured documents: Anthropic `claude-sonnet-5`, provider output, no fallback
- Foreign-worker briefing and transmission: Anthropic `claude-haiku-4-5`, provider output, no fallback
- Fixed evidence: direct 5, SIF 3, supporting 3
- Overall quality state: `degraded`
- Overall fallback flag: `true`

The overall fallback flag is not evidence that every document failed. It records that at least one document group used a deterministic or fallback path. Per-document provenance remains available in `response.json`.

## Vietnamese distribution

The generated Vietnamese worker payload contained seven Vietnamese lines and no Hangul characters. It explicitly covered:

- strong wind,
- forklift and pedestrian route conflict,
- immediate stop-work action,
- fall protection and scaffold wheel/guardrail checks.

This verifies actual model generation and preview content. It does not prove external SMS or email delivery. The production dispatch route currently remains fail-closed until provider idempotency is supported.

## Evidence

- `response.json`: complete runtime response and per-document generation trace
- `summary.json`: bounded runtime summary and Vietnamese content checks

## Verdict

The provider generation path is operational, including Sonnet 5 TBM generation and Haiku 4.5 Vietnamese content. Submission messaging must still distinguish generated/preview-ready content from externally delivered content, and the overall workpack must retain its degraded state until remaining fallback and evidence gaps are resolved.
