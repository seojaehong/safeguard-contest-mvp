# SafeGuard Template Source Scan

## Summary
- Root: `C:\Users\iceam\OneDrive\_40_안전`
- Candidate files: 498
- Purpose: replace the current lightweight demo templates with field-like safety document templates.

## Best Template Sources
| Use | Recommended source | Why it matters |
|---|---|---|
| 위험성평가표 | `00.참고자료\16.위험성평가\0.위험성평가관련자료(최신)\3.위험성평가 관련 서식.hwp` | 공식 서식형 원천으로 앱의 위험성평가표 기본 구조를 대체하기 좋음 |
| 현장 위험성평가 사례 | `위험성보고서작성\문진숙\0.서진산업\0.1회차\주식회사 서진산업(1회차)\(회사자료)\위험성평가 실시 서진산업.hwp` | 실제 사업장 작성본 성격이라 현장감 있는 항목과 작성 밀도를 참고 가능 |
| 시트형 위험성평가 | `서부발전\1.2022_하반기\2.1219-1220 김포\0.사업장자료\김포열병합 시운전 위험성평가_rev.0.xlsx` | 앱의 XLSX/Google Sheet export 템플릿 후보 |
| 안전교육 기록 | `위험성보고서작성\문진숙\0.서진산업\0.1회차\주식회사 서진산업(1회차)\(회사자료)\안전보건교육일지.pdf` | 안전교육 기록 초안의 실제 교육일지 필드 후보 |
| 건설 점검/TBM 보조 | `00.참고자료\0.건설\(붙임2) 건설공사 등 안전점검표.hwp` | TBM과 작업 전 점검표를 결합하는 화면/문서 구조 후보 |
| 중대재해 서식 묶음 | `00.참고자료\00.안전보건시스템,계획(관리체계)\6. 활용 서식 모음_'중대재해처벌법.hwp` | 안전보건관리체계 문서팩의 공통 필드 원천 |

## risk_assessment
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.xlsx` | `서부발전\1.2022_하반기\2.1219-1220 김포\0.사업장자료\김포열병합 시운전 위험성평가_rev.0.xlsx` | keywords=위험성평가, 위험성, 시운전 위험성; template_hints=rev; ext=.xlsx |
| high | `.hwp` | `서부발전\0.2022_상반기\4. 서인천(0525-0527)\1.결과보고서\참고자료\■화학물질 위험성평가 외.hwp` | keywords=위험성평가, 위험성, 화학물질 위험성; template_hints=보고서; ext=.hwp |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.위험성평가관련자료(최신)\3.위험성평가 관련 서식.hwp` | keywords=위험성평가, 위험성; template_hints=서식, 최신; ext=.hwp |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.위험성평가관련자료(최신)\6.(참고)위험성평가컨설팅 양식(대화형기법)_지게차,추락.hwp` | keywords=위험성평가, 위험성; template_hints=양식, 최신; ext=.hwp |
| high | `.pdf` | `0.위험성평가제안\참고자료\350718_유해위험요인_자기관리(위험성평가)_인식태도조사_및_시범사업_성과평가_2012_최종보고서.pdf` | keywords=위험성평가, 위험성, 유해위험; template_hints=최종, 보고서; ext=.pdf |
| high | `.xlsx` | `0.위험성평가제안\참고자료\산업재해현황_20230130.xlsx` | keywords=위험성평가, 위험성; ext=.xlsx |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.위험성평가관련자료(최신)\2.위험성평가 규정.hwp` | keywords=위험성평가, 위험성; template_hints=최신; ext=.hwp |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.체계구축 지원서류\2020 위험성평가 지침해설서 - 관련 서식.hwp` | keywords=위험성평가, 위험성; template_hints=서식; ext=.hwp |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.체계구축 지원서류\안전보건관리체계 구축 컨설팅 매뉴얼(최종본).hwp` | keywords=위험성평가, 위험성; template_hints=최종; ext=.hwp |
| high | `.hwp` | `00.참고자료\16.위험성평가\0.체계구축 지원서류\위험성평가컨설팅 양식(대화형기법)_지게차,추락_v1.hwp` | keywords=위험성평가, 위험성; template_hints=양식; ext=.hwp |
| high | `.hwp` | `00.참고자료\21.로봇\협동운전 위험성평가 보고서.hwp` | keywords=위험성평가, 위험성; template_hints=보고서; ext=.hwp |
| high | `.hwpx` | `서부발전\1.2022_하반기\3.1222-1223 문경\1.점검표\④ 도급인의 위험성평가(이정도).hwpx` | keywords=위험성평가, 위험성; template_hints=점검표; ext=.hwpx |

