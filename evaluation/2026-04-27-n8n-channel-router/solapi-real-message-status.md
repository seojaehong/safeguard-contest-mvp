# Solapi Real Message Delivery Status

## Sent Message Shape
SafeGuard sent a field-style LMS message with the following structure:

- Site: 시연 현장
- Core risk: 강풍 시 비계·사다리 작업 중 추락 위험
- Immediate action: 고정상태, 안전대, 접근통제선 확인
- TBM reminder: 작업중지 기준과 지게차 동선 공유

## Provider Result
- Solapi API request: accepted.
- Initial provider status: `2000`.
- Message type: `LMS`.

## Carrier Result
- Final status: failed.
- Carrier status code: `3059`.
- Failure reason: `번호도용/변작방지 차단 전송 실패`.
- Solapi reason: `변작된 발신번호.`

## Interpretation
The SafeGuard message formatting and n8n Solapi API integration are working. The current blocker is still sender-number anti-spoofing or registration propagation at the carrier layer.
