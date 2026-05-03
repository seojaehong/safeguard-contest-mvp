-- MIGRATION CANDIDATE ONLY. Do not apply without review.
-- Existing tables safety_reference_sources/items/ingestion_runs can carry this bundle through item.payload.
-- This optional table is recommended only if form-level QA needs first-class columns.

create table if not exists safety_reference_form_records (
  id text primary key,
  source_id text not null references safety_reference_sources(id) on delete cascade,
  source_file text not null,
  source_type text not null,
  form_type text not null,
  document_kind text not null check (document_kind in (
    'tbm',
    'risk_assessment',
    'work_plan',
    'permit',
    'safety_education_log',
    'photo_evidence',
    'emergency_response',
    'technical_reference'
  )),
  page_or_sheet text not null,
  extracted_text text not null default '',
  section_title text not null default '',
  field_labels text[] not null default '{}'::text[],
  recommended_use text not null check (recommended_use in ('submission_output', 'internal_knowledge_db')),
  confidence numeric(4,2) not null default 0,
  needs_manual_review boolean not null default true,
  parser text not null,
  failure_reason text,
  duplicate_group text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_safety_reference_form_records_source_id on safety_reference_form_records(source_id);
create index if not exists idx_safety_reference_form_records_document_kind on safety_reference_form_records(document_kind);
create index if not exists idx_safety_reference_form_records_recommended_use on safety_reference_form_records(recommended_use);
create index if not exists idx_safety_reference_form_records_field_labels on safety_reference_form_records using gin(field_labels);
create index if not exists idx_safety_reference_form_records_search on safety_reference_form_records using gin(
  to_tsvector('simple', coalesce(section_title, '') || ' ' || coalesce(extracted_text, ''))
);

alter table safety_reference_form_records enable row level security;

create policy "public can read safety reference form records"
  on safety_reference_form_records for select
  using (true);
