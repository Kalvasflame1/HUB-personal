# Personal Hub · Arquitectura

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **pendiente de aprobación. No hay código escrito ni servicios creados.**

Documentos relacionados: [ROADMAP.md](ROADMAP.md) · [DATABASE.md](DATABASE.md) · [SETUP.md](SETUP.md) · [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md)

---

## 1. Veredicto de viabilidad

El proyecto es viable con coste recurrente nuevo de **0 €/mes**, con tres condiciones que cambian el diseño respecto al briefing:

1. **La IA no puede ser una dependencia dura.** Las condiciones de uso programado de la suscripción de Claude (`claude -p`, Agent SDK) cambiaron varias veces en 2026 y no he podido confirmar su estado actual (ver riesgo R1). Todo lo que sea estadística, gráficas, tareas e informes numéricos se hace con SQL y código normal. La IA añade redacción y consultas en lenguaje natural, y si falla el Hub sigue funcionando.
2. **El Mac mini solo hace conexiones salientes.** Recoge trabajo de una cola en Supabase y devuelve resultados. No hace falta abrir puertos, túneles ni VPN.
3. **Craft se consulta, no se migra.** El espacio es pequeño (unos 210 documentos), así que un índice ligero con enlaces al original basta. Detalle en [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md).

## 2. Lo que he comprobado en esta máquina y en tus cuentas

| Comprobación | Resultado |
|---|---|
| Carpeta del proyecto | Vacía. No es repositorio Git todavía. |
| Hardware / SO | Apple M4 Pro, 24 GB, macOS 27.2 |
| Git | 2.54 (Apple) instalado |
| Node, npm, pnpm, Homebrew | **No instalados** |
| CLI `claude`, `supabase`, `gh`, Docker, Tailscale | **No instalados** (Claude Code funciona hoy solo desde la app de escritorio) |
| Craft desde Claude Code | **Funciona**: esta sesión ha leído el espacio «HOME MARCOS» con el conector de tu cuenta (solo lectura, no he modificado nada) |
| Artefactos de Claude | **Accesibles**: 8 artefactos propios listados (Resumen diario, Coach Personal, etc.) |
| Tareas programadas en la pestaña Code | Ninguna |
| Conector de Strava | Disponible en tu cuenta (no lo he consultado) |

## 3. Versiones y compatibilidad

Las versiones exactas se fijan con `npm view <paquete> version` el día de la instalación; aquí van las líneas mayores y sus restricciones.

| Componente | Línea propuesta | Notas |
|---|---|---|
| Node.js | LTS activa (mínimo 20.9 exigido por Next 16) | Fijar en `.nvmrc` |
| Next.js | 16.x (App Router, Turbopack) | Última estable que he podido confirmar: 16.2.x (julio 2026). En Next 16 `middleware.ts` pasa a llamarse `proxy.ts` |
| React | 19.x | La que acompañe a Next 16 |
| TypeScript | 5.x o superior, modo `strict` | |
| Tailwind CSS | 4.x | Configuración en CSS, sin `tailwind.config.js` |
| Recharts | 3.x | Componentes cliente (`"use client"`) |
| Supabase | `@supabase/supabase-js` 2.x + `@supabase/ssr` | Usar las claves nuevas `sb_publishable_…` y `sb_secret_…`. Las antiguas `anon`/`service_role` se retiran a finales de 2026 |
| PWA | `app/manifest.ts` nativo + service worker propio y mínimo | Serwist solo si se quiere caché offline avanzada; comprobar antes su compatibilidad con Turbopack |
| Worker del Mac mini | Node + TypeScript, lanzado con `launchd` | Sin Docker |

Limitaciones de iOS que afectan al diseño: la PWA se instala desde Safari («Añadir a pantalla de inicio»); las notificaciones push web solo funcionan con la app instalada; no hay sincronización en segundo plano, así que los datos los mantiene frescos el Mac mini, no el teléfono.

## 4. Componentes

