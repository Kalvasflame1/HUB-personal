-- Edición de la tabla «Seguimiento» de Craft desde la app (autorizada el 21-11-2026).
--
-- La web no escribe en Craft: deja aquí el cambio pedido y el worker del Mac mini lo aplica con
-- su conexión de escritura. Antes de escribir, el worker comprueba que el asunto no ha cambiado
-- en Craft desde que la web lo leyó (`base`); si cambió, no escribe y marca un conflicto.
-- Solo se pueden tocar título, categoría, estado, fecha y notas.

create table public.craft_tracking_changes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  external_id  text not null,            -- id del asunto en Craft
  changes      jsonb not null,           -- { title?, category?, status?, due_date?, notes? }
  base         jsonb not null,           -- los mismos campos tal como estaban al editar
  state        text not null default 'pending' check (state in ('pending', 'applied', 'conflict', 'error')),
  error        text,
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  constraint changes_allowed_keys check (changes - array['title', 'category', 'status', 'due_date', 'notes'] = '{}'::jsonb)
);
create index craft_tracking_changes_pending_idx on public.craft_tracking_changes (user_id, state, created_at);

alter table public.craft_tracking_changes enable row level security;
create policy owner_select on public.craft_tracking_changes for select to authenticated using (user_id = (select auth.uid()));
create policy owner_insert on public.craft_tracking_changes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and state = 'pending'
    -- solo asuntos que existen en la copia local de la tabla de seguimiento
    and exists (select 1 from public.craft_tracking t where t.user_id = (select auth.uid()) and t.external_id = craft_tracking_changes.external_id)
  );
revoke update, delete, truncate on public.craft_tracking_changes from anon, authenticated;
revoke insert on public.craft_tracking_changes from anon;
grant insert (external_id, changes, base) on public.craft_tracking_changes to authenticated;
