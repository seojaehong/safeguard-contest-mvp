// PR-17(과장 표현 정리)·PR-18(공개 화면 예시·정적 데이터) 회귀시험.
// 근거: evaluation/launch-depth-audit-2026-10-25/inventory.md 원인 L·M, 결정 11·12·14(2026-10-25 승인).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getEvidenceLabel } from "@/lib/smsa-mapping";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import { buildStoredCurrentWorkpack } from "@/lib/current-workpack";
import {
  PUBLIC_SAMPLE_BANNER_LABEL,
  applyRouteSnapshotUpdate,
  describeDryrunFreshness,
  isExampleSource,
  resolveDisplayWorkpack,
  sourceBadgeLabel
} from "@/lib/public-screen-sample";
import { mockSearchResults } from "@/lib/mock-data";

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// 이번 PR 이 손댄 사용자 화면 원천 파일. 주석까지 포함해 검사한다(주석이 되돌림의 근거가 되지 않도록).
const TOUCHED_SCREEN_FILES = [
  "app/evidence-file/page.tsx",
  "app/archive/page.tsx",
  "app/tbm/page.tsx",
  "app/worker/page.tsx",
  "app/ask/page.tsx",
  "app/ask/AskLivePage.tsx",
  "app/dryrun/page.tsx",
  "app/search/SearchLivePage.tsx",
  "components/ResultCard.tsx",
  "components/CitationList.tsx",
  "components/PublicSampleBoards.tsx",
  "lib/module-navigation.ts",
  "lib/evidence-file.ts",
  "lib/evidence-file-demo.ts",
  "lib/smsa-mapping.ts",
  "lib/public-screen-sample.ts"
];

const BANNED_PATTERNS: Array<[string, RegExp]> = [
  ["방어", /방어/],
  ["수사·감독 대응", /수사\s*[·ㆍ]\s*감독\s*대응/],
  ["검증된 본문", /검증된\s*본문/],
  ["노무사", /노무사/],
  ["자문", /자문/],
  ["상담", /상담/],
  ["진단", /진단/],
  ["판정", /판정/],
  ["확률 숫자", /\d+(\.\d+)?\s*%/]
];

describe("PR-17 금지 낱말 — 손댄 화면 원천에 0회", () => {
  for (const file of TOUCHED_SCREEN_FILES) {
    it(`${file}`, () => {
      const text = read(file);
      const hits = BANNED_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
      expect(hits).toEqual([]);
    });
  }

  it("템플릿 모드 설명에 「검증된 본문」이 없다 (COPY-10)", () => {
    expect(read("components/SafeGuardCommandCenter.tsx")).not.toMatch(/검증된\s*본문/);
  });

  it("/evidence-file 화면 이름은 「시행령 제4조 문서 모아보기」이고 경로는 그대로다 (결정 14)", () => {
    const page = read("app/evidence-file/page.tsx");
    expect(page).toContain("시행령 제4조 문서 모아보기");
    expect(page).toContain('activeHref="/evidence-file"');
    expect(read("lib/module-navigation.ts")).toMatch(/href: "\/evidence-file", label: "시행령 제4조 문서 모아보기"/);
  });
});

describe("PR-17 smsa-mapping 고정 테이블 (결정 11·12)", () => {
  it("위험성평가 라벨에 산업안전보건법 제36조를 병기한다 (RA-13)", () => {
    expect(getEvidenceLabel("riskAssessment")?.related).toBe("산업안전보건법 제36조");
    expect(getEvidenceLabel("structuredRiskRows")?.related).toBe("산업안전보건법 제36조");
  });

  it("TBM 병기 근거는 산업안전보건법 제36조 제4항(작업 전 안전점검회의 등 주지)이다 (EF-13)", () => {
    for (const docType of ["tbmBriefing", "tbmLog", "tbmBriefingStructured", "tbmLogStructured"]) {
      expect(getEvidenceLabel(docType)?.related).toBe("산업안전보건법 제36조 제4항");
    }
  });

  it("비상대응 라벨은 「점검 증빙」이 아니라 「이행 보조」다 (EF-08)", () => {
    const label = getEvidenceLabel("emergencyResponse");
    expect(label?.article).toBe("중대재해처벌법 시행령 제4조 제8호");
    expect(label?.purpose).toContain("이행 보조");
    expect(label?.purpose).not.toContain("점검 증빙");
  });
});

