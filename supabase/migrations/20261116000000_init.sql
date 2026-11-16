-- Personal Hub · migración inicial
-- Generada a partir de docs/DATABASE.md. Aún no ejecutada contra Postgres.

-- ============ Extensiones y utilidades ============
create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============ Núcleo ============
create table public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone     text not null default 'Europe/Madrid',
  units        text not null default 'metric',
  settings     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============ Productividad ============
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active'
              check (status in ('active','paused','done','archived')),
  color       text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  project_id   uuid references public.projects on delete set null,
  title        text not null,
  notes        text,
  status       text not null default 'todo'
               check (status in ('todo','doing','done','cancelled')),
  priority     smallint not null default 2 check (priority between 1 and 4), -- 1 = máxima
  due_date     date,
  completed_at timestamptz,
  position     double precision not null default 0,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_open_idx on public.tasks (user_id, status, due_date);

-- Registro de actividad: lo que alimenta "Actividad reciente" del dashboard
create table public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  occurred_at timestamptz not null default now(),
  kind        text not null,          -- task_done, run_imported, report_ready, job_failed…
  title       text not null,
  entity_type text,                   -- task | strava_activity | report | job_run…
  entity_id   text,
  metadata    jsonb not null default '{}',
  is_demo     boolean not null default false
);
create index activity_log_recent_idx on public.activity_log (user_id, occurred_at desc);

-- ============ Automatizaciones ============
create table public.job_runs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  job_name    text not null,          -- strava_sync, craft_index, web_fetch, report_daily, backup…
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running'
              check (status in ('running','ok','error','skipped')),
  items       integer,                -- elementos procesados
  error       text,
  details     jsonb not null default '{}'
);
create index job_runs_recent_idx on public.job_runs (user_id, job_name, started_at desc);

-- ============ Running ============
create table private.strava_tokens (
  user_id       uuid primary key references auth.users on delete cascade,
  athlete_id    bigint not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  updated_at    timestamptz not null default now()
);

create table public.strava_activities (
  id                  bigint primary key,   -- id de Strava
  user_id             uuid not null references auth.users on delete cascade,
  sport_type          text not null,        -- Run, TrailRun, Ride, Walk…
  name                text,
  start_date          timestamptz not null,
  start_date_local    timestamp not null,
  distance_m          numeric(10,1) not null default 0,
  moving_time_s       integer not null default 0,
  elapsed_time_s      integer not null default 0,
  elevation_gain_m    numeric(7,1),
  average_speed_ms    numeric(6,3),
  max_speed_ms        numeric(6,3),
  average_heartrate   numeric(5,1),
  max_heartrate       numeric(5,1),
  average_cadence     numeric(5,1),
  suffer_score        integer,              -- esfuerzo relativo, base de la carga
  calories            numeric(7,1),
  gear_id             text,
  summary_polyline    text,
  has_detail          boolean not null default false,
  raw                 jsonb,                -- respuesta original, por si cambian los cálculos
  is_demo             boolean not null default false,
  synced_at           timestamptz not null default now()
);
create index strava_activities_date_idx on public.strava_activities (user_id, start_date desc);
create index strava_activities_sport_idx on public.strava_activities (user_id, sport_type, start_date desc);

create table public.strava_laps (
  id               bigint primary key,
  activity_id      bigint not null references public.strava_activities on delete cascade,
  user_id          uuid not null references auth.users on delete cascade,
  lap_index        integer not null,
  distance_m       numeric(10,1),
  moving_time_s    integer,
  average_speed_ms numeric(6,3),
  average_heartrate numeric(5,1)
);
create index strava_laps_activity_idx on public.strava_laps (activity_id, lap_index);

create table public.personal_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  distance_key text not null,        -- 1k, 5k, 10k, half_marathon, marathon
  time_s       integer not null,
  activity_id  bigint references public.strava_activities on delete set null,
  achieved_at  timestamptz not null,
  is_current   boolean not null default true,
  is_demo      boolean not null default false
);
create unique index personal_records_current_idx
  on public.personal_records (user_id, distance_key) where is_current;

-- ============ Información web ============
create table public.web_sources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  url             text not null,
  feed_url        text,               -- RSS/Atom si existe
  category        text,
  kind            text not null default 'bookmark' check (kind in ('bookmark','feed')),
  is_favorite     boolean not null default false,
  fetch_enabled   boolean not null default false,
  last_fetched_at timestamptz,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.web_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  source_id    uuid not null references public.web_sources on delete cascade,
  url          text not null,
  title        text not null,
  excerpt      text,
  summary      text,                  -- resumen generado (opcional, IA)
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  is_read      boolean not null default false,
  is_saved     boolean not null default false,
  is_demo      boolean not null default false,
  unique (source_id, url)
);
create index web_items_recent_idx on public.web_items (user_id, published_at desc);

