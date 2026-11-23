-- F6 · Widget del iPhone (Scriptable) y Apple Watch (Atajos).
--
-- Un widget no tiene sesión de Supabase. En su lugar usa una clave larga de solo lectura que se
-- crea desde la app (Más → Widget y Apple Watch). Se enseña una sola vez y aquí solo se guarda su
-- huella SHA-256 en el esquema privado. Con ella, public.widget_summary(token) devuelve un
-- resumen pequeño en JSON (sin notas ni textos largos). No permite escribir nada.
-- La web no necesita la clave secreta de Supabase: el widget llama directamente a la API REST
-- con la clave publicable.

create table private.widget_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  token_hash    bytea not null unique,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);
create index widget_tokens_user_idx on private.widget_tokens (user_id) where revoked_at is null;

-- Crea una clave nueva y revoca las anteriores. Devuelve la clave en claro (solo esta vez).
create function public.create_widget_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  token text;
begin
  if uid is null then
    raise exception 'Hace falta iniciar sesión';
  end if;
  update private.widget_tokens set revoked_at = now() where user_id = uid and revoked_at is null;
  token := 'hubw_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.widget_tokens (user_id, token_hash) values (uid, extensions.digest(token, 'sha256'));
  return token;
end;
$$;

-- Revoca la clave activa (el widget deja de funcionar).
create function public.revoke_widget_tokens()
returns void
language sql
security definer
set search_path = ''
as $$
  update private.widget_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
$$;

-- Estado de la clave activa, sin la clave.
create function public.widget_token_status()
returns table (created_at timestamptz, last_used_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select t.created_at, t.last_used_at from private.widget_tokens t
   where t.user_id = auth.uid() and t.revoked_at is null
   order by t.created_at desc limit 1;
$$;

-- Resumen para el widget. Mismas cifras que Inicio: carreras = Run, TrailRun y VirtualRun;
-- semana de lunes a hoy; forma con el esfuerzo relativo de todas las actividades (CTL 42 días,
-- ATL 7 días, 545 días de calentamiento como lib/fitness-data.ts) y preparación lineal
-- (−30 → 0 %, +15 → 100 %).
create function public.widget_summary(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok private.widget_tokens;
  uid uuid;
  today date := (now() at time zone 'Europe/Madrid')::date;
  week_start date := date_trunc('week', (now() at time zone 'Europe/Madrid'))::date;
  ctl double precision := 0;
  atl double precision := 0;
  d date;
  v_load double precision;
  tsb double precision;
  ready int;
  result jsonb;
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

  -- Forma, fatiga y frescura
  for d, v_load in
    select g.dd::date, coalesce(l.total, 0)
      from generate_series(today - 545, today, interval '1 day') as g(dd)
      left join (select a.start_date_local::date as dd, sum(a.suffer_score)::double precision as total
                   from public.strava_activities a
                  where a.user_id = uid and a.suffer_score is not null and a.start_date_local::date >= today - 545
                  group by 1) l on l.dd = g.dd::date
     order by g.dd
  loop
    ctl := ctl + (v_load - ctl) / 42;
    atl := atl + (v_load - atl) / 7;
  end loop;
  tsb := round((ctl - atl)::numeric, 1);
  ready := round(least(100, greatest(0, ((tsb + 30) / 45) * 100)));

  select jsonb_build_object(
    'date', today,
    'generated_at', now(),
    'tasks', (
      select jsonb_build_object(
        'pending', count(*),
        'overdue', count(*) filter (where t.due_date < today),
        'today', count(*) filter (where t.due_date = today),
        'top', coalesce((select jsonb_agg(x.title) from (
            select t2.title from public.tasks t2
             where t2.user_id = uid and not t2.is_demo and t2.status in ('todo', 'doing')
             order by t2.due_date nulls last, t2.priority, t2.position limit 3) x), '[]'::jsonb))
        from public.tasks t where t.user_id = uid and not t.is_demo and t.status in ('todo', 'doing')),
    'tracking', (
      select jsonb_build_object(
        'active', count(*),
        'due_soon', count(*) filter (where c.due_date between today and today + 7),
        'next', (select jsonb_build_object('title', left(c2.title, 80), 'due', c2.due_date)
                   from public.craft_tracking c2
                  where c2.user_id = uid and c2.status_key in ('open', 'in_progress', 'watching') and c2.due_date >= today
                  order by c2.due_date limit 1))
        from public.craft_tracking c where c.user_id = uid and c.status_key in ('open', 'in_progress', 'watching')),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('date', e.event_date, 'label', e.label,
               'items', (select coalesce(jsonb_agg(left(i->>'text', 60)), '[]'::jsonb)
                           from jsonb_array_elements(e.items) i)) order by e.event_date, e.position)
        from (select * from public.craft_events where user_id = uid and event_date between today and today + 2
               order by event_date, position limit 3) e), '[]'::jsonb),
    'running', jsonb_build_object(
      'week_km', (select round(coalesce(sum(a.distance_m), 0) / 1000.0, 1) from public.strava_activities a
                   where a.user_id = uid and not a.is_demo and a.sport_type in ('Run', 'TrailRun', 'VirtualRun')
                     and a.start_date_local::date between week_start and today),
      'month_km', (select round(coalesce(sum(a.distance_m), 0) / 1000.0, 1) from public.strava_activities a
                    where a.user_id = uid and not a.is_demo and a.sport_type in ('Run', 'TrailRun', 'VirtualRun')
                      and a.start_date_local::date between date_trunc('month', today::timestamp)::date and today),
      'last', (select jsonb_build_object('date', a.start_date_local::date, 'name', left(a.name, 60),
                        'km', round(a.distance_m / 1000.0, 1),
                        'pace_s_km', case when a.distance_m > 0 then round(a.moving_time_s / (a.distance_m / 1000.0)) end)
                 from public.strava_activities a
                where a.user_id = uid and not a.is_demo and a.sport_type in ('Run', 'TrailRun', 'VirtualRun')
                order by a.start_date desc limit 1),
      'tsb', tsb,
      'readiness', ready),
    'podcast', (select jsonb_build_object('date', p.episode_date, 'duration_s', p.duration_s, 'today', p.episode_date = today)
                  from public.podcast_episodes p where p.user_id = uid order by p.episode_date desc limit 1)
  ) into result;

  return result;
end;
$$;

revoke all on function public.create_widget_token(), public.revoke_widget_tokens(), public.widget_token_status() from public, anon;
grant execute on function public.create_widget_token(), public.revoke_widget_tokens(), public.widget_token_status() to authenticated;
revoke all on function public.widget_summary(text) from public;
grant execute on function public.widget_summary(text) to anon, authenticated;
