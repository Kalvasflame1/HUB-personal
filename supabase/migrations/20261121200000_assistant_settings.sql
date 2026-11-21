-- F5-11 · Configuración del asistente (acordada el 18-11-2026), con historial de versiones.
--
-- Cada vez que se guarda la configuración se añade una versión nueva; la vigente es la más
-- reciente. Nada se sobrescribe ni se borra desde la web: restaurar una versión es guardar una
-- copia suya como versión nueva.
--
-- Lo que NO se configura aquí, a propósito: los permisos (las herramientas de solo lectura los
-- fija el worker), el origen de las cifras (siempre SQL) y las reglas del proyecto.

create table public.assistant_settings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  version       integer not null,
  instructions  text not null default '' check (length(instructions) <= 8000),
  style         text not null default 'normal' check (style in ('breve', 'normal', 'detallado')),
  sources       jsonb not null default '{"tasks": true, "running": true, "reports": true, "web": true, "craft": true, "craft_personal": true}',
  model_quick   text not null default 'haiku' check (model_quick in ('haiku', 'sonnet', 'opus')),
  model_reports text not null default 'sonnet' check (model_reports in ('haiku', 'sonnet', 'opus')),
  daily_cap     integer not null default 20 check (daily_cap between 0 and 200),
  shortcuts     text[] not null default '{}' check (cardinality(shortcuts) <= 12),
  note          text check (length(note) <= 200),   -- «Restaurada la versión 3», etc.
  created_at    timestamptz not null default now(),
  unique (user_id, version)
);
create index assistant_settings_current_idx on public.assistant_settings (user_id, version desc);

alter table public.assistant_settings enable row level security;
create policy owner_select on public.assistant_settings for select to authenticated using (user_id = (select auth.uid()));
create policy owner_insert on public.assistant_settings for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete, truncate on public.assistant_settings from anon, authenticated;
revoke insert on public.assistant_settings from anon;
