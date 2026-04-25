# SafeGuard Output Format Research

- Date: 2026-04-25
- Goal: Align SafeGuard demo outputs with official industrial safety document structure used in KOSHA materials and related government guidance.

## Research Summary

SafeGuard should present generated results as "실무자가 바로 옮겨 적을 수 있는 초안" rather than free-form AI prose.

The current recommended structure is based on two official patterns:

1. Risk assessment forms and examples that consistently use:
   - 작업명
   - 공정 / 세부작업
   - 유해·위험요인
   - 현재 위험성
   - 감소대책
   - 잔여 위험성
   - 확인 / 담당자

2. TBM or 작업 전 안전점검회의 materials that consistently use:
   - 일시
   - 장소
   - 작업내용
   - 참석 대상 / 참석 인원
   - 주요 위험요인
   - 안전작업방법
   - 비상시 조치
   - 작업자 확인

## Primary References

### 1. KOSHA construction-industry risk assessment education PDF

Official KOSHA education material includes risk assessment table examples centered on:

- 공종 / 세부작업
- 유해·위험요인 파악
- 위험성 결정
- 위험성 감소대책

Source:

- https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf

### 2. KOSHA guidance describing TBM as work-before safety meeting

KOSHA materials describe TBM as a short, field-level meeting before work to share hazards, planned work, and precautions.
This supports formatting outputs as a meeting record rather than a chat answer.

Reference surface:

- https://www.kosha.or.kr/kosha/business/constructionLife.do?mode=view&articleNo=459856&article.offset=0&articleLimit=10

### 3. MOEL / KOSHA risk-assessment regulation context

Formal risk-assessment practice is tied to documenting identified hazards and the reduction measures to be implemented, which supports structured output over narrative-only output.

Reference surface:

- https://www.moel.go.kr

## Output Design Decision

### Risk Assessment Draft

SafeGuard should output:

- `위험성평가표(초안)`
- 작업명
- 공정/세부작업
- 작업장소
- 작업인원
- 기상 및 작업조건
- 유해·위험요인 및 감소대책
- 현재 위험성 / 잔여 위험성
- 확인

### TBM Briefing

SafeGuard should output:

- `작업 전 안전점검회의(TBM) 브리핑(초안)`
- 일시 / 장소 / 오늘 작업 / 참석 대상
- 오늘 공유할 주요 위험요인
- 안전작업방법
- 비상시 조치
- 확인 질문

### TBM Log Draft

SafeGuard should output:

- `작업 전 안전점검회의(TBM) 일지(초안)`
- 일시 / 작업장소 / 작업내용 / 참석인원 / 실시자
- 전달 내용
- 작업 전 일일 안전점검 시행 결과
- 미조치 위험요인 / 후속조치
- 작업자 확인

## What Was Applied In Code

The demo mock deliverables were updated so the on-screen documents now resemble:

- KOSHA-style 위험성평가표 item ordering
- TBM / 작업 전 안전점검회의 record ordering
- field-ready report sections rather than generic AI paragraphs

## Remaining Gap

This is still a "공식 서식 기반 초안" and not a legal reproduction of a specific government form.
If we later want near-1:1 document export, the next step should be:

1. choose one exact KOSHA or MOEL template by industry
2. map each field one-to-one
3. export to Word/Excel/PDF layout matching that template
