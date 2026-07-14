# Share v2 cutoff handoff

- Verdict: HOLD. Do not integrate into main.
- Product commit: `7a56434a99b043edf8601f772d9b9606220863a0`
- Product tree: `ecfc310b0e367f45a2588d4b3f1a04a49b576dde`
- Parent product commits: `d0a38032fc84b12fd895e97e7218d9d43bbfee1b`, `6eb00fafdf0da2ff086f826effe884f3be9cbeed`
- RED contract commit: `424331b45c7173c74abe5c053874b06d98b3fa77`
- Main authority supplied for this cutoff: `920c7f360688352156de4854b4957a9f2f1f0e43`
- Ontology authority: intentionally unbound because the latest SHA was not supplied.

## Minimum gates

- Focused authority/channel/policy/route unit tests: 4 files, 66 passed, 0 failed.
- Windows browser harness termination: 1 file, 2 passed, 0 failed. The preceding run exposed a deadline-edge verification bug and is retained as RED evidence.
- Strict TypeScript: exit 0.
- Actual browser subset bound to the product SHA/tree: 1 failed, 129 skipped, exit 1, 41.66 seconds.
- Browser blocker: delayed local edit/restore still changes `workpack_revalidation` to `ready` after an old server workpack response. The old server content binding differs from the edited local content binding.
- Share-owned Vitest/Next processes after the run: 0.
- Full 128-row browser matrix: not executed due to the hard cutoff.
- Production build: not executed due to the hard cutoff.
- Full 23-file Share unit suite, evidence validator, static audit, current merge trees: not rerun due to the hard cutoff.

The focused unit and harness gates are green, but the actual browser authority bypass remains reproducible. This branch requires another product fix and fresh independent review.
