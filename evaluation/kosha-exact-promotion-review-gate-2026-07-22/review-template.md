# KOSHA Exact Promotion Human Review Checklist

Generated at: `2026-08-31T20:15:22.674Z`

Source HEAD: `72c32feafdbc01a687d35d8d155a4197374264d3`

Candidates: `8`

## Review Boundary

- 이 문서는 사람 검토를 돕는 읽기 전용 packet입니다.
- 기계 evidence는 사람 검토를 대체하지 않습니다.
- 체크 완료만으로 exact-trust promotion이 승인되거나 registry artifact가 생성되지 않습니다.
- 실제 입력은 같은 폴더의 `review-template.json`에 기록한 뒤 review gate를 실행합니다.

## Review Instructions

1. 공식 PDF를 열고 stable key, 버전, 제목, 파일 ID, 게시일을 확인합니다.
2. body/PDF hash와 lifecycle evidence를 대조합니다.
3. 세 semantic group의 발췌와 page receipt를 직접 확인합니다.
4. 후보별 reviewer, reviewedAt, 다섯 확인 항목과 최종 사람 확인을 JSON에 기록합니다.
5. 별도 promotion 승인 전에는 exact-kosha registry를 생성하거나 수정하지 않습니다.

## 1. D-C-10 · 건설장비(이동식크레인, 항타기 및 항발기, 타워크레인) 작업계획서 작성에 관한 기술지원규정

- 버전: `D-C-10-2026`
- 분야: 건설안전분야
- 게시일: `2026-01-30`
- 공식 파일 ID: `CTC2026012914313984348485`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914313984348485/1)
- 본문/PDF SHA-256: `1068fed72e7bbc449c48183f5c6278287eef51b292100a6cc4f308972cb36777` / `085961d6b29640b6e89592c96495b1df01b086b582f5aaf4bf941082e8f594dd`
- 페이지/정규화 문자: 70 / 40234
- 선정 근거: construction equipment work-plan coverage for mobile crane, pile driver, and tower-crane scenarios

### Machine Evidence To Inspect

- Group 1: 이동식크레인, 항타기, 항발기, 타워크레인
  - 본문 발췌: KOSHAGUIDED–C–10-2026건설장비(이동식크레인,항타기및항발기,타워크레인)작업계획서작성에관한기술지원규정 2026.1. 한국산업안전보건공단기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데...
  - page receipt: p.1 chars 26-32 sha 78cc9bc7d96a
- Group 2: 작업계획서
  - 본문 발췌: KOSHAGUIDED–C–10-2026건설장비(이동식크레인,항타기및항발기,타워크레인)작업계획서작성에관한기술지원규정 2026.1. 한국산업안전보건공단기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준향상에필요...
  - page receipt: p.1 chars 47-52 sha 78cc9bc7d96a
- Group 3: 신호수, 작업반경, 줄걸이, 전도
  - 본문 발췌: ...(다)협력업체소장,협력업체명(이동식크레인,타워크레인항타기·항발기사용업체명)(라)협력업체주소,협력업체연락처(마)하역작업주체및안전교육여부(바)작업지휘자의확인사항(사)신호수의확인사항(3)협력업체(가)주소,대표전화(나)운전원이름,면허,연락처,교육이수여부(다)신호수이름연락처,교육이수여부6.2작업기준및방법(1)이동식크레인의중량물및줄걸이방...
  - page receipt: p.16 chars 11575-11578 sha fa60024a00ef

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 2. D-C-11 · 굴착 및 토공 안전작업에 관한 기술지원규정

- 버전: `D-C-11-2026`
- 분야: 건설안전분야
- 게시일: `2026-01-30`
- 공식 파일 ID: `CTC2026012914341697414755`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012914341697414755/1)
- 본문/PDF SHA-256: `b97b0cf1ac5e43bf98c412e58896f538232402167cfeedc18806ed1eead1245c` / `266aca072d42bcc5c869218a84ecd189236e6cf0d426bd4a66d06010c0f2e144`
- 페이지/정규화 문자: 68 / 43211
- 선정 근거: excavation and earthwork coverage for common civil/construction hazard inputs

### Machine Evidence To Inspect

- Group 1: 굴착, 토공
  - 본문 발췌: KOSHAGUIDED–C–11-2026굴착및토공안전작업에관한기술지원규정 2026.1. 한국산업안전보건공단기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준...
  - page receipt: p.1 chars 21-23 sha 644f3f1bccda
