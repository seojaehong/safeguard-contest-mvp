import { createHash } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceDatabase = {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; owner_id: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; owner_id?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; owner_id?: string | null; updated_at?: string };
        Relationships: [];
      };
      sites: {
        Row: { id: string; organization_id: string; name: string; industry: string | null; region: string | null; briefing_enabled: boolean; briefing_question: string | null; briefing_email: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; organization_id: string; name: string; industry?: string | null; region?: string | null; briefing_enabled?: boolean; briefing_question?: string | null; briefing_email?: string | null; created_at?: string; updated_at?: string };
        Update: { name?: string; industry?: string | null; region?: string | null; briefing_enabled?: boolean; briefing_question?: string | null; briefing_email?: string | null; updated_at?: string };
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          external_key: string;
          display_name: string;
          role: string;
          joined_at: string | null;
          experience_summary: string | null;
          nationality: string | null;
          language_code: string | null;
          language_label: string | null;
          is_new_worker: boolean;
          is_foreign_worker: boolean;
          training_status: string;
          training_summary: string | null;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          external_key: string;
          display_name: string;
          role: string;
          joined_at?: string | null;
          experience_summary?: string | null;
          nationality?: string | null;
          language_code?: string | null;
          language_label?: string | null;
          is_new_worker?: boolean;
          is_foreign_worker?: boolean;
          training_status?: string;
          training_summary?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          site_id?: string | null;
          display_name?: string;
          role?: string;
          joined_at?: string | null;
          experience_summary?: string | null;
          nationality?: string | null;
          language_code?: string | null;
          language_label?: string | null;
          is_new_worker?: boolean;
          is_foreign_worker?: boolean;
          training_status?: string;
          training_summary?: string | null;
          phone?: string | null;
          email?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workpacks: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          question: string;
          scenario: Json;
          deliverables: Json;
          evidence_summary: Json;
          quality_contract: Json;
          ontology_qa: Json;
          worker_summary: Json;
          status: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          question: string;
          scenario?: Json;
          deliverables?: Json;
          evidence_summary?: Json;
          quality_contract?: Json;
          ontology_qa?: Json;
          worker_summary?: Json;
          status?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question?: string;
          scenario?: Json;
          deliverables?: Json;
          evidence_summary?: Json;
          quality_contract?: Json;
          ontology_qa?: Json;
          worker_summary?: Json;
          status?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      education_records: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string | null;
          worker_id: string | null;
          worker_external_key: string | null;
          worker_snapshot: Json;
          topic: string;
          language_code: string | null;
          language_label: string | null;
          confirmation_status: string;
          confirmation_method: string | null;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id?: string | null;
          worker_id?: string | null;
          worker_external_key?: string | null;
          worker_snapshot?: Json;
          topic: string;
          language_code?: string | null;
          language_label?: string | null;
          confirmation_status?: string;
          confirmation_method?: string | null;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          confirmation_status?: string;
          confirmation_method?: string | null;
          memo?: string | null;
        };
        Relationships: [];
      };
      dispatch_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          site_id: string | null;
          workpack_id: string | null;
          channel: string;
          target_label: string | null;
          target_contact: string | null;
          language_code: string | null;
          provider: string | null;
          provider_status: string | null;
          workflow_run_id: string | null;
          failure_reason: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          site_id?: string | null;
          workpack_id?: string | null;
          channel: string;
          target_label?: string | null;
          target_contact?: string | null;
          language_code?: string | null;
          provider?: string | null;
          provider_status?: string | null;
          workflow_run_id?: string | null;
          failure_reason?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          provider_status?: string | null;
          failure_reason?: string | null;
          payload?: Json;
        };
        Relationships: [];
      };
      workpack_share_sessions: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string;
          share_scope: string;
          recipients_snapshot: Json;
          access_policy: Json;
          status: string;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id: string;
          share_scope?: string;
          recipients_snapshot?: Json;
          access_policy?: Json;
          status?: string;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          share_scope?: string;
          recipients_snapshot?: Json;
          access_policy?: Json;
          status?: string;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workpack_read_confirmations: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string;
          share_session_id: string | null;
          worker_id: string | null;
          worker_display_name: string;
          worker_snapshot: Json;
          language_code: string;
          confirmation_method: string;
          read_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id: string;
          share_session_id?: string | null;
          worker_id?: string | null;
          worker_display_name: string;
          worker_snapshot?: Json;
          language_code?: string;
          confirmation_method?: string;
          read_at?: string;
          created_at?: string;
        };
        Update: {
          worker_snapshot?: Json;
          language_code?: string;
          confirmation_method?: string;
          read_at?: string;
        };
        Relationships: [];
      };
      workpack_improvements: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string;
          task_label: string;
          hazard_label: string;
          improvement_text: string;
          reflected_documents: string[];
          review_status: string;
          source_type: string;
          photo_summary: Json;
          analysis_payload: Json;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id: string;
          task_label: string;
          hazard_label: string;
          improvement_text: string;
          reflected_documents?: string[];
          review_status?: string;
          source_type?: string;
          photo_summary?: Json;
          analysis_payload?: Json;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          task_label?: string;
          hazard_label?: string;
          improvement_text?: string;
          reflected_documents?: string[];
          review_status?: string;
          source_type?: string;
          photo_summary?: Json;
          analysis_payload?: Json;
          approved_by?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workpack_improvement_photos: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string;
          improvement_id: string;
          photo_role: string;
          storage_bucket: string;
          storage_path: string;
          original_filename: string;
          content_type: string | null;
          analysis_payload: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id: string;
          improvement_id: string;
          photo_role: string;
          storage_bucket?: string;
          storage_path: string;
          original_filename: string;
          content_type?: string | null;
          analysis_payload?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          original_filename?: string;
          content_type?: string | null;
          analysis_payload?: Json;
        };
        Relationships: [];
      };
      safety_reference_embeddings: {
        Row: {
          id: string;
          reference_item_id: string;
          embedding: string | null;
          embedding_model: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          reference_item_id: string;
          embedding?: string | null;
          embedding_model: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          embedding?: string | null;
          embedding_model?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      daily_entries: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string | null;
          entry_date: string;
          input_delta: string | null;
          weather_snap: Json;
          legal_evidence_snap: Json;
          training_snap: Json;
          kosha_snap: Json;
          accident_snap: Json;
          knowledge_snap: Json;
          doc_pack: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id?: string | null;
          entry_date?: string;
          input_delta?: string | null;
          weather_snap?: Json;
          legal_evidence_snap?: Json;
          training_snap?: Json;
          kosha_snap?: Json;
          accident_snap?: Json;
          knowledge_snap?: Json;
          doc_pack?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workpack_id?: string | null;
          input_delta?: string | null;
          weather_snap?: Json;
          legal_evidence_snap?: Json;
          training_snap?: Json;
          kosha_snap?: Json;
          accident_snap?: Json;
          knowledge_snap?: Json;
          doc_pack?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge_events: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string | null;
          daily_entry_id: string | null;
          source: string;
          source_id: string;
          captured_at: string;
          title: string;
          url: string | null;
          payload: Json;
          related_hazard_ids: string[];
          reflected_documents: string[];
          review_status: string;
          proposed_wiki_update: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id?: string | null;
          daily_entry_id?: string | null;
          source: string;
          source_id: string;
          captured_at?: string;
          title: string;
          url?: string | null;
          payload?: Json;
          related_hazard_ids?: string[];
          reflected_documents?: string[];
          review_status?: string;
          proposed_wiki_update?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          review_status?: string;
          proposed_wiki_update?: Json;
        };
        Relationships: [];
      };
      mcp_tokens: {
        Row: {
          id: string;
          token_hash: string;
          label: string | null;
          site_id: string | null;
          org_id: string | null;
          scopes: Json;
          disabled: boolean;
          last_used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token_hash: string;
          label?: string | null;
          site_id?: string | null;
          org_id?: string | null;
          scopes?: Json;
          disabled?: boolean;
          last_used_at?: string | null;
          created_at?: string;
        };
        Update: {
          label?: string | null;
          site_id?: string | null;
          org_id?: string | null;
          scopes?: Json;
          disabled?: boolean;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      knowledge_regeneration_runs: {
        Row: {
          id: string;
          organization_id: string;
          site_id: string | null;
          workpack_id: string | null;
          daily_entry_id: string | null;
          question: string;
          raw_event_ids: string[];
          matched_hazards: Json;
          templates: Json;
          ai_instruction: string;
          generated_output: Json;
          provider: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          site_id?: string | null;
          workpack_id?: string | null;
          daily_entry_id?: string | null;
          question: string;
          raw_event_ids?: string[];
          matched_hazards?: Json;
          templates?: Json;
          ai_instruction?: string;
          generated_output?: Json;
          provider?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          generated_output?: Json;
          provider?: string | null;
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type WorkspaceContext = {
  organizationId: string;
  siteId: string;
};

export type WorkspaceScopeSelection = {
  organizationId: string;
  siteId: string;
};

export class WorkspaceContextResolutionError extends Error {
  readonly status = 409;

  constructor(
    readonly code:
      | "workspace_scope_incomplete"
      | "workspace_scope_required"
      | "workspace_scope_invalid"
      | "workspace_scope_forbidden"
      | "workspace_scope_ambiguous",
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceContextResolutionError";
  }
}

export type WorkspaceUser = {
  id: string;
  email: string | null;
};

export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function createSupabaseAdminClient(): SupabaseClient<WorkspaceDatabase> | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient<WorkspaceDatabase>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function getWorkspaceUser(
  client: SupabaseClient<WorkspaceDatabase>,
  headers: Headers
): Promise<WorkspaceUser | null> {
  const authorization = headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  return normalizeUser(data.user);
}

function normalizeUser(user: User): WorkspaceUser {
  return {
    id: user.id,
    email: user.email || null
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deterministicContextUuid(parts: readonly string[]): string {
  const bytes = createHash("sha256").update(JSON.stringify(parts), "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function databaseErrorCode(error: unknown): string | null {
  return isRecord(error) && typeof error.code === "string" ? error.code : null;
}

function parseWorkspaceScopeSelection(value: unknown): WorkspaceScopeSelection {
  if (typeof value === "undefined" || value === null) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_required",
      "조직과 현장을 직접 선택해야 작업팩을 저장할 수 있습니다.",
    );
  }
  if (!isRecord(value)) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_invalid",
      "조직과 현장 선택 형식을 확인해 주세요.",
    );
  }
  const organizationId = typeof value.organizationId === "string" ? value.organizationId.trim() : "";
  const siteId = typeof value.siteId === "string" ? value.siteId.trim() : "";
  if (!organizationId || !siteId) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_incomplete",
      "조직과 현장은 함께 선택해야 합니다.",
    );
  }
  if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(siteId)) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_invalid",
      "조직과 현장 선택값을 확인해 주세요.",
    );
  }
  return { organizationId, siteId };
}

