# SafeClaw Live Enhanced Output Quality Review

- Captured: 2026-07-10
- Endpoint: `https://www.safeclaw.kr/api/ask`
- Input: Seoul Seongsu exterior painting, mobile scaffold, five workers, one new worker, afternoon strong-wind forecast
- Raw response: `evaluation/crunch/live-enhanced-response.json`
- Extracted contract: `evaluation/crunch/live-enhanced-summary.json`

## Verdict

The DB harness is executing, but the current `ready` verdict is not yet a trustworthy commercial quality gate.

The request completed in enhanced mode and returned a `db_harness_first` packet. The packet fixed retrieved evidence before deterministic risk-row and TBM assembly, and the response carried live KOSHA/SIF catalog provenance. Full SIF vector retrieval was not involved: the retrieval contract was `rest-ilike`, the vector feature was disabled, and no embedding RPC was attempted.

## What Improved

- The result did not rely on an unstructured document-only response. It produced five canonical risk rows and five matching TBM links.
- Each harness row carried stable evidence references into TBM.
- The workpack exposed the actual retrieval contract, evidence counts, ontology result, and document coverage.
- The entered strong-wind/mobile-scaffold condition survived as a dedicated high-risk row and TBM confirmation question.
- The ontology review was connected to the generated workpack rather than shown as a separate decorative page.

## What Still Fails

### Evidence-to-control mismatch

- `B-E-17-2026 도장 공정에서의 화재·폭발위험방지` became `화재 위험: 가동부 방호덮개와 비상정지장치 미확인` with LOTO as the follow-up control.
- `B-E-20-2026 정전도장기` became a similar machinery-guarding/LOTO row instead of grounding, static removal, explosion-proof ventilation, and ignition-source control.
- `G-67-2011 건물 외벽 청소` became `유해·위험요인 미확인` with only supervisor confirmation, instead of a specific exterior/fall control.

The root cause is deterministic: catalog ingestion inferred broad controls from any occurrence of `기계` or `설비`, while runtime risk-row construction trusts the first stored control before the evidence title. The title and control can therefore describe different hazard domains.

### False-ready quality state

The response marked ontology, structured output, and DB harness as ready because rows were structurally valid and evidence metadata declared document coverage. No current gate checks that a fire hazard has fire controls, a fall hazard has fall controls, or that generic supervisor confirmation is insufficient. The result can therefore be schema-valid and still operationally wrong.

### SIF display labels

The live response still exposed archive-style SIF titles such as numeric/process paths. Local commits after the deployed revision derive readable accident labels while retaining raw titles for provenance; those commits still require branch push and live verification.

## Required Gate

Before treating enhanced generation as commercially ready:

1. Derive an operational control view from title/risk-domain signals without overwriting raw DB controls.
2. Use the same aligned controls in deterministic risk rows and TBM links.
3. Reject or mark review-required when the hazard domain and control domain do not align.
4. Keep generic `유해·위험요인 확인` rows as unresolved candidates, not specific ready evidence.
5. Re-run the same live scenario and verify the selected KOSHA/SIF evidence, risk row, TBM question, and exported artifact all carry the same hazard-control relationship.

## Bottom Line

The change from a document generator to a DB-harness pipeline is real and observable. The remaining gap is not “more AI”; it is deterministic evidence-control alignment and a server-enforced quality contract. Embeddings can improve retrieval later, but they would not fix the current wrong control mapping by themselves.
