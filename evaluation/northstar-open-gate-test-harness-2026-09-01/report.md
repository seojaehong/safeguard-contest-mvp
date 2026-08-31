# Northstar open-gate test harness

- Verdict: `PASS_CURRENT_SOURCE_NORTHSTAR_OPEN_GATE_HARNESS_MEMORY_BOUNDED`
- Source before change: `d7abe2dd20779f13c5655fb56f044baeeed0b1e8`
- Full suite: 1 file, 204 tests passed, 0 failed
- Duration: 1789.91 seconds
- Observed worker private-memory maximum: 141.0 MB
- Adjacent Northstar suites: 2 files, 18 tests passed, 0 failed
- Strict typecheck: PASS

The test helper previously created and imported a fresh copy of the open-gate module for every test. It now keeps the existing shebang-stripping isolation behavior but reuses one imported module. The default fixture also includes the current public-lifetime remediation receipt and its governed paths, so the baseline gate is no longer incorrectly reported as evidence-missing.

The memory value is sampled process telemetry, not a profiler peak. The prior approximately 3.7 GB value comes from the earlier aborted coordination run and is retained only as comparative context.

No gate semantics or product runtime changed. No database, provider, Share-session, vector, Wiki, or KOSHA registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`.
