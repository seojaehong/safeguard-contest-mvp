# Browser RED classification

The isolated browser run bound to rejected product `bec9dd71f2a249bc184abea477e911afd10845ca` exited `1`: one file failed, `17` tests failed, `113` passed, and only `111/128` matrix rows completed in `1260.09s`.

Every failure was parsed from its Vitest case ID and split into theme, viewport, fixture, and scale axes. `browser-red-classification.json` contains all 17 rows.

| Cause | Rows | Responsibility | Minimal correction |
| --- | ---: | --- | --- |
| `navigation_settlement_contract` | 8 | browser expectation | Wait for the actual document owner, exercise its return control, and settle back on Share. |
| `product_state_transition` | 8 | product | Keep the server stale reason while authority is absent; clear it only when channel readiness can restart. |
| `async_persistence_settlement_contract` | 1 | browser expectation | Wait for the persisted terminal state and history link before exact assertions. |

The eight stale rows cover every day/night, desktop/mobile, and normal/root-text-200 combination. The eight review rows cover the same complete axis set. The remaining persistence-settlement failure is `day-desktop:fail_dispatch:owning_root_text_200`.

No assertion was weakened, skipped, or allowlisted. The final run uses the same 130-test census and exercises real route navigation for the language review return journey.
