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
  return [
    {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: "kosha-guideline",
      item_type: "technical-guideline",
      title: "지게차 보행자 충돌 예방 지침",
      category: "기계안전",
      body: guidelineBody,
      normalized_text_sha256: sha256(guidelineBody),
      state,
      stable_key: "forklift-traffic-guideline",
      version_key: "KOSHA-GUIDE-2026",
      source_key: "kosha-synthetic",
      extraction_status: "success"
    },
    {
      schema_version: "safeclaw-kosha-body-corpus/v2",
      item_id: "kosha-regulation",
      item_type: "technical-support-regulation",
      title: "지게차 하역 안전 기술지원규정",
      category: "운반하역",
      body: regulationBody,
      normalized_text_sha256: sha256(regulationBody),
      state,
      stable_key: "forklift-loading-regulation",
      version_key: "KOSHA-REG-2026",
      source_key: "kosha-synthetic",
      extraction_status: "success"
    }
  ];
}

function defaultChunks(): JsonRecord[] {
  const rows = [
    ["kosha-guideline", "지게차 운행경로와 보행자 통행 동선을 분리하고 후진 경보를 확인한다."],
    ["kosha-regulation", "지게차 하역구역의 출입을 통제하고 신호수를 배치한다."]
  ] as const;
  return rows.map(([itemId, text]) => ({
    schema_version: "safeclaw-kosha-body-corpus/v2",
    chunk_id: `${itemId}:p1`,
    chunk_sha256: sha256(text),
    item_id: itemId,
    page_start: 1,
    page_end: 1,
    text
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
  const items = overrides.items ?? defaultItems(overrides.state ?? "stale");
  const chunks = overrides.chunks ?? defaultChunks();
  const failures = overrides.failures ?? [];
  const snapshotPath = `snapshots/${snapshotId}`;
  const snapshotDir = join(rootDir, snapshotPath);
  mkdirSync(snapshotDir, { recursive: true });

  const itemsText = `${items.map((item) => JSON.stringify(item)).join("\n")}\n`;
  const chunksText = `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`;
  const failuresText = failures.length
    ? `${failures.map((failure) => JSON.stringify(failure)).join("\n")}\n`
    : "";
  writeFileSync(join(snapshotDir, "items.jsonl"), itemsText, "utf8");
  writeFileSync(join(snapshotDir, "chunks.jsonl"), chunksText, "utf8");
  writeFileSync(join(snapshotDir, "failures.jsonl"), failuresText, "utf8");

  const sourceIdentity = "1".repeat(64);
  const generationPolicy = "2".repeat(64);
  const manifest: JsonRecord = {
    schema_version: "safeclaw-kosha-body-corpus/v2",
    snapshot_id: snapshotId,
    reproducibility_hash: sha256(snapshotId),
    generation_policy_sha256: generationPolicy,
    source_identity: { identity_sha256: sourceIdentity },
    counts: {
      inventory: items.length,
      completed: items.length,
      success: items.length - failures.length,
      failure: failures.length,
      chunks: chunks.length,
      failure_ledger: failures.length
    },
    output_hashes: {
      "items.jsonl": sha256(itemsText),
      "chunks.jsonl": sha256(chunksText),
      "failures.jsonl": sha256(failuresText)
    }
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  writeFileSync(join(snapshotDir, "manifest.json"), manifestText, "utf8");

  const current: JsonRecord = {
    schema_version: "safeclaw-kosha-body-current/v1",
    generation_policy_sha256: generationPolicy,
    manifest: {
      path: overrides.manifestPath ?? `${snapshotPath}/manifest.json`,
      sha256: sha256(manifestText),
      size_bytes: Buffer.byteLength(manifestText)
    },
    reproducibility_hash: manifest.reproducibility_hash,
    snapshot_id: snapshotId,
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
  return readFileSync(join(rootDir, "snapshots", "fixture-v3", "items.jsonl"), "utf8")
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
