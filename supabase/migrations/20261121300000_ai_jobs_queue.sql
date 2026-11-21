-- F5-4 · Cola de trabajos de IA.
--
-- La web solo puede preguntar (insertar un trabajo «assistant» en cola con su pregunta) y leer
-- sus trabajos. Estado, respuesta, proveedor y consumo los escribe únicamente el worker, que se
-- conecta por el pooler y no pasa por la RLS.
--
-- Cada inserción avisa al worker con NOTIFY (canal ai_jobs) para que responda en segundos; el
-- worker revisa además la cola cada minuto por si se perdió el aviso.

alter table public.ai_jobs
  add column model text,          -- haiku | sonnet | opus
  add column usage jsonb;         -- tokens y duración que devuelve el proveedor

alter table public.ai_jobs
  add constraint ai_jobs_input_size check (octet_length(input::text) <= 4000);

drop policy owner_all on public.ai_jobs;
create policy owner_select on public.ai_jobs for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_insert on public.ai_jobs for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'assistant' and status = 'queued');

revoke insert, update, delete, truncate on public.ai_jobs from anon, authenticated;
grant insert (kind, input) on public.ai_jobs to authenticated;

create function private.ai_jobs_notify() returns trigger
language plpgsql as $$
begin
  perform pg_notify('ai_jobs', new.id::text);
  return new;
end $$;

create trigger ai_jobs_notify after insert on public.ai_jobs
  for each row execute function private.ai_jobs_notify();
