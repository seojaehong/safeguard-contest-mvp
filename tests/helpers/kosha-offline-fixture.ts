import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type JsonRecord = Record<string, unknown>;

export const ACTUAL_KOSHA_ROOT =
  "C:/Users/iceam/dev/safeclaw-local-artifacts/kosha-corpus-body-recovery-2026-07-12-v3";

const tempDirs: string[] = [];

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export const KOSHA_TEST_METADATA_SHA256 = "e".repeat(64);
export const KOSHA_TEST_HOOKS = {
  trustedOfficialMetadataSha256: [KOSHA_TEST_METADATA_SHA256]
} as const;

export function koshaTestLookup(
  rootDir: string,
  hooks: {
    afterPathChecked?: (path: string) => Promise<void> | void;
    afterStreamChunk?: (path: string, bytesRead: number) => Promise<void> | void;
  } = {}
): {
  rootDir: string;
  testHooks: typeof hooks & typeof KOSHA_TEST_HOOKS;
} {
  return { rootDir, testHooks: { ...KOSHA_TEST_HOOKS, ...hooks } };
}

export function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object");
  }
  return value as JsonRecord;
}

type FixtureLifecycle = "current" | "stale" | "retired";

function defaultItems(state: FixtureLifecycle): JsonRecord[] {
  const guidelineBody = "지게차 운행경로와 보행자 통행 동선을 분리하고 후진 경보를 확인한다.";
  const regulationBody = "지게차 하역구역의 출입을 통제하고 신호수를 배치한다.";
  const primary: JsonRecord[] = [
    {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: "kosha-guideline",
      item_type: "technical-support-regulation",
      title: "지게차 보행자 충돌 예방 지침",
      category: "기계안전",
      body: guidelineBody,
      normalized_text_sha256: sha256(guidelineBody),
      raw_sha256: sha256(`pdf:${guidelineBody}`),
      state,
      stable_key: "forklift-traffic-guideline",
      version_key: "KOSHA-GUIDE-2026",
      source_key: "kosha-synthetic",
      extraction_status: "success",
      official_provenance: {
        official_url: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
        official_file_id: "fixture-guideline-file",
        publication_date: "2026-01-30",
        official_version: "KOSHA-GUIDE-2026",
        official_status: "current",
        pdf_sha256: sha256(`pdf:${guidelineBody}`),
        body_sha256: sha256(guidelineBody)
      }
    },
    {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: "kosha-regulation",
      item_type: "technical-support-regulation",
      title: "지게차 하역 안전 기술지원규정",
      category: "운반하역",
      body: regulationBody,
      normalized_text_sha256: sha256(regulationBody),
      raw_sha256: sha256(`pdf:${regulationBody}`),
      state,
      stable_key: "forklift-loading-regulation",
      version_key: "KOSHA-REG-2026",
      source_key: "kosha-synthetic",
      extraction_status: "success",
      official_provenance: {
        official_url: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
        official_file_id: "fixture-regulation-file",
        publication_date: "2026-01-30",
        official_version: "KOSHA-REG-2026",
        official_status: "current",
        pdf_sha256: sha256(`pdf:${regulationBody}`),
        body_sha256: sha256(regulationBody)
      }
    }
  ];
  const fillers = Array.from({ length: 232 }, (_, index) => {
    const body = `기술지원규정 fixture 본문 ${index}`;
    const version = `KOSHA-REG-${1000 + index}-2026`;
    return {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: `kosha-regulation-${1000 + index}`,
      item_type: "technical-support-regulation",
      title: `${version} 기술지원규정`,
      category: "운반하역",
      body,
      normalized_text_sha256: sha256(body),
      raw_sha256: sha256(`pdf:${body}`),
      state,
      stable_key: version.replace(/-2026$/u, ""),
      version_key: version,
      source_key: "kosha-synthetic",
      extraction_status: "success",
      official_provenance: {
        official_url: "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
        official_file_id: `fixture-regulation-${index}`,
        publication_date: "2026-01-30",
        official_version: version,
        official_status: "current",
        pdf_sha256: sha256(`pdf:${body}`),
        body_sha256: sha256(body)
      }
    };
  });
  return [...primary, ...fillers];
}

function defaultChunks(items: JsonRecord[]): JsonRecord[] {
  return items.map((item) => ({
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: `${String(item.item_id)}:p1`,
    chunk_sha256: sha256(String(item.body)),
    item_id: item.item_id,
    page_start: 1,
    page_end: 1,
    text: item.body
  }));
}

export type SnapshotOverrides = {
  items?: JsonRecord[];
  chunks?: JsonRecord[];
  failures?: JsonRecord[];
  manifestPath?: string;
  state?: FixtureLifecycle;
};

