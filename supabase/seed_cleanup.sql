-- Personal Hub · borra todos los datos de demostración.
-- No toca datos reales: solo filas marcadas como demo.

begin;
delete from public.activity_log      where is_demo;
delete from public.reports           where is_demo;
delete from public.web_items         where is_demo;
delete from public.web_sources       where is_demo;
delete from public.personal_records  where is_demo;
delete from public.strava_activities where is_demo;
delete from public.tasks             where is_demo;
delete from public.projects          where is_demo;
delete from public.job_runs          where details @> '{"demo": true}';
delete from public.notifications     where title like '[Demo]%';
commit;
