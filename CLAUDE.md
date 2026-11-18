# Personal Hub

Aplicación personal de un solo usuario: productividad, running (Strava), información web, informes, asistente y acceso al conocimiento de Craft. PWA para iPhone, iPad y Mac.

## Estado

Fase 1 cerrada el 16-11-2026. Fase 2 cerrada el 17-11-2026 (`apps/web`): desplegada en Vercel (`https://hub-personal-tau.vercel.app`, raíz `apps/web`, despliegue automático desde `main`) e instalada como PWA en el iPhone. Fase 3 casi cerrada el 17-11-2026: Strava conectado (`apps/worker`, sincronización manual con `npm run strava:sync --workspace apps/worker`), historial importado y datos de demostración de running borrados. Fase 4 en curso: worker con planificador (`npm start --workspace apps/worker`), fuentes web, informes y avisos; instalado como agente de launchd `com.personalhub.worker` (quitar con `apps/worker/launchd/uninstall.sh`; registro en `~/Library/Logs/hub-worker.log`); copia nocturna (`npm run backup --workspace apps/worker`, local en `~/Library/Application Support/PersonalHub/backups`, sin iCloud Drive); índice de Craft en solo lectura (`npm run craft:index --workspace apps/worker`, cada hora, búsqueda en Conocimiento); limpieza semanal autorizada (`npm run cleanup --workspace apps/worker -- --dry-run` para probar). La hoja de ruta y el estado de cada tarea están en `docs/ROADMAP.md`; actualizar las casillas al completar tareas.

## Documentación

- `docs/ARCHITECTURE.md`: componentes, decisiones D1–D6 (aprobadas el 16-11-2026 con las recomendaciones), riesgos, variables de entorno
- `docs/DATABASE.md`: esquema y RLS
- `docs/KNOWLEDGE_BASE.md`: estrategia de Craft y Cowork
- `docs/SETUP.md`: instalación paso a paso
- `docs/ROADMAP.md`: fases y tareas

## Estructura

- `apps/web`: Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4, Recharts
- `apps/worker`: proceso Node del Mac mini (launchd en la Fase 4), solo conexiones salientes. TypeScript ejecutado directamente por Node 24 (imports con `.ts`), conexión a Postgres por el pooler con `pg` (`SUPABASE_DB_URL` en `apps/worker/.env`)
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

## Aplicación web

- Next 16.4 con `cacheComponents` activado: ninguna lectura de sesión en el nivel superior de un layout o página. Cada página exporta un componente síncrono con la cabecera y envuelve en `<Suspense>` un componente `async` que llama a `getSession()` (`apps/web/lib/supabase/server.ts`). Antes de tocar APIs de Next, leer `node_modules/next/dist/docs/`.
- Mutaciones con Server Actions que llaman a `getSession()` y terminan con `refresh()` de `next/cache`.
- Estilos: tokens en `app/globals.css` (un solo color de acento, sin sombras, sin emojis; iconos de `lucide-react`; fuente del sistema).
- Gráficas: Recharts en `components/charts.tsx`, una sola serie por gráfica, nunca doble eje.
- Servidor de desarrollo: configuración `hub-web` en `.claude/launch.json`. Comprobaciones: `npm run lint` y `npm run build` dentro de `apps/web`.
- Los accesos directos de Craft y de artefactos están curados a mano en `apps/web/lib/knowledge.ts`.
