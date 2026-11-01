-- The app's tables (SPEC §13). Row level security is on everywhere with no policies at all, so the anon
-- and authenticated roles can read and write nothing. Only the server, with the service role key, gets
-- through, and every route it serves is scoped to the signed-in user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar text not null default 'bracket',
  show_on_leaderboard boolean not null default true,
  consent_at timestamptz,
  -- Groups a trial's students for export, from a link such as /?cohort=ABC. Never shown to anyone.
  cohort text check (char_length(cohort) <= 32),
  condition text not null default 'adaptive' check (condition in ('adaptive', 'fixed')),
  form_pre text check (form_pre in ('A', 'B')),
  form_post text check (form_post in ('A', 'B')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learner_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  profile jsonb not null,
  -- Bumped on every write, so two devices cannot overwrite each other unseen.
  rev integer not null default 0,
  -- The last action applied from each device: { "<deviceId>": <seq> }. Makes a retry harmless.
  devices jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  user_agent text
);
create index sessions_user_time on public.sessions (user_id, started_at);

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  seq integer not null,
  item_ref jsonb not null,
  skill text not null,
  difficulty smallint not null,
  kind text not null,
  target text,
  answer jsonb not null,
  classification text not null,
  misconception text,
  variant text,
  wrong_cells jsonb,
  time_ms integer not null,
  hint_level smallint not null,
  -- Everything this attempt earned, the bonus for fixing a misconception included.
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, device_id, seq)
);
create index attempts_user_time on public.attempts (user_id, created_at);
create index attempts_time on public.attempts (created_at);

create table public.decisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id bigint references public.attempts (id) on delete set null,
  trigger text not null,
  mode text not null,
  candidates jsonb not null,
  choice text not null,
  message text,
  path_note text,
  narration jsonb,
  reason text,
  latency_ms integer,
  fallback_reason text,
  created_at timestamptz not null default now()
);
create index decisions_user_time on public.decisions (user_id, created_at);

create table public.scene_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  template text not null,
  purpose text not null,
  beats_total integer not null,
  beats_seen integer not null,
  replays integer not null,
  skipped boolean not null,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);
create index scene_views_user_time on public.scene_views (user_id, created_at);

create table public.hint_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_ref jsonb,
  level smallint not null,
  created_at timestamptz not null default now()
);
create index hint_events_user_time on public.hint_events (user_id, created_at);

create table public.assessments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  form text not null check (form in ('A', 'B')),
  score integer not null,
  total integer not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  unique (user_id, phase)
);
create index assessments_user_time on public.assessments (user_id, submitted_at);

create table public.assessment_responses (
  id bigint generated always as identity primary key,
  assessment_id bigint not null references public.assessments (id) on delete cascade,
  item_no smallint not null,
  item_ref jsonb not null,
  answer jsonb,
  correct boolean not null,
  misconception text,
  variant text,
  time_ms integer,
  unique (assessment_id, item_no)
);

alter table public.profiles enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.decisions enable row level security;
alter table public.scene_views enable row level security;
alter table public.hint_events enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_responses enable row level security;

-- XP earned since week_start by everyone who chose to be shown. It returns no email and no user data
-- beyond the name each student picked, and only the server may call it.
create function public.weekly_leaderboard(week_start timestamptz, max_rows integer)
returns table (user_id uuid, display_name text, avatar text, xp bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, sum(a.xp)::bigint as xp
  from public.attempts a
  join public.profiles p on p.id = a.user_id
  where a.created_at >= week_start and p.show_on_leaderboard
  group by p.id, p.display_name, p.avatar
  having sum(a.xp) > 0
  order by xp desc, p.id
  limit max_rows
$$;

revoke all on function public.weekly_leaderboard(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.weekly_leaderboard(timestamptz, integer) to service_role;
