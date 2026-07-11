import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  KOSHA_GUIDE_REFRESH_PLAN,
  auditKoshaGuideRows,
  auditKoshaRetrievalScenario,
  buildKoshaArchiveInventory,
  buildKoshaOfficialDownloadUrl,
  compareKoshaInventoryToOfficial,
  decodeKoshaArchiveEntryName,
  listKoshaManifestGateFailures,
  normalizeKoshaVersionCode,
  reconcileKoshaVisibleSnapshots,
  summarizeKoshaAuditChecks,
  summarizeKoshaVisibleStatus,
  toKoshaOfficialGuideRecord,
  toKoshaStableDocumentKey,
  type KoshaArchiveEntry,
  type KoshaGuideAuditManifest,
  type KoshaOfficialGuideRecord
} from "@/lib/kosha-guide-corpus-audit";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";

function reference(overrides: Partial<SafetyReferenceItem> = {}): SafetyReferenceItem {
  return {
    id: "technical-support-09-0009-b-e-17",
    source_id: "kosha-technical-support-regulations-2025",
    item_type: "technical-support-regulation",
    category: "전기안전분야",
    subcategory: "기술지원규정",
    title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
    summary: "도료와 유기용제 증기가 체류하는 도장 공정의 화재·폭발 방지 기준",
    body: "도장 공정의 환기, 방폭 전기기기, 점화원 통제 기준",
    keywords: ["도장", "도료", "유기용제"],
    risk_tags: ["화재", "폭발"],
    primary_documents: ["위험성평가표", "TBM 브리핑", "TBM 기록"],
    controls: ["가동부 방호덮개 설치", "정비 전 전원 차단 및 잠금표지"],
    source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/paint/1",
    evidence_role: "direct",
    retrieval_source: "rest",
    ...overrides
  };
}

function archiveEntry(overrides: Partial<KoshaArchiveEntry> = {}): KoshaArchiveEntry {
  return {
    zipFile: "[2025] 기술지원규정(전기안전분야).zip",
    internalPath: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정.pdf",
    crc32: "3556073921",
    compressedSize: 400_000,
    fileSize: 438_739,
    itemType: "technical-support-regulation",
    ...overrides
  };
}

function official(overrides: Partial<KoshaOfficialGuideRecord> = {}): KoshaOfficialGuideRecord {
  return {
    code: "B-E-17-2026",
    stableKey: "B-E-17",
    title: "도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
    category: "B",
    field: "BE",
    status: "개정",
    publishedAt: "2026-01-30",
    fileId: "CTC2026012913400018064273",
    fileSeq: 1,
    ...overrides
  };
}

describe("KOSHA GUIDE identity", () => {
  it("recovers CP949 archive names even when the ZIP UTF-8 flag is wrong", () => {
    const rawName = Buffer.from(
      "442d432d31332d3230323620bfdcbaaeb5b5c0e5bab8bcf6b0f8bbe7bfa120bec8c0fcc0dbbef7bfa120b0fcc7d120b1e2bcfac1f6bff8b1d4c1a42e706466",
      "hex"
    );

    expect(decodeKoshaArchiveEntryName(rawName)).toBe(
      "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정.pdf"
    );
  });

  it("normalizes version codes without confusing formatting with stale content", () => {
    expect(normalizeKoshaVersionCode("C-05-2016 건설공사 돌관작업 지침.pdf")).toBe("C-5-2016");
    expect(normalizeKoshaVersionCode("D-27- 2021 수소 저장설비 지침.pdf")).toBe("D-27-2021");
    expect(normalizeKoshaVersionCode("B-M-07-2025 지게차 지침.pdf")).toBe("B-M-7-2025");
    expect(normalizeKoshaVersionCode("규정번호 없음.pdf")).toBeNull();
  });

  it("derives a version-independent stable document key", () => {
    expect(toKoshaStableDocumentKey("B-M-07-2025")).toBe("B-M-7");
    expect(toKoshaStableDocumentKey("W-14-2022_경고표지 작성 지침.pdf")).toBe("W-14");
    expect(toKoshaStableDocumentKey("D-27- 2021 수소 저장설비 지침.pdf")).toBe("D-27");
    expect(toKoshaStableDocumentKey("규정번호 없음")).toBeNull();
  });
});