## tbm_or_prework
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.hwp` | `서부발전\1.2022_하반기\0.1117-1124_태안\7. 태안(0608-0616)\3. 결과보고서\태안발전본부 정기점검표-221127_최종.hwp` | keywords=정기점검표; template_hints=점검표, 최종, 보고서; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\2.1219-1220 김포\4. 군산발전본부 정기점검표_1214(최종).hwp` | keywords=정기점검표; template_hints=점검표, 최종; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\2.1219-1220 김포\5. 김포건설본부 정기점검표(12.19-20)_최종.hwp` | keywords=정기점검표; template_hints=점검표, 최종; ext=.hwp |
| high | `.docx` | `00.참고자료\0.교육\0.tbm\230209 작업 전 안전점검회의 가이드(배포용).docx` | keywords=TBM, 작업 전; ext=.docx |
| high | `.docx` | `00.참고자료\0.교육\0.tbm\230209 작업 전 안전점검회의 가이드(배포용)1.docx` | keywords=TBM, 작업 전; ext=.docx |
| high | `.hwp` | `00.참고자료\0.건설\(붙임2) 건설공사 등 안전점검표.hwp` | keywords=안전점검표; template_hints=점검표; ext=.hwp |
| high | `.pdf` | `00.참고자료\0.교육\0.tbm\230209 작업 전 안전점검회의 가이드(배포용).pdf` | keywords=TBM, 작업 전; ext=.pdf |
| high | `.hwp` | `서부발전\1.2022_하반기\1.1128-1201 평택\결과보고\221130_2. 평택발전본부 정기점검표 (김종우).hwp` | keywords=정기점검표; template_hints=점검표; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\1.1128-1201 평택\결과보고\221130_2. 평택발전본부 정기점검표(재홍편집).hwp` | keywords=정기점검표; template_hints=점검표; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\1.1128-1201 평택\결과보고\중대재해처벌법 이행 정기점검표(평택 입력).hwp` | keywords=정기점검표; template_hints=점검표; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\1.1128-1201 평택\결과보고\평택발전본부 정기점검표(JDLEE).hwp` | keywords=정기점검표; template_hints=점검표; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\1.1128-1201 평택\평택발전본부 정기점검표(1)-221127(의왕).hwp` | keywords=정기점검표; template_hints=점검표; ext=.hwp |

## safety_education
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.pdf` | `위험성보고서작성\문진숙\0.서진산업\0.1회차\주식회사 서진산업(1회차)\(회사자료)\안전보건교육일지.pdf` | keywords=안전보건교육, 교육일지, 교육; template_hints=교육일지, 보고서; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.건설\1.4 2023년 건설업 기초안전보건교육 표준교재(별첨 건설산재예방정책과)7.pdf` | keywords=안전보건교육, 교육, 기초안전보건교육; ext=.pdf |
| high | `.hwp` | `서부발전\1.2022_하반기\0.1117-1124_태안\1.협력사\3.협력사회신자료\2.한전산업개발\중대재해처벌법 이행상태 점검 관련 사업장 안전보건교육 실시결과(한전산업개발).hwp` | keywords=안전보건교육, 교육; template_hints=실시; ext=.hwp |
| high | `.hwp` | `서부발전\1.2022_하반기\0.1117-1124_태안\1.협력사\3.협력사회신자료\9.hkc\hkc2\(주)HKC ⑪ 사업장 안전보건교육 실시결과 여부.hwp` | keywords=안전보건교육, 교육; template_hints=실시; ext=.hwp |
| high | `.pdf` | `00.참고자료\0.교육\2022년안전보건교육안내서.pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.교육\[고용노동부]산업안전보건교육 가이드북_v5.pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.교육\[별표 5] 안전보건교육 교육대상별 교육내용(제26조제1항 등 관련)(산업안전보건법 시행규칙).pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.교육\부교재_03_법에서 규정하는 안전보건교육1_2.0_191120.pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.교육\산업안전보건법 시행규칙 [별표 7] 안전보건교육 교육대상자별 교육내용.pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.pdf` | `서부발전\1.2022_하반기\1.1128-1201 평택\협력사\0..20221121\0.OES\_\특별안전보건교육 크레인(2명).pdf` | keywords=안전보건교육, 교육; ext=.pdf |
| high | `.hwp` | `00.참고자료\0.교육\건설기계 사용 특수형태근로종사자 안전강화 사업시행방법 안내문.hwp` | keywords=교육; ext=.hwp |
| high | `.hwp` | `00.참고자료\0.교육\특수형태근로종사자 교육의무 시행 질의회시.hwp` | keywords=교육; ext=.hwp |

## inspection_checklist
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.hwp` | `00.참고자료\0.건설\12.21_건설업_중대산업재해_예방을_위한_자율점검표(첨부_건설산재예방정책과).hwp` | keywords=점검표, 자율점검; template_hints=점검표; ext=.hwp |
| high | `.hwp` | `00.참고자료\12.중대재해처벌법\중대재해 안전보건관리체계 구축 및 사업장 이행점검 확인표-실무자단체(이상국) -목차수정.hwp` | keywords=확인표, 이행점검; ext=.hwp |
| high | `.pdf` | `00.참고자료\0.건설\건설업 중대산업재해 예방을 위한 자율점검표.pdf` | keywords=점검표, 자율점검; template_hints=점검표; ext=.pdf |
| high | `.pdf` | `00.참고자료\0.안전보건실무길잡이\1.11 화학업종 중소기업을 위한 안전보건관리 자율점검표(별첨).pdf` | keywords=점검표, 자율점검; template_hints=점검표; ext=.pdf |
| high | `.pdf` | `00.참고자료\00.안전보건시스템,계획(관리체계)\건설업 자율점검표(고위험 기인물 12종).pdf` | keywords=점검표, 자율점검; template_hints=점검표; ext=.pdf |
| high | `.hwp` | `00.참고자료\14.근골격계\참고자료\01_부담작업체크리스트.hwp` | keywords=체크리스트; template_hints=체크리스트; ext=.hwp |
| high | `.hwp` | `00.참고자료\14.근골격계\참고자료\[첨부1]부담작업체크리스트.hwp` | keywords=체크리스트; template_hints=체크리스트; ext=.hwp |
| high | `.hwp` | `서부발전\0.2022_상반기\000.보고서\11. 상반기 정기점검(2022.7.7.)-이행점검수정19차(재홍).hwp` | keywords=이행점검; template_hints=보고서; ext=.hwp |
| high | `.hwp` | `서부발전\0.2022_상반기\000.보고서\11. 상반기 정기점검(2022.7.7.)-이행점검수정19차.hwp` | keywords=이행점검; template_hints=보고서; ext=.hwp |
| high | `.hwp` | `서부발전\0.2022_상반기\000.보고서\9. 상반기 정기점검(2022.7.7.)-이행점검수정안_DJ2.hwp` | keywords=이행점검; template_hints=보고서; ext=.hwp |
| high | `.hwp` | `서부발전\0.2022_상반기\000.보고서\9. 상반기 정기점검(2022.7.7.)-이행점검수정안_재홍(목차확인완료).hwp` | keywords=이행점검; template_hints=보고서; ext=.hwp |
| high | `.hwp` | `서부발전\0.2022_상반기\000.보고서\9. 상반기 정기점검(2022.7.7.)-이행점검수정안_재홍f.hwp` | keywords=이행점검; template_hints=보고서; ext=.hwp |

