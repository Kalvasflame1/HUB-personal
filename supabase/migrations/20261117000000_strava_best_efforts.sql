-- Personal Hub · Fase 3: mejores esfuerzos de Strava
-- Strava calcula en cada carrera los mejores tiempos por distancia (1 km, 5 km, 10 km…).
-- Se guardan aquí y de ellos salen las marcas personales.

create table public.strava_best_efforts (
  id              bigint primary key,   -- id del esfuerzo en Strava
  activity_id     bigint not null references public.strava_activities on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,        -- 400m, 1k, 1 mile, 5k, 10k, Half-Marathon, Marathon…
  distance_m      numeric(10,1) not null,
  elapsed_time_s  integer not null,
  moving_time_s   integer,
  start_date      timestamptz not null,
  pr_rank         integer               -- 1, 2 o 3 si fue de los tres mejores en su momento
);
create index strava_best_efforts_name_idx on public.strava_best_efforts (user_id, name, elapsed_time_s);
create index strava_best_efforts_activity_idx on public.strava_best_efforts (activity_id);

alter table public.strava_best_efforts enable row level security;
create policy owner_all on public.strava_best_efforts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
