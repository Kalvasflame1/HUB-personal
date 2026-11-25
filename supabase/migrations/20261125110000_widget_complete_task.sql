-- Widget de tareas: incluye el id de cada tarea y permite marcarla como hecha.
-- Es la única escritura que permite la clave del widget: pasar una tarea abierta (todo/doing)
-- del propio usuario a 'done', igual que la casilla de Productividad (con registro task_done).
-- No borra, no edita títulos ni notas y no reabre tareas.

create or replace function private.widget_user(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok private.widget_tokens;
begin
  if token is null or length(token) < 20 then
    raise exception 'Clave no válida' using errcode = '28000';
  end if;
  select * into tok from private.widget_tokens
   where token_hash = extensions.digest(token, 'sha256') and revoked_at is null;
  if not found then
    raise exception 'Clave no válida' using errcode = '28000';
  end if;
  if tok.last_used_at is null or tok.last_used_at < now() - interval '5 minutes' then
    update private.widget_tokens set last_used_at = now() where id = tok.id;
  end if;
  return tok.user_id;
end;
$$;
revoke all on function private.widget_user(text) from public, anon, authenticated;

create or replace function public.widget_tasks(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.widget_user(token);
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  return jsonb_build_object(
    'date', today,
    'generated_at', now(),
    'done_today', (select count(*) from public.tasks t
                    where t.user_id = uid and not t.is_demo and t.status = 'done'
                      and (t.completed_at at time zone 'Europe/Madrid')::date = today),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'title', left(x.title, 80), 'priority', x.priority, 'due', x.due_date,
               'overdue', x.due_date < today, 'doing', x.status = 'doing')
             order by x.due_date < today desc, x.priority, x.position)
        from public.tasks x
       where x.user_id = uid and not x.is_demo and x.status in ('todo', 'doing')
         and x.due_date <= today), '[]'::jsonb)
  );
end;
$$;

create function public.widget_complete_task(token text, task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.widget_user(token);
  v_title text;
begin
  update public.tasks set status = 'done', completed_at = now()
   where id = task_id and user_id = uid and status in ('todo', 'doing')
   returning title into v_title;
  if v_title is null then
    return jsonb_build_object('ok', false, 'message', 'La tarea ya no está pendiente.');
  end if;
  insert into public.activity_log (user_id, kind, title, entity_type, entity_id, metadata)
  values (uid, 'task_done', v_title, 'task', task_id::text, '{"source": "widget"}');
  return jsonb_build_object('ok', true, 'title', v_title);
end;
$$;

revoke all on function public.widget_tasks(text), public.widget_complete_task(text, uuid) from public;
grant execute on function public.widget_tasks(text), public.widget_complete_task(text, uuid) to anon, authenticated;
