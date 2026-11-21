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
| Node.js / npm | Instalado el 16-11-2026: Node 24.22.3 (LTS) y npm 11 en `~/.local/opt/node`, con enlaces en `~/.local/bin` y PATH en `~/.zprofile`. Para actualizar: descargar la nueva versión, descomprimir en `~/.local/opt` y reapuntar el enlace `node` |
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

   Nota de lo ejecutado el 16-11-2026: el host directo `db.<ref>.supabase.co` solo responde por IPv6 y esta red no lo alcanza. Se usa el pooler en modo sesión, que funciona por IPv4 y sin `supabase login`:
   `postgresql://postgres.<ref>:<contraseña>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`, pasado con `--remote` a `db push`, `db query` y `gen types --db-url`. La contraseña se lee de `.env` (`SUPABASE_DB_PASSWORD`).
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
2. 👤 Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en las variables de entorno del proyecto. `NEXT_PUBLIC_APP_URL` no hace falta hasta la Fase 3 (vuelta de OAuth de Strava).
3. 🤖 Comprobar el despliegue. El inicio de sesión es con correo y contraseña, así que no hace falta configurar redirecciones en Supabase.

Hecho el 17-11-2026: `https://hub-personal-tau.vercel.app`. Cada `git push` a `main` despliega automáticamente.

Si se elige la **alternativa Tailscale**: instalar Tailscale en el Mac mini, iPhone e iPad (plan personal gratuito), servir la app con `tailscale serve` (HTTPS con certificado `*.ts.net`) y mantenerla en marcha con `launchd`. La app solo es accesible con Tailscale activo.

## 5. Instalar la PWA en el iPhone y el iPad

1. Abrir la URL de producción en **Safari**.
2. Compartir → **Añadir a pantalla de inicio**.
3. Abrir desde el icono e iniciar sesión.
4. En Mac: Safari → Archivo → **Añadir al Dock**.

## 6. Strava (Fase 3)

1. 👤 En strava.com/settings/api: crear una aplicación.
   - *Authorization Callback Domain*: `localhost` (la autorización se hace una vez, desde este Mac; el script usa `http://127.0.0.1:8723/callback`, que Strava admite con ese valor).
   - Revisar el acuerdo de la API vigente antes de aceptar.
2. 👤 Escribir `STRAVA_CLIENT_ID` y `STRAVA_CLIENT_SECRET` en `apps/worker/.env` (ya existe, con permisos 600 y la conexión a la base de datos rellenada). Nunca por chat.
3. 👤 Autorizar (abre Strava en el navegador; hay que dejar marcado el permiso de actividades privadas):
   ```bash
   npm run strava:auth --workspace apps/worker
   ```
   Los tokens quedan en `private.strava_tokens` y se renuevan solos en cada sincronización.
4. 🤖/👤 Sincronizar. La primera vez trae todo el historial (200 actividades por petición) y el detalle (parciales y mejores esfuerzos) de las 60 carreras más recientes; las siguientes ejecuciones completan el resto:
   ```bash
   npm run strava:sync --workspace apps/worker
   ```
   Opciones: `-- --details=200` para más detalles por ejecución, `-- --full` para releer todo, `-- --clear-demo` para borrar antes los datos de demostración de running (solo actividades, marcas, actividad reciente y avisos marcados como demo).
   El script se para solo al acercarse a los límites de Strava (100 lecturas cada 15 min, 1.000 al día) y registra cada ejecución en `job_runs`.
5. Hasta la Fase 4 la sincronización es manual; después la hará el worker cada 30 min.

## 7. Worker del Mac mini (Fase 4)

1. 🤖 `apps/worker/.env` (permisos 600) ya contiene `SUPABASE_DB_URL`, `HUB_USER_ID`, las credenciales de Strava, `AI_PROVIDER=none` y `TZ`. Craft y las copias se añadirán cuando se configuren. El worker usa la conexión directa a Postgres, así que no necesita la clave `sb_secret_`.
2. Probar a mano antes de instalar:
   ```bash
   npm start --workspace apps/worker -- --once          # ejecuta lo que toque y termina
   npm start --workspace apps/worker -- --run=web_fetch # una tarea concreta
   npm run report --workspace apps/worker -- weekly --date=2026-11-10
   npm run report --workspace apps/worker -- weekly --no-ai   # sin comentario de Claude (conserva el que hubiera)
   ```