describe("KOSHA GUIDE read-only runner contract", () => {
  it("selects provenance payload without requesting a non-schema item URL column or mutation method", () => {
    const script = readFileSync(resolve(process.cwd(), "scripts/audit_kosha_guides.mjs"), "utf8");
    const fieldSelection = script.match(/const fields = \[([\s\S]+?)\]\.join\(","\);/u)?.[1] || "";

    expect(fieldSelection).toContain('"payload"');
    expect(fieldSelection).not.toContain('"source_url"');
    expect(script).not.toMatch(/method:\s*"(?:PATCH|PUT|DELETE)"/u);
  });
});

describe("KOSHA GUIDE measured manifest gate", () => {
  it("keeps archive row/type/hash expectations explicit and deterministic", () => {
    const entries = [
      archiveEntry(),
      archiveEntry({
        zipFile: "[2025] 기술지원규정(산업보건일반분야).zip",
        internalPath: "E-G-18-2026 밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정.pdf",
        crc32: "1451289034",
        compressedSize: 700_000,
        fileSize: 751_075
      }),
      archiveEntry({
        zipFile: "[2025] 기술지원규정(산업독성분야).zip",
        internalPath: "W-14-2022_경고표지 작성 지침.pdf",
        crc32: "4212962564",
        compressedSize: 710_000,
        fileSize: 734_876,
        itemType: "technical-guideline"
      })
    ];
    const inventory = buildKoshaArchiveInventory(entries);
    const manifest: KoshaGuideAuditManifest = {
      version: 1,
      measuredAt: "2026-07-11T00:00:00.000Z",
      localArchive: {
        archiveCount: 3,
        pdfEntryCount: 3,
        entryManifestSha256: inventory.entryManifestSha256,
        itemTypes: {
          "technical-guideline": 1,
          "technical-support-regulation": 2
        }
      },
      supabaseVisible: {
        sourceId: "kosha-technical-support-regulations-2025",
        rowCount: 3,
        itemTypes: {
          "technical-guideline": 1,
          "technical-support-regulation": 2
        }
      }
    };

    expect(listKoshaManifestGateFailures({ localArchive: inventory, supabaseVisible: manifest.supabaseVisible }, manifest)).toEqual([]);
    expect(listKoshaManifestGateFailures({
      localArchive: { ...inventory, pdfEntryCount: 2, entryManifestSha256: "drift" },
      supabaseVisible: { ...manifest.supabaseVisible, rowCount: 4 }
    }, manifest)).toEqual([
      "local-pdf-rows:2",
      "local-entry-manifest-sha256:drift",
      "supabase-visible-rows:4"
    ]);
  });

  it("detects official current and retired snapshot drift independently", () => {
    const inventory = buildKoshaArchiveInventory([archiveEntry()]);
    const manifest: KoshaGuideAuditManifest = {
      version: 1,
      measuredAt: "2026-07-11T00:00:00.000Z",
      localArchive: inventory,
      supabaseVisible: {
        sourceId: "kosha-technical-support-regulations-2025",
        rowCount: 1,
        itemTypes: {
          "technical-guideline": 0,
          "technical-support-regulation": 1
        }
      },
      officialSnapshot: {
        currentCount: 1,
        currentCanonicalSha256: "current-hash",
        retiredCount: 2,
        retiredCanonicalSha256: "retired-hash"
      }
    };

    expect(listKoshaManifestGateFailures({
      localArchive: inventory,
      supabaseVisible: manifest.supabaseVisible,
      officialSnapshot: {
        currentCount: 2,
        currentCanonicalSha256: "current-drift",
        retiredCount: 3,
        retiredCanonicalSha256: "retired-drift"
      }
    }, manifest)).toEqual([
      "official-current-rows:2",
      "official-current-sha256:current-drift",
      "official-retired-rows:3",
      "official-retired-sha256:retired-drift"
    ]);
  });
});

