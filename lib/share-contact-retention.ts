import type { SupabaseClient } from "@supabase/supabase-js";
import { toJson, type WorkspaceDatabase } from "@/lib/supabase-admin";
import {
  countRecipientSnapshotContacts,
  shareContactPurgeCutoff,
  stripRecipientSnapshotContacts,
  stripWorkerSnapshotContacts
} from "@/lib/workpack-commercial";

// 결정 19: 공유 세션 만료(또는 중지·만료 상태 전환) 뒤 30일이 지나면 스냅숏 연락처를 지운다.
// 매일 cron(/api/share-sessions/contact-retention)이 부른다. 한 번에 최대 batchLimit 건.

export type ShareContactPurgeResult = {
  ok: boolean;
  scanned: number;
  cleared: number;
  confirmationsCleared: number;
  failed: number;
  cutoff: string;
};

type SessionRow = { id: string; recipients_snapshot: unknown };

export async function purgeExpiredShareSessionContacts(
  client: SupabaseClient<WorkspaceDatabase>,
  options: { now?: Date; batchLimit?: number } = {}
): Promise<ShareContactPurgeResult> {
  const cutoff = shareContactPurgeCutoff(options.now);
  const batchLimit = options.batchLimit ?? 200;

  const [expiredByTime, closedByStatus] = await Promise.all([
    client
      .from("workpack_share_sessions")
      .select("id,recipients_snapshot")
      .lt("expires_at", cutoff)
      // 새로 기한을 넘긴 것부터 — 이미 정리된 오래된 행이 배치를 막지 않게 한다.
      .order("expires_at", { ascending: false })
      .limit(batchLimit),
    client
      .from("workpack_share_sessions")
      .select("id,recipients_snapshot")
      .in("status", ["revoked", "expired"])
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(batchLimit)
  ]);

  if (expiredByTime.error || closedByStatus.error) {
    console.error("share contact retention scan failed", expiredByTime.error || closedByStatus.error);
    return { ok: false, scanned: 0, cleared: 0, confirmationsCleared: 0, failed: 0, cutoff };
  }

  const rows = new Map<string, SessionRow>();
  for (const row of [...(expiredByTime.data || []), ...(closedByStatus.data || [])] as SessionRow[]) {
    rows.set(row.id, row);
  }

  let cleared = 0;
  let failed = 0;
  for (const row of rows.values()) {
    if (countRecipientSnapshotContacts(row.recipients_snapshot) === 0) continue;
    const { error } = await client
      .from("workpack_share_sessions")
      .update({ recipients_snapshot: toJson(stripRecipientSnapshotContacts(row.recipients_snapshot)) })
      .eq("id", row.id);
    if (error) {
      failed += 1;
      console.error("share contact retention scrub failed", { sessionId: row.id, code: error.code });
    } else {
      cleared += 1;
    }
  }

  // 이 변경 전에 쌓인 열람 확인 기록에도 연락처가 남아 있을 수 있다 — 같은 기한으로 지운다.
  const confirmations = await client
    .from("workpack_read_confirmations")
    .select("id,worker_snapshot")
    .lt("read_at", cutoff)
    .order("read_at", { ascending: false })
    .limit(batchLimit);
  let confirmationsCleared = 0;
  if (confirmations.error) {
    failed += 1;
    console.error("read confirmation contact retention scan failed", { code: confirmations.error.code });
  } else {
    for (const row of (confirmations.data || []) as Array<{ id: string; worker_snapshot: unknown }>) {
      const snapshot = row.worker_snapshot;
      if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) continue;
      if (countRecipientSnapshotContacts([{ workerSnapshot: snapshot }]) === 0) continue;
      const { error } = await client
        .from("workpack_read_confirmations")
        .update({ worker_snapshot: toJson(stripWorkerSnapshotContacts(snapshot as Record<string, unknown>)) })
        .eq("id", row.id);
      if (error) {
        failed += 1;
        console.error("read confirmation contact scrub failed", { confirmationId: row.id, code: error.code });
      } else {
        confirmationsCleared += 1;
      }
    }
  }

  return { ok: failed === 0, scanned: rows.size, cleared, confirmationsCleared, failed, cutoff };
}
