-- GrowthOS core schema: auth profiles, agencies, clients, campaigns, calendar
-- Applied via Supabase MCP (apply_migration)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum (
    'super_admin', 'admin', 'manager', 'creative', 'client'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.client_tier as enum (
    'Starter', 'Agency Growth', 'Enterprise White-Label'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'paid', 'outstanding', 'overdue'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.campaign_status as enum (
    'active', 'paused', 'draft', 'completed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.calendar_status as enum (
    'scheduled', 'draft', 'published', 'needs_correction'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Organizations (agencies)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  team_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'admin',
  avatar text not null default '',
  phone text,
  company_name text,
  department text default 'Growth Operations',
  privileges jsonb not null default '{
    "can_create_account": true,
    "can_delete_social_handle": true,
    "can_add_team": true,
    "can_invoice_management": true,
    "can_manage_campaigns": true,
    "can_manage_calendar": true,
    "can_sync_social": true
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles (org_id);

-- ---------------------------------------------------------------------------
-- Clients (agency brands)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id text primary key,
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  industry text not null,
  industry_label text not null,
  logo text not null default '',
  website text not null default '',
  tier public.client_tier not null default 'Starter',
  monthly_budget numeric not null default 0,
  primary_goal text not null default '',
  growth_score numeric not null default 0,
  virality_score numeric not null default 0,
  engagement_health numeric not null default 0,
  sentiment_score numeric not null default 0,
  conversion_score numeric not null default 0,
  roi_multiplier numeric not null default 0,
  platforms jsonb not null default '[]'::jsonb,
  next_payment_date text not null default '',
  last_payment_date text not null default '',
  payment_status public.payment_status not null default 'outstanding',
  outstanding_amount numeric not null default 0,
  invoices jsonb not null default '[]'::jsonb,
  recent_growth_trends jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_org_id_idx on public.clients (org_id);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  name text not null,
  type text not null,
  objective text not null,
  objective_label text not null,
  status public.campaign_status not null default 'draft',
  primary_goal text not null default '',
  primary_metric text not null default '',
  budget numeric not null default 0,
  start_date text not null default '',
  end_date text not null default '',
  target_metric text not null default '',
  current_progress numeric not null default 0,
  channels jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  funnel_stages jsonb,
  retargeting_pools jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_client_id_idx on public.campaigns (client_id);

-- ---------------------------------------------------------------------------
-- Content calendar
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_items (
  id text primary key,
  client_id text not null references public.clients (id) on delete cascade,
  campaign_id text references public.campaigns (id) on delete set null,
  date text not null,
  day_of_week text not null default '',
  time text not null default '',
  platform text not null,
  content_type text not null,
  topic text not null default '',
  hook_text text not null default '',
  caption_text text not null default '',
  cta text not null default '',
  status public.calendar_status not null default 'draft',
  ai_score numeric not null default 0,
  ai_feedback text,
  ai_suggested_hook text,
  ai_suggested_time text,
  visual_asset_url text,
  visual_asset_type text,
  designer_status text,
  designer_notes text,
  creative_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_items_client_id_idx on public.calendar_items (client_id);
create index if not exists calendar_items_date_idx on public.calendar_items (date);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

drop trigger if exists calendar_items_set_updated_at on public.calendar_items;
create trigger calendar_items_set_updated_at
  before update on public.calendar_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth → profile bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'full_name', ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );
  avatar_url text := coalesce(
    nullif(meta ->> 'avatar', ''),
    nullif(meta ->> 'avatar_url', ''),
    nullif(meta ->> 'picture', ''),
    'https://ui-avatars.com/api/?name=' || replace(full_name, ' ', '+') || '&background=6366f1&color=fff&size=128'
  );
  user_role public.user_role := coalesce(
    nullif(meta ->> 'role', '')::public.user_role,
    'admin'
  );
begin
  insert into public.profiles (
    id, name, email, role, avatar, phone, company_name, department, privileges
  ) values (
    new.id,
    full_name,
    coalesce(new.email, ''),
    user_role,
    avatar_url,
    nullif(meta ->> 'phone', ''),
    nullif(meta ->> 'company_name', ''),
    coalesce(nullif(meta ->> 'department', ''), 'Growth Operations'),
    coalesce(meta -> 'privileges', '{
      "can_create_account": true,
      "can_delete_social_handle": true,
      "can_add_team": true,
      "can_invoice_management": true,
      "can_manage_campaigns": true,
      "can_manage_calendar": true,
      "can_sync_social": true
    }'::jsonb)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.campaigns enable row level security;
alter table public.calendar_items enable row level security;

-- Profiles: users can read all team profiles; update own; admins update any
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
    )
  )
  with check (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'admin')
    )
  );

-- Organizations
drop policy if exists "organizations_select_authenticated" on public.organizations;
create policy "organizations_select_authenticated"
  on public.organizations for select
  to authenticated
  using (true);

drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
  on public.organizations for insert
  to authenticated
  with check (true);

drop policy if exists "organizations_update_authenticated" on public.organizations;
create policy "organizations_update_authenticated"
  on public.organizations for update
  to authenticated
  using (true)
  with check (true);

-- Clients / campaigns / calendar: authenticated team access
drop policy if exists "clients_all_authenticated" on public.clients;
create policy "clients_all_authenticated"
  on public.clients for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "campaigns_all_authenticated" on public.campaigns;
create policy "campaigns_all_authenticated"
  on public.campaigns for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "calendar_items_all_authenticated" on public.calendar_items;
create policy "calendar_items_all_authenticated"
  on public.calendar_items for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Realtime (optional subscriptions)
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.clients;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.campaigns;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.calendar_items;
exception when duplicate_object then null;
end $$;
