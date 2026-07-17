# Workspace Editor Focus Test Stability

## Finding

The generated-document edit-flow regression test waited for the transient focus cue, opened additional disclosures, and then queried the same cue again after its intentional 2.2-second dismissal. Slow browser runs therefore failed with `Missing layout target: .editor-focus-message` even though edit entry and focus succeeded.

## Change

- Measure the focus-message background immediately after the cue becomes visible.
- Preserve the product focus timer and all edit-flow behavior.
- Preserve the later layout, responsive, and return-to-review assertions.

## Verification

- Focused browser regression: 1/1 passed, 23 unrelated cases skipped by the test-name filter.
- Duration: 43.86 seconds.
