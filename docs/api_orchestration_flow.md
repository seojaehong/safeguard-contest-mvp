# SafeGuard API Orchestration Flow

## Product Point

SafeGuard should start from the current field context, not from a static example. The default flow is:

1. The user selects or types a field scenario.
2. The home workspace immediately prefetches current KMA weather for the inferred region.
3. When the user generates the workpack, SafeGuard combines public APIs and AI into one field document pack.

## Current API Stack

| Source | Timing | Role | Output Use |
| --- | --- | --- | --- |
| KMA current weather | Before generation and during `/api/ask` | Current regional weather signal | Field Brief, TBM weather signal, immediate action wording |
| Law.go / korean-law-mcp | During `/api/ask` | Statutes, precedents, interpretations | Risk assessment, TBM, education evidence |
| Gemini | During `/api/ask` | Draft generation and structured response | Risk summary and workpack drafts |
| Work24 training | During `/api/ask` | Follow-up training recommendation | Safety education record and education fit check |
| KOSHA education portal mapping | During `/api/ask` | KOSHA education candidate | Education linkage and evidence card |
| KOSHA official resources | During `/api/ask` | Official guide/manual/template mapping | Risk assessment/TBM/education template grounding |
| KOSHA accident cases | During `/api/ask` with short budget | Similar accident learning | TBM and education prevention points |

## KMA Weather Flow

- `GET /api/weather?question=...` calls `fetchWeatherSignal(question)` on the server.
- The browser never receives the public API key.
- `fetchWeatherSignal` calls three KMA endpoints:
  - `getUltraSrtNcst` for current ultra-short observation
  - `getUltraSrtFcst` for near-term ultra-short forecast
  - `getVilageFcst` for short-term village forecast
- The home Field Brief shows `현재 기상 반영` when KMA returns live data.
- `/api/ask` calls the same weather adapter again so the generated workpack has a server-side weather evidence snapshot.

## UX Rule

- Before generation: weather is a live field context precheck.
- During generation: weather is one part of the full API orchestration.
- In generated documents: weather should support field decisions, not dominate the result unless the API values or user input indicate weather-sensitive work.
