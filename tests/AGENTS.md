# tests/ 지식

- vitest 설정: vitest.config.ts, alias `@` → 리포 루트, include `tests/**/*.test.ts`, environment node. 실행: `npm.cmd test` (Windows Git Bash에서 npm.cmd 필수).
- next.config.mjs를 테스트에서 직접 import 가능 (`import nextConfig from "@/next.config.mjs"`) — headers()/redirects() 반환값을 Next 실행 없이 검증한다.
- 단, tsc가 .mjs import에 TS7016(선언 없음)을 내므로 `tests/next-config.d.ts`의 `declare module "@/next.config.mjs"` 선언이 필요. next.config.mjs에서 테스트가 쓰는 export 형태를 바꾸면 이 선언도 함께 갱신할 것.
- 정책/결정 로직은 lib/*-policy.ts 순수 함수로 분리해 테스트하는 것이 이 리포의 패턴 (예: tests/ai-deliverables-policy.test.ts).
