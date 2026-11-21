-- F5-8 · Resumen diario de las fuentes web, redactado por Claude.
--
-- Una sola llamada al día con las entradas recogidas en las últimas 24 horas (no una por
-- entrada, para no gastar el tope diario). Cada punto cita sus entradas por número; `items`
-- guarda a qué entrada corresponde cada número. Lo escribe el worker; la web solo lee.

create table public.web_digests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  digest_date  date not null,
  body         text not null check (length(body) <= 20000),
  items        jsonb not null default '[]',   -- [{"n", "id", "title", "url", "source"}]
  model        text,
  usage        jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, digest_date)
);

alter table public.web_digests enable row level security;
create policy owner_select on public.web_digests for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.web_digests from anon, authenticated;
