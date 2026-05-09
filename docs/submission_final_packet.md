# SafeClaw 제출 패키지 기준 문서

작성일: 2026-05-09

## 제출 기준으로 사용할 파일

아래 파일만 최종 제출 패키지의 기준으로 사용합니다.

| 용도 | 파일 |
|---|---|
| 최종 판정 | `evaluation/final-90-gate/decision.md` |
| 기계 판정 | `evaluation/final-90-gate/decision.json` |
| 제출 준비 설명 | `docs/submission_readiness_report.md` |
| 상용화 요약 | `docs/commercialization-onepager.md` |
| 공공데이터 및 AI 반영 근거 | `docs/submission-evidence-map.md` |
| 신청서 입력 참고 | `docs/submission_form_data_entries.md` |
| 보안 및 개인정보 고지 | `docs/security_privacy_readiness.md` |
| 최신 구조화 출력 smoke | `evaluation/2026-05-09-pr29-rebase-smoke/summary.md` |

## 제출 기준에서 제외할 파일

아래 파일은 과거 감사 로그 또는 개발 중간 산출물입니다. 제출 판정 기준으로 사용하지 않습니다.

| 파일 | 제외 이유 |
|---|---|
| `evaluation/final-99-gate/decision.md` | PR #29 이전 상태의 과거 판정입니다. |
| 과거 `blocked` smoke 파일 | 결함 추적용으로 보관하지만 최신 판정을 대체하지 않습니다. |
| 생성된 임시 바이너리 파일 | 재현 검증용 산출물이며 제출 설명의 기준 파일은 아닙니다. |

## 제출 설명 기준

- SafeClaw는 공공데이터와 AI를 활용해 안전문서 초안을 생성하고, 현장 검토 후 사용할 수 있게 돕는 서비스입니다.
- 법령, KOSHA, 기상, 재해사례, 내부 지식 DB가 문서 생성과 보완 근거로 연결됩니다.
- AI 결과는 자동 확정하지 않고, 사용자가 확인하고 편집한 뒤 삽입합니다.
- 제출 기준 전파 채널은 이메일과 SMS입니다.
- 카카오와 밴드는 승인 완료 후 확장합니다.

## 최종 체크

제출 직전 아래 순서로 한 번만 재현합니다.

1. 관리자 로그인
2. 새 현장 입력
3. 문서팩 생성
4. 위험성평가표, 작업계획서, TBM, 교육일지 다운로드
5. 이메일 또는 SMS 전파
6. 이력 재조회