3. 👤 Autorizar e instalar el agente de `launchd` (arranca al iniciar sesión y se reinicia si se cae):
   ```bash
   apps/worker/launchd/install.sh
   ```
   Registro: `~/Library/Logs/hub-worker.log`. Para quitarlo: `apps/worker/launchd/uninstall.sh`.
4. 👤 En *Ajustes del Sistema → Energía*: impedir el reposo automático y activar el reinicio tras corte de corriente. Activar FileVault y el cortafuegos si no lo están. (Claude Code no modifica ajustes del sistema.)
5. Calendario (hora de Madrid). Si el Mac estuvo apagado, cada tarea se pone al día una sola vez al volver:

| Tarea | Frecuencia | Estado |
|---|---|---|
| `strava_sync` | Cada 30 min (hasta 90 detalles por ejecución) | Activa |
| `web_fetch` | Cada 2 h | Activa |
| `report_daily` | 06:30 | Activa |
| `report_weekly` | Lunes 07:00 | Activa |
| `report_monthly` | Día 1, 07:00 | Activa |
| `watchdog` | Cada hora: avisa si una tarea lleva demasiado sin terminar bien | Activa |
| `craft_index` | Cada hora (solo lee lo modificado) | Activa |
| `craft_extras` | Cada hora: próximos eventos del último Informe Diario y tabla «Seguimiento» | Activa (21-11-2026) |
| `craft_changes` | Cada minuto, solo si hay cambios del seguimiento hechos desde la app | Activa (21-11-2026) |
| `podcast` | Cada 10 min entre 05:00 y 13:00 hasta tener el episodio del día (atajo «HUB - Podcast») | Activa (21-11-2026) |
| `backup` | 03:30 | Activa (copia local comprobada, §10) |
| `cleanup` | Domingo 04:00 | Activa (reglas en §10) |

6. Avisos: si una tarea falla se crea un aviso (solo el primero de una racha de fallos); si lleva demasiado sin terminar bien, otro, como máximo uno al día.

## 8. Craft (Fase 4)

1. 👤 En Craft → **Imagine / Connections**: conexión de **API** «API para HUB Personal» al espacio «HOME MARCOS», solo lectura. Hecho el 18-11-2026; su especificación (`/openapi.json`) solo tiene operaciones GET. Es independiente del conector de Craft que usa Cowork.
2. 👤 URL y clave en `apps/worker/.env` como `CRAFT_API_URL` y `CRAFT_API_KEY`.
3. 🤖 Indexador `apps/worker/src/craft/index.ts`, tarea `craft_index` cada hora:
   - Recorre carpetas, «Sin clasificar» y notas diarias. Excluye «How to use Craft», NOTION, las plantillas de ejemplo, Plantillas y Papelera (KNOWLEDGE_BASE §9).
   - Solo vuelve a leer los documentos cuya fecha de modificación cambió. Los que desaparecen se marcan con `deleted_at`.
   - Del 📰 Informe Diario guarda título, fecha y extracto; del resto, el texto completo para buscar.
   - Respeta el límite de Craft (100 peticiones/min): una petición cada 0,7 s. La primera pasada tarda unos 3 minutos.
   - Manual: `npm run craft:index --workspace apps/worker` (añadir `-- --full` para releerlo todo).
4. 🤖 Búsqueda en la pantalla Conocimiento (texto completo en español de Postgres). Cada resultado abre el original con el enlace `craftdocs://` que da la API.
5. 👤 Para revocar: borrar la conexión en Craft. El índice existente se queda, pero deja de actualizarse.

## 9. Asistente con Claude (Fase 5)

Antes de nada: **verificar en el centro de ayuda de Anthropic cómo se factura hoy `claude -p` con tu plan** (riesgo R1).

