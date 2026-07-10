import { describe, expect, it } from "vitest";

import * as commercial from "@/lib/workpack-commercial";
import * as commercialStore from "@/lib/workpack-commercial-store";
import { buildMockAskResponse, mockSearchResults } from "@/lib/mock-data";
import { buildWorkpackEvidenceSummary } from "@/lib/workpack-store";
import type { AskResponse } from "@/lib/types";

const WORKER_1 = "11111111-1111-4111-8111-111111111111";
const WORKER_2 = "22222222-2222-4222-8222-222222222222";

function readyResponse(): AskResponse {
  const response = buildMockAskResponse("성수동 외벽 도장", mockSearchResults.slice(0, 2), "live", "test");
  return {
    ...response,
    qualityContract: {
      ...(response.qualityContract as NonNullable<AskResponse["qualityContract"]>),
      overall: "ready"
    },
    dbHarness: {
      packet: {} as NonNullable<AskResponse["dbHarness"]>["packet"],
      promptContext: "server harness",
      summary: {
        mode: "db_harness_first",
        llmRole: "naturalize_only",
        llmOutputScope: "rewrite_fixed_evidence_only",
        evidenceAuthority: "db_harness",
        providerRetryScope: "naturalization_retry_only",
        fallbackChainAllowed: false,
        genericProseSubstitutionAllowed: false,
        missingEvidencePolicy: "surface_review_required",
        directEvidence: 2,
        sifCases: 1,
        supportingEvidence: 1,
        improvementMemory: 0,
        workpackMemory: 0,
        missingEvidence: [],
        documentCoverage: [],
        retrievalContract: {} as NonNullable<AskResponse["dbHarness"]>["summary"]["retrievalContract"],
        ontologyStatus: "ready"
      }
    }
  };
}

