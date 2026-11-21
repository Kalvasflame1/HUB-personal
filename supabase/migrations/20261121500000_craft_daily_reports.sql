-- F5-9 · Decisión D4 (21-11-2026): el «Resumen diario» de Cowork y los informes del Hub conviven.
-- Cowork sigue escribiendo el 📰 Informe Diario en Craft; el worker guarda una copia de lectura de
-- los últimos días para mostrarla dentro del Hub. Craft sigue siendo la fuente: aquí nunca se edita.

create table public.craft_daily_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  external_id  text not null,                -- documento del informe en Craft
  report_date  date not null,
  title        text not null,
  markdown     text not null check (length(markdown) <= 100000),
  source_url   text,
  fetched_at   timestamptz not null default now(),
  unique (user_id, report_date)
);

alter table public.craft_daily_reports enable row level security;
create policy owner_select on public.craft_daily_reports for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.craft_daily_reports from anon, authenticated;
