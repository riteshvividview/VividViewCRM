-- ==========================================
-- Vivid View CRM — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ==========================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────
-- WORKSPACES
-- ──────────────────────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  owner_id    uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

alter table public.workspaces enable row level security;

create policy "Workspace members can view their workspace"
  on public.workspaces for select
  using (owner_id = auth.uid() or id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

create policy "Workspace owner can update workspace"
  on public.workspaces for update
  using (owner_id = auth.uid());

-- ──────────────────────────────────────────
-- PROFILES
-- ──────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid references public.workspaces(id) on delete set null,
  full_name     text not null default '',
  avatar_url    text,
  role          text not null default 'sales_rep' check (role in ('admin', 'manager', 'sales_rep')),
  created_at    timestamptz default now(),
  unique (user_id)
);

alter table public.profiles enable row level security;

create policy "Users can view profiles in their workspace"
  on public.profiles for select
  using (user_id = auth.uid() or workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

create policy "Users can update their own profile"
  on public.profiles for update
  using (user_id = auth.uid());

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (user_id = auth.uid());

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────
-- LEADS
-- ──────────────────────────────────────────
create table if not exists public.leads (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  company       text,
  status        text not null default 'New' check (status in ('New','Contacted','Qualified','Proposal','Negotiation','Won','Lost')),
  score         int default 0,
  value         numeric(12,2),
  assigned_to   uuid references public.profiles(id) on delete set null,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.leads enable row level security;

create policy "Workspace members can view leads"
  on public.leads for select
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

create policy "Workspace members can insert leads"
  on public.leads for insert
  with check (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

create policy "Workspace members can update leads"
  on public.leads for update
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- DEALS
-- ──────────────────────────────────────────
create table if not exists public.deals (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  title         text not null,
  company       text,
  value         numeric(12,2),
  stage         text not null default 'Discovery' check (stage in ('Discovery','Proposal','Negotiation','Closed Won','Closed Lost')),
  probability   int default 0 check (probability between 0 and 100),
  expected_close date,
  assigned_to   uuid references public.profiles(id) on delete set null,
  lead_id       uuid references public.leads(id) on delete set null,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.deals enable row level security;

create policy "Workspace members can manage deals"
  on public.deals for all
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- CONTACTS
-- ──────────────────────────────────────────
create table if not exists public.contacts (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  company       text,
  role          text,
  avatar_url    text,
  status        text default 'Active' check (status in ('Active','Inactive')),
  notes         text,
  created_at    timestamptz default now()
);

alter table public.contacts enable row level security;

create policy "Workspace members can manage contacts"
  on public.contacts for all
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- ACTION ITEMS
-- ──────────────────────────────────────────
create table if not exists public.action_items (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  title         text not null,
  priority      text default 'Medium' check (priority in ('High','Medium','Low')),
  status        text default 'Pending' check (status in ('Pending','In Progress','Completed')),
  due_date      date,
  assigned_to   uuid references public.profiles(id) on delete set null,
  related_lead  uuid references public.leads(id) on delete set null,
  related_deal  uuid references public.deals(id) on delete set null,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now()
);

alter table public.action_items enable row level security;

create policy "Workspace members can manage action items"
  on public.action_items for all
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- Updated_at trigger
-- ──────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at before update on public.leads for each row execute procedure update_updated_at();
create trigger deals_updated_at before update on public.deals for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- PHASE 2: ENHANCED LEADS TABLE
-- ──────────────────────────────────────────
-- Drop old leads and recreate with full schema
drop table if exists public.leads cascade;

create table if not exists public.leads (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  company       text,
  company_id    uuid,
  source        text check (source in ('Website','Referral','Cold Call','Social Media','Event','Email Campaign','Partner','Other')),
  status        text not null default 'New' check (status in ('New','Contacted','Qualified','Proposal','Won','Lost')),
  score         int not null default 0 check (score between 0 and 100),
  assigned_to   uuid references public.profiles(id) on delete set null,
  assigned_name text,
  custom_fields jsonb,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.leads enable row level security;

create policy "Workspace members can manage leads"
  on public.leads for all
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- PHASE 2: ENHANCED DEALS TABLE
-- ──────────────────────────────────────────
drop table if exists public.deals cascade;

create table if not exists public.deals (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid references public.workspaces(id) on delete cascade,
  title          text not null,
  lead_id        uuid references public.leads(id) on delete set null,
  stage          text not null default 'Av. Leads' check (stage in ('Av. Leads','Samples Sent','Quotes','Negotiations','Sales')),
  value          numeric(14,2) not null default 0,
  currency       text not null default 'INR',
  close_date     date,
  assigned_to    uuid references public.profiles(id) on delete set null,
  assigned_name  text,
  assigned_avatar text,
  location       text check (location in ('Delhi','Mumbai','Bangalore','Chennai','Hyderabad','Other')),
  notes          text,
  company        text,
  contact_name   text,
  won_lost_reason text,
  days_in_stage  int not null default 0,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.deals enable row level security;

create policy "Workspace members can manage deals"
  on public.deals for all
  using (workspace_id in (
    select workspace_id from public.profiles where user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- DEAL ACTIVITIES
-- ──────────────────────────────────────────
create table if not exists public.deal_activities (
  id          uuid primary key default uuid_generate_v4(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  type        text not null check (type in ('note','status_change','file_upload','call','email')),
  content     text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

alter table public.deal_activities enable row level security;

create policy "Workspace members can manage deal activities"
  on public.deal_activities for all
  using (deal_id in (
    select d.id from public.deals d
    join public.profiles p on p.workspace_id = d.workspace_id
    where p.user_id = auth.uid()
  ));

-- ──────────────────────────────────────────
-- LEAD ACTIVITIES
-- ──────────────────────────────────────────
create table if not exists public.lead_activities (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  type        text not null check (type in ('note','status_change','call','email','meeting')),
  content     text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

alter table public.lead_activities enable row level security;

create policy "Workspace members can manage lead activities"
  on public.lead_activities for all
  using (lead_id in (
    select l.id from public.leads l
    join public.profiles p on p.workspace_id = l.workspace_id
    where p.user_id = auth.uid()
  ));

-- Updated_at triggers for new tables
create trigger leads_v2_updated_at before update on public.leads for each row execute procedure update_updated_at();
create trigger deals_v2_updated_at before update on public.deals for each row execute procedure update_updated_at();

-- ==========================================
-- PHASE 4: TASKS, CALENDAR EVENTS, NOTIFICATIONS
-- ==========================================

-- ──────────────────────────────────────────
-- TASKS
-- ──────────────────────────────────────────
create table if not exists public.tasks (
  id                  uuid primary key default uuid_generate_v4(),
  title               text not null,
  description         text default '',
  status              text not null default 'todo'
    check (status in ('todo','in_progress','waiting','done')),
  priority            text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  due_date            date,
  assignee_id         uuid references auth.users(id) on delete set null,
  assignee_name       text,
  linked_entity_type  text check (linked_entity_type in ('lead','deal','contact','company')),
  linked_entity_id    uuid,
  linked_entity_name  text,
  parent_task_id      uuid references public.tasks(id) on delete cascade,
  sub_tasks           jsonb default '[]'::jsonb,
  recurring_pattern   text check (recurring_pattern in ('daily','weekly','monthly')),
  tags                text[] default '{}',
  created_by          uuid references auth.users(id) on delete set null,
  workspace_id        uuid references public.workspaces(id) on delete cascade,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "Users can manage their workspace tasks"
  on public.tasks for all
  using (
    workspace_id in (select workspace_id from public.profiles where user_id = auth.uid())
    or assignee_id = auth.uid()
    or created_by = auth.uid()
  );

create trigger tasks_updated_at before update on public.tasks
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- CALENDAR EVENTS
-- ──────────────────────────────────────────
create table if not exists public.calendar_events (
  id                  uuid primary key default uuid_generate_v4(),
  title               text not null,
  type                text not null default 'meeting'
    check (type in ('meeting','call','demo','follow_up','deadline')),
  start_time          timestamptz not null,
  end_time            timestamptz not null,
  all_day             boolean default false,
  attendees           text[] default '{}',
  linked_entity_type  text check (linked_entity_type in ('lead','deal','contact','company')),
  linked_entity_id    uuid,
  linked_entity_name  text,
  notes               text default '',
  video_call_link     text,
  color_override      text,
  created_by          uuid references auth.users(id) on delete set null,
  workspace_id        uuid references public.workspaces(id) on delete cascade,
  created_at          timestamptz default now()
);

alter table public.calendar_events enable row level security;
create policy "Workspace members can manage calendar events"
  on public.calendar_events for all
  using (
    workspace_id in (select workspace_id from public.profiles where user_id = auth.uid())
    or created_by = auth.uid()
  );

-- ──────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('task_assigned','deal_stage_changed','lead_assigned','mention','event_reminder','task_due')),
  title           text not null,
  body            text not null,
  read            boolean not null default false,
  entity_type     text,
  entity_id       uuid,
  created_at      timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "Users can manage their own notifications"
  on public.notifications for all
  using (user_id = auth.uid());

create index if not exists notifications_user_unread on public.notifications(user_id, read) where read = false;

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;

-- ──────────────────────────────────────────
-- EMAIL TEMPLATES
-- ──────────────────────────────────────────
create table if not exists public.email_templates (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  thumbnail       text,
  blocks          jsonb not null default '[]'::jsonb,
  html_override   text,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.email_templates enable row level security;
create policy "Workspace members can manage email templates"
  on public.email_templates for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));

create trigger email_templates_updated_at before update on public.email_templates
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- CAMPAIGNS
-- ──────────────────────────────────────────
create table if not exists public.campaigns (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  status          text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent','paused')),
  template_id     uuid references public.email_templates(id) on delete set null,
  audience_config jsonb,
  subject         text not null default '',
  preview_text    text not null default '',
  schedule_time   timestamptz,
  drip_sequence   jsonb not null default '[]'::jsonb,
  stats           jsonb not null default '{"sent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"unsubscribed":0}'::jsonb,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.campaigns enable row level security;
create policy "Workspace members can manage campaigns"
  on public.campaigns for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- EMAIL ACCOUNTS
-- ──────────────────────────────────────────
create table if not exists public.email_accounts (
  id              uuid primary key default uuid_generate_v4(),
  provider        text not null check (provider in ('smtp','gmail','outlook')),
  email           text not null,
  display_name    text not null default '',
  is_default      boolean not null default false,
  smtp_host       text,
  smtp_port       integer,
  smtp_username   text,
  smtp_password   text,
  smtp_encryption text default 'tls' check (smtp_encryption in ('tls','ssl','none')),
  from_name       text,
  from_email      text,
  track_opens     boolean not null default true,
  track_clicks    boolean not null default true,
  auto_unsubscribe boolean not null default true,
  oauth_token     text,
  oauth_refresh   text,
  oauth_expiry    timestamptz,
  connected       boolean not null default false,
  syncing         boolean not null default false,
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.email_accounts enable row level security;
create policy "Workspace members can manage email accounts"
  on public.email_accounts for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));

create trigger email_accounts_updated_at before update on public.email_accounts
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- TEAMS
-- ──────────────────────────────────────────
create table if not exists public.teams (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  manager_id   uuid references auth.users(id) on delete set null,
  color        text default 'bg-purple-500',
  territory    text,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.teams enable row level security;
create policy "Workspace members can manage teams"
  on public.teams for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));
create trigger teams_updated_at before update on public.teams
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- TEAM MEMBERS JUNCTION
-- ──────────────────────────────────────────
create table if not exists public.team_members (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'rep'
    check (role in ('manager','senior_rep','rep','junior_rep')),
  territories  text[] default '{}',
  joined_at    timestamptz default now(),
  unique(team_id, user_id)
);
alter table public.team_members enable row level security;
create policy "Workspace members can view team memberships"
  on public.team_members for all
  using (
    team_id in (select id from public.teams where workspace_id in (
      select workspace_id from public.profiles where user_id = auth.uid()
    ))
  );
create index if not exists team_members_team_id on public.team_members(team_id);
create index if not exists team_members_user_id on public.team_members(user_id);

-- ──────────────────────────────────────────
-- TARGETS
-- ──────────────────────────────────────────
create table if not exists public.targets (
  id              uuid primary key default uuid_generate_v4(),
  type            text not null check (type in ('revenue','calls','emails','closures','meetings')),
  label           text not null,
  value           numeric not null default 0,
  current         numeric not null default 0,
  period          text not null default 'monthly'
    check (period in ('weekly','monthly','quarterly','yearly')),
  assigned_to     uuid not null,
  assigned_type   text not null check (assigned_type in ('team','individual')),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.targets enable row level security;
create policy "Workspace members can manage targets"
  on public.targets for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));
create trigger targets_updated_at before update on public.targets
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────
-- TERRITORIES
-- ──────────────────────────────────────────
create table if not exists public.territories (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  city                 text not null,
  state                text,
  assigned_team_id     uuid references public.teams(id) on delete set null,
  assigned_member_ids  uuid[] default '{}',
  workspace_id         uuid references public.workspaces(id) on delete cascade,
  created_at           timestamptz default now()
);
alter table public.territories enable row level security;
create policy "Workspace members can manage territories"
  on public.territories for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- MARKETING CAMPAIGNS
-- ──────────────────────────────────────────
create table if not exists public.marketing_campaigns (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  type                 text not null
    check (type in ('google_ads','facebook','instagram','pr_articles','blogs','outdoor_ads','linkedin','affiliate')),
  status               text not null default 'draft'
    check (status in ('active','paused','completed','draft')),
  budget               numeric not null default 0,
  spent                numeric not null default 0,
  leads_generated      integer not null default 0,
  revenue_attributed   numeric not null default 0,
  pipeline_value       numeric not null default 0,
  roi                  numeric not null default 0,
  start_date           date not null,
  end_date             date,
  utm_params           jsonb default '{}'::jsonb,
  assets               jsonb default '[]'::jsonb,
  territory            text,
  workspace_id         uuid references public.workspaces(id) on delete cascade,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
alter table public.marketing_campaigns enable row level security;
create policy "Workspace members can manage marketing campaigns"
  on public.marketing_campaigns for all
  using (workspace_id in (select workspace_id from public.profiles where user_id = auth.uid()));
create trigger marketing_campaigns_updated_at before update on public.marketing_campaigns
  for each row execute procedure update_updated_at();
