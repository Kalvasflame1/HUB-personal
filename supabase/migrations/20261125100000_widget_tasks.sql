-- Widget de tareas del día (Scriptable). Usa la misma clave del widget que widget_summary.
-- Devuelve las tareas abiertas que vencen hoy y las atrasadas (solo título, prioridad y fecha;
-- sin notas). No permite escribir nada.

create function public.widget_tasks(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok private.widget_tokens;
  uid uuid;
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if token is null or length(token) < 20 then
    raise exception 'Clave no válida' using errcode = '28000';
  end if;
  select * into tok from private.widget_tokens
   where token_hash = extensions.digest(token, 'sha256') and revoked_at is null;
  if not found then
    raise exception 'Clave no válida' using errcode = '28000';
  end if;
  uid := tok.user_id;
  if tok.last_used_at is null or tok.last_used_at < now() - interval '5 minutes' then
    update private.widget_tokens set last_used_at = now() where id = tok.id;
  end if;

  return jsonb_build_object(
    'date', today,
    'generated_at', now(),
    'done_today', (select count(*) from public.tasks t
                    where t.user_id = uid and not t.is_demo and t.status = 'done'
                      and (t.completed_at at time zone 'Europe/Madrid')::date = today),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', left(x.title, 80), 'priority', x.priority, 'due', x.due_date,
               'overdue', x.due_date < today, 'doing', x.status = 'doing')
             order by x.due_date < today desc, x.priority, x.position)
        from public.tasks x
       where x.user_id = uid and not x.is_demo and x.status in ('todo', 'doing')
         and x.due_date <= today), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.widget_tasks(text) from public;
grant execute on function public.widget_tasks(text) to anon, authenticated;
