# SafeClaw Language Grid Design Check

- Checked at: 2026-05-08T11:09:33.698Z
- Target: http://127.0.0.1:3210/
- Overall: pass

## Results

### desktop-1440

- Viewport: 1440x1000
- Items: 10
- Rows: 5 + 5
- Grid columns: 276.391px 276.406px 276.391px 276.406px 276.391px
- Screenshot: desktop-1440-language-grid.png
- Result: pass

### wide-1920

- Viewport: 1920x1080
- Items: 10
- Rows: 5 + 5
- Grid columns: 372.391px 372.406px 372.391px 372.406px 372.391px
- Screenshot: wide-1920-language-grid.png
- Result: pass

## Notes

The landing language matrix now uses a balanced 5 x 2 layout on desktop widths. The same multilingual font stack is applied to language titles and subtitles so Thai, Khmer, Nepali, Myanmar, Mongolian, Chinese, and Latin scripts render from the same fallback strategy.
