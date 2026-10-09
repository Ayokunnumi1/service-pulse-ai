-- ServicePulse AI — initial schema
-- Multi-bank (tenant) model: every bank-owned row carries bank_id, and every
-- cross-table reference is a composite (bank_id, id) foreign key so the
-- database itself rejects links between rows of different banks.

-- ---------------------------------------------------------------------------
-- Banks
-- ---------------------------------------------------------------------------
create table banks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  logo_url    text,
  currency    text not null default 'NGN',
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Organisational responsibility directory
-- ---------------------------------------------------------------------------
create table departments (
  id          uuid primary key default gen_random_uuid(),
  bank_id     uuid not null references banks (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (bank_id, name),
  unique (bank_id, id)
);

create table teams (
  id            uuid primary key default gen_random_uuid(),
  bank_id       uuid not null references banks (id) on delete cascade,
  department_id uuid not null,
  name          text not null,
  description   text,
  created_at    timestamptz not null default now(),
  unique (bank_id, name),
  unique (bank_id, id),
  foreign key (bank_id, department_id) references departments (bank_id, id) on delete cascade
);

create table team_responsibilities (
  id             uuid primary key default gen_random_uuid(),
  bank_id        uuid not null references banks (id) on delete cascade,
  team_id        uuid not null,
  responsibility text not null,
  created_at     timestamptz not null default now(),
  foreign key (bank_id, team_id) references teams (bank_id, id) on delete cascade
);

create table products (
  id          uuid primary key default gen_random_uuid(),
  bank_id     uuid not null references banks (id) on delete cascade,
  code        text not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (bank_id, code),
  unique (bank_id, id)
);

create table systems (
  id            uuid primary key default gen_random_uuid(),
  bank_id       uuid not null references banks (id) on delete cascade,
  name          text not null,
  description   text,
  product_id    uuid,
  owner_team_id uuid,
  created_at    timestamptz not null default now(),
  unique (bank_id, name),
  foreign key (bank_id, product_id) references products (bank_id, id) on delete set null (product_id),
  foreign key (bank_id, owner_team_id) references teams (bank_id, id) on delete set null (owner_team_id)
);

create table team_product_ownership (
  bank_id    uuid not null references banks (id) on delete cascade,
  team_id    uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, product_id),
  foreign key (bank_id, team_id) references teams (bank_id, id) on delete cascade,
  foreign key (bank_id, product_id) references products (bank_id, id) on delete cascade
);

create table branches (
  id         uuid primary key default gen_random_uuid(),
  bank_id    uuid not null references banks (id) on delete cascade,
  code       text not null,
  name       text not null,
  city       text not null,
  region     text,
  created_at timestamptz not null default now(),
  unique (bank_id, code)
);

-- ---------------------------------------------------------------------------
-- Customer interactions
-- ---------------------------------------------------------------------------
create table interactions (
  id                 uuid primary key default gen_random_uuid(),
  bank_id            uuid not null references banks (id) on delete cascade,
  channel            text not null check (channel in (
                       'BRANCH', 'CONTACT_CENTER', 'EMAIL', 'MOBILE_APP',
                       'USSD', 'WHATSAPP', 'SOCIAL_MEDIA', 'WEB')),
  message            text not null,
  customer_reference text,
  branch             text,
  location           text,
  product            text,
  amount             numeric(14, 2),
  occurred_at        timestamptz not null,
  status             text not null default 'PENDING'
                       check (status in ('PENDING', 'CLASSIFIED', 'FAILED')),
  source             text not null default 'SEED' check (source in ('SEED', 'IMPORT')),
  created_at         timestamptz not null default now(),
  unique (bank_id, id)
);
create index interactions_bank_time_idx on interactions (bank_id, occurred_at desc);
create index interactions_bank_status_idx on interactions (bank_id, status);

create table interaction_classifications (
  interaction_id           uuid primary key,
  bank_id                  uuid not null references banks (id) on delete cascade,
  category                 text not null,
  issue                    text not null,
  issue_group              text not null,
  intent                   text not null,
  sentiment                text not null,
  severity                 text not null,
  product                  text not null,
  channel                  text not null,
  location                 text,
  systemic_issue_candidate boolean not null default false,
  confidence               numeric(4, 3) not null,
  method                   text not null check (method in ('AI', 'RULES')),
  model                    text,
  classified_at            timestamptz not null default now(),
  foreign key (bank_id, interaction_id) references interactions (bank_id, id) on delete cascade
);
create index classifications_bank_group_idx on interaction_classifications (bank_id, issue_group);