describe("server-only workpack share authority", () => {
  it("blocks legacy stored workpacks that have no generation harness", () => {
    const assess = Reflect.get(commercialStore, "assessStoredWorkpackShareAuthority") as (input: unknown) => {
      readiness: { canShare: boolean; reasons: string[] };
    };
    const response = readyResponse();
    const evidenceSummary = buildWorkpackEvidenceSummary(response) as Record<string, unknown>;
    delete evidenceSummary.dbHarness;

    const result = assess({
      question: response.question,
      scenario: response.scenario,
      deliverables: response.deliverables,
      evidenceSummary,
      status: response.status
    });

    expect(result.readiness.canShare).toBe(false);
    expect(result.readiness.reasons).toContain("DB 하네스 근거 보강 필요");
  });

  it("rejects empty, duplicate, malformed, unknown, and foreign recipient ids", () => {
    const build = Reflect.get(commercial, "buildServerShareRecipients") as (input: unknown) => {
      ok: boolean;
      message?: string;
    };
    const base = {
      organizationId: "org-1",
      siteId: "site-1",
      workers: [{
        id: WORKER_1,
        organization_id: "org-2",
        site_id: "site-1",
        external_key: "W-1",
        display_name: "Nguyen",
        role: "도장공",
        joined_at: null,
        experience_summary: null,
        nationality: "VN",
        language_code: "vi",
        language_label: "Tiếng Việt",
        is_new_worker: false,
        is_foreign_worker: true,
        training_status: "확인",
        training_summary: null,
        phone: "010-1111-2222",
        email: null
      }]
    };

    expect(build({ ...base, requestedWorkerIds: [] }).ok).toBe(false);
    expect(build({ ...base, requestedWorkerIds: [WORKER_1, WORKER_1] }).ok).toBe(false);
    expect(build({ ...base, requestedWorkerIds: ["not-a-uuid"] }).ok).toBe(false);
    expect(build({ ...base, requestedWorkerIds: [WORKER_2] }).ok).toBe(false);
    expect(build({ ...base, requestedWorkerIds: [WORKER_1] }).ok).toBe(false);
  });

  it("rebuilds recipient snapshots exclusively from server worker rows", () => {
    const build = Reflect.get(commercial, "buildServerShareRecipients") as (input: unknown) => {
      ok: boolean;
      recipients?: Array<Record<string, unknown>>;
    };
    const result = build({
      organizationId: "org-1",
      siteId: "site-1",
      requestedWorkerIds: [WORKER_1],
      workers: [{
        id: WORKER_1,
        organization_id: "org-1",
        site_id: "site-1",
        external_key: "W-1",
        display_name: "Server Nguyen",
        role: "도장공",
        joined_at: "2026-01-01",
        experience_summary: "3년",
        nationality: "VN",
        language_code: "vi",
        language_label: "Tiếng Việt",
        is_new_worker: false,
        is_foreign_worker: true,
        training_status: "이수",
        training_summary: "TBM",
        phone: "010-1111-2222",
        email: "server@example.com"
      }]
    });

    expect(result.ok).toBe(true);
    expect(result.recipients?.[0]).toMatchObject({
      workerId: WORKER_1,
      displayName: "Server Nguyen",
      languageCode: "vi",
      workerSnapshot: {
        workerId: WORKER_1,
        displayName: "Server Nguyen",
        phone: "010-1111-2222",
        email: "server@example.com"
      }
    });
  });

  it("requires channel-specific contacts from the immutable session snapshot", () => {
    const validate = Reflect.get(commercial, "validateDispatchContacts") as (input: unknown) => {
      ok: boolean;
      message?: string;
    };
    const recipient = {
      workerId: WORKER_1,
      displayName: "Nguyen",
      languageCode: "vi",
      role: "viewer",
      workerSnapshot: { workerId: WORKER_1, displayName: "Nguyen", phone: "010-1111-2222", email: null }
    };

    expect(validate({ channels: ["sms"], recipients: [recipient] }).ok).toBe(true);
    expect(validate({ channels: ["email"], recipients: [recipient] }).ok).toBe(false);
  });

  it("rejects an entire persisted session snapshot when any recipient is malformed", () => {
    const parse = Reflect.get(commercial, "parseShareSessionRecipients") as (value: unknown) => unknown[];
    const recipients = parse([
      {
        workerId: WORKER_1,
        displayName: "Nguyen",
        languageCode: "vi",
        role: "viewer",
        workerSnapshot: { workerId: WORKER_1, displayName: "Nguyen" }
      },
      {
        workerId: WORKER_2,
        displayName: "Tampered",
        workerSnapshot: { workerId: WORKER_1, displayName: "Tampered" }
      }
    ]);

    expect(recipients).toEqual([]);
  });

  it("rejects an invalid session expiry while querying the owned session scope", async () => {
    const filters: Array<[string, string]> = [];
    const query = {
      select() { return query; },
      eq(column: string, value: string) {
        filters.push([column, value]);
        return query;
      },
      maybeSingle: async () => ({
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          organization_id: "org-1",
          site_id: "site-1",
          workpack_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          recipients_snapshot: [{
            workerId: WORKER_1,
            displayName: "Nguyen",
            languageCode: "vi",
            role: "viewer",
            workerSnapshot: { workerId: WORKER_1, displayName: "Nguyen" }
          }],
          status: "active",
          expires_at: "not-a-date",
          created_by: "user-1"
        },
        error: null
      })
    };
    const load = Reflect.get(commercialStore, "loadActiveOwnedShareSession") as unknown as (
      client: unknown,
      input: Record<string, unknown>
    ) => Promise<{ ok: boolean; status?: number }>;

    const result = await load({ from: () => query }, {
      organizationId: "org-1",
      siteId: "site-1",
      workpackId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      shareSessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "user-1"
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(filters).toEqual(expect.arrayContaining([
      ["organization_id", "org-1"],
      ["workpack_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      ["created_by", "user-1"]
    ]));
  });
});
