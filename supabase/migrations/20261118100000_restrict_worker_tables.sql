-- F4-11 · Restricción de RLS (aprobada el 18-11-2026, tabla por tabla).
--
-- La web (rol authenticated) solo puede escribir donde lo necesita. Las tablas que mantiene
-- el worker del Mac mini pasan a solo lectura para la web. El worker no se ve afectado:
-- entra por el pooler con el rol propietario, que no pasa por estas políticas.
--
-- Los borrados en cascada (p. ej. borrar una fuente web borra sus web_items) siguen
-- funcionando: las acciones de integridad referencial no dependen de estos permisos.

-- 1. Solo lectura
do $$
declare t text;
begin
  foreach t in array array['strava_activities', 'strava_laps', 'strava_best_efforts', 'personal_records', 'job_runs', 'kb_documents', 'reports']
  loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. Lectura y cambio de una sola casilla
drop policy if exists owner_all on public.web_items;
create policy owner_select on public.web_items for select to authenticated using (user_id = (select auth.uid()));
create policy owner_update on public.web_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.web_items from anon, authenticated;
grant update (is_read, is_saved) on public.web_items to authenticated;

drop policy if exists owner_all on public.notifications;
create policy owner_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy owner_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 3. Leer y añadir (el feed de actividad), sin editar ni borrar
drop policy if exists owner_all on public.activity_log;
create policy owner_select on public.activity_log for select to authenticated using (user_id = (select auth.uid()));
create policy owner_insert on public.activity_log for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete, truncate on public.activity_log from anon, authenticated;

-- 4. Sin cambios: tasks, projects, kb_links, web_sources, profiles, ai_jobs,
--    assistant_conversations, assistant_messages (siguen con owner_all).
