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
          created_at: string;
        };
        Insert: {
          id?: string;
          reference_item_id: string;
          embedding?: string | null;
          embedding_model: string;
          created_at?: string;
        };
        Update: {
          embedding?: string | null;
          embedding_model?: string;
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

export async function ensureWorkspaceContext(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  input: { companyName?: string; siteName?: string; companyType?: string; region?: string }
): Promise<WorkspaceContext> {
  const organizationName = input.companyName || "SafeClaw Pilot";
  const siteName = input.siteName || "기본 현장";

  const { data: existingOrganization, error: organizationSelectError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (organizationSelectError) throw organizationSelectError;

  const organizationId = existingOrganization?.id || await insertOrganization(client, user.id, organizationName);

  const { data: existingSite, error: siteSelectError } = await client
    .from("sites")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", siteName)
    .limit(1)
    .maybeSingle();

  if (siteSelectError) throw siteSelectError;

  const siteId = existingSite?.id || await insertSite(client, organizationId, {
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
  const { data, error } = await client
    .from("organizations")
    .insert({ name, owner_id: ownerId })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function insertSite(
  client: SupabaseClient<WorkspaceDatabase>,
  organizationId: string,
  site: { name: string; industry: string | null; region: string | null }
) {
  const { data, error } = await client
    .from("sites")
    .insert({
      organization_id: organizationId,
      name: site.name,
      industry: site.industry,
      region: site.region
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