- Group 2: 흙막이, 굴착면, 지보공
  - 본문 발췌: ...령(국토해양부)-건설공사의안전(건설업노동재해방지협회)-건설공사안전점검편람(한국건설기술연구원)-실무규정(Codeofpractice):굴착공사(서호주산업안전위원회)-흙막이지보공안전교육(산업안전교육원)-고용노동부고시2015-57호굴착공사표준안전작업지침-실무규정(Codeofpractice):굴착공사(서호주산업안전위원회)-OSHA§19...
  - page receipt: p.2 chars 328-331 sha 5eb5f614415e
- Group 3: 매설물, 붕괴, 토사
  - 본문 발췌: ...자:(사)고경력과학기술연우총연합회◦제.개정경과-2025년12월건설안전분야표준제정위원회심의(개정)-2026년1월표준제정위원회본위원회심의(개정) ◦관련규격및자료-지하매설물안전관리요령(국토해양부)-건설공사의안전(건설업노동재해방지협회)-건설공사안전점검편람(한국건설기술연구원)-실무규정(Codeofpractice):굴착공사(서호주산업안전...
  - page receipt: p.2 chars 230-233 sha 5eb5f614415e

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 3. A-G-1 · 추락방호망 설치 기술지원규정(수직형 추락방망 설치 기술지원규정 포함)

- 버전: `A-G-1-2025`
- 분야: 산업안전일반분야
- 게시일: `2025-03-26`
- 공식 파일 ID: `FL00021379766`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/FL00021379766/3)
- 본문/PDF SHA-256: `55fa0e40cfd6915873141bd81efe901050f4d221fa0f2e670d893fc12feb1763` / `adac02929d30d8cae251bc1fd57cacc3df6579d826bf3de85bcfdaf3be1dcd5f`
- 페이지/정규화 문자: 18 / 10322
- 선정 근거: fall-prevention net coverage that complements the current scaffold and exterior-paint exact pins
- corpus 원제목: A-G-1-2025 추락방호망 설치 기술지원규정(수직형 추락방망 설치)

### Machine Evidence To Inspect

- Group 1: 추락방호망, 수직형추락방망
  - 본문 발췌: KOSHAGUIDEA-G–1-2025추락방호망설치기술지원규정(수직형추락방망설치기술지원규정포함) 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하...
  - page receipt: p.1 chars 20-25 sha 663f1a883f4a
- Group 2: 설치, 테두리로프, 인장
  - 본문 발췌: KOSHAGUIDEA-G–1-2025추락방호망설치기술지원규정(수직형추락방망설치기술지원규정포함) 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나...
  - page receipt: p.1 chars 25-27 sha 663f1a883f4a
- Group 3: 추락, 낙하
  - 본문 발췌: KOSHAGUIDEA-G–1-2025추락방호망설치기술지원규정(수직형추락방망설치기술지원규정포함) 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데...
  - page receipt: p.1 chars 20-22 sha 663f1a883f4a

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 4. A-G-15 · 중소규모 사업장 비상조치계획 작성에 관한 기술지원규정

- 버전: `A-G-15-2026`
- 분야: 산업안전일반분야
- 게시일: `2026-01-30`
- 공식 파일 ID: `CTC2026012909391077692640`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012909391077692640/2)
- 본문/PDF SHA-256: `53b410850420b802021db72975a71647e0eecfc56d94047f2bbe524c1d405f54` / `71715efb34bf516fecd43414c8d547bb2ccbcbfe1fb256de8ac5804499c66478`
- 페이지/정규화 문자: 42 / 23570
- 선정 근거: emergency action planning coverage for first-screen stop/report/preserve document flows

### Machine Evidence To Inspect

- Group 1: 비상조치계획
  - 본문 발췌: ...안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준향상에필요한기술적권고규정임 KOSHAGUIDEA–G–15–2026 중소규모사업장비상조치계획작성에관한기술지원규정 2026.1. 한국산업안전보건공단 기술지원규정의개요 ◦개정자:(사)고경력과학기술연우총연합회 ◦제.개정경과-2025년11월산업안전일반분야표준제...
  - page receipt: p.1 chars 99-105 sha 70379b91c0ac
- Group 2: 대피, 비상연락, 응급
  - 본문 발췌: ...···················································································56.2근로자대피··························································································...
  - page receipt: p.3 chars 2065-2067 sha b596f568d1bc