-- ============ Informes ============
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  kind         text not null check (kind in ('daily','weekly','monthly')),
  period_start date not null,
  period_end   date not null,
  title        text not null,
  metrics      jsonb not null default '{}',  -- cifras calculadas con SQL
  body_md      text,                          -- redacción (plantilla o IA)
  generated_by text not null default 'template' check (generated_by in ('template','ai')),
  craft_url    text,                          -- si además se publica en Craft
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, kind, period_start)
);

-- ============ Asistente ============
create table public.assistant_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  sources         jsonb not null default '[]',  -- enlaces a tareas, actividades, docs de Craft
  created_at      timestamptz not null default now()
);
create index assistant_messages_conv_idx on public.assistant_messages (conversation_id, created_at);

-- Cola que consume el Mac mini
create table public.ai_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  kind         text not null check (kind in ('assistant','report','web_summary')),
  status       text not null default 'queued'
               check (status in ('queued','running','done','error','cancelled')),
  input        jsonb not null,
  output       jsonb,
  provider     text,                  -- none | claude_cli | anthropic_api
  error        text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index ai_jobs_queue_idx on public.ai_jobs (status, created_at) where status = 'queued';

-- ============ Conocimiento (índice de Craft) ============
create table public.kb_documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  source           text not null default 'craft',
  external_id      text not null,     -- rootBlockId de Craft
  title            text not null,
  folder_path      text,              -- p. ej. "Histórico Resúmenes / Semanal"
  doc_kind         text,              -- note | report | collection | daily_note
  excerpt          text,              -- primeras líneas, para listados
  search_text      text,              -- texto plano para buscar; no es la copia maestra
  content_hash     text,              -- para saltar documentos sin cambios
  source_updated_at timestamptz,
  indexed_at       timestamptz not null default now(),
  deleted_at       timestamptz,       -- desapareció de Craft
  fts tsvector generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(search_text, '')), 'B')
  ) stored,
  unique (user_id, source, external_id)
);
create index kb_documents_fts_idx on public.kb_documents using gin (fts);
create index kb_documents_folder_idx on public.kb_documents (user_id, folder_path);

-- Relación entre documentos y entidades del Hub
create table public.kb_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  document_id uuid not null references public.kb_documents on delete cascade,
  entity_type text not null check (entity_type in ('project','task','report')),
  entity_id   uuid not null,
  created_by  text not null default 'user' check (created_by in ('user','assistant')),
  created_at  timestamptz not null default now(),
  unique (document_id, entity_type, entity_id)
);

-- ============ Avisos ============
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  level      text not null default 'info' check (level in ('info','success','warning','error')),
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ============ Perfil automático al crear el usuario ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Triggers updated_at ============
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

-- ============ Vistas ============
create view public.v_running_weekly with (security_invoker = true) as
select
  user_id,
  date_trunc('week', start_date_local)::date as week_start,
  count(*)                                   as runs,
  round(sum(distance_m) / 1000, 2)           as km,
  sum(moving_time_s)                         as moving_time_s,
  round(sum(moving_time_s) / nullif(sum(distance_m) / 1000, 0)) as pace_s_per_km,
  round(avg(average_heartrate), 1)           as avg_hr,
  sum(elevation_gain_m)                      as elevation_m,
  sum(suffer_score)                          as load
from public.strava_activities
where sport_type in ('Run', 'TrailRun', 'VirtualRun')
group by user_id, date_trunc('week', start_date_local);

create view public.v_running_monthly with (security_invoker = true) as
select
  user_id,
  date_trunc('month', start_date_local)::date as month_start,
  count(*)                                    as runs,
  round(sum(distance_m) / 1000, 2)            as km,
  sum(moving_time_s)                          as moving_time_s,
  round(sum(moving_time_s) / nullif(sum(distance_m) / 1000, 0)) as pace_s_per_km,
  round(avg(average_heartrate), 1)            as avg_hr,
  sum(suffer_score)                           as load
from public.strava_activities
where sport_type in ('Run', 'TrailRun', 'VirtualRun')
group by user_id, date_trunc('month', start_date_local);

create view public.v_tasks_pending with (security_invoker = true) as
select t.*, p.name as project_name,
       (t.due_date < current_date) as overdue
from public.tasks t
left join public.projects p on p.id = t.project_id
where t.status in ('todo', 'doing');

-- ============ Seguridad a nivel de fila ============
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- El esquema private no se expone y no concede nada a los roles de la API
revoke all on schema private from anon, authenticated;
