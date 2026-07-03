// 경영책임자 방어 파일 — 중대재해처벌법 시행령 제4조 증빙 파일철.
// 저장된 문서팩(workpack) 목록을 lib/smsa-mapping.ts의 SMSA_ARTICLE_MAP으로
// 시행령 항목별로 묶는 순수 함수 모음. Supabase/Next 의존성 없이 테스트 가능.

import { buildEvidenceLabels } from "@/lib/smsa-mapping";

/** 그룹핑 입력이 되는 문서팩 1건. documentKeys는 이미 "내용이 채워진" deliverables 필드 키만 포함해야 한다. */
export type EvidenceFileWorkpack = {
  id: string;
  siteName: string;
  question: string;
  createdAt: string;
  documentKeys: readonly string[];
  reopenHref: string;
};

/** 시행령 항목별 아코디언에 나열되는 문서 1건. */
export type EvidenceFileDocument = {
  workpackId: string;
  siteName: string;
  question: string;
  createdAt: string;
  documentKey: string;
  reopenHref: string;
};

/** 매핑된 문서가 있는 시행령 항목(라벨 단위, 예: "제4조 제3호·제5호") 섹션. */
export type EvidenceFileArticleGroup = {
  article: string;
  purpose: string;
  related?: string;
  count: number;
  latestAt: string | null;
  documents: EvidenceFileDocument[];
};

/** 상단 요약 그리드 1칸(시행령 제4조 1~9호 개별 항목). */
export type EvidenceFileGridItem = {
  article: string;
  title: string;
  count: number;
  latestAt: string | null;
};

export type EvidenceFileResult = {
  gridItems: EvidenceFileGridItem[];
  sections: EvidenceFileArticleGroup[];
};

/**
 * 중대재해처벌법 시행령 제4조 1~9호 전체 목록(제목만).
 * 상단 요약 그리드는 실제 매핑된 문서가 없는 항목도 "증빙 없음"으로 보여줘야
 * 하므로, 문서 매핑 여부와 무관하게 9개 항목을 고정 목록으로 둔다.
 */
export const SMSA_ARTICLE_4_ITEMS: ReadonlyArray<{ ho: number; article: string; title: string }> = [
  { ho: 1, article: "중대재해처벌법 시행령 제4조 제1호", title: "안전·보건 목표와 경영방침 설정" },
  { ho: 2, article: "중대재해처벌법 시행령 제4조 제2호", title: "안전보건 업무 전담 조직 구성" },
  { ho: 3, article: "중대재해처벌법 시행령 제4조 제3호", title: "유해·위험요인 확인·개선 절차" },
  { ho: 4, article: "중대재해처벌법 시행령 제4조 제4호", title: "안전보건 관련 예산 편성·집행" },
  { ho: 5, article: "중대재해처벌법 시행령 제4조 제5호", title: "안전보건관리책임자 등 권한·평가" },
  { ho: 6, article: "중대재해처벌법 시행령 제4조 제6호", title: "안전관리자·보건관리자 등 법정 인력 배치" },
  { ho: 7, article: "중대재해처벌법 시행령 제4조 제7호", title: "종사자 의견 청취 절차" },
  { ho: 8, article: "중대재해처벌법 시행령 제4조 제8호", title: "중대산업재해 대비 매뉴얼" },
  { ho: 9, article: "중대재해처벌법 시행령 제4조 제9호", title: "도급·용역·위탁 시 안전보건 확보 기준" }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * deliverables 원본 객체(예: workpacks.deliverables JSON)에서 "내용이 채워진"
 * 필드 키만 뽑아낸다. 산문 필드는 non-empty string, schema-first 필드(예:
 * workPlanStructured)는 object이면 채워진 것으로 본다. foreignWorkerLanguages
 * 같은 배열 필드는 어차피 SMSA_ARTICLE_MAP에 없어 이후 단계에서 제외된다.
 */
export function documentKeysFromDeliverables(deliverables: unknown): string[] {
  if (!isRecord(deliverables)) return [];

  return Object.keys(deliverables).filter((key) => {
    const value = deliverables[key];
    if (typeof value === "string") return value.trim().length > 0;
    if (isRecord(value)) return true;
    return false;
  });
}

function parseHoNumbers(article: string): number[] {
  const numbers: number[] = [];
  const pattern = /제(\d+)호/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(article)) !== null) {
    numbers.push(Number(match[1]));
  }
  return numbers;
}

function laterTimestamp(a: string | null, b: string): string {
  if (!a) return b;
  return new Date(b).getTime() > new Date(a).getTime() ? b : a;
}

/**
 * workpack 목록 + SMSA_ARTICLE_MAP → 시행령 제4조 1~9호 요약 그리드 +
 * 항목(라벨)별 문서 섹션. 매핑되지 않은 documentKey는 결과에서 제외된다.
 * 정렬: gridItems는 1~9호 고정 순서, sections는 문서 건수 내림차순
 * (동률이면 첫 호 번호 오름차순), 각 섹션 내부 documents는 최신순.
 */
export function groupEvidenceByArticle(workpacks: readonly EvidenceFileWorkpack[]): EvidenceFileResult {
  const sectionMap = new Map<string, EvidenceFileArticleGroup>();
  const gridCounts = new Map<number, { count: number; latestAt: string | null }>();

  for (const workpack of workpacks) {
    const labels = buildEvidenceLabels(workpack.documentKeys);

    for (const documentKey of workpack.documentKeys) {
      const label = labels[documentKey];
      if (!label) continue;

      const existing = sectionMap.get(label.article);
      const document: EvidenceFileDocument = {
        workpackId: workpack.id,
        siteName: workpack.siteName,
        question: workpack.question,
        createdAt: workpack.createdAt,
        documentKey,
        reopenHref: workpack.reopenHref
      };

      if (existing) {
        existing.count += 1;
        existing.latestAt = laterTimestamp(existing.latestAt, workpack.createdAt);
        existing.documents.push(document);
      } else {
        sectionMap.set(label.article, {
          article: label.article,
          purpose: label.purpose,
          related: label.related,
          count: 1,
          latestAt: workpack.createdAt,
          documents: [document]
        });
      }

      for (const ho of parseHoNumbers(label.article)) {
        const current = gridCounts.get(ho) || { count: 0, latestAt: null };
        current.count += 1;
        current.latestAt = laterTimestamp(current.latestAt, workpack.createdAt);
        gridCounts.set(ho, current);
      }
    }
  }

  for (const section of sectionMap.values()) {
    section.documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    // 호 번호가 없는 주근거(예: "산업안전보건법 제29조" — 교육 기록)는 시행령
    // 제4조 섹션들 뒤로 보낸다. Math.min(빈 배열) = Infinity → NaN 비교 방지.
    const aHos = parseHoNumbers(a.article);
    const bHos = parseHoNumbers(b.article);
    const aFirst = aHos.length ? Math.min(...aHos) : Number.MAX_SAFE_INTEGER;
    const bFirst = bHos.length ? Math.min(...bHos) : Number.MAX_SAFE_INTEGER;
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.article.localeCompare(b.article, "ko");
  });

  const gridItems: EvidenceFileGridItem[] = SMSA_ARTICLE_4_ITEMS.map((item) => {
    const counted = gridCounts.get(item.ho);
    return {
      article: item.article,
      title: item.title,
      count: counted?.count || 0,
      latestAt: counted?.latestAt || null
    };
  });

  return { gridItems, sections };
}