describe("KOSHA GUIDE evaluation counts", () => {
  it("keeps failed checks and access boundaries separate", () => {
    expect(summarizeKoshaAuditChecks([
      { id: "manifest", status: "pass", count: 0, detail: "measured manifest matched" },
      { id: "empty-body", status: "fail", count: 818, detail: "body missing" },
      { id: "live-row-hash", status: "boundary", count: 1, detail: "credential rejected" }
    ])).toEqual({
      checkCount: 3,
      passedCheckCount: 1,
      failedCheckCount: 1,
      boundaryCheckCount: 1,
      failures: ["empty-body:818"],
      boundaries: ["live-row-hash:1"]
    });
  });
});

describe("KOSHA GUIDE corpus quality", () => {
  it("reports empty bodies, duplicate text, missing provenance, raw aliases, and cross-task controls", () => {
    const rows = [
      reference({
        id: "paint-1",
        body: "",
        summary: "중복 요약",
        risk_tags: ["화재"],
        controls: ["화재", "가동부 방호덮개 설치"],
        source_url: null
      }),
      reference({
        id: "paint-2",
        title: "B-E-18-2026 도료 저장 안전에 관한 기술지원규정",
        body: "",
        summary: "중복 요약",
        risk_tags: ["화재"],
        controls: ["화재", "가동부 방호덮개 설치"],
        source_url: null
      }),
      reference({
        id: "confined-1",
        title: "E-G-18-2026 밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
        category: "산업보건일반분야",
        summary: "밀폐공간 진입 전 산소농도 측정과 감시인 배치",
        body: "산소 및 유해가스 농도 측정, 환기, 감시인과 구조장비 기준",
        keywords: ["밀폐공간", "산소농도", "환기", "감시인"],
        risk_tags: ["질식"],
        controls: ["작업 전 산소·유해가스 농도 측정", "감시인 배치 및 구조장비 확보"],
        source_url: "https://portal.kosha.or.kr/openapi/v1/file/down/confined/1"
      })
    ];
    const report = auditKoshaGuideRows(rows);

    expect(report.rowCount).toBe(3);
    expect(report.emptyBodyCount).toBe(2);
    expect(report.duplicateSummaryGroups).toBe(1);
    expect(report.duplicateSummaryRows).toBe(2);
    expect(report.missingSourceUrlCount).toBe(2);
    expect(report.missingOfficialFileIdCount).toBe(3);
    expect(report.missingOfficialPublishedAtCount).toBe(3);
    expect(report.rawTagStandaloneControlLeakCount).toBe(2);
    expect(report.rawControlContaminationCount).toBe(2);
    expect(report.sourceMutationCount).toBe(0);
    expect(report.operationalControlContaminationCount).toBe(1);
    expect(report.rawControlContaminationRows[0]).toEqual(expect.objectContaining({
      id: "paint-1",
      title: "B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정",
      controls: ["화재", "가동부 방호덮개 설치"]
    }));
    expect(report.operationalControlContaminationRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "paint-2",
        controls: expect.arrayContaining(["가동부 방호덮개 설치"])
      })
    ]));
  });

  it("accepts item-level official URL and metadata provenance from payload aliases", () => {
    const report = auditKoshaGuideRows([{
      ...reference({ source_url: null }),
      payload: {
        officialDownloadUrl: "https://portal.kosha.or.kr/openapi/v1/file/down/file/1",
        officialFileId: "file",
        officialPublishedAt: "2026-01-30",
        officialStatus: "개정"
      }
    }]);

    expect(report.missingSourceUrlCount).toBe(0);
    expect(report.missingOfficialFileIdCount).toBe(0);
    expect(report.missingOfficialPublishedAtCount).toBe(0);
    expect(report.missingOfficialStatusCount).toBe(0);
  });

  it("separates fallback summary reuse from non-empty body duplicate candidates", () => {
    const fallbackSummary = "건설안전분야 분야의 KOSHA 기술지원규정 또는 안전보건 기술지침 자료입니다.";
    const rows = [
      reference({ id: "fallback-1", summary: fallbackSummary, body: "" }),
      reference({ id: "fallback-2", summary: fallbackSummary, body: "" }),
      reference({ id: "bullet-1", summary: "ㆍ", body: "동일하게 추출된 짧은 본문" }),
      reference({ id: "bullet-2", summary: "ㆍ", body: "동일하게 추출된 짧은 본문" }),
      reference({ id: "unique", summary: "고유 요약", body: "고유 본문" })
    ];

    const report = auditKoshaGuideRows(rows);

    expect(report.duplicateSummaryGroups).toBe(2);
    expect(report.duplicateSummaryRows).toBe(4);
    expect(report.templatedFallbackSummaryGroups).toBe(1);
    expect(report.templatedFallbackSummaryRows).toBe(2);
    expect(report.nonTemplateDuplicateSummaryGroups).toBe(1);
    expect(report.nonTemplateDuplicateSummaryRows).toBe(2);
    expect(report.exactBodyDuplicateCandidateGroups).toBe(1);
    expect(report.exactBodyDuplicateCandidateRows).toBe(2);
    expect(report.duplicateSummaryDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        summary: fallbackSummary,
        rowCount: 2,
        templateFallback: true,
        nonEmptyBodyRows: 0
      }),
      expect.objectContaining({
        summary: "ㆍ",
        rowCount: 2,
        templateFallback: false,
        nonEmptyBodyRows: 2
      })
    ]));
  });

  it("calibrates legitimate task aliases while retaining true cross-domain controls", () => {
    const rows = [
      reference({
        id: "roof",
        title: "C-59-2022 지붕공사 안전보건작업 기술지침",
        summary: "지붕공사 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["작업발판과 안전난간 확인", "안전대 체결"]
      }),
      reference({
        id: "material-health",
        title: "H-147-2021 특별관리물질 취급 근로자의 작업환경관리 지침",
        summary: "물질 노출과 독성 관리",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["MSDS 확인 및 적정 보호구 착용"]
      }),
      reference({
        id: "transport",
        title: "G-40-2012 해상운송을 위한 포장·운반 및 하역 기술지침",
        summary: "운반차량과 운반구 하역 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["보행자 동선과 장비 동선 분리", "후진 경보 확인"]
      }),
      reference({
        id: "vehicle-lift",
        title: "X-36-2016 자동차·차량 이송용 리프트 작업 지침",
        summary: "차량 이송과 리프트 작업",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["지게차 후진 경보 확인"]
      }),
      reference({
        id: "toxic-gas-response",
        title: "H-115-2013 시안화수소 가스 노출 급성중독 응급대응 지침",
        summary: "급성중독 응급대응",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["작업 전 산소·유해가스 농도 측정", "감시인 배치 및 구조장비 확보"]
      }),
      reference({
        id: "cleaning-chemical",
        title: "H-175-2015 환경미화원 세척시설 기술지침",
        summary: "세척시설과 세척제 관리",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["MSDS 확인 및 적정 보호구 착용"]
      }),
      reference({
        id: "office-cross-domain",
        title: "G-999-2026 사무실 문서 정리 지침",
        summary: "사무실 문서 분류와 보관",
        body: "",
        keywords: [],
        risk_tags: [],
        controls: ["지게차 후진 경보 확인", "MSDS 확인"]
      })
    ];

    const report = auditKoshaGuideRows(rows);

    expect(report.rawInitialControlContaminationCount).toBe(7);
    expect(report.rawControlContaminationCount).toBe(1);
    expect(report.rawControlFalsePositiveCount).toBe(6);
    expect(report.rawControlAliasRemovedFlagCount).toBe(6);
    expect(report.rawControlContaminationRows).toEqual([
      expect.objectContaining({
        id: "office-cross-domain",
        flags: ["forklift-control-cross-task", "fire-chemical-control-cross-task"]
      })
    ]);
    expect(report.operationalInitialControlContaminationCount).toBeGreaterThanOrEqual(
      report.operationalControlContaminationCount
    );
    expect(report.operationalControlFalsePositiveCount).toBeGreaterThanOrEqual(6);
  });
});