describe("PR-18 공개 화면 예시 데이터", () => {
  const sample = buildSampleWorkpack();

  it("저장된 작업팩이 없으면 예시로 표시하고 배너 문구를 낸다 (UI-01)", () => {
    const resolved = resolveDisplayWorkpack(null, sample);
    expect(resolved.isSample).toBe(true);
    expect(resolved.data).toBe(sample);
    expect(PUBLIC_SAMPLE_BANNER_LABEL).toBe("기본 예시 표시");
  });

  it("저장된 작업팩이 있으면 그것을 표시한다 (UI-01 반대쪽)", () => {
    const raw = JSON.stringify(buildStoredCurrentWorkpack(sample));
    const resolved = resolveDisplayWorkpack(raw, sample);
    expect(resolved.isSample).toBe(false);
  });

  it("/tbm·/worker 는 예시 배너를 쓰는 보드 컴포넌트를 쓴다", () => {
    expect(read("app/tbm/page.tsx")).toContain("TbmSampleAwareBoard");
    expect(read("app/worker/page.tsx")).toContain("WorkerSampleAwareBoard");
    expect(read("components/PublicSampleBoards.tsx")).toContain("PUBLIC_SAMPLE_BANNER_LABEL");
  });

  it("저장된 작업팩이 없을 때 「수정 반영」 후 localStorage 에 currentWorkpack 을 쓰지 않는다 (UI-02)", () => {
    const update = applyRouteSnapshotUpdate(
      { data: sample, isCurrent: false, savedAt: null, generationFingerprint: "fp" },
      { workerSnapshot: { savedAt: "2026-10-25T00:00:00.000Z", source: "workspace", workers: [], selectedWorkerIds: [] } },
      "2026-10-25T00:00:00.000Z"
    );
    expect(update.persist).toBeNull();
    expect(update.next.isCurrent).toBe(false);
  });

  it("저장된 작업팩이 있으면 「수정 반영」을 저장한다 (UI-02 반대쪽)", () => {
    const update = applyRouteSnapshotUpdate(
      { data: sample, isCurrent: true, savedAt: null, generationFingerprint: "fp" },
      { workerSnapshot: { savedAt: "2026-10-25T00:00:00.000Z", source: "workspace", workers: [], selectedWorkerIds: [] } },
      "2026-10-25T00:00:00.000Z"
    );
    expect(update.persist).not.toBeNull();
    expect(update.next.isCurrent).toBe(true);
  });

  it("mock 근거는 예시 자료로 표시하고 링크하지 않는다 (UI-03)", () => {
    const mock = mockSearchResults.find((item) => item.type === "precedent");
    expect(mock && isExampleSource(mock)).toBe(true);
    expect(mock && sourceBadgeLabel(mock)).not.toContain("법제처");
    const live = { ...mockSearchResults[0], sourceSystem: "lawgo" as const, sourceLabel: "법제처 법령" };
    expect(isExampleSource(live)).toBe(false);
    expect(sourceBadgeLabel(live)).toBe("법제처 법령");
    for (const file of ["components/ResultCard.tsx", "components/CitationList.tsx"]) {
      expect(read(file)).toContain("isExampleSource");
    }
  });

  it("/ask 는 열 때 API 를 자동 호출하지 않는다 (UI-05)", () => {
    const ask = read("app/ask/AskLivePage.tsx");
    // useEffect 는 화면을 떠날 때 진행 중인 질의를 취소하는 정리 함수 하나뿐이다.
    expect(ask.match(/useEffect\(/g)?.length).toBe(1);
    expect(ask).toContain("useEffect(() => () => controllerRef.current?.abort(");
    expect(ask).toMatch(/const runAsk = useCallback\(\(\) => \{[\s\S]*fetch\("\/api\/ask"/);
    expect(ask).toContain('"/api/ask"');
    expect(ask).toMatch(/onClick=\{runAsk\}|onSubmit=/);
  });

  it("/worker 확인 버튼은 저장한다고 말하지 않는다 (UI-07)", () => {
    const board = read("components/PublicSampleBoards.tsx");
    expect(board).not.toContain("기록 예정");
    expect(board).not.toContain("저장되며");
    expect(board).toContain("저장되지 않습니다");
  });

  it("오래된 점검 기록은 현재 상태로 보이지 않는다 (UI-08)", () => {
    const now = new Date("2026-10-25T00:00:00.000Z");
    const stale = describeDryrunFreshness("2026-04-18T02:07:28.669Z", now);
    expect(stale.stale).toBe(true);
    expect(stale.label).toContain("2026-04-18");
    expect(stale.label).toContain("현재 상태가 아닙니다");
    const fresh = describeDryrunFreshness("2026-10-23T00:00:00.000Z", now);
    expect(fresh.stale).toBe(false);
    expect(describeDryrunFreshness(null, now).stale).toBe(true);
    expect(read("app/dryrun/page.tsx")).toContain("describeDryrunFreshness");
  });
});
