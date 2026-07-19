# Foreign Dispatch Live Post-Deploy Verification

Date: 2026-07-20

Served build from `/api/build-info`: `7c35c4dc9f72a4c6c14f703f7ec388447a60edd3`

## Probe

Route: `POST https://www.safeclaw.kr/api/ask`

Mode: `enhanced`

Scenario:

> 그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 베트남 작업자 2명과 신규 작업자 1명 포함, 작업자 6명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 베트남어 안전교육까지 반영해 위험성평가, TBM, 외국인 전송본을 만들어줘.

## Result

- Runtime mode: `live`
- Elapsed: 19.4s
- Vietnamese lines: 7
- Hangul in Vietnamese recipient lines: false
- `confined-space hazard`: false
- `heat illness`: false
- `fire or hot-work hazard`: false
- Vietnamese ventilation term present: true
- Vietnamese heat-stress term present: true

Sample recipient lines:

```text
Công việc hôm nay: Hàn, cắt và công việc có lửa
Nguy cơ chính của công việc này: nguy cơ cháy khi hàn/cắt, nguy cơ thiếu oxy hoặc ngạt do thông gió kém, nguy cơ say nóng hoặc kiệt sức do nóng
Trước khi bắt đầu: Dọn vật dễ cháy, bố trí người giám sát cháy và chuẩn bị bình chữa cháy.
Kiểm tra thông gió, nồng độ oxy và bố trí người giám sát bên ngoài trước khi vào khu vực kín.
Uống nước, nghỉ ở nơi mát và báo ngay nếu chóng mặt hoặc buồn nôn.
```

## Verdict

PASS for the specific live recipient-message regression. The production response no longer leaks the previously observed English fallback hazard labels into the Vietnamese worker message.

This verification does not claim real SMS/Kakao/email provider delivery. Provider dispatch remains separately gated.

