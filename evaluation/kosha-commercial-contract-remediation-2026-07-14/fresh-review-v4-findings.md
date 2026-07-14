# KOSHA Commercial Contract Fresh Review V4 Findings

## Bound source

- Final evidence HEAD: `08f6d6edc168c9a83cb6aac0eca151f45b783131`
- Product GREEN: `e0a67f6e1953d421e58549666d1d44402435dfeb`
- RED: `2b3144f72f51baf9ee4808fd7ba804078ce43d23`
- Main target: `920c7f360688352156de4854b4957a9f2f1f0e43`
- Verdict: `HOLD`, SPEC FAIL, CODE QUALITY FAIL

## P1 - broad context tokens unlock unrelated KOSHA

`hasRelevantKoshaParent` treats a generic token such as `보행자` as collision-family evidence and accepts any family intersection. This permits an unrelated forklift fire or pedestrian slip direct row to unlock a collision KOSHA child. Once the false parent decision passes, the unsafe KOSHA content reaches the public DB harness packet, MCP payload, model prompt, evidence references, and actions.

Required hostile cases:

1. KOSHA collision child:
   - title: `KOSHA 지게차 보행자 충돌 예방 기술지침`
   - keywords: `지게차`, `보행자`, `동선`, `충돌`
   - risk tags: `충돌`
2. Unrelated fire direct parent candidate:
   - title: `LPG 지게차 보행자 통행구역 연료계통 화재 직접 근거`
   - summary: `보행자 통행구역의 LPG 지게차 연료 누출 가스가 점화되어 화재가 발생할 수 있다.`
   - keywords: `LPG`, `지게차`, `보행자`, `통행구역`, `연료누출`, `화재`
   - empty risk tags
   - expected parent decision: false
3. Same-equipment pedestrian slip with `risk_tags=["미끄러짐"]`: false.
4. Fire narrative with conflicting `risk_tags=["충돌"]`: false, because explicit/narrative hazard families conflict.
5. True vehicle collision with `risk_tags=["차량 충돌"]`: true.

The solution must distinguish hazard-defining terms from broad context/equipment/actor terms, reject mixed or contradictory families, and require a deterministic compatible parent family. Equipment/category/subcategory overlap may rank evidence but must not establish parenthood by itself. Preserve legitimate collision aliases and all other hazard-family positives.

Downstream assertions must verify that every false-parent case is absent from:

- public DB harness packet
- answer and practical sections
- deliverables and structured output
- citations/evidence references/actions
- MCP response payload
- MCP model prompt serialization

Do not patch only the MCP layer; all public surfaces must consume the same sanitized parent-ready packet.

## P2 - historical log wording

The current bytes of `integrated-kosha-group-d.log` first appear at `2a232695`, not `049debe4`.

Correct the report history explicitly:

- `049debe4`: blob `8836b0bb...`, 129 passed / 1 failed
- `29ae8372`: modified to 130 passed
- `2a232695`: modified to current 129 passed / 1 failed blob `cabd4989...`
- `08f6d6ed`: retains the `2a232695` blob

Keep the classification `self-recorded, not independently immutable`. Do not rewrite historical logs.

## Preserved invariants and gates

- SIF remains hazard-priority evidence.
- KOSHA remains technical guidance unless a separate published law edge establishes mandate.
- Law remains the mandate layer.
- LLM remains `naturalize_only`; parentless provider narratives are discarded.
- No DB/schema/data/migration/package/lockfile changes, no explicit `any`, no silent failures.
- TDD: commit the new bypass attacks and failing log before product changes, then product GREEN, focused tests, evidence, push, and fresh independent review.
- Re-run the exact hostile cases, existing v4 seven, MCP 27, focused 55, B26/C22/D130/E84, strict typecheck, diff/scope/no-any, artifact hashes, and clean main merge tree.