## safety_management_system
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.hwp` | `00.참고자료\00.안전보건시스템,계획(관리체계)\6. 활용 서식 모음_'중대재해처벌법 - 복사본.hwp` | keywords=중대재해, 활용 서식; template_hints=서식, 활용 서식; ext=.hwp |
| high | `.hwp` | `00.참고자료\00.안전보건시스템,계획(관리체계)\6. 활용 서식 모음_'중대재해처벌법.hwp` | keywords=중대재해, 활용 서식; template_hints=서식, 활용 서식; ext=.hwp |
| high | `.pdf` | `안전매뉴얼(202312_실무자단체제출)\안전보건관리체계 구축 실시 매뉴얼 작성 제안서\1. 안전보건매뉴얼-최종.pdf` | keywords=안전보건관리체계, 안전보건매뉴얼, 매뉴얼; template_hints=실시, 최종; ext=.pdf |
| high | `.hwp` | `00.참고자료\00.안전보건시스템,계획(관리체계)\안전보건관리체계 구축 컨설팅 매뉴얼(최종본).hwp` | keywords=안전보건관리체계, 매뉴얼; template_hints=최종; ext=.hwp |
| high | `.hwp` | `00.참고자료\00.안전보건시스템,계획(관리체계)\중규모기업을 위한 안전보건관리체계 구축 컨설팅 매뉴얼.hwp` | keywords=안전보건관리체계, 매뉴얼; ext=.hwp |
| high | `.hwp` | `안전매뉴얼(202312_실무자단체제출)\붙임 1. 신청서(안전보건관리체계 구축 실시 매뉴얼)_실무기관 위너스(김진관,조대진,서재홍).hwp` | keywords=안전보건관리체계, 매뉴얼; template_hints=실시; ext=.hwp |
| high | `.hwp` | `안전매뉴얼(202312_실무자단체제출)\안전보건관리체계 구축 실시 매뉴얼 작성 제안서\붙임 1. 신청서(안전보건관리체계 구축 실시 매뉴얼)_실무기관 위너스(김진관,조대진,서재홍).hwp` | keywords=안전보건관리체계, 매뉴얼; template_hints=실시; ext=.hwp |
| high | `.hwp` | `어린이집\1. 어린이집 중대재해 안전계획서.hwp` | keywords=중대재해, 안전계획; template_hints=안전계획; ext=.hwp |
| high | `.hwp` | `위험성보고서작성\안전보건관리체계 구축 컨설팅 매뉴얼.hwp` | keywords=안전보건관리체계, 매뉴얼; template_hints=보고서; ext=.hwp |
| high | `.pdf` | `안전매뉴얼(202312_실무자단체제출)\안전보건관리체계 구축 실시 매뉴얼 작성 제안서\230705한국공인실무자단체-2023년 산업안전매뉴얼-내지(v2)(최종).pdf` | keywords=안전보건관리체계, 매뉴얼; template_hints=실시, 최종; ext=.pdf |
| high | `.pdf` | `서부발전\0.2022_상반기\0_한국서부발전 안전보건 매뉴얼, 절차서 지침서 송부(PDF 변환)_220222\붙임1,2_개정전문 및 비교표\안전보건매뉴얼\(전문) 안전보건매뉴얼_최종.pdf` | keywords=안전보건매뉴얼, 매뉴얼; template_hints=최종; ext=.pdf |
| high | `.hwp` | `어린이집\안전계획 서식 (4).hwp` | keywords=안전계획; template_hints=서식, 안전계획; ext=.hwp |

