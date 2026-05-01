# SafeClaw Design Gap Analysis

## 기준

최종 기준은 `safeclaw Brand Guide _standalone_.html`입니다. Remix 산출물의 A안/C안은 반영 대상이 아니며, B안도 그대로 복사하지 않습니다. B안에서 확인한 작업공간 밀도와 패널 구조는 참고만 하고, 실제 적용은 브랜드 가이드의 원칙으로 정렬합니다.

## 발견한 갭

- 이름은 SafeClaw로 바뀌었지만 legacy soft-demo CSS가 남아 있었습니다.
- `linear-gradient`, `radial-gradient`, 큰 radius, pill 버튼, decorative shadow가 주요 화면에 남아 있었습니다.
- 일부 V2/demo/supporting surface는 전역 토큰보다 뒤쪽 CSS에 의해 다시 말랑한 카드로 렌더링될 수 있었습니다.
- 브랜드 가이드는 문서화됐지만 “A/C 무시, 최종 가이드를 기준으로 한다”는 결정이 리포트에 명시되지 않았습니다.

## 정렬 방향

- Steel-neutral surface를 기본으로 둡니다.
- Hazard Yellow는 주요 액션과 진행/활성 신호에만 사용합니다.
- 메인 카드와 패널은 4px radius, no shadow로 고정합니다.
- 한국어를 본문/명령의 중심에 두고, mono label은 상태와 출처에만 사용합니다.
- 외국인 근로자 전송문은 안전 이해를 위해 제한적 pictogram을 허용합니다.

## 이번 패스 반영

- `body`, `topbar`, `brand-mark`, navigation 계열에서 legacy soft styling을 일부 직접 제거했습니다.
- production-critical surface에 최종 브랜드 가이드 cascade guard를 추가했습니다.
- V2/demo/문서편집/근거/전파/루브릭 surface의 radius, shadow, gradient를 브랜드 가이드 기준으로 정렬했습니다.
- 진행률/활성 상태는 yellow rail과 square meter로 정리했습니다.
- `/` 첫 화면을 단순 작업공간이 아니라 홈페이지형 랜딩 구조로 재편했습니다.
- 랜딩은 hero, 연동 데이터 strip, 문제/해결, 핵심 3종, workflow 섹션으로 나뉩니다.
- 기존 작업공간은 아래로 유지해 실제 기능 흐름을 보존했습니다.

## 남은 작업

- 장기적으로는 `app/globals.css`를 feature section별 파일 또는 token/layer 구조로 분리해 legacy rule 자체를 제거해야 합니다.
- 현재 패스는 제출 안정성을 위해 layout 변경 없이 visual layer를 정렬했습니다.
- 다음 픽셀 패스에서는 브라우저 스크린샷 기준으로 hero, document editor, evidence panel, dispatch panel을 각각 비교해야 합니다.
