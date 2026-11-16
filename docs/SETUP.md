# Personal Hub · Instalación y configuración

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **guía prevista. Ningún paso se ha ejecutado.** Los comandos se validarán y corregirán al ejecutarlos en cada fase.

Leyenda: 👤 lo haces tú (cuentas, contraseñas, aceptar condiciones) · 🤖 lo hace Claude Code con tu aprobación.

---

## 0. Estado de partida del Mac mini

| Herramienta | Estado |
|---|---|
| macOS 27.2, M4 Pro, 24 GB | OK |
| Git 2.54 | Instalado |
| Node.js / npm | **Falta** |
| Homebrew | Falta (opcional) |
| CLI de Supabase | Falta |
| CLI de Claude Code (`claude`) | Falta; solo hace falta en la Fase 5 |
| Carpeta del proyecto | Vacía, sin Git |

## 1. Herramientas base (Fase 1)

1. 👤 **Node.js LTS.** Dos opciones:
   - Instalador oficial de nodejs.org (lo más simple), o
   - Homebrew + gestor de versiones (`fnm`), si quieres cambiar de versión con facilidad.
2. 🤖 Comprobar versiones:

```bash
node --version
```

```bash
npm --version
```

3. 🤖 CLI de Supabase como dependencia de desarrollo del proyecto (`npx supabase …`), sin instalación global.
4. 🤖 Inicializar el repositorio en la carpeta del proyecto, con `.gitignore` que excluya `.env*`, `node_modules`, `.next` y copias de seguridad.
5. 👤 Si se aprueba D6: crear repositorio **privado** en GitHub y autorizar el acceso desde el Mac.

## 2. Supabase (Fase 1)

1. 👤 Crear cuenta en supabase.com y un proyecto en plan **Free**.
   - Región: UE (Fráncfort o la más cercana disponible).
   - Guardar la contraseña de la base de datos en tu gestor de contraseñas.
2. 👤 En *Authentication → Sign In / Providers*: activar correo; tras crear tu usuario, **desactivar nuevos registros**.
3. 👤 En *Settings → API Keys*: copiar la clave **publicable** (`sb_publishable_…`) y crear una clave **secreta** (`sb_secret_…`). No usar las antiguas `anon` / `service_role`.
4. 🤖 Enlazar el proyecto y aplicar la migración inicial de [DATABASE.md](DATABASE.md):

```bash
npx supabase link --project-ref <ref-del-proyecto>
```

```bash
npx supabase db push
```

5. 🤖 Generar los tipos de TypeScript:

```bash
npx supabase gen types typescript --linked > packages/shared/database.types.ts
```

6. 🤖 Verificar RLS: una consulta con la clave publicable y sin sesión debe devolver cero filas en todas las tablas.
7. 👤 En *Authentication → URL Configuration*: añadir la URL local y la de producción como direcciones de redirección permitidas.

## 3. Aplicación web (Fase 2)

1. 🤖 Crear el proyecto Next.js en `apps/web` (TypeScript, App Router, Tailwind, ESLint).
2. 🤖 Crear `apps/web/.env.local` a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. 🤖 Arrancar en local:

```bash
npm run dev
```

4. 🤖 Cargar los datos de demostración (`supabase/seed.sql`).
5. 👤 Iniciar sesión por primera vez con tu correo.

## 4. Despliegue (Fase 2)

Si se aprueba **D1 = Vercel Hobby**:

1. 👤 Crear cuenta en Vercel con tu GitHub e importar el repositorio (directorio raíz `apps/web`).
2. 👤 Añadir las tres variables `NEXT_PUBLIC_*` en *Project Settings → Environment Variables*, con la URL de producción en `NEXT_PUBLIC_APP_URL`.
3. 🤖 Comprobar el despliegue y añadir la URL a las redirecciones de Supabase.

Si se elige la **alternativa Tailscale**: instalar Tailscale en el Mac mini, iPhone e iPad (plan personal gratuito), servir la app con `tailscale serve` (HTTPS con certificado `*.ts.net`) y mantenerla en marcha con `launchd`. La app solo es accesible con Tailscale activo.

## 5. Instalar la PWA en el iPhone y el iPad

1. Abrir la URL de producción en **Safari**.
2. Compartir → **Añadir a pantalla de inicio**.
3. Abrir desde el icono e iniciar sesión.
4. En Mac: Safari → Archivo → **Añadir al Dock**.

## 6. Strava (Fase 3)

1. 👤 En strava.com/settings/api: crear una aplicación.
   - *Authorization Callback Domain*: `localhost` (la autorización se hace una vez, desde el Mac mini).
   - Revisar el acuerdo de la API vigente (1 de junio de 2026) antes de aceptar.