-- ---------------------------------------------------------------------------
-- Issues (normalised issue groups with deterministic metrics)
-- ---------------------------------------------------------------------------
create table issues (
  id                    uuid primary key default gen_random_uuid(),
  bank_id               uuid not null references banks (id) on delete cascade,
  issue_code            text not null,
  title                 text not null,
  category              text not null,
  status                text not null default 'OPEN'
                          check (status in ('OPEN', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED')),
  trend_status          text not null default 'STABLE',
  risk_level            text not null default 'LOW',
  risk_score            integer not null default 0,
  risk_factors          jsonb not null default '[]'::jsonb,
  total_complaints      integer not null default 0,
  pct_of_total          numeric(6, 2) not null default 0,
  current_period_count  integer not null default 0,
  previous_period_count integer not null default 0,
  growth_pct            numeric(8, 2),
  severity              text not null default 'LOW',
  channel_breakdown     jsonb not null default '[]'::jsonb,
  product_breakdown     jsonb not null default '[]'::jsonb,
  location_breakdown    jsonb not null default '[]'::jsonb,
  branch_breakdown      jsonb not null default '[]'::jsonb,
  financial_impact      numeric(16, 2),
  period_days           integer not null default 7,
  period_end            timestamptz,
  first_seen_at         timestamptz,
  last_seen_at          timestamptz,
  assigned_team_id      uuid,
  assigned_at           timestamptz,
  assignment_source     text check (assignment_source in ('AI_ACCEPTED', 'MANUAL_OVERRIDE')),
  resolved_at           timestamptz,
  metrics_updated_at    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (bank_id, issue_code),
  unique (bank_id, id),
  foreign key (bank_id, assigned_team_id) references teams (bank_id, id) on delete set null (assigned_team_id)
);
create index issues_bank_risk_idx on issues (bank_id, risk_score desc);

create table issue_analyses (
  id                        uuid primary key default gen_random_uuid(),
  bank_id                   uuid not null references banks (id) on delete cascade,
  issue_id                  uuid not null,
  method                    text not null check (method in ('AI', 'RULES')),
  model                     text,
  observed_pattern          text not null,
  likely_root_cause         text not null,
  root_cause_status         text not null check (root_cause_status in ('LIKELY', 'POSSIBLE', 'REQUIRES_INVESTIGATION')),
  root_cause_confidence     numeric(4, 3) not null,
  alternative_causes        jsonb not null default '[]'::jsonb,
  affected_systems          jsonb not null default '[]'::jsonb,
  recommended_investigation jsonb not null default '[]'::jsonb,
  management_insight        text,
  ownership_status          text not null check (ownership_status in ('RECOMMENDED', 'NO_CLEAR_OWNER', 'REJECTED_INVALID_TEAM')),
  primary_department_id     uuid,
  primary_team_id           uuid,
  primary_team_confidence   numeric(4, 3),
  secondary_teams           jsonb not null default '[]'::jsonb,
  ownership_reason          text,
  recommended_action        text not null,
  validation_notes          jsonb not null default '[]'::jsonb,
  input_snapshot            jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  foreign key (bank_id, issue_id) references issues (bank_id, id) on delete cascade,
  foreign key (bank_id, primary_department_id) references departments (bank_id, id) on delete set null (primary_department_id),
  foreign key (bank_id, primary_team_id) references teams (bank_id, id) on delete set null (primary_team_id)
);
create index issue_analyses_issue_idx on issue_analyses (issue_id, created_at desc);

create table issue_notes (
  id         uuid primary key default gen_random_uuid(),
  bank_id    uuid not null references banks (id) on delete cascade,
  issue_id   uuid not null,
  author     text not null,
  note       text not null,
  created_at timestamptz not null default now(),
  foreign key (bank_id, issue_id) references issues (bank_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Audit log: every AI recommendation and every human decision
-- ---------------------------------------------------------------------------
create table audit_log (
  id                    uuid primary key default gen_random_uuid(),
  bank_id               uuid not null references banks (id) on delete cascade,
  issue_id              uuid,
  event_type            text not null,
  actor                 text not null,
  method                text,
  model                 text,
  input_data            jsonb,
  detected_issue        text,
  root_cause            text,
  recommended_team_id   uuid,
  recommended_team_name text,
  confidence            numeric(4, 3),
  assigned_team_id      uuid,
  assigned_team_name    text,
  human_override        boolean,
  final_status          text,
  details               jsonb,
  created_at            timestamptz not null default now(),
  foreign key (bank_id, issue_id) references issues (bank_id, id) on delete cascade
);
create index audit_log_bank_time_idx on audit_log (bank_id, created_at desc);
create index audit_log_issue_idx on audit_log (issue_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The application only talks to Postgres from the server using the database
-- owner role. RLS is enabled with no policies so Supabase's public anon /
-- authenticated keys can never read or write tenant data directly.
-- ---------------------------------------------------------------------------
alter table banks enable row level security;
alter table departments enable row level security;
alter table teams enable row level security;
alter table team_responsibilities enable row level security;
alter table products enable row level security;
alter table systems enable row level security;
alter table team_product_ownership enable row level security;
alter table branches enable row level security;
alter table interactions enable row level security;
alter table interaction_classifications enable row level security;
alter table issues enable row level security;
alter table issue_analyses enable row level security;
alter table issue_notes enable row level security;
alter table audit_log enable row level security;
