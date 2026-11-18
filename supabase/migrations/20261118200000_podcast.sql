-- Podcast diario: episodios de audio del «Resumen diario».
-- El worker del Mac mini sube cada episodio (AAC, ~5 MB) al bucket privado «podcast» en la
-- carpeta <user_id>/ y registra una fila aquí. La web solo lee: lista los episodios y pide una
-- URL firmada temporal para reproducirlos.

create table public.podcast_episodes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  episode_date  date not null,
  title         text not null,
  storage_path  text not null,          -- <user_id>/AAAA-MM-DD.m4a dentro del bucket «podcast»
  duration_s    integer,
  bytes         integer,
  voice         text not null default 'siri',  -- siri | elevenlabs | macos | …
  created_at    timestamptz not null default now(),
  unique (user_id, episode_date)
);
create index podcast_episodes_recent_idx on public.podcast_episodes (user_id, episode_date desc);

alter table public.podcast_episodes enable row level security;
create policy owner_select on public.podcast_episodes for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.podcast_episodes from anon, authenticated;

-- Bucket privado: sin URL pública; la web pide URLs firmadas con la sesión del usuario
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('podcast', 'podcast', false, 52428800, array['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg'])
on conflict (id) do nothing;

create policy podcast_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'podcast' and (storage.foldername(name))[1] = (select auth.uid())::text);
