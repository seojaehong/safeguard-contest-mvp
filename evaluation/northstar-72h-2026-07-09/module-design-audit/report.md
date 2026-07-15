# Module Design Audit

Date: 2026-07-09

## Result

The internal module pages now render with the workspace daylight shell instead of the previous near-black module shell. Mobile navigation is compact enough for the page title to appear early, the document cockpit is on the same light surface system, and no checked route has horizontal overflow.

## Checks

| Route | Viewport | Shell background | Rail height | Hero top | H1 top | Document cockpit | Index button | Horizontal overflow |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| /home | desktop | rgb(250, 250, 251) | 900 | 58 | 139 | - | - | no |
| /documents | desktop | rgb(250, 250, 251) | 900 | 58 | 121 | rgb(255, 255, 255) | rgb(245, 246, 248) | no |
| /evidence | desktop | rgb(250, 250, 251) | 900 | 58 | 139 | - | - | no |
| /dispatch | desktop | rgb(250, 250, 251) | 900 | 58 | 139 | - | - | no |
| /archive | desktop | rgb(250, 250, 251) | 900 | 58 | 126 | - | - | no |
| /reports | desktop | rgb(250, 250, 251) | 900 | 58 | 139 | - | - | no |
| /ontology | desktop | rgb(250, 250, 251) | 900 | 58 | 139 | - | - | no |
| /settings/ai-connect | desktop | rgb(250, 250, 251) | 900 | 58 | 150 | - | - | no |
| /home | mobile | rgb(250, 250, 251) | 148 | 211 | 264 | - | - | no |
| /documents | mobile | rgb(250, 250, 251) | 148 | 211 | 264 | rgb(255, 255, 255) | rgb(245, 246, 248) | no |
| /reports | mobile | rgb(250, 250, 251) | 88 | 151 | 204 | - | - | no |
| /settings/ai-connect | mobile | rgb(250, 250, 251) | 148 | 211 | 264 | - | - | no |

## Errors

- None

## Commands

```powershell
npm.cmd test -- tests\module-shell-design-regression.test.ts
npm.cmd test -- tests\module-shell-navigation.test.ts
npm.cmd test -- tests\workspace-layout-regression.test.ts
```
