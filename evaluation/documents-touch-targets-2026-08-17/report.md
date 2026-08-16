# Documents Touch Target Evidence

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_DOCUMENT_TOUCH_TARGETS`
- Source: `1a4ab653e7beac74abe536bdbd66125af3a19043`
- Production: `local`
- Scope: Documents section actions, risk-row selectors, and human-review close control
- Boundary: no DB/provider/Share mutation; exact saved Share remains `MISSING_EVIDENCE`

| Theme | Viewport | Body/Viewport | Shell ratio | Actions px | Risk selectors px | Review close | Verdict |
|---|---|---:|---:|---|---|---:|---|
| day | desktop-1440x723 | 723/723 | 1.75 | 44/44 | 44/44/44 | 44x44 | PASS |
| night | desktop-1440x723 | 723/723 | 1.75 | 44/44 | 44/44/44 | 44x44 | PASS |
| day | mobile-390x723 | 723/723 | 2.07 | 44/44 | 44/44/44 | 44x44 | PASS |
| night | mobile-390x723 | 723/723 | 2.07 | 44/44 | 44/44/44 | 44x44 | PASS |

All checked controls preserve the 44px interaction floor while the Documents route remains viewport-contained with local editor scrolling.
