-- Enlace profundo al documento original de Craft (craftdocs://open?…&documentId=…).
-- La API de Craft lo devuelve ya construido: el documentId del enlace no coincide con el
-- identificador de bloque raíz que se guarda en external_id.
alter table public.kb_documents add column source_url text;

-- Búsqueda desde la web: documentos vivos de un usuario ordenados por relevancia
create index kb_documents_live_idx on public.kb_documents (user_id, source_updated_at desc) where deleted_at is null;