```
 iPhone / iPad / Mac
 ┌──────────────────┐
 │  PWA (Next.js)   │
 └────────┬─────────┘
          │ HTTPS
 ┌────────▼─────────┐        ┌───────────────────────────┐
 │ Hosting frontend │        │         Supabase          │
 │ (Vercel Hobby)   ├───────►│ Auth · Postgres+RLS       │
 └──────────────────┘ HTTPS  │ Storage · Realtime        │
                             └───────────▲───────────────┘
                                         │ solo saliente (HTTPS/WSS)
                             ┌───────────┴───────────────┐
                             │   Mac mini · worker       │
                             │ launchd + Node            │
                             │  · sync Strava            │
                             │  · índice Craft           │
                             │  · fuentes web (RSS)      │
                             │  · informes               │
                             │  · cola de IA (claude -p) │
                             │  · copia de seguridad     │
                             └──┬──────────┬──────────┬──┘
                                ▼          ▼          ▼
                             Strava API  Craft API  Claude (suscripción)
```

### 4.1 Frontend
- Next.js App Router. Server Components para lectura; Server Actions para escritura.
- Sesión con `@supabase/ssr` y cookies. Toda consulta pasa por RLS con la clave publicable.
- Un único usuario: registro deshabilitado en Supabase tras crear la cuenta.
- Diseño: navegación inferior con pestañas en iPhone, barra lateral en iPad/Mac, tema claro/oscuro del sistema, tipografía del sistema (San Francisco), áreas seguras (`env(safe-area-inset-*)`).

### 4.2 Backend (Supabase)
- Postgres como única fuente de datos del Hub. Esquema en [DATABASE.md](DATABASE.md).
- RLS en todas las tablas del esquema `public`. Los secretos de terceros (tokens de Strava) van en un esquema `private` sin acceso desde la API.
- Realtime para que el worker reciba trabajos sin sondear y para que la PWA vea el resultado al momento.
- El plan gratuito pausa proyectos con poca actividad semanal: el worker del Mac mini escribe cada 30 minutos, lo que lo mantiene activo.

### 4.3 Nodo local (Mac mini)
- Un solo proceso Node gestionado por `launchd` (arranque automático, reinicio si cae).
- Planificador interno con las tareas periódicas; cada ejecución se registra en `job_runs` (inicio, fin, estado, error), que alimenta el «historial de automatizaciones» del módulo de Productividad.
- Usa la clave secreta de Supabase, guardada en el Llavero de macOS o en un `.env` con permisos `600`, nunca en el repositorio.
- Sin puertos abiertos. No necesita IP fija ni dominio.

### 4.4 Capa de IA
Interfaz única `AiProvider` con tres implementaciones seleccionadas por `AI_PROVIDER`:

| Valor | Qué hace | Cuándo |
|---|---|---|
| `none` | Sin IA. Informes con plantillas y cifras; el asistente responde solo consultas predefinidas (km del mes, tareas pendientes…) resueltas con SQL | Por defecto hasta la Fase 5, y como modo degradado |
| `claude_cli` | El worker ejecuta `claude -p` en el Mac mini con herramientas de solo lectura y salida JSON | Fase 5, tras verificar R1 |
| `anthropic_api` | Llamadas directas a la API | Futuro, solo si lo decides. No se contrata ahora |

Flujo del asistente: la PWA inserta la pregunta en `ai_jobs` → un disparador hace `pg_notify` y el worker, que tiene una conexión con `LISTEN ai_jobs` por el pooler en modo sesión, la recibe al instante (y revisa la cola cada minuto por si se perdió el aviso; se usa NOTIFY en lugar de Realtime porque el worker ya habla Postgres directamente) → reúne con SQL el contexto que permiten las fuentes activadas → ejecuta el proveedor → escribe la respuesta con sus fuentes → la PWA, que vuelve a pedir la página cada 2 s mientras espera, la muestra. Con `claude_cli`, Claude se lanza sin ninguna herramienta (`--tools ""`), sin MCP, sin ajustes del usuario y sin guardar la sesión: solo ve el texto que le pasa el worker y solo devuelve texto. Latencia esperada de varios segundos; aceptable para uso personal. Límites configurables de trabajos por día para no agotar la suscripción.

## 5. Decisiones que necesitan tu aprobación

