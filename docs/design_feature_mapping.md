# SafeGuard Design And Feature Mapping

## Purpose

This document maps the SafeClaw design direction into actual SafeGuard product behavior. The goal is to avoid a polished shell that is disconnected from live data.

## Current UX Contract

- The first screen opens as a command workspace, not a generated report.
- The home layout follows `V1 · Split + Top Stepper`: full-width sticky stepper, sticky 320px left panel, and one main workspace.
- The left panel owns live state, field brief, and recent workpacks. The home screen does not use a permanent right-side panel.
- Field examples are quick-start cases. They load a realistic work description, then the user generates a workpack through `/api/ask`.
- The field brief has two states:
  - Before generation: lightweight client-side extraction from the input text.
  - After generation: API-backed brief from `AskResponse.scenario` and `AskResponse.externalData.weather`.
- Generated workpack output remains the source of truth for document editing, download, evidence, worker assignment, and dispatch.

## Field Brief Mapping

| UI Field | Before Generation | After Generation |
|---|---|---|
| Company | Selected field example default | `AskResponse.scenario.companyName` |
| Site | Location keyword extracted from input | `AskResponse.scenario.siteName` |
| Industry | Selected field example default | `AskResponse.scenario.companyType` |
| Work summary | Selected field example work type | `AskResponse.scenario.workSummary` |
| Worker count | `n명` pattern extracted from input | `AskResponse.scenario.workerCount` |
| Weather / condition | Keyword extraction such as 강풍, 우천, 폭염, 환기 | `AskResponse.externalData.weather.summary` from KMA 초단기실황/초단기예보/단기예보 |
| Foreign worker signal | Keyword extraction such as 외국인, 베트남, 중국, 몽골, 다국어 | Input and scenario context |

## Remaining Implementation Decisions

- Add a dedicated `/api/field-brief` endpoint only if we need a fast server-side extraction before full document generation.
- Persist selected example and generated workpack to Supabase once the user explicitly saves the workspace.
- Add source-level latency logging for `/api/ask` so slow provider calls are visible in evaluation artifacts.
- Keep weather fully API-backed only after generation. Pre-generation weather remains a UI hint because the user may not have entered an exact address.
- The generated Field Brief should show the composed KMA summary, while `AskResponse.externalData.weather.signals` preserves which KMA endpoint was used: 초단기실황, 초단기예보, 단기예보.
- Avoid auto-generating every time an example is clicked because it would create unnecessary API cost and slow exploratory browsing.

## Product Rule

Examples should never be presented as final data. They are realistic seeds that become real workpacks only after the user presses `선택한 현장으로 생성`.
