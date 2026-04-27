# Solapi Final Night Test

## Summary
After the user received the unblock notice, SafeGuard sent one final field-style LMS message through the n8n Solapi route.

## Provider Result
- SafeGuard webhook: success.
- Solapi API receipt: accepted.
- Message type: `LMS`.
- Initial status: `2000`.

## Carrier Result
- Final status: failed.
- First carrier result: `3048`, KISA personal number-spoofing block.
- Retry carrier result: `3059`, number spoofing/modification protection block.
- Solapi reason: `변작된 발신번호.`

## Interpretation
The SafeGuard integration is functioning, but the phone carrier/KISA sender-number protection was still active at the time of this test. Retest after the carrier-side unblock fully propagates.