| # | Decisión | Recomendación | Alternativa |
|---|---|---|---|
| D1 | Dónde se aloja el frontend | **Vercel Hobby** (gratis, HTTPS, accesible desde cualquier red, uso personal no comercial) | Servirlo desde el Mac mini con Tailscale: nada sale a Internet, pero el iPhone necesita la VPN activa |
| D2 | Método de acceso | **Enlace mágico por correo + passkey** si está disponible en el plan gratuito; si no, correo y contraseña | Solo contraseña. **Implementado así en la Fase 2** (correo y contraseña); el enlace mágico queda como mejora |
| D3 | Dónde viven las tareas | **En Supabase** (el Hub es la fuente). Las tareas de Craft se muestran aparte, en solo lectura, sin sincronización bidireccional | Usar las tareas de Craft como fuente única y que el Hub solo las muestre |
| D4 | Informes: ¿sustituyen o conviven con tu «Resumen diario» actual? | **Conviven** en la primera entrega; el Hub enlaza a los artefactos existentes. Se decide la unificación en la Fase 5. **Decisión final (21-11-2026): conviven y el Hub muestra el Informe Diario de Cowork en solo lectura** (`craft_daily_reports`) | Migrar el resumen diario al Hub desde el principio |
| D5 | Sincronización de Strava | **Sondeo cada 30 min** desde el Mac mini | Webhook de Strava recibido por una Edge Function de Supabase (más inmediato, más piezas) |
| D6 | Alojamiento del código | **Git local + GitHub privado** (gratis) | Solo Git local con copia de Time Machine |

## 6. Riesgos y limitaciones

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | **Uso programado de la suscripción de Claude.** En mayo de 2026 Anthropic anunció que `claude -p` y el Agent SDK pasarían a un crédito mensual aparte; en junio se pausó; hay informaciones no confirmadas de que se reactivó en octubre. **Verificado el 18-11-2026 en el centro de ayuda** (ver ROADMAP, F5-1): el cambio de junio sigue en pausa; con la sesión del plan, `claude -p` consume los límites de la suscripción, sin coste extra. Max y Ultra incluyen además créditos mensuales de API (100 $ y 200 $) para `claude -p` con clave de una organización de Console vinculada; al agotarse, se paran y no se cobran al plan, salvo que se compren créditos o se active la recarga automática | Los trabajos de IA automáticos comparten límites con tu uso interactivo | IA opcional por diseño. Verificar en el centro de ayuda de Anthropic antes de la Fase 5. Tope diario de trabajos. No definir `ANTHROPIC_API_KEY` en el Mac mini (si existe, `claude -p` factura a la API) |
| R2 | Cowork y Claude Code **no comparten memoria ni sesiones** | El asistente del Hub no «recuerda» lo hablado en Cowork | El puente son los datos compartidos: Craft y Supabase, accesibles desde ambos por conector. Ver KNOWLEDGE_BASE.md |
| R3 | Supabase gratuito: pausa por inactividad, 500 MB de base de datos, sin copias automáticas | Pérdida de servicio o de datos | El worker mantiene actividad; copia nocturna local del worker; volumen previsto muy inferior a 500 MB |
| R4 | Strava: 100 lecturas/15 min y 1.000/día; app nueva limitada a 1 atleta; los datos solo pueden mostrarse a su propietario; las condiciones cambiaron el 1 de junio de 2026 | Importación histórica lenta; restricciones sobre enviar datos a terceros | Importación inicial por lotes en varios días; uso estrictamente personal; revisar el acuerdo de la API al registrar la app, incluida la parte de tratamiento con IA |
| R5 | API de Craft: 100 peticiones/min por espacio; sin webhooks; la conexión se creó sin coste el 18-11-2026 | Índice no instantáneo | Sincronización incremental cada hora; conexión de solo lectura |
| R6 | PWA en iOS: sin tareas en segundo plano, push solo instalada | Menos «nativa» que una app | Aceptado. El trabajo en segundo plano lo hace el Mac mini |
| R7 | El Mac mini es punto único de fallo para automatizaciones | Sin sincronización si se apaga | La PWA sigue funcionando con los últimos datos; `job_runs` muestra la última ejecución correcta; aviso si pasan más de N horas |
| R8 | La clave secreta de Supabase da acceso total | Compromiso del Mac mini = compromiso de datos | Llavero, FileVault, usuario sin sesión remota abierta, rotación documentada |
| R9 | Duplicidad con lo que ya tienes (Resumen diario, Coach Personal, colección «Seguimiento») | Dos sistemas para lo mismo | Decisiones D3 y D4; el Hub enlaza antes de reimplementar |

## 7. Seguridad

