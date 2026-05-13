# Worker B Weather/Law Source Field Enrichment

## Scope

- Owned files: `lib/weather.ts`, `lib/lawgo.ts`, `lib/types.ts`
- Not touched: `lib/search.ts`

## Connected Fields

- KMA short forecast now exposes request filters and parsed source fields on `weather.sourceFields`, `weather.filters`, and each `weather.signals[]`.
- Short forecast fields include `baseDate`, `baseTime`, `nx`, `ny`, `category`, `fcstDate`, `fcstTime`, `fcstValue`, `obsrValue`, plus normalized `temperatureC`, `windSpeedMps`, `precipitationProbability`, and `precipitationType`.
- KMA warning fields include `발표시각`, `특보구역`, `특보종류`, `특보수준`, `wrn`, `lvl`, `cmd`, and station filters.
- Living weather utilization evidence is included for `생활기상 자외선`, `생활기상 체감온도`, and `실시간 홍반자외선`; the returned metadata states how UV, apparent temperature, heat risk, and erythemal UV feed `weather.actions`.
- Law.go search results now expose `법령명`, `법령ID`, `MST`, `시행일자`, `공포일자`, `소관부처`, and query filters.
- Law.go detail results now expose parsed article metadata for `조문번호`, `조문제목`, `조문내용`, plus counts for `별표` and `개정이력` when present.

## Verification

- `npm.cmd run typecheck` passed.

## Remaining Gaps

- Law.go `별표` and `개정이력` are exposed as parsed counts/metadata, not full downstream-rendered tables.
- KMA warning API response type currently captures warning code/level/command fields; explicit effective/release timestamps depend on the upstream response shape and remain represented in metadata as supported source field candidates.
