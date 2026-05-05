# SafeClaw 상용 SaaS v1 원페이지

## 한 줄 정의
SafeClaw는 현장관리자가 오늘 작업을 한 줄로 입력하면 위험성평가표, 작업계획서, TBM일지, 안전보건교육 기록, 외국인 공지, 전파 이력을 한 작업공간에서 처리하는 안전 문서 운영 SaaS입니다.

## 제출 기준 판정
- 최종 게이트: pass_with_notice
- 정식 전파 채널: 메일, 문자
- 제외 채널: 카카오, 밴드
- HWPX: 원본 셀 단위 복제물이 아니라 제출형 초안
- PDF: 서버 export와 브라우저 검토 흐름 병행

## 닫힌 운영 흐름
1. 작업 입력.
2. 법령, KOSHA, 재해사례, 기상, 교육 데이터 반영.
3. 위험성평가표, 작업계획서, 허가/점검표, TBM일지 생성.
4. 사용자가 AI 보완 제안을 편집 후 삽입.
5. PDF/HWPX/XLS 다운로드.
6. 메일/SMS 전파.
7. 관리자 이력에서 재열기.

## 게이트 요약
- ask-orchestration: pass
- auth-history-reuse: pass_with_notice
- document-downloads: pass_with_notice
- public-data-ai-map: pass
- ai-remediation-flow: pass
- dispatch-policy: pass_with_notice
- screenshots: pass

## 정직한 고지
SafeClaw는 공식자료 기반 초안과 현장 기록 보조 도구입니다. 최종 제출·법률 판단·현장 조치 책임은 현장 확인 절차를 거쳐 확정합니다.
