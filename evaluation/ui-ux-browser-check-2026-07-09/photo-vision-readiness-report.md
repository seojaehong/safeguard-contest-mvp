# SafeClaw Photo Vision/OCR Readiness Report

Date: 2026-07-09

## Scope

This pass exposes how photo Vision/OCR is attached to SafeClaw without changing DB schema or uploading files.

## Implemented Surface

- `GET /api/input-photos/hazard-analysis`
  - reports provider/model readiness
  - reports max photo count
  - reports accepted-only memory rule
  - reports Before/After support
  - reports OCR support
  - reports export targets
- `/settings/ai-connect`
  - displays a compact Vision/OCR Harness section
  - shows attach -> analyze -> accept -> export flow
  - keeps the user-facing rule clear: photo analysis is a candidate surface, and only user-accepted candidates enter DB harness memory

## Runtime Probe

Result file: `evaluation/ui-ux-browser-check-2026-07-09/photo-vision-readiness-api-check.json`

- Readiness endpoint HTTP: 200
- Provider: OpenAI
- Max input photos: 10
- Accepted-only memory: true
- Before/After supported: true
- OCR supported: true
- Flow: attach, analyze, accept, export
- POST guard without multipart: HTTP 400

## Verification

```powershell
npm.cmd test -- tests\photo-vision-analysis.test.ts tests\commercial-harness.test.ts tests\sif-embedding-approval-packet.test.ts
npm.cmd run typecheck
npm.cmd run build
```

## Result

The photo path is now explicit:

1. Input screen `+` attachment accepts up to 10 field photos.
2. `POST /api/input-photos/hazard-analysis` sends multipart photos to the OpenAI Responses vision path.
3. The model returns reviewable hazard candidates, OCR text, and site signals.
4. The user accepts candidates before they become harness improvements.
5. Accepted items and Before/After improvements are preserved in workpack memory exports and downstream DB harness context.