describe("KOSHA GUIDE official comparison", () => {
  it("normalizes official API rows without dropping version, status, date, or file provenance", () => {
    expect(toKoshaOfficialGuideRecord({
      techGdlnNo: "E-G-18-2026",
      techGdlnNm: "밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
      techGdlnCtgryCd: "E",
      techGdlnFldSeCd: "EG",
      techGdlnSttsSeCdSt: "개정",
      techGdlnOfancYmd: "20260130",
      techGdlnOrgnlAtcflNo: "CTC2026012914540778798257",
      techGdlnOrgnlAtcflNoSeq: 1
    })).toEqual({
      code: "E-G-18-2026",
      stableKey: "E-G-18",
      title: "밀폐공간 작업 프로그램 수립 및 시행에 관한 기술지원규정",
      category: "E",
      field: "EG",
      status: "개정",
      publishedAt: "2026-01-30",
      fileId: "CTC2026012914540778798257",
      fileSeq: 1
    });
    expect(toKoshaOfficialGuideRecord({ techGdlnNo: "bad" })).toBeNull();
  });

  it("separates formatting normalization, stale versions, and retired local rows", () => {
    const local = [
      archiveEntry({ internalPath: "C-05-2016 건설공사 돌관작업 안전보건작업 지침.pdf", itemType: "technical-guideline" }),
      archiveEntry({ internalPath: "B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf" }),
      archiveEntry({ internalPath: "W-14-2022_경고표지 작성 지침.pdf", itemType: "technical-guideline" })
    ];
    const current = [
      official({ code: "C-5-2016", stableKey: "C-5", title: "건설공사 돌관작업 안전보건작업 지침" }),
      official({ code: "B-M-7-2025", stableKey: "B-M-7", title: "양중기 일반 안전에 관한 기술지원규정" })
    ];
    const retired = [official({ code: "W-14-2022", stableKey: "W-14", status: "폐지" })];

    const comparison = compareKoshaInventoryToOfficial(local, current, retired);

    expect(comparison.stableKeyMatches).toBe(2);
    expect(comparison.exactVersionMatches).toBe(1);
    expect(comparison.versionMismatches).toEqual([{
      stableKey: "B-M-7",
      officialCode: "B-M-7-2025",
      localCode: "B-M-7-2026",
      internalPath: "B-M-7-2026 양중기 일반 안전에 관한 기술지원규정.pdf"
    }]);
    expect(comparison.staleLocalRows).toEqual([{
      stableKey: "W-14",
      localCode: "W-14-2022",
      internalPath: "W-14-2022_경고표지 작성 지침.pdf",
      officialRetired: true
    }]);
    expect(comparison.refreshDryRun).toEqual(expect.objectContaining({
      readOnly: true,
      mutationPerformed: false,
      approvalRequiredBeforeMutation: true,
      counts: {
        insert: 0,
        update: 1,
        retire: 1,
        unchanged: 1
      }
    }));
    expect(comparison.refreshDryRun.update).toEqual(comparison.versionMismatches);
    expect(comparison.refreshDryRun.retire).toEqual(comparison.staleLocalRows);
  });

  it("builds official download URLs only when provenance is complete", () => {
    expect(buildKoshaOfficialDownloadUrl(official())).toBe(
      "https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012913400018064273/1"
    );
    expect(buildKoshaOfficialDownloadUrl(official({ fileId: null }))).toBeNull();
  });
});