export function writeSnapshot(
  rootDir: string,
  snapshotId: string,
  overrides: SnapshotOverrides = {}
): void {
  const items = overrides.items ?? defaultItems(overrides.state ?? "current");
  const chunks = overrides.chunks ?? defaultChunks(items);
  const failures = overrides.failures ?? [];

  const itemsText = `${items.map((item) => JSON.stringify(item)).join("\n")}\n`;
  const chunksText = `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`;
  const failuresText = failures.length
    ? `${failures.map((failure) => JSON.stringify(failure)).join("\n")}\n`
    : "";
  const sourceIdentity = "1".repeat(64);
  const generationPolicy: JsonRecord = {
    schema_version: "safeclaw-kosha-verified-subset-policy/v1",
    source_snapshot_id: "976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282",
    official_metadata_sha256: KOSHA_TEST_METADATA_SHA256,
    trusted_metadata_registry_sha256: sha256(JSON.stringify([KOSHA_TEST_METADATA_SHA256])),
    generator_source_sha256: sha256(`fixture-generator:${snapshotId}`),
    selection: "technical-support-regulation+current-unverified+success+native",
    required_provenance: [
      "official_url",
      "official_file_id",
      "publication_date",
      "official_version",
      "official_status=current",
      "pdf_sha256",
      "body_sha256"
    ]
  };
  const generationPolicySha256 = sha256(canonicalJson(generationPolicy));
  const outputHashes = {
    "items.jsonl": sha256(itemsText),
    "chunks.jsonl": sha256(chunksText),
    "failures.jsonl": sha256(failuresText)
  };
  const derivedSnapshotId = sha256(canonicalJson({
    generator_source_sha256: generationPolicy.generator_source_sha256,
    generation_policy_sha256: generationPolicySha256,
    official_metadata_sha256: generationPolicy.official_metadata_sha256,
    output_hashes: outputHashes,
    source_identity_sha256: sourceIdentity,
    source_snapshot_id: generationPolicy.source_snapshot_id,
    trusted_metadata_registry_sha256: generationPolicy.trusted_metadata_registry_sha256
  }));
  const snapshotPath = `snapshots/${derivedSnapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, "utf8");
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, "utf8");
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, "utf8");

  const manifest: JsonRecord = {
    schema_version: "safeclaw-kosha-verified-subset/v1",
    snapshot_id: derivedSnapshotId,
    reproducibility_hash: derivedSnapshotId,
    generation_policy_sha256: generationPolicySha256,
    generation_policy: generationPolicy,
    source_identity: {
      identity_sha256: sourceIdentity,
      parent_snapshot_id: generationPolicy.source_snapshot_id
    },
    counts: {
      inventory: items.length + failures.length,
      completed: items.length,
      success: items.length,
      failure: failures.length,
      chunks: chunks.length,
      failure_ledger: failures.length
    },
    launch_gate: {
      launch_ready: failures.length === 0,
      failure_count: failures.length,
      partial_coverage: failures.length > 0,
      provenance_complete: failures.length === 0,
      blockers: failures.length ? ["fixture-failure"] : []
    },
    coverage_scope: {
      scope_id: "technical-support-regulation-current-native",
      source_inventory_count: 1040,
      candidate_count: items.length + failures.length,
      accepted_count: items.length,
      rejected_count: failures.length,
      out_of_scope_count: 1040 - items.length - failures.length,
      item_types: ["technical-support-regulation"],
      official_statuses: ["current"],
      body_kinds: ["native"],
      complete: failures.length === 0
    },
    output_hashes: outputHashes
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  writeFileSync(join(snapshotDir, "manifest.json"), manifestText, "utf8");

  const current: JsonRecord = {
    schema_version: "safeclaw-kosha-body-current/v1",
    generation_policy_sha256: generationPolicySha256,
    manifest: {
      path: overrides.manifestPath ?? `${snapshotPath}/manifest.json`,
      sha256: sha256(manifestText),
      size_bytes: Buffer.byteLength(manifestText)
    },
    reproducibility_hash: manifest.reproducibility_hash,
    snapshot_id: derivedSnapshotId,
    snapshot_path: snapshotPath,
    source_identity_sha256: sourceIdentity
  };
  writeFileSync(join(rootDir, "current.json"), JSON.stringify(current, null, 2), "utf8");
}

export function createKoshaFixture(overrides: SnapshotOverrides = {}): string {
  const rootDir = mkdtempSync(join(tmpdir(), "kosha-current-integration-"));
  tempDirs.push(rootDir);
  writeSnapshot(rootDir, "fixture-v3", overrides);
  return rootDir;
}

export function readFixtureItems(rootDir: string): JsonRecord[] {
  const current = asRecord(JSON.parse(readFileSync(join(rootDir, "current.json"), "utf8")) as unknown);
  return readFileSync(join(rootDir, String(current.snapshot_path), "items.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => asRecord(JSON.parse(line) as unknown));
}

export function cleanupKoshaFixtures(): void {
  while (tempDirs.length) {
    const target = tempDirs.pop();
    if (target) rmSync(target, { recursive: true, force: true });
  }
}

export async function withNoSupabase<T>(run: () => Promise<T>): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    return await run();
  } finally {
    if (url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = url;
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }
}
