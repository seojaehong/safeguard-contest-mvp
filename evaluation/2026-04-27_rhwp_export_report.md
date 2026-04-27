# rhwp HWPX Export Report

Generated at: 2026-04-27

## Issue

The previous browser HWPX export created a lightweight ZIP/XML package manually. Korean text could appear broken or incompatible in stricter HWPX readers because the package was not generated through a HWP/HWPX document model.

## Change

- Added `@rhwp/core@0.7.6`.
- Served `rhwp_bg.wasm` from `public/rhwp_bg.wasm`.
- Replaced the manual HWPX ZIP builder in `WorkpackEditor` with rhwp:
  - initialize WASM with `/rhwp_bg.wasm`
  - create a blank HWP document
  - insert the edited Korean text
  - export through `HwpDocument.exportHwpx()`

## Verification

- `npm.cmd run build`: passed
- `npm.cmd run typecheck`: passed
- Local rhwp export script generated `evaluation/2026-04-27-rhwp-inspect/rhwp-export.hwpx`
- Exported HWPX package contains:
  - `mimetype`
  - `Contents/content.hpf`
  - `Contents/section0.xml`
  - `Preview/PrvText.txt`
- `Contents/section0.xml` preserved Korean text including `위험성평가표` and `한글 깨짐 확인`.

## Notes

This moves HWPX export from a hand-built compatibility approximation to the rhwp document serializer. If a later phase needs official template-grade documents, the next step is to load a validated HWPX template through rhwp and replace named fields.
