-- Proyectos con respaldo en Craft (autorizado por el usuario el 26-11-2026).
-- La web crea el proyecto; el worker del Mac mini le crea una carpeta dentro de
-- «📁 PROYECTOS HUB» en Craft con un documento «Ficha del proyecto» que mantiene al día
-- (descripción, estado y tareas). La web no escribe en Craft: solo lee estas columnas.

alter table public.projects
  add column craft_folder_id  text,          -- carpeta del proyecto en Craft
  add column craft_doc_id     text,          -- rootBlockId de la «Ficha del proyecto»
  add column craft_synced_at  timestamptz,   -- última vez que la ficha quedó al día
  add column craft_sync_hash  text,          -- huella del contenido escrito, para no reescribir sin cambios
  add column craft_error      text;          -- último error al sincronizar (null si fue bien)

comment on column public.projects.craft_folder_id is 'Carpeta del proyecto en Craft (la crea el worker)';
comment on column public.projects.craft_doc_id is 'Documento «Ficha del proyecto» en Craft (lo crea y actualiza el worker)';