export async function resolveAuthenticatedWorkspaceContext(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  requestedScope: unknown,
  _fallback: { companyName?: string; siteName?: string; companyType?: string; region?: string },
): Promise<WorkspaceContext> {
  const selection = parseWorkspaceScopeSelection(requestedScope);

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("id", selection.organizationId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_forbidden",
      "선택한 조직과 현장을 현재 계정에서 확인할 수 없습니다.",
    );
  }

  const { data: site, error: siteError } = await client
    .from("sites")
    .select("id,organization_id")
    .eq("id", selection.siteId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site || site.organization_id !== organization.id) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_forbidden",
      "선택한 조직과 현장을 현재 계정에서 확인할 수 없습니다.",
    );
  }

  return { organizationId: organization.id, siteId: site.id };
}

export async function ensureWorkspaceContext(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  input: { companyName?: string; siteName?: string; companyType?: string; region?: string }
): Promise<WorkspaceContext> {
  const organizationName = input.companyName || "SafeClaw Pilot";
  const siteName = input.siteName || "기본 현장";

  const { data: matchingOrganizations, error: organizationSelectError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .eq("name", organizationName)
    .limit(2);

  if (organizationSelectError) throw organizationSelectError;
  if ((matchingOrganizations || []).length > 1) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_ambiguous",
      "같은 이름의 조직이 여러 개라 조직과 현장을 직접 선택해야 합니다.",
    );
  }

  const organizationId = matchingOrganizations?.[0]?.id
    || await insertOrganization(client, user.id, organizationName);

  const { data: matchingSites, error: siteSelectError } = await client
    .from("sites")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", siteName)
    .limit(2);

  if (siteSelectError) throw siteSelectError;
  if ((matchingSites || []).length > 1) {
    throw new WorkspaceContextResolutionError(
      "workspace_scope_ambiguous",
      "같은 이름의 현장이 여러 개라 조직과 현장을 직접 선택해야 합니다.",
    );
  }

  const siteId = matchingSites?.[0]?.id || await insertSite(client, organizationId, {
    name: siteName,
    industry: input.companyType || null,
    region: input.region || null
  });

  return { organizationId, siteId };
}