2. 👤 Pasar `Client ID` y `Client Secret` al `.env` del worker (no por chat).
3. 🤖 Ejecutar el script de autorización del worker: abre el navegador, autorizas con permiso `activity:read_all`, y los tokens quedan en `private.strava_tokens`.
4. 🤖 Importación histórica por lotes respetando 100 lecturas/15 min y 1.000/día. Puede repartirse en varios días según tu historial.
5. 🤖 Borrar las actividades de demostración al terminar la importación.

## 7. Worker del Mac mini (Fase 4)

1. 🤖 Crear `apps/worker/.env` con permisos restringidos:

```bash
chmod 600 apps/worker/.env
```

   Contenido previsto (valores reales introducidos por ti):

```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_DB_URL=postgresql://...
HUB_USER_ID=<uuid-de-tu-usuario>
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
CRAFT_API_URL=...
CRAFT_SPACE_ID=57b0381b-3107-7b28-4b8f-d05ffde1fe04
AI_PROVIDER=none
AI_MAX_JOBS_PER_DAY=20
BACKUP_DIR=/Users/marcos/Backups/hub-personal
TZ=Europe/Madrid
```

2. 🤖 Instalar el servicio de `launchd` (agente de usuario en `~/Library/LaunchAgents/`), con arranque al iniciar sesión y reinicio automático.
3. 👤 En *Ajustes del Sistema → Energía*: impedir el reposo automático y activar el reinicio tras corte de corriente. Activar FileVault y el cortafuegos si no lo están. (Claude Code no modifica ajustes del sistema.)
4. 🤖 Calendario de tareas previsto:

| Tarea | Frecuencia |
|---|---|
| `strava_sync` | Cada 30 min |
| `craft_index` | Cada hora |
| `web_fetch` | Cada 2 h |
| `report_daily` | 06:30 |
| `report_weekly` | Lunes 07:00 |
| `report_monthly` | Día 1, 07:00 |
| `backup` | 03:00 |
| `cleanup` | Domingo 04:00 |

5. 🤖 Verificar en la pantalla de Productividad que cada tarea aparece en el historial con estado correcto.

## 8. Craft (Fase 4)

1. 👤 En Craft → **Connections**: crear una conexión de API con acceso de **solo lectura** al espacio «HOME MARCOS» (o a las carpetas que decidas en KNOWLEDGE_BASE.md §9).
2. 👤 Copiar la URL y la credencial al `.env` del worker.
3. 🤖 Primera indexación y revisión conjunta de qué ha entrado.
4. 👤 Para revocar: borrar la conexión en Craft.

## 9. Asistente con Claude (Fase 5)

Antes de nada: **verificar en el centro de ayuda de Anthropic cómo se factura hoy `claude -p` con tu plan** (riesgo R1).

1. 👤 Instalar la CLI de Claude Code en el Mac mini e iniciar sesión con tu suscripción.
2. 🤖 Comprobar que **no** existe `ANTHROPIC_API_KEY` en el entorno del worker (si existe, el uso se factura a la API).
3. 🤖 Configurar el worker con `AI_PROVIDER=claude_cli`, herramientas de solo lectura y `--output-format json`.
4. 🤖 Declarar el MCP de Craft de forma explícita en la configuración del worker.
5. 🤖 Prueba con las seis preguntas de ejemplo del briefing y medición del consumo.

## 10. Copias de seguridad y restauración

- `pg_dump` nocturno a `BACKUP_DIR`, comprimido, con retención de 30 días.
- La carpeta entra en Time Machine.
- Prueba de restauración en un proyecto local de Supabase al cerrar la Fase 4.
- El código está en Git; los secretos, en tu gestor de contraseñas. Con esas tres cosas el Hub se reconstruye desde cero.

## 11. Rotación de credenciales

| Credencial | Dónde se rota | Qué actualizar |
|---|---|---|
| Clave secreta de Supabase | Panel → API Keys | `.env` del worker, reiniciar servicio |
| Contraseña de la base de datos | Panel → Database | `SUPABASE_DB_URL` |
| Secreto de Strava | strava.com/settings/api | `.env` del worker; reautorizar |
| Conexión de Craft | Craft → Connections | `.env` del worker |

## 12. Comprobaciones rápidas cuando algo falla

| Síntoma | Mirar primero |
|---|---|
| La PWA no carga datos | Sesión caducada; estado del proyecto en Supabase (¿pausado?) |
| No entran entrenamientos | Última fila de `job_runs` para `strava_sync`; caducidad del token; límite diario |
| El índice de Craft no se actualiza | `job_runs` para `craft_index`; respuesta 429 (límite de peticiones) |
| El worker no corre | `launchctl list` y el log del servicio; ¿el Mac entró en reposo? |
| El asistente no responde | `ai_jobs` en estado `queued`; tope diario alcanzado; sesión de la CLI |
