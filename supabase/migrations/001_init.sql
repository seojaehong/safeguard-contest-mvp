create table if not exists query_logs (
  id bigint generated always as identity primary key,
  query_text text not null,
  mode text not null default 'mock',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key,
  doc_type text not null,
  title text not null,
  summary text,
  body text,
  citation text,
  source_url text,
  created_at timestamptz not null default now()
);
