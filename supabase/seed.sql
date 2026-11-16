-- Personal Hub · datos de demostración
-- Todas las filas llevan is_demo = true. Se asignan al primer usuario de auth.users,
-- así que hay que haber iniciado sesión una vez antes de ejecutarlo.
-- Limpieza: supabase/seed_cleanup.sql

do $$
declare
  uid uuid;
  p_hub uuid; p_casa uuid; p_maraton uuid;
  s_run uuid; s_tech uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'No hay ningún usuario. Inicia sesión una vez y vuelve a ejecutar el seed.';
  end if;

  -- ---------- Proyectos y tareas ----------
  insert into public.projects (user_id, name, description, color, is_demo)
    values (uid, 'Personal Hub', 'Construcción de la aplicación', '#0A84FF', true)
    returning id into p_hub;
  insert into public.projects (user_id, name, description, color, is_demo)
    values (uid, 'Casa', 'Gestiones y mantenimiento', '#30D158', true)
    returning id into p_casa;
  insert into public.projects (user_id, name, description, color, is_demo)
    values (uid, 'Media maratón de primavera', 'Preparación de 12 semanas', '#FF9F0A', true)
    returning id into p_maraton;

  insert into public.tasks (user_id, project_id, title, status, priority, due_date, completed_at, position, is_demo) values
    (uid, p_hub,     'Revisar el diseño del dashboard',        'doing', 1, current_date,      null, 1, true),
    (uid, p_hub,     'Registrar la app de Strava',             'todo',  2, current_date + 3,  null, 2, true),
    (uid, p_hub,     'Decidir carpetas de Craft a indexar',    'todo',  3, current_date + 10, null, 3, true),
    (uid, p_casa,    'Pedir cita para la ITV',                 'todo',  1, current_date - 2,  null, 4, true),
    (uid, p_casa,    'Renovar el seguro del hogar',            'todo',  2, current_date + 14, null, 5, true),
    (uid, p_casa,    'Cambiar el filtro de la campana',        'done',  3, current_date - 5,  now() - interval '4 days', 6, true),
    (uid, p_maraton, 'Comprar zapatillas de entrenamiento',    'todo',  2, current_date + 7,  null, 7, true),
    (uid, p_maraton, 'Reservar dorsal',                        'done',  1, current_date - 10, now() - interval '9 days', 8, true),
    (uid, null,      'Hacer copia de seguridad de las fotos',  'todo',  4, null,              null, 9, true);

  -- ---------- Running: 12 semanas, 4 salidas por semana ----------
  -- Ids negativos para no chocar nunca con ids reales de Strava.
  insert into public.strava_activities
    (id, user_id, sport_type, name, start_date, start_date_local, distance_m, moving_time_s,
     elapsed_time_s, elevation_gain_m, average_speed_ms, average_heartrate, max_heartrate,
     average_cadence, suffer_score, has_detail, is_demo)
  select
    -(w * 10 + d + 1),
    uid,
    'Run',
    case d when 0 then 'Rodaje suave' when 1 then 'Series' when 2 then 'Rodaje medio' else 'Tirada larga' end,
    ts, ts at time zone 'Europe/Madrid',
    dist,
    round(dist / speed)::int,
    round(dist / speed)::int + 60,
    round((dist / 1000 * (4 + random() * 6))::numeric, 1),
    round(speed::numeric, 3),
    round((case d when 1 then 162 when 3 then 150 else 144 end + random() * 6)::numeric, 1),
    round((case d when 1 then 181 else 168 end + random() * 5)::numeric, 1),
    round((84 + random() * 4)::numeric, 1),
    round(dist / 1000 * (case d when 1 then 9 else 5 end))::int,
    false,
    true
  from (
    select w, d,
      date_trunc('week', now()) - (w || ' weeks')::interval
        + ((case d when 0 then 1 when 1 then 3 when 2 then 4 else 6 end) || ' days')::interval
        + interval '7 hours 30 minutes' as ts,
      -- volumen creciente hacia la semana actual (w = 0)
      round(((case d when 0 then 6000 when 1 then 8000 when 2 then 9000 else 14000 end)
             * (1 + (11 - w) * 0.03) * (0.95 + random() * 0.1))::numeric, 1) as dist,
      -- ritmo que mejora ligeramente: de ~5:35 a ~5:15 min/km en rodajes
      (case d when 1 then 3.45 when 3 then 2.95 else 3.05 end) * (1 + (11 - w) * 0.006) as speed
    from generate_series(0, 11) as w, generate_series(0, 3) as d
  ) g
  where ts < now();

  insert into public.personal_records (user_id, distance_key, time_s, achieved_at, is_demo) values
    (uid, '1k',            232,  now() - interval '20 days', true),
    (uid, '5k',            1368, now() - interval '34 days', true),
    (uid, '10k',           2910, now() - interval '48 days', true),
    (uid, 'half_marathon', 6540, now() - interval '200 days', true);

  -- ---------- Información web ----------
  insert into public.web_sources (user_id, name, url, feed_url, category, kind, is_favorite, is_demo)
    values (uid, 'Blog de running (demo)', 'https://example.com/running', 'https://example.com/running/feed', 'Deporte', 'feed', true, true)
    returning id into s_run;
  insert into public.web_sources (user_id, name, url, feed_url, category, kind, is_favorite, is_demo)
    values (uid, 'Noticias de tecnología (demo)', 'https://example.com/tech', 'https://example.com/tech/feed', 'Tecnología', 'feed', false, true)
    returning id into s_tech;
  insert into public.web_sources (user_id, name, url, category, kind, is_favorite, is_demo) values
    (uid, 'Previsión del tiempo (demo)', 'https://example.com/tiempo', 'Utilidades', 'bookmark', true, true);

  insert into public.web_items (user_id, source_id, url, title, excerpt, published_at, is_demo) values
    (uid, s_run,  'https://example.com/running/1', 'Cómo plantear una tirada larga',        'Claves para dosificar el esfuerzo en los rodajes de fin de semana.', now() - interval '5 hours', true),
    (uid, s_run,  'https://example.com/running/2', 'Series cortas frente a series largas',  'Qué aporta cada tipo de sesión y cuándo usarla.',                  now() - interval '2 days',  true),
    (uid, s_tech, 'https://example.com/tech/1',    'Novedades de la semana',                'Resumen de los lanzamientos más relevantes.',                      now() - interval '9 hours', true),
    (uid, s_tech, 'https://example.com/tech/2',    'Guía de copias de seguridad en casa',   'Una estrategia sencilla con tres copias.',                         now() - interval '3 days',  true);

  -- ---------- Informes ----------
  insert into public.reports (user_id, kind, period_start, period_end, title, metrics, body_md, is_demo) values
    (uid, 'daily', current_date - 1, current_date - 1, 'Resumen de ayer',
      '{"tasks_done": 1, "tasks_pending": 6, "km": 9.4}',
      E'## Ayer\n\n- 1 tarea completada, 6 pendientes.\n- Rodaje medio de 9,4 km.', true),
    (uid, 'weekly', (date_trunc('week', current_date) - interval '7 days')::date, (date_trunc('week', current_date) - interval '1 day')::date, 'Resumen semanal',
      '{"tasks_done": 4, "km": 48.2, "runs": 4, "pace_s_per_km": 322}',
      E'## Semana pasada\n\n- 4 tareas completadas.\n- 48,2 km en 4 salidas, ritmo medio 5:22 min/km.', true),
    (uid, 'monthly', (date_trunc('month', current_date) - interval '1 month')::date, (date_trunc('month', current_date) - interval '1 day')::date, 'Resumen mensual',
      '{"tasks_done": 17, "km": 176.5, "runs": 16}',
      E'## Mes pasado\n\n- 17 tareas completadas.\n- 176,5 km en 16 salidas.', true);

  -- ---------- Actividad reciente ----------
  insert into public.activity_log (user_id, occurred_at, kind, title, entity_type, is_demo) values
    (uid, now() - interval '3 hours', 'run_imported', 'Rodaje suave · 6,4 km',            'strava_activity', true),
    (uid, now() - interval '1 day',   'report_ready', 'Resumen de ayer disponible',       'report',          true),
    (uid, now() - interval '4 days',  'task_done',    'Cambiar el filtro de la campana',  'task',            true),
    (uid, now() - interval '9 days',  'task_done',    'Reservar dorsal',                  'task',            true);

  -- ---------- Automatizaciones y avisos (sin columna is_demo: se marcan en details / título) ----------
  insert into public.job_runs (user_id, job_name, started_at, finished_at, status, items, error, details) values
    (uid, 'strava_sync', now() - interval '30 minutes', now() - interval '29 minutes', 'ok',    1,    null, '{"demo": true}'),
    (uid, 'web_fetch',   now() - interval '2 hours',    now() - interval '2 hours',    'ok',    4,    null, '{"demo": true}'),
    (uid, 'craft_index', now() - interval '1 hour',     now() - interval '1 hour',     'error', null, 'Demo: límite de peticiones alcanzado (429)', '{"demo": true}'),
    (uid, 'backup',      now() - interval '9 hours',    now() - interval '9 hours',    'ok',    null, null, '{"demo": true}');

  insert into public.notifications (user_id, level, title, body) values
    (uid, 'warning', '[Demo] Tarea vencida', 'Pedir cita para la ITV venció hace 2 días.'),
    (uid, 'success', '[Demo] Nueva marca en 1 km', '3:52, veinte días atrás.');
end $$;
