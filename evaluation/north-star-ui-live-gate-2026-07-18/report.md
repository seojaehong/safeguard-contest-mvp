# North Star UI Live Gate - 2026-07-18

## Scope

Current branch: `master`

Live target: `https://www.safeclaw.kr`

This gate re-checks the launch blockers that were previously reported for:

- `/ontology` graph hairball, node overlap, low contrast, and mobile unreadability.
- `/why` mobile comparison table overflow.
- Common CTA/button contrast failures on visible live routes.

No product code was changed in this gate.

## Evidence

### `/ontology` Live Browser Contract

Command:

```powershell
$env:ONTOLOGY_BASE_URL='https://www.safeclaw.kr'; npm.cmd test -- tests\ontology-ui-browser.test.ts
```

Result:

- `1 file / 1 test PASS`
- Source in generated metrics: `https://www.safeclaw.kr`
- Evidence: `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`

Key metrics:

- Desktop/tablet/mobile Day/Night horizontal overflow: `0`
- Node overlap pairs: `0`
- Visible desktop neighborhood nodes: `15`
- Mobile relation list visible; full graph only in dialog.
- Minimum control height: `44`
- Minimum node text contrast: `5.6`

Decision: the previous `/ontology` P0 graph-usability blocker is closed on current live production.

### `/why` Live Mobile Layout

Command:

```powershell
node <inline playwright audit for https://www.safeclaw.kr/why?theme=day/night>
```

Result:

- Day mobile `390x844`: overflow `0`, outside elements `0`, undersized controls `0`, comparison rows all `332px`.
- Night mobile `390x844`: overflow `0`, outside elements `0`, undersized controls `0`, comparison rows all `332px`.

Decision: the previous `/why` mobile comparison overflow blocker is closed on current live production.

### Visible CTA/Button Contrast Sampling

Sampled live routes:

- `/`
- `/workspace`
- `/documents`
- `/reports`
- `/workers`
- `/worker`
- `/search`
- `/archive`
- `/settings/ai-connect`
- `/why`
- `/roadmap`

Command:

```powershell
node <inline playwright contrast audit for visible a/button/[role=button] surfaces>
```

Result:

- Findings below `4.5:1`: `0`

Decision: the previously reported visible white/yellow CTA contrast failures are not reproduced on the sampled current live production routes.

## Remaining Known Work

This gate does not claim the full North Star objective is complete. Remaining work still includes:

- Full 108-row frontend audit after the static contract reaches green.
- Remaining product depth work for document-specific editors, share recipient flows, and Hermes/LLM Wiki long-term architecture.
- Continued route-by-route UI simplification where density is still high.

