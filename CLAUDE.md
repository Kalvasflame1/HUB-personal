# Personal Hub

Aplicación personal de un solo usuario: productividad, running (Strava), información web, informes, asistente y acceso al conocimiento de Craft. PWA para iPhone, iPad y Mac.

## Estado

Fase 1 (cimientos) cerrada el 16-11-2026. Siguiente: Fase 2 (aplicación Next.js). La hoja de ruta y el estado de cada tarea están en `docs/ROADMAP.md`; actualizar las casillas al completar tareas.

## Documentación

- `docs/ARCHITECTURE.md`: componentes, decisiones D1–D6 (aprobadas el 16-11-2026 con las recomendaciones), riesgos, variables de entorno
- `docs/DATABASE.md`: esquema y RLS
- `docs/KNOWLEDGE_BASE.md`: estrategia de Craft y Cowork
- `docs/SETUP.md`: instalación paso a paso
- `docs/ROADMAP.md`: fases y tareas

## Estructura

- `apps/web`: Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4, Recharts
- `apps/worker`: proceso Node del Mac mini (launchd), solo conexiones salientes
- `packages/shared`: tipos generados de la base de datos
- `supabase/migrations`: migraciones; `supabase/seed.sql`: datos de demostración

## Reglas del proyecto

- Idioma: interfaz, documentación y mensajes de commit en español; identificadores de código en inglés.
- Coste cero: no contratar servicios, no crear cuentas ni activar planes de pago sin autorización expresa.
- Sin cambios destructivos (borrar tablas, columnas o datos reales) sin copia previa y autorización.
- Craft es de solo lectura. No escribir, mover ni borrar nada en Craft sin autorización expresa.
- La IA es opcional: toda estadística se calcula con SQL o código. Nada debe romperse con `AI_PROVIDER=none`.
- Secretos solo en `.env` (ignorado por Git) o en el Llavero. Nunca en variables `NEXT_PUBLIC_*`, en el repositorio ni en el chat.
- Todas las tablas de `public` llevan `user_id` y RLS. Los secretos de terceros van en el esquema `private`.
- Los datos de demostración llevan `is_demo = true` y la interfaz los etiqueta como «Demo».
- Cambios de esquema solo mediante archivos en `supabase/migrations`, nunca a mano desde el panel.
- Usar las claves nuevas de Supabase (`sb_publishable_`, `sb_secret_`), no las antiguas `anon` / `service_role`.
- En Next 16 el antiguo `middleware.ts` se llama `proxy.ts`.
- Al cerrar cada fase: actualizar `docs/` con lo realmente construido y parar para revisión.

## Entorno

- Node 24 LTS en `~/.local/opt/node` (enlaces en `~/.local/bin`). Si un shell no lo encuentra, anteponer `PATH="$HOME/.local/bin:$PATH"`.
- Supabase: proyecto `jgdnxnddudiccxszrkwn` (eu-west-1). La CLI no tiene sesión iniciada; se conecta por el pooler con `--remote "postgresql://postgres.<ref>:<contraseña>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"`, leyendo la contraseña de `.env` (`SUPABASE_DB_PASSWORD`). El host directo `db.<ref>` es solo IPv6 y no responde desde esta red.
- `supabase db query` acepta una sola sentencia por llamada; usar `--read-only` para consultas y `--file` para scripts.
