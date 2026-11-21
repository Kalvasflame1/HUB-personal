# Personal Hub · Base de datos

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **diseño. No se ha creado ningún proyecto ni tabla en Supabase.**

PostgreSQL gestionado por Supabase. El SQL de este documento es el borrador de la primera migración; se revisará al ejecutarlo contra la versión real de Postgres del proyecto.

---

## 1. Principios

- **Un usuario, pero con RLS completo.** Todas las tablas de `public` llevan `user_id` y la misma política. Si algún día hay más usuarios, no cambia nada.
- **Dos esquemas.** `public` es lo que ve la PWA a través de la API. `private` guarda secretos (tokens) y no está expuesto en la API; solo lo usa el worker con la clave secreta.
- **Estadísticas con vistas SQL**, no con tablas duplicadas ni con IA.
- **Datos de demostración identificados**: columna `is_demo` en las tablas que reciben datos de ejemplo. Borrarlos es un `delete … where is_demo`.
- **Craft no se copia.** `kb_documents` es un índice de búsqueda con enlace al original, no un almacén de documentos.
- Identificadores `uuid`, fechas `timestamptz`, zona horaria de presentación `Europe/Madrid`.

## 2. Mapa de tablas

| Módulo | Tablas |
|---|---|
| Núcleo | `profiles` |
| Productividad | `projects`, `tasks`, `activity_log` |
| Automatizaciones | `job_runs` |
| Running | `strava_activities`, `strava_laps`, `strava_best_efforts`, `personal_records`, `private.strava_tokens` |
| Información web | `web_sources`, `web_items` |
| Informes | `reports` |
| Asistente | `assistant_conversations`, `assistant_messages`, `ai_jobs` |
| Conocimiento | `kb_documents`, `kb_links` |
| Eventos y seguimiento de Craft | `craft_events` (sección «Próximos eventos» del último Informe Diario, una fila por día, se sustituye entera), `craft_tracking` (tabla «Seguimiento» de «🗂️ Seguimiento activo») y `craft_tracking_changes` (cola de cambios pedidos desde la app; el worker los aplica en Craft tras comprobar que el asunto no cambió, o los marca `conflict`); migraciones `20261121000000_craft_events_tracking.sql` y `20261121100000_craft_tracking_changes.sql` |
| Configuración del asistente | `assistant_settings`: instrucciones, estilo, fuentes activables, modelo para preguntas y para informes, tope diario y atajos; una fila por versión, la vigente es la de `version` más alta; migración `20261121200000_assistant_settings.sql` |
| Podcast | `podcast_episodes` (solo lectura para la web) y bucket privado de Storage `podcast`, con carpeta `<user_id>/`; migración `20261118200000_podcast.sql` |
| Avisos | `notifications` |

Vistas: `v_running_weekly`, `v_running_monthly`, `v_tasks_pending`.

## 3. Borrador de la migración inicial

```sql
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

-- Fase 3 (migración 20261117000000): mejores tiempos por distancia que Strava calcula en cada carrera.
-- De aquí salen las marcas personales (personal_records se recalcula en cada sincronización).
create table public.strava_best_efforts (
  id              bigint primary key,   -- id del esfuerzo en Strava
  activity_id     bigint not null references public.strava_activities on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,        -- 400m, 1k, 5k, 10k, Half-Marathon, Marathon…
  distance_m      numeric(10,1) not null,
  elapsed_time_s  integer not null,
  moving_time_s   integer,
  start_date      timestamptz not null,
  pr_rank         integer
);

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
  -- F5-7 (20261121400000_reports_ai_summary.sql): comentario de Claude aparte de la plantilla,
  -- solo en semanal y mensual; al regenerar sin IA se conserva el anterior.
  -- ai_summary text (≤ 12000), ai_model text, ai_generated_at timestamptz
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
  finished_at  timestamptz,
  model        text,                  -- haiku | sonnet | opus (F5-4)
  usage        jsonb                  -- tokens y duración (F5-4)
);
create index ai_jobs_queue_idx on public.ai_jobs (status, created_at) where status = 'queued';
-- F5-4 (20261121300000_ai_jobs_queue.sql): input ≤ 4000 bytes; cada inserción lanza
-- pg_notify('ai_jobs', id) con el disparador private.ai_jobs_notify() para despertar al worker.
-- output de una pregunta: {"answer": "...", "sources": [{"n", "label", "href"}], "context_blocks": n}

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
  source_url       text,              -- enlace craftdocs:// que da la API (migración 20261118000000)
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
```

## 4. Seguridad a nivel de fila

La misma política en todas las tablas de `public`. `(select auth.uid())` en lugar de `auth.uid()` para que Postgres lo evalúe una vez por consulta.

