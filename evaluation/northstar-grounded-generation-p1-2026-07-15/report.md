# Grounded Generation P1 Remediation

## Scope

- Starting HEAD: `ec3f6bef6380774efda7e2b04e4ad38dd5aad239`
- Branch: `fix/northstar-grounded-current-20260715`
- No database schema, migration, data mutation, package manifest, or lockfile change

## Contract

1. `현장 확인 필요` is accepted only when whitespace normalization makes the entire field equal to that sentinel.
2. A mixed value such as `현장 확인 필요 후 안전대를 체결한다.` cannot bypass packet grounding.
3. Short Korean nominal instructions such as `안전대 체결`, `출입 제한`, `설비 격리`, `전원 잠금`, `통제선 마련`, `유도자 유도`, and `감시인 감시` must resolve to the immutable packet.
4. Nominal detection is structural and does not depend on a finite action-verb list.
5. Declarative descriptive prose remains allowed.

## TDD Evidence

- Initial focused RED: 29 passed, 2 failed. Both structured and narrative mixed-sentinel cases were incorrectly accepted.
- Final contract suite: 1 file, 39 tests passed.
- Generation focused suite: 4 files, 94 tests passed.
- Strict TypeScript typecheck: passed.
- `git diff --check`: passed.

## Fresh Re-review

- Starting HEAD: `467c734cb6ec178c6ec445b209a4565daab01a2d`
- RED: the focused contract run exposed 3 behavioral failures: ungrounded `safetyEducationPoints` passed, while both descriptive nominal fields were rejected.
- `educationRecordStructured` now activates packet validation for the sibling `safetyEducationPoints` array.
- Two-token action-shaped nominal clauses remain fail-closed without a finite verb list. Longer `field name + descriptive value` noun fields remain allowed.
- `workPlanStructured`, `tbmBriefingStructured`, `tbmLogStructured`, and `educationRecordStructured` paths now render concrete Korean document labels in `AnswerPanel`.
- Focused contract and label tests: 2 files, 48 tests passed.
- Generation focused suite: 5 files, 103 tests passed.
- Strict TypeScript typecheck and `git diff --check`: passed.

## Third Re-review

- Starting HEAD: `c82d3fbb9d1c081df1c9fa51f67175c7b48ba3d0`
- RED: 7 failures covering 2 multiword nominal actions, 1 independent `safetyEducationPoints` array, and 4 actual structured rejected-group keys.
- Nominal clauses from 2 through 6 tokens now fail closed by default. The bounded schema metadata labels `작업 장소` and `사용 장비` distinguish descriptive field values without an action-verb list.
- `safetyEducationPoints` validation no longer depends on the `educationRecordStructured` sibling.
- `AnswerPanel` imports and uses the tested `groundingGroupLabel` helper for `rejectedGroups`, including all 4 structured group keys.
- Focused contract and label tests: 2 files, 54 tests passed.
- Generation focused suite: 5 files, 109 tests passed.
- Strict TypeScript typecheck and `git diff --check`: passed.