- Group 3: 화재, 폭발, 누출
  - 본문 발췌: ...업장안전보건관리체계구축지원가이드.산업안전보건공단.2023◦관련법규.규칙.고시등-산업안전보건법시행령제44조(공정안전보고서의내용)-산업안전보건기준에관한규칙제241조(화재위험작업시의준수사항)◦기술지원규정의적용및문의-이기술지원규정에대한의견또는문의는한국산업안전보건공단홈페이지(www.kosha.or.kr)의기술지원규정(KOSHAGUID...
  - page receipt: p.2 chars 483-485 sha aeaf7dcb63b7

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 5. B-E-11 · 충전전로 및 그 인근에서의 전기작업에 관한 기술지원규정

- 버전: `B-E-11-2026`
- 분야: 전기안전분야
- 게시일: `2026-01-30`
- 공식 파일 ID: `CTC2026012913300640598489`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012913300640598489/1)
- 본문/PDF SHA-256: `96632acae68db0c28296499905eec09508641debeb6065f10629667690a72acc` / `4dbdee537beeb6598b834766bb179c2882d954c21ca33ccb56376ad4271e65bf`
- 페이지/정규화 문자: 31 / 20850
- 선정 근거: live electrical work coverage paired with the existing de-energized electrical exact pin

### Machine Evidence To Inspect

- Group 1: 충전전로
  - 본문 발췌: KOSHAGUIDEB–E–11-2026충전전로및그인근에서의전기작업에관한기술지원규정 2026.1. 한국산업안전보건공단기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·...
  - page receipt: p.1 chars 21-25 sha 9eeae3434b72
- Group 2: 활선, 전기작업, 접근한계
  - 본문 발췌: ...·······················································································66.활선작업여부의평가및판단················································································...
  - page receipt: p.3 chars 1800-1802 sha 9453e70f2021
- Group 3: 감전, 아크, 절연
  - 본문 발췌: ...규정1.목적이규정은「산업안전보건기준에관한규칙」제321조(충전전로에서의전기작업)에따라충전전로에서의전기작업에대하여필요한사항을정함을목적으로한다.2.적용범위(1)이규정은감전위험이있는전기기계ᆞ기구또는전로(이하"전기설비"라한다)의설치ᆞ해체ᆞ정비ᆞ점검(설비의유효성을도구를이용하여확인하는점검으로한정한다)등의작업(이하"전기작업"이라한다)을하는...
  - page receipt: p.4 chars 2988-2990 sha 72e0affd65ad

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 6. B-E-9 · 접지설비에 관한 기술지원규정

- 버전: `B-E-9-2026`
- 분야: 전기안전분야
- 게시일: `2026-01-30`
- 공식 파일 ID: `CTC2026012913250472771281`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012913250472771281/1)
- 본문/PDF SHA-256: `df5f9bc7ba40f2467370a50cf41ff5d4c7dedb22bce4d38d88667d785e779576` / `5a196084490078f1c3e8a03a82aea0bd528b68fcfa4c6bd190ad9c86fe1b59f9`
- 페이지/정규화 문자: 51 / 32583
- 선정 근거: grounding equipment coverage paired with electrical isolation and live-part controls

### Machine Evidence To Inspect

- Group 1: 접지설비
  - 본문 발췌: KOSHAGUIDEB–E–9-2026 접지설비에관한기술지원규정 2026.1. 한국산업안전보건공단기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준향상에필요한기...
  - page receipt: p.1 chars 21-25 sha 467cd52f5847
- Group 2: 접지저항, 접지도체, 보호접지
  - 본문 발췌: ...tion-NFPA70BRecommendedpracticeforelectricalequipmentmaintenanceCH29(Grounding)-TTAS.KO-04접지저항측정기술표준,한국정보통신기술협회-Electricalearthmonitoringandprotectiveconductorproving,BS4444◦관련법규.규칙.고시...
  - page receipt: p.2 chars 953-957 sha 3c8d999c8cb5
- Group 3: 감전, 고장전류, 등전위
  - 본문 발췌: ...Neutralconductor)”이라함은전력계통의중성점에접속되고전력전송에사용되는도체를말한다.(저)“보호도체(Protectiveconductor)”라함은안전을목적(감전방지등)으로설치된도체를말한다.(처)“중성선겸용보호도체(PENconductor)”라함은보호도체와중성선모두의기능을겸비한도체를말한다.(커)“다중접지(Multigroun...
  - page receipt: p.8 chars 7623-7625 sha 04e322d4ebf3

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 7. D-C-4 · 굴착기 안전보건작업 기술지원규정

- 버전: `D-C-4-2025`
- 분야: 건설안전분야
- 게시일: `2025-03-26`
- 공식 파일 ID: `FL00021380674`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/FL00021380674/2)
- 본문/PDF SHA-256: `60527e44d909198acd82fa2c95129932b67640eb7e7253ad9883ba267ff262b7` / `b032b3347a6f1bc107a3e605ef35d116b9917fed047b3d60a2eab75bfeab9252`
- 페이지/정규화 문자: 32 / 16180
- 선정 근거: excavator task coverage for construction-equipment and work-plan hazard rows