```sql
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
```

Matices:

- **Restricción aplicada el 18-11-2026** (migración `20261118100000_restrict_worker_tables.sql`, F4-11). Qué puede hacer la web (`authenticated`) en cada tabla:

| Permiso de la web | Tablas |
|---|---|
| Solo lectura | `strava_activities`, `strava_laps`, `strava_best_efforts`, `personal_records`, `job_runs`, `kb_documents`, `reports`, `podcast_episodes`, `craft_events`, `craft_tracking`, `craft_daily_reports` (copia de lectura de los 7 últimos Informes Diarios de Cowork, D4), `web_digests` (resumen diario de las fuentes web, F5-8; 30 días) |
| Lectura y cambiar una casilla | `web_items` (`is_read`, `is_saved`), `notifications` (`read_at`) |
| Leer y añadir | `activity_log`, `assistant_settings` (cada guardado es una versión nueva; restaurar es copiar una versión antigua como nueva), `craft_tracking_changes` (solo `external_id`, `changes` y `base`; únicamente asuntos que existen en `craft_tracking` y solo los campos `title`, `category`, `status`, `due_date` y `notes`), `ai_jobs` (solo `kind` e `input`; únicamente preguntas `assistant` en cola: estado, respuesta, proveedor y consumo los escribe el worker) |
| Todo (`owner_all`) | `tasks`, `projects`, `kb_links`, `web_sources`, `profiles`, `assistant_conversations`, `assistant_messages` |

  Para las de solo lectura se quitan además los permisos de escritura del rol (`revoke insert, update, delete`). Los borrados en cascada (por ejemplo, borrar una fuente web borra sus lecturas) siguen funcionando. Comprobado con el rol `authenticated` en una transacción deshecha: lo permitido funciona y lo demás da *permission denied*.
- El worker entra por el pooler con el rol propietario de la base de datos, que no pasa por RLS. Por eso siempre escribe `user_id = HUB_USER_ID` de forma explícita.
- `anon` no tiene ninguna política: sin sesión no se lee nada. Es el criterio de aceptación 8.

## 5. Vistas de estadísticas

```sql
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
```

`security_invoker = true` hace que las vistas respeten el RLS de quien consulta.

Carga y recuperación: primera versión con la carga aguda (7 días) frente a la crónica (media de 28 días) sobre `suffer_score`, calculada en una función SQL en la Fase 3. Si una actividad no trae `suffer_score` (sin pulsómetro), se estima con duración × intensidad por ritmo. Son cálculos convencionales, sin IA.

## 6. Datos de demostración

- `supabase/seed.sql` inserta proyectos, tareas, unas 12 semanas de actividades de running verosímiles, fuentes web e informes de ejemplo, todos con `is_demo = true`.
- La interfaz muestra una etiqueta «Demo» mientras exista alguna fila de demostración en la pantalla.
- Limpieza con un único script que borra `where is_demo` en cada tabla. En Running, la importación real de Strava borra antes las actividades de demostración para no mezclar estadísticas.

## 7. Volumen previsto

| Tabla | Filas al año (estimación) | Tamaño |
|---|---|---|
| `strava_activities` (con `raw`) | 200–400 | < 5 MB |
| `kb_documents` | ~210 hoy, +400/año | < 10 MB |
| `web_items` | 5.000–20.000 según fuentes | 10–40 MB |
| `job_runs` | ~25.000 (purga a 90 días) | < 10 MB |
| Resto | Miles | < 5 MB |

Muy por debajo de los 500 MB del plan gratuito. Purga automática de `job_runs` y de `web_items` leídos y no guardados con más de 90 días.

## 8. Lo que queda fuera a propósito

- **Flujos segundo a segundo de Strava** (GPS, pulso, ritmo por punto). Cuestan una llamada por actividad y ocupan mucho. Se añadirían en una tabla `strava_streams` si las gráficas por actividad lo piden.
- **Embeddings / búsqueda semántica.** Requieren un modelo de embeddings. Con ~210 documentos, la búsqueda de texto en español de Postgres es suficiente. Si hiciera falta, el M4 Pro puede generar embeddings en local sin coste y guardarlos con `pgvector`.
- **Finanzas, calendario, Apple Health.** Fase 6; no se reserva esquema ahora.

## 9. Migraciones y tipos

- Migraciones versionadas en `supabase/migrations/`, aplicadas con la CLI de Supabase. Nunca cambios manuales desde el panel en producción.
- Tipos de TypeScript generados con `supabase gen types typescript` en `packages/shared`.
- Cualquier cambio destructivo (borrar columna o tabla) requiere copia previa y tu aprobación.
