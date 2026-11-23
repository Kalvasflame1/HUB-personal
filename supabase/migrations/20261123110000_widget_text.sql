-- F6 · Versión en texto del resumen del widget, para el Apple Watch y Siri (Atajos):
-- unas pocas frases que se pueden mostrar o leer en voz alta sin procesar el JSON.
-- Devuelve el tipo "text/plain" para que PostgREST responda texto plano (sin comillas JSON)
-- cuando el atajo pide «Accept: text/plain».

create domain public."text/plain" as text;

create or replace function public.widget_text(token text)
returns public."text/plain"
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb := public.widget_summary(token);
  r jsonb := s->'running';
  t jsonb := s->'tasks';
  ev jsonb := s->'events'->0;
  parts text[] := '{}';
  km text;
begin
  parts := array_append(parts, format('Preparación %s %%.', r->>'readiness'));
  km := replace(regexp_replace(r->>'week_km', '\.0$', ''), '.', ',');
  if (r->'last') is not null and (r->'last') <> 'null'::jsonb then
    parts := array_append(parts, format('Esta semana %s km; último rodaje de %s km el %s.', km,
      replace(r->'last'->>'km', '.', ','), to_char((r->'last'->>'date')::date, 'DD-MM')));
  else
    parts := array_append(parts, format('Esta semana %s km.', km));
  end if;
  parts := array_append(parts, case (t->>'pending')::int
    when 0 then 'Sin tareas pendientes.'
    when 1 then '1 tarea pendiente.'
    else format('%s tareas pendientes%s.', t->>'pending',
      case when (t->>'overdue')::int > 0 then format(', %s atrasadas', t->>'overdue') else '' end) end);
  if (s->'tracking'->>'due_soon')::int > 0 then
    parts := array_append(parts, format('%s asuntos de seguimiento vencen en 7 días.', s->'tracking'->>'due_soon'));
  end if;
  if ev is not null and (ev->>'date')::date = (s->>'date')::date then
    parts := array_append(parts, format('Hoy: %s.', (select string_agg(x, ', ') from jsonb_array_elements_text(ev->'items') x)));
  end if;
  if coalesce((s->'podcast'->>'today')::boolean, false) then
    parts := array_append(parts, 'El podcast de hoy está listo.');
  end if;
  return array_to_string(parts, ' ');
end;
$$;

revoke all on function public.widget_text(text) from public;
grant execute on function public.widget_text(text) to anon, authenticated;