### Machine Evidence To Inspect

- Group 1: 굴착기
  - 본문 발췌: KOSHAGUIDED-C-4-2025 굴착기안전보건작업기술지원규정 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준향상에...
  - page receipt: p.1 chars 21-24 sha 9380eea5b1b1
- Group 2: 작업계획서, 유도자, 후진
  - 본문 발췌: ...25 -2- 4.굴착기관련법적필수사항다음은산업안전보건법령에관한사항으로써반드시준수하여야한다.4.1굴착기의위험방지안전보건규칙제20조(출입의금지등),제38조(사전조사및작업계획서의작성등),제40조(신호),제88조(기계의동력차단장치),제89조(운전시작전조치),제91조(고장난기계의정비등),제93조(방호장치의해체금지),제98조(제한속도의지정등...
  - page receipt: p.7 chars 3867-3872 sha 047e52e97be2
- Group 3: 충돌, 협착, 전도
  - 본문 발췌: ...조(고장난기계의정비등),제93조(방호장치의해체금지),제98조(제한속도의지정등),제99조(운전위치이탈시의조치),차량계건설기계등(제196조~206조),제221조의2(충돌위험방지조치),3(좌석안전띠의착용),4(잠금장치의체결및5(인양작업시조치)에따라사업주는굴착기운영시필요한조치를하여야한다.1. 총칙안전보건규칙 제20조(출입의 금지 등...
  - page receipt: p.7 chars 4010-4012 sha 047e52e97be2

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)

## 8. E-G-4 · 근골격계질환 예방을 위한 업종·직종별 기술지원규정

- 버전: `E-G-4-2025`
- 분야: 산업보건일반분야
- 게시일: `2025-03-26`
- 공식 파일 ID: `FL00021380215`
- 공식 PDF: [KOSHA PDF 열기](https://portal.kosha.or.kr/openapi/v1/file/down/FL00021380215/2)
- 본문/PDF SHA-256: `2b0478ccea84b4fbe4d6ba32f4d492fc819abdc58ba077a05e2f22aafeaf8678` / `63b2ec5e7c01e13d0da202accde8fea1596cbed77e33c7a4835c7186467c07b4`
- 페이지/정규화 문자: 54 / 30647
- 선정 근거: musculoskeletal prevention coverage for manual handling and repetitive work evidence
- corpus 원제목: E-G-4-2025 근골격계질환 예방을 위한 업종직종별 기술지원규정

### Machine Evidence To Inspect

- Group 1: 근골격계질환
  - 본문 발췌: KOSHAGUIDEE-G-4-2025근골격계질환예방을위한업종·직종별기술지원규정 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건...
  - page receipt: p.1 chars 20-26 sha cfe3523b5b48
- Group 2: 업종, 직종
  - 본문 발췌: KOSHAGUIDEE-G-4-2025근골격계질환예방을위한업종·직종별기술지원규정 2025.3. 한국산업안전보건공단 기술지원규정은산업안전보건기준에관한규칙등산업안전보건법령의요구사항을이행하는데참고하거나사업장안전·보건수준향상에필요...
  - page receipt: p.1 chars 31-33 sha cfe3523b5b48
- Group 3: 반복, 중량물, 부담작업, 작업자세
  - 본문 발췌: ...·····················································································266.5반복작업························································································...
  - page receipt: p.4 chars 4330-4332 sha 8a1d83a342e0

### Human Review Input

- Reviewer: ______________________________
- Reviewed at (ISO 8601): ______________________________
- [ ] 공식 URL이 선택한 stable key의 KOSHA PDF를 연다.
- [ ] 공식 파일 ID, 버전, 게시일이 metadata와 body corpus provenance에 일치한다.
- [ ] body SHA-256과 PDF SHA-256을 immutable acquisition evidence와 다시 대조했다.
- [ ] 현재 lifecycle 상태를 확인했고 폐기되거나 대체된 버전을 제외했다.
- [ ] exact-kosha registry JSON 생성 전에 사람의 최종 확인을 기록한다.
- [ ] 최종 사람 확인 완료 (`humanConfirmed=true` 입력 전 마지막 확인)
