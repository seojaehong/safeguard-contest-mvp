# Northstar CI Remediation

## Trigger

GitHub Actions run `29491156696` completed 1,915 tests with three failures:

- one frontend evidence source-identity mismatch;
- two photo-analysis assertions that predated the exact D-C-7 registry entry.

## Remediation

- Regenerated the static, audit bundle, normal bundle, and 108-row browser
  evidence on source `7d5b09b55bd97cc078b01d9a39e5e61060b14c11`.
- Updated photo-analysis expectations to retain D-C-7 as direct evidence.
- Added a product guard that permits KOSHA controls only when the control text is
  extractable from the verified body. Synthetic catalog prose is no longer
  promoted to `confirmedControls`.

## Accepted evidence

- Frontend and photo focused tests: 78/78 passed.
- Photo grounding suite after the product guard: 39/39 passed.
- Frontend browser audit: 108/108 passed, findings 0.
- Normal build: 28/28, audit marker 0.
- Audit build: 28/28, expected audit marker 1.
- Strict TypeScript typecheck: passed.

## Rejected evidence

The local full serial retry did not produce a final Vitest summary. It stalled
during browser-test teardown and was terminated after an extended wait. The raw
log and exit marker are preserved as `full-test.log` and `full-test.exit.txt`;
exit `-1` is not a test assertion result and is not reported as PASS.

The next GitHub Actions run is the authoritative full-suite gate.