- Autenticación de un solo usuario, registro cerrado, sesión en cookies `HttpOnly`.
- RLS en todas las tablas; política única `user_id = auth.uid()`.
- La clave secreta y los tokens de Strava/Craft existen solo en el Mac mini y en el esquema `private`. Nunca en variables `NEXT_PUBLIC_*`.
- El worker se conecta a Postgres por el pooler con TLS sin verificar la cadena (la CA de Supabase no está en el almacén de Node). Mejora pendiente: descargar el certificado raíz desde el panel de Supabase y verificarlo.
- HTTPS en todos los tramos. Cabeceras de seguridad (CSP, HSTS) en Next.js.
- Conexión de Craft de **solo lectura** mientras no autorices escritura.
- Mac mini: FileVault, cortafuegos activo, actualizaciones automáticas, sin «Sesión remota» salvo necesidad.
- Copias: volcado JSON nocturno de `public`, en disco local, comprobado en cada ejecución con una restauración a tablas temporales. No se copian los secretos de `private`. Detalle en SETUP §10.
- Registro de errores en `job_runs`; sin datos personales en logs de terceros.

## 8. Estructura de carpetas propuesta

```
hub-personal/
├── apps/
│   ├── web/                    # Next.js (PWA)
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (hub)/          # layout con navegación
│   │   │   │   ├── page.tsx            # Dashboard
│   │   │   │   ├── productividad/
│   │   │   │   ├── running/
│   │   │   │   ├── web/
│   │   │   │   ├── asistente/
│   │   │   │   ├── informes/
│   │   │   │   └── conocimiento/
│   │   │   ├── manifest.ts
│   │   │   └── layout.tsx
│   │   ├── components/         # ui/, charts/, dashboard/
│   │   ├── lib/                # supabase/, stats/, format/
│   │   └── public/             # iconos PWA, sw.js
│   └── worker/                 # proceso del Mac mini
│       ├── src/jobs/           # strava, craft, web, reports, backup, ai
│       ├── src/providers/      # ai: none | claude_cli | anthropic_api
│       └── launchd/            # plist de ejemplo
├── packages/shared/            # tipos generados de la BD, utilidades
├── supabase/
│   ├── migrations/
│   └── seed.sql                # datos de demostración (is_demo = true)
├── docs/                       # estos cinco documentos
├── .env.example
├── CLAUDE.md                   # contexto del proyecto para Claude Code
└── package.json                # workspaces de npm
```

## 9. Variables de entorno

| Variable | Dónde | Secreta | Uso |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | No | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web | No | Clave publicable (sujeta a RLS) |
| `NEXT_PUBLIC_APP_URL` | web | No | URL pública de la PWA |
| `SUPABASE_URL` | worker | No | Igual que la anterior |
| `SUPABASE_SECRET_KEY` | worker | **Sí** | Acceso de servicio a Storage (subida del podcast). Solo en `apps/worker/.env`, en el Mac mini; configurada y comprobada el 18-11-2026 |
| `CRAFT_WRITE_API_URL` / `CRAFT_WRITE_API_KEY` | worker | **Sí** | Conexión de escritura de Craft limitada al documento «🗂️ Seguimiento activo» (creada el 21-11-2026). Solo la usa el aplicador de cambios del seguimiento; la lectura sigue por `CRAFT_API_*` |
| `CRAFT_PROJECTS_API_URL` / `CRAFT_PROJECTS_API_KEY` | worker | **Sí** | Conexión de escritura de Craft para los proyectos (26-11-2026): crea la carpeta de cada proyecto dentro de «📁 PROYECTOS HUB» y su «📋 Ficha del proyecto». Sin ella `craft_projects` se salta. `CRAFT_PROJECTS_FOLDER_ID` (opcional) cambia la carpeta madre |
| `SUPABASE_DB_URL` | worker | **Sí** | Cadena de conexión para `pg_dump` |
| `HUB_USER_ID` | worker | No | UUID del único usuario, para escribir filas a su nombre |
| `STRAVA_CLIENT_ID` | worker | No | App de Strava |
| `STRAVA_CLIENT_SECRET` | worker | **Sí** | App de Strava |
| `CRAFT_API_URL` | worker | **Sí** | URL de la conexión de API de Craft (`https://connect.craft.do/links/…/api/v1`) |
| `CRAFT_API_KEY` | worker | **Sí** | Clave de esa conexión (`pdk_…`), enviada como `Authorization: Bearer` |
| `CRAFT_SPACE_ID` | worker / web | No | Para construir enlaces `craftdocs://` |
| `AI_PROVIDER` | worker | No | `none` \| `claude_cli` \| `anthropic_api` |
| `AI_MAX_JOBS_PER_DAY` | worker | No | Tope de seguridad |
| `CLAUDE_CODE_OAUTH_TOKEN` | worker | **Sí** | Solo si se usa `claude_cli` sin sesión interactiva (verificar el mecanismo vigente) |
| `BACKUP_LOCAL_DIR` | worker | No | Carpeta local de copias (por defecto `~/Library/Application Support/PersonalHub/backups`) |
| `TZ` | worker | No | `Europe/Madrid` |