async function insertOrganization(
  client: SupabaseClient<WorkspaceDatabase>,
  ownerId: string,
  name: string
) {
  const id = deterministicContextUuid(["safeclaw-workspace-organization/v1", ownerId, name]);
  const { data, error } = await client
    .from("organizations")
    .insert({ id, name, owner_id: ownerId })
    .select("id")
    .single();

  if (error) {
    if (databaseErrorCode(error) === "23505") {
      const { data: raced, error: racedError } = await client
        .from("organizations")
        .select("id")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (racedError) throw racedError;
      if (raced) return raced.id;
    }
    throw error;
  }
  return data.id;
}

async function insertSite(
  client: SupabaseClient<WorkspaceDatabase>,
  organizationId: string,
  site: { name: string; industry: string | null; region: string | null }
) {
  const id = deterministicContextUuid(["safeclaw-workspace-site/v1", organizationId, site.name]);
  const { data, error } = await client
    .from("sites")
    .insert({
      id,
      organization_id: organizationId,
      name: site.name,
      industry: site.industry,
      region: site.region
    })
    .select("id")
    .single();

  if (error) {
    if (databaseErrorCode(error) === "23505") {
      const { data: raced, error: racedError } = await client
        .from("sites")
        .select("id,organization_id")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (racedError) throw racedError;
      if (raced?.organization_id === organizationId) return raced.id;
    }
    throw error;
  }
  return data.id;
}
