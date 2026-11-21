-- Próximos eventos y asuntos en seguimiento, leídos de Craft por el worker (21-11-2026).
--
-- · craft_events: la sección «📅 Próximos eventos — 30 días vista» del último «📰 Informe
--   Diario» de Cowork. Una fila por día (o rango de días). Se sustituye entera en cada lectura.
-- · craft_tracking: la colección «Seguimiento» de «🗂️ Seguimiento activo». Una fila por
--   asunto, con su estado tal cual está en Craft. La web filtra los que siguen vivos.
--
-- Craft es la copia maestra y es de solo lectura: la web solo lee estas tablas.

create table public.craft_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  event_date   date,                  -- null si no se pudo leer la fecha
  end_date     date,                  -- para rangos («Domingo 6 a martes 8»)
  label        text not null,         -- «Jueves 3», «16 y 18»…
  icons        text,                  -- emojis del principio de la línea
  items        jsonb not null default '[]',  -- [{ "text": "…", "important": true }]
  raw          text not null,         -- la línea original, por si el formato cambia
  position     integer not null,      -- orden dentro del informe
  report_doc   text not null,         -- rootBlockId del informe de origen
  report_date  date not null,
  source_url   text,
  created_at   timestamptz not null default now()
);
create index craft_events_date_idx on public.craft_events (user_id, event_date);

create table public.craft_tracking (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  external_id  text not null,         -- id del elemento de la colección en Craft
  title        text not null,
  category     text,
  status       text,                  -- tal cual: «🟡 En curso», «🔵 Seguimiento»…
  status_key   text,                  -- open | in_progress | watching | done | expired | other
  due_date     date,
  period       text,
  notes        text,
  source_url   text,
  updated_at   timestamptz not null default now(),
  unique (user_id, external_id)
);
create index craft_tracking_status_idx on public.craft_tracking (user_id, status_key, due_date);

do $$
declare t text;
begin
  foreach t in array array['craft_events', 'craft_tracking']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