## industry_guide
| Priority | Extension | File | Reason |
|---|---|---|---|
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\65기타금속제품제조업(웹용).pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\구조용 금속제품 제조업 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\목재 가구 제조업(C. 3202) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\사업시설 유지 관리 서비스업 안전보건관리체계 구축 가이드.pdf` | keywords=서비스업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\섬유제품 제조업(C.13) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\식료품 제조업(C. 10) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\육상화물취급업 안전보건관리체계 구축 가이드.pdf` | keywords=육상화물, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\일반 목적용 기계 제조업(C. 291) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\자동차 신품 부품 제조업(C. 303) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\전기장비 제조업(C. 28) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\펄프, 종이 및 종이제품 제조업(C. 17) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |
| high | `.pdf` | `00.참고자료\13.안전보건관리체계구축가이드\플라스틱 제품 제조업(C. 222) 안전보건관리체계 구축 가이드.pdf` | keywords=제조업, 가이드; ext=.pdf |

## Implementation Direction
- Replace the current plain text document pack with three template families: `field sheet`, `official form`, and `brief/share message`.
- Use the HWP/HWPX files as structural references, but generate editable XLSX/DOCX/HWPX/PDF exports from SafeGuard's own normalized workpack data.
- For Excel/Google Sheets, start from `김포열병합 시운전 위험성평가_rev.0.xlsx` style: site metadata, process/task, hazard, current control, risk level, improvement action, owner, due date, confirmation.
- For safety education, add fields from real education logs: education date/time, site, instructor, target workers, content, materials, attendees, signature/confirmation, follow-up training.
- For TBM/pre-work, merge quick briefing with checklist fields: work summary, weather, high-risk task, stop-work criteria, PPE, equipment/vehicle route, sign-off.

## XLSX Structure Notes
- `김포열병합 시운전 위험성평가_rev.0.xlsx` contains a usable sheet-based pattern rather than a simple table dump.
- Important sheets include `프로세스&지침`, `Structure`, `평가방법`, `서명지`, and task-specific risk assessment sheets.
- The workbook explicitly uses `빈도 x 강도 = 위험성`, risk acceptance bands, site/company metadata, work location, work people, PTW role, task activity, hazard/environmental impact, damage type, and sign-off fields.
- This is a stronger model for SafeGuard exports than the current demo document cards because it supports both field review and spreadsheet editing.

## Evidence
- Machine-readable scan: `evaluation/2026-04-27-template-source-scan/summary.json`
- XLSX structure sample: `evaluation/2026-04-27-template-source-scan/kimpo-risk-assessment-xlsx-structure.json`
