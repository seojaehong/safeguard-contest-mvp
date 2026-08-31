# Northstar open-gate test harness

- Verdict: `PASS_CURRENT_SOURCE_NORTHSTAR_OPEN_GATE_HARNESS_MEMORY_AND_FIXTURE_IO_BOUNDED`
- Product/test commit: `a8e337501b71070adb5019188f247f15bb23307e`
- Full suite: 1 file, 204 tests passed, 0 failed
- Duration: 1248.99 seconds
- Baseline duration: 1789.91 seconds
- Reduction: 540.92 seconds / 30.22%
- Observed worker private-memory maximum: 214.5 MB
- Adjacent Northstar suites: 2 files, 18 tests passed, 0 failed
- Strict typecheck: PASS

The first harness remediation replaced 189 fresh module imports with one cached import and added the missing public-lifetime fixture contract. This follow-up builds the 6,700-line fixture repository once and keeps at most four reusable local clones, matching the maximum number required by any single test. After every test, each used repository is reset to the immutable template revision, cleaned, and given the intentional post-commit provenance overlay again.

The full 204-test suite dropped from 1789.91 seconds to 1248.99 seconds. A local-clone-per-test experiment took 1476.78 seconds, so the final reusable pool also saves 227.79 seconds against that intermediate design. Targeted single- and multi-fixture isolation contracts passed 13/13 before the complete run.

The memory value is sampled process telemetry, not a profiler peak. It remains far below the earlier approximately 3.7 GB aborted coordination run. The remaining runtime is dominated by repeated full audit evaluation rather than repository construction.

No gate semantics or product runtime changed. No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`.