describe("KOSHA GUIDE production visibility", () => {
  it("reads the public status contract without treating samples as a full row snapshot", () => {
    const visible = summarizeKoshaVisibleStatus({
      ok: true,
      configured: true,
      status: "ready",
      sources: 1063,
      items: 9920,
      technicalTotal: 1040,
      technicalSupportRegulations: 237,
      technicalGuidelines: 803,
      samples: [reference()]
    });

    expect(visible).toMatchObject({
      ok: true,
      configured: true,
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      },
      sampleCount: 1,
      fullRowSnapshotAvailable: false
    });
  });

  it("rejects malformed public status payloads", () => {
    expect(summarizeKoshaVisibleStatus({ ok: true, technicalTotal: "1040" })).toBeNull();
  });

  it("uses a matching live full-row snapshot for the manifest hash", () => {
    const production = {
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      },
      canonicalRowSha256: null
    };
    const fullRows = { ...production, canonicalRowSha256: "live-row-hash" };

    expect(reconcileKoshaVisibleSnapshots(production, fullRows)).toEqual({
      snapshot: fullRows,
      parityFailures: []
    });
  });

  it("does not attach a full-row hash when production and direct counts disagree", () => {
    const production = {
      sourceId: "kosha-technical-support-regulations-2025",
      rowCount: 1040,
      itemTypes: {
        "technical-guideline": 803,
        "technical-support-regulation": 237
      }
    };
    const fullRows = {
      ...production,
      rowCount: 1039,
      canonicalRowSha256: "wrong-snapshot"
    };

    expect(reconcileKoshaVisibleSnapshots(production, fullRows)).toEqual({
      snapshot: { ...production, canonicalRowSha256: null },
      parityFailures: ["supabase-visible-row-parity:1039/1040"]
    });
  });
});