1. 👤 Instalar la CLI de Claude Code en el Mac mini e iniciar sesión con tu suscripción. Hecho: `~/.local/bin/claude` (2.1.330), sesión `claude.ai` del plan Pro (`claude auth status`; caduca el 20-12-2026 y se renueva al usar Claude Code).
2. 🤖 Comprobar que **no** existe `ANTHROPIC_API_KEY` en el entorno del worker (si existe, el uso se factura a la API). Comprobado el 21-11-2026; además el proveedor la quita del entorno al lanzar `claude`.
3. 🤖 `AI_PROVIDER=claude_cli` en `apps/worker/.env` (activado el 21-11-2026). El proveedor (`apps/worker/src/ai/claude.ts`) lanza `claude -p --output-format json --no-session-persistence --tools "" --strict-mcp-config --setting-sources ""` en `~/Library/Application Support/PersonalHub/ai`. No usa `--bare`, que se salta el Llavero donde está la sesión. Probado también desde launchd.
4. 🤖 Contexto reunido por el worker con SQL (`src/ai/context.ts`) según las fuentes de Asistente → Configuración; el modelo es el de «preguntas» y el tope diario el de esa pantalla.
5. 🤖 Probar sin la web: `npm run ai:ask --workspace apps/worker -- "pregunta"` (la responde como el worker) o con `--context` (solo muestra lo que se enviaría, sin llamar a Claude).
6. 🤖 Prueba con las seis preguntas de ejemplo del briefing y medición del consumo: hecha el 21-11-2026 (resultado en ROADMAP, Fase 5).
7. Para apagar la IA: `AI_PROVIDER=none` y reiniciar el worker. Las preguntas a Claude se cierran con un aviso; las preguntas rápidas siguen funcionando.

## 10. Copias de seguridad y restauración

Tarea `backup` del worker (`apps/worker/src/backup.ts`), cada noche a las 03:30:

1. 🤖 Vuelca todas las tablas de `public` (solo las filas del usuario) a `hub-AAAA-MM-DD.json.gz`. El esquema `private` (tokens de Strava) **no** se copia: tras una restauración basta con repetir `npm run strava:auth`. No hace falta `pg_dump`.
2. 🤖 La guarda en `~/Library/Application Support/PersonalHub/backups` (`BACKUP_LOCAL_DIR`) y la **comprueba**: vuelve a leer el archivo y carga cada tabla en una tabla temporal con la estructura actual, dentro de una transacción que se deshace. No toca los datos reales.
3. 🤖 Conserva las 30 copias más recientes y borra las anteriores.

Las copias se quedan solo en este Mac (decisión del 18-11-2026). No van a iCloud Drive porque macOS no deja entrar en él a un proceso de launchd si no se le da «Acceso total al disco», y ese permiso valdría para cualquier script de Node.

Comandos:

- `npm run backup --workspace apps/worker`: copia ahora.
- `npm run backup --workspace apps/worker -- --verify=RUTA`: solo comprueba un archivo de copia.

**Limpieza semanal** (`apps/worker/src/cleanup.ts`, domingos 04:00). Reglas autorizadas el 18-11-2026:

| Tabla | Se borra |
|---|---|
| `web_items` | Lecturas de más de 90 días no guardadas |
| `job_runs` | Ejecuciones de más de 180 días |
| `notifications` | Avisos leídos hace más de 90 días |
| `activity_log` | Entradas del feed de más de 365 días |

- No toca Strava, tareas, proyectos, informes, el índice de Craft ni los datos de demostración.
- Solo actúa si hay una copia de seguridad correcta de las últimas 24 horas. Si no la hay, falla y crea un aviso.
- Todo se borra en una sola transacción.
- Para ver qué borraría sin borrar nada: `npm run cleanup --workspace apps/worker -- --dry-run`.

Borrado puntual del 18-11-2026, autorizado y con copia previa: 511 entradas «carrera importada» que la importación del historial de Strava había dejado en el feed. Para que no vuelva a pasar, la sincronización solo anota en el feed las carreras de los últimos 7 días.

**Restaurar** (manual, solo con autorización, porque sobrescribe datos): descomprimir la copia y, tabla por tabla, insertar las filas con `json_populate_recordset`, el mismo método que usa la comprobación. Antes, sacar una copia del estado actual.

El código está en Git y los secretos en tu gestor de contraseñas; con eso y la copia, el Hub se reconstruye desde cero.

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