Los tokens de acceso y refresco de Strava no son variables de entorno: se guardan en `private.strava_tokens` porque rotan.

## 10. Dependencias externas

| Servicio | Para qué | Cuenta nueva |
|---|---|---|
| Supabase | Base de datos, auth, almacenamiento | Sí (gratis) |
| Vercel | Alojamiento del frontend (si se aprueba D1) | Sí (gratis) |
| GitHub | Repositorio privado (si se aprueba D6) | Depende de si ya tienes |
| Strava | App de API propia | No, pero hay que registrar la app |
| Craft | Conexión de API de solo lectura | No |
| Claude | Suscripción existente | No |
| Make | Solo si surge una automatización que no pueda hacer el Mac mini | No previsto |

## 11. Costes recurrentes estimados

| Concepto | Coste mensual |
|---|---|
| Supabase Free | 0 € |
| Vercel Hobby | 0 € |
| GitHub privado | 0 € |
| Strava API | 0 € según el acuerdo vigente (Strava se reserva introducir cargos con aviso) |
| Craft, Claude | Lo que ya pagas; sin incremento |
| Dominio propio (opcional) | ≈ 1 €/mes |
| Electricidad del Mac mini | Ya está encendido 24 h |
| **Total nuevo** | **0 €/mes** |

Umbrales que obligarían a pagar: superar 500 MB de base de datos o 5 GB de tráfico en Supabase (Pro: 25 $/mes), o decidir usar la API de Anthropic. Ninguno es previsible con un usuario.

## 12. Criterios de aceptación de la primera entrega

1. `npm run build` y `npm run lint` terminan sin errores.
2. La app desplegada pide inicio de sesión y no muestra ningún dato sin sesión.
3. Dashboard completo con todas las tarjetas del briefing, con datos de demostración visiblemente etiquetados como «Demo».
4. Al menos un módulo (tareas) lee y escribe datos reales en Supabase.
5. Navegación entre los siete módulos sin recargas completas.
6. Se instala en iPhone desde Safari, abre a pantalla completa con icono propio y respeta las áreas seguras.
7. Usable de 375 px a escritorio; modo claro y oscuro.
8. RLS activo en todas las tablas; comprobado que la clave publicable sin sesión devuelve cero filas.
9. Ningún secreto en el repositorio ni en el bundle del cliente.
10. Los cinco documentos actualizados con lo realmente construido, y la estrategia de Craft documentada.

## Fuentes

- [Next.js 16](https://nextjs.org/blog/next-16) · [Política de soporte de Next.js](https://nextjs.org/support-policy)
- [Claves de API de Supabase](https://supabase.com/docs/guides/api/api-keys) · [Pausa de proyectos gratuitos](https://supabase.com/kb/faqs/platform/free-project-pausing)
- [Límites de la API de Strava](https://developers.strava.com/docs/rate-limits/) · [Acuerdo de la API de Strava](https://www.strava.com/legal/api)
- [API de Craft](https://support.craft.do/en/integrate/api) · [MCP de Craft](https://support.craft.do/en/integrate/mcp) · [Referencia de la API](https://connect.craft.do/api-docs/daily-notes)
- [Claude Code en modo programático](https://code.claude.com/docs/en/headless.md)
- Sobre el crédito del Agent SDK (fuentes secundarias, sin confirmar): [The New Stack](https://thenewstack.io/anthropic-agent-sdk-credits/) · [Startup Fortune](https://startupfortune.com/anthropic-quietly-separates-claude-agent-sdk-usage-from-subscription-limits/) · [Digital Applied](https://www.digitalapplied.com/blog/anthropic-claude-credit-overhaul-june-15-2026)