describe("KOSHA GUIDE retrieval-to-document evidence", () => {
  it.each(["rest", "ranked", "hybrid"] as const)(
    "surfaces task-specific KOSHA evidence through the %s branch instead of generic prose",
    (branch) => {
      const items = [
        reference({ retrieval_source: branch }),
        reference({
          id: "technical-support-01-0065-d-c-13",
          category: "건설안전분야",
          title: "D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정",
          summary: "외벽 도장 보수공사의 비계, 추락방지, 작업발판 안전 기준",
          keywords: ["외벽도장", "비계", "추락"],
          risk_tags: ["추락", "비계"],
          controls: ["작업발판·난간·개구부 상태 확인", "안전대 체결 및 작업반경 출입통제"],
          retrieval_source: branch
        }),
        reference({
          id: "unrelated-electrostatic",
          title: "B-E-20-2026 정전도장기 제작 및 설치에 관한 기술지원규정",
          summary: "정전도장기의 정전기 방전 방지",
          keywords: ["정전도장", "정전기"],
          risk_tags: ["화재", "폭발"],
          retrieval_source: branch
        })
      ];

      const result = auditKoshaRetrievalScenario({
        id: "exterior-paint",
        query: "외벽 도장 이동식 비계 강풍 도료 유기용제 화재 폭발",
        expectedCodes: ["B-E-17-2026", "D-C-13-2026"],
        requiredControlTerms: ["도료", "유기용제", "작업발판", "안전대"],
        forbiddenTerms: ["정전도장기", "피도장물 접지"]
      }, items, branch);

      expect(result.failures).toEqual([]);
      expect(result.retrievalSources).toEqual([branch]);
      expect(result.promptContext).toContain("공식자료: B-E-17-2026");
      expect(result.promptContext).toContain("공식자료: D-C-13-2026");
      expect(result.answer).toMatch(/도료|유기용제/);
      expect(result.answer).toMatch(/작업발판|안전대/);
      expect(result.answer).not.toContain("정전도장기");
      expect(result.documentReflections.every((item) => item.documents.includes("위험성평가표"))).toBe(true);
      expect(result.documentReflections.every((item) => item.label.includes("위험성평가표"))).toBe(true);
    }
  );
});

describe("KOSHA GUIDE refresh plan", () => {
  it("stays incremental, shardable, empty-response filtered, and non-mutating", () => {
    expect(KOSHA_GUIDE_REFRESH_PLAN).toMatchObject({
      mode: "read-only-plan",
      mutationPerformed: false,
      checkpointField: "publishedAt",
      shardKeys: ["category", "status", "page"],
      emptyResponsePolicy: "reject-empty-page-and-empty-file-provenance",
      reconciliation: "full-stable-key-current-vs-retired"
    });
  });
});
