-- F5-7 · Redacción con IA de los informes semanal y mensual.
--
-- Las cifras siguen saliendo de SQL y la plantilla (body_md) se genera siempre. La redacción de
-- Claude es un comentario aparte: si la IA está apagada, falla o se alcanza el tope diario, el
-- informe queda igual que antes, solo sin comentario.

alter table public.reports
  add column ai_summary      text check (length(ai_summary) <= 12000),
  add column ai_model        text,          -- haiku | sonnet | opus
  add column ai_generated_at timestamptz;
