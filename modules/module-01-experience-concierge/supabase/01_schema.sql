-- Big Sky Command™ — Experience Registry
-- 01_schema.sql
-- Creates the "experiences" table and locks it down so only Big Sky Lead
-- Partners (via the Supabase dashboard / SQL editor, using elevated access)
-- can create or edit records. The public front end only ever reads active
-- rows through the anon key.

create extension if not exists "pgcrypto";

create table if not exists experiences (
  id                    uuid primary key default gen_random_uuid(),
  experience_id         text not null unique,
  business_name         text not null,
  experience_name       text not null,
  status                text not null default 'active'
                          check (status in ('active', 'inactive')),
  headline              text,
  subheadline           text,
  logo_url              text,
  primary_color         text,
  secondary_color       text,
  welcome_video_url     text,
  call_to_action_text   text,
  ghl_form_embed        text,
  thank_you_message     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Keep updated_at accurate on every edit, without requiring the editor
-- (Big Sky Lead Partners staff) to set it manually.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_experiences_updated_at on experiences;
create trigger trg_experiences_updated_at
  before update on experiences
  for each row
  execute function set_updated_at();

-- Fast lookup by experience_id (the value read from the URL path).
create index if not exists idx_experiences_experience_id
  on experiences (experience_id);

-- ---------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------
-- Row Level Security is ON. No insert/update/delete policy is defined for
-- the public (anon) role, so the front end — and anyone using the anon
-- key — can never create or edit a record. Only Big Sky Lead Partners,
-- working directly in the Supabase Table Editor or SQL Editor (which use
-- elevated project credentials, not the anon key), can create or edit
-- Experience Registry records and Business Overlays. Clients are never
-- given Supabase access.

alter table experiences enable row level security;

drop policy if exists "Public can read active experiences" on experiences;
create policy "Public can read active experiences"
  on experiences
  for select
  using (status = 'active');

-- No insert / update / delete policy exists for the anon or authenticated
-- roles. This is intentional: it is what enforces the Client Access Rule.
