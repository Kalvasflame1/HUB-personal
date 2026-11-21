# Personal Hub · Hoja de ruta

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **plan aprobado el 16-11-2026 (D1–D6 con las recomendaciones). Fase 1 cerrada el 16-11-2026. Fase 2 cerrada el 17-11-2026: desplegada en Vercel (https://hub-personal-tau.vercel.app) e instalada como PWA en el iPhone. Fase 3 cerrada el 18-11-2026. Fase 4 cerrada el 21-11-2026 tras la prueba de 72 horas sin intervención. Fase 5 en curso.**

Las fases siguen las del briefing. Cada tarea tiene identificador, y cada fase termina con un criterio verificable y una parada para tu revisión. No doy fechas: cada fase se mide en sesiones de trabajo con Claude Code, y el ritmo lo marcas tú.

---

## Antes de empezar: lo que necesito de ti

1. Aprobación o cambios sobre las decisiones **D1–D6** de [ARCHITECTURE.md](ARCHITECTURE.md) §5.
2. Respuesta a las preguntas de [KNOWLEDGE_BASE.md](KNOWLEDGE_BASE.md) §9 (pueden esperar a la Fase 4).
3. Instalar Node.js y crear la cuenta de Supabase ([SETUP.md](SETUP.md) §1–2).

## Resumen

| Fase | Resultado | Tamaño | Depende de |
|---|---|---|---|
| 0 | Plan aprobado | — | Tu revisión |
| 1 | Repositorio, Supabase y esquema listos | Pequeña | Fase 0, Node, cuenta Supabase |
| 2 | **Primera entrega**: PWA con dashboard, navegación y tareas reales | Grande | Fase 1 |
| 3 | Running con datos reales de Strava | Media | Fase 2, app de Strava |
| 4 | Mac mini automatizado + índice de Craft | Media | Fase 3, conexión de Craft |
| 5 | Asistente e informes con IA | Media | Fase 4, verificación R1 |
| 6 | Ampliaciones | Abierta | A demanda |

La primera entrega del briefing (§9) corresponde al cierre de la Fase 2.

---

## Fase 0 · Plan (actual)

- [x] F0-1 Análisis de viabilidad, riesgos y versiones
- [x] F0-2 Inventario del entorno local y de Craft (solo lectura)
- [x] F0-3 Redacción de los cinco documentos
- [x] F0-4 **Tu revisión y aprobación**

## Fase 1 · Arquitectura y cimientos

- [x] F1-1 Instalar Node.js LTS y fijar versión en `.nvmrc` (24.22.3 en `~/.local/opt`, sin sudo)
- [x] F1-2 `git init`, `.gitignore`, estructura de carpetas y workspaces
- [x] F1-3 `CLAUDE.md` con convenciones del proyecto
- [x] F1-4 Repositorio privado remoto (si D6): `Kalvasflame1/HUB-personal`, por SSH; subido el 17-11-2026
- [x] F1-5 Crear proyecto de Supabase (plan Free, región UE: eu-west-1)
- [x] F1-6 Migración inicial: tablas, índices, vistas y RLS (aplicada el 16-11-2026; 17 tablas con RLS, 17 políticas)
- [x] F1-7 Datos de demostración (`seed.sql`, `is_demo = true`) (cargados el 16-11-2026: 3 proyectos, 9 tareas, 44 entrenamientos, 3 informes)
- [x] F1-8 Tipos de TypeScript generados (`packages/shared/database.types.ts`)
- [x] F1-9 `.env.example` completo
- [x] F1-10 Mover los cinco documentos a `docs/`

**Hecho cuando:** el esquema está aplicado, una consulta sin sesión devuelve cero filas, y `git log` muestra el primer commit sin ningún secreto.

**Verificado el 16-11-2026:** con datos cargados, la clave publicable sin sesión devuelve cero filas en todas las tablas y vistas y no puede insertar; registros nuevos desactivados; un único usuario confirmado.

## Fase 2 · Aplicación inicial (primera entrega)

- [x] F2-1 Proyecto Next.js con TypeScript, Tailwind y ESLint
- [x] F2-2 Sistema de diseño: colores, tipografía, tarjetas, modo claro/oscuro
- [x] F2-3 Autenticación con Supabase y protección de rutas
- [x] F2-4 Estructura de navegación: pestañas inferiores (iPhone), barra lateral (iPad/Mac)
- [x] F2-5 Dashboard: resumen del día, tareas pendientes, actividad reciente, resumen deportivo, informes y avisos, tarjeta de Craft
- [x] F2-6 Productividad: tareas y proyectos con lectura y escritura reales
- [x] F2-7 Running: pantalla con gráficas de Recharts sobre datos de demostración
- [x] F2-8 Información web: favoritos y fuentes por categoría (alta, edición, borrado)
- [x] F2-9 Informes, Asistente y Conocimiento: pantallas navegables con datos de demostración y estado «próximamente» donde corresponda
- [x] F2-10 Conocimiento nivel A: enlaces a carpetas y documentos de Craft y a los artefactos actuales
- [x] F2-11 PWA: manifiesto, iconos, pantalla de inicio, áreas seguras, service worker mínimo
- [x] F2-12 Etiqueta «Demo» visible donde haya datos de ejemplo
- [x] F2-13 Despliegue (D1) y prueba de instalación en iPhone, iPad y Mac. Desplegada el 17-11-2026 en `https://hub-personal-tau.vercel.app` (Vercel Hobby, raíz `apps/web`, despliegue automático desde `main`); instalada y con sesión iniciada en el iPhone. iPad y Mac siguen el mismo proceso (Safari)
- [ ] F2-14 Revisión de accesibilidad y rendimiento básicos (revisado a mano en escritorio y a 375 px: sin desbordes ni errores de consola; sin auditoría formal)
- [x] F2-15 Documentación actualizada con lo construido

**Hecho cuando:** se cumplen los diez criterios de aceptación de [ARCHITECTURE.md](ARCHITECTURE.md) §12.

**Verificado en local el 17-11-2026:** `build` y `lint` sin errores; redirección a la entrada sin sesión; las siete pantallas cargan con datos de demostración etiquetados; alta, completado y borrado de una tarea contra Supabase; gráficas de Running; sin desborde horizontal a 375 px. **Sin verificar:** instalación como PWA en iPhone, iPad y Mac (requiere el despliegue con HTTPS), y el alta de fuentes web desde la interfaz (mismo mecanismo que las tareas, no probado).

## Fase 3 · Running

- [x] F3-1 Registro de la app de Strava y revisión del acuerdo de la API (se reutilizó la aplicación que ya existía en la cuenta; Strava solo permite una)
- [x] F3-2 Script de autorización OAuth y guardado de tokens en `private` (`npm run strava:auth --workspace apps/worker`; permiso `read,activity:read_all`, 17-11-2026)
- [x] F3-3 Renovación automática del token (comprobada: el worker lo renovó solo; última renovación el 18-11-2026 a las 18:12)
- [x] F3-4 Importación histórica por lotes con control de límites (1.476 actividades importadas el 17-11-2026; detalles de todas las carreras completados el 18-11-2026)
- [x] F3-5 Sincronización incremental (ejecución manual por ahora: `npm run strava:sync --workspace apps/worker`)
- [x] F3-6 Estadísticas: semanal, mensual (12 meses), comparativa del mes en curso con los mismos días del anterior
- [x] F3-7 Marcas personales por distancia (desde `strava_best_efforts`; mejorarán al completarse los detalles antiguos)
- [x] F3-8 Carga de entrenamiento y recuperación (aguda frente a crónica, con el esfuerzo relativo de Strava)
- [x] F3-9 Gráficas: volumen semanal y mensual, ritmo, frecuencia cardiaca, carga
- [x] F3-10 Detalle de actividad con parciales y mejores esfuerzos (`/running/[id]`)
- [x] F3-11 Sustituir los datos de demostración de Running por los reales (borrados con autorización el 17-11-2026)

**Hecho cuando:** los kilómetros del mes en curso y de los dos anteriores coinciden con los que muestra Strava, y un entrenamiento nuevo aparece tras ejecutar la sincronización.

Comprobado el 17-11-2026: septiembre 43,80 km (7), octubre 78,28 km (13) y noviembre 61,11 km (7), idénticos a Strava. El mismo día, la «Carrera de noche» de 6,58 km (20:10) entró sola en la sincronización programada de las 20:14, con sus 3 vueltas y 6 mejores esfuerzos.

## Fase 4 · Automatizaciones

- [x] F4-1 Worker en Node con planificador y registro en `job_runs` (`apps/worker/src/index.ts`; probado a mano el 17-11-2026)
- [x] F4-2 Servicio de `launchd` con arranque y reinicio automáticos (instalado con autorización el 17-11-2026: `com.personalhub.worker`, registro en `~/Library/Logs/hub-worker.log`)
- [x] F4-3 Sincronización de Strava cada 30 min (hasta 90 detalles por ejecución)
- [x] F4-4 Recogida de fuentes web (RSS/Atom) y limpieza periódica (recogida con detección automática del feed; limpieza semanal autorizada y activa desde el 18-11-2026; botones «Guardar» y «Leída» en cada lectura, y «Marcar como leído» en los avisos de Inicio)
- [x] F4-5 Informes diario, semanal y mensual con plantilla (sin IA)
- [x] F4-6 Conexión de solo lectura con Craft e índice de búsqueda (nivel B) (18-11-2026: conexión de API propia, solo GET; 220 documentos indexados en la primera pasada; revisión incremental cada hora)
- [x] F4-7 Pantalla de búsqueda en Conocimiento y enlaces documento–tarea–proyecto (18-11-2026: se vincula desde cada resultado de búsqueda; Productividad muestra los documentos bajo cada tarea y proyecto)
- [x] F4-8 Historial de automatizaciones y control de errores en Productividad (último estado por tarea y errores de 7 días)
- [x] F4-9 Avisos cuando una tarea falla o lleva demasiado sin ejecutarse
- [x] F4-10 Copia nocturna y prueba de restauración (18-11-2026: copia local diaria a las 03:30, comprobada en cada ejecución con una restauración a tablas temporales; sin iCloud Drive por decisión del usuario)
- [x] F4-11 Restringir a solo lectura las tablas que únicamente escribe el worker (18-11-2026; detalle en DATABASE §4)

**Hecho cuando:** tras 72 horas sin intervención, todas las tareas programadas muestran ejecuciones correctas, la búsqueda encuentra un documento de Craft por una palabra de su contenido, y una copia se ha restaurado con éxito.

**Cerrada el 21-11-2026.** Prueba del 18-11 a las 18:34:36 al 21-11 a las 18:35, con el mismo proceso del worker durante todo el periodo, sin reinicios ni huecos en el vigilante (72 ejecuciones). `strava_sync` 144 correctas, `craft_index` 70 correctas y 2 errores puntuales de Craft (502 de Cloudflare, recuperados en la hora siguiente), `report_daily` 3, `backup` 5 (copias del 18 al 21, cada una restaurada a tablas temporales al hacerse), `watchdog` 72 y `web_fetch` 36 omitidas por no haber fuentes desde que se borraron las de demostración. La búsqueda de «renault» encuentra los informes diarios de Craft. Al terminar se programaron `craft_extras`, `craft_changes` y `podcast`.

## Fase 5 · Inteligencia artificial

- [x] F5-1 **Verificar las condiciones vigentes de uso programado de la suscripción (R1)** y decidir contigo si se sigue. Verificación hecha el 18-11-2026. **Decisión del usuario (18-11-2026): opción A con tope diario de trabajos** (plan Pro, que no tiene créditos de API):
  - Fuentes: [Agent SDK con tu plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) (aviso del 07-10-2026) y [Créditos mensuales de API](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans).
  - **Opción A · sesión del plan:** `claude -p` con tu suscripción iniciada. Sin coste añadido, pero comparte límites con Claude Code y Cowork. Vale con Pro, Max o Ultra.
  - **Opción B · créditos mensuales de API (solo Max/Ultra):** `claude -p` con una clave de una organización de Console vinculada (100 $/mes en Max y 200 $/mes en Ultra). No toca tus límites; al agotarse, se para y no se cobra, salvo que actives la recarga automática. Requiere vincular la organización (acción tuya en claude.ai → Ajustes → Facturación) y guardar la clave en `apps/worker/.env`. Los créditos que no se usan caducan cada mes.
  - En ambas: tope diario de trabajos en el worker y `AI_PROVIDER=none` como interruptor.
- [x] F5-11 Configuración del asistente (acordada el 18-11-2026; pantalla y tabla hechas el 21-11-2026, se aplicará cuando la IA esté activa en F5-3/F5-4): pantalla Asistente → Configuración y tabla `assistant_settings`, editable desde la web y con historial de versiones.
  - Se configura: instrucciones generales en texto libre, estilo de respuesta, fuentes activables (tareas, running, informes, web, Craft; posibilidad de excluir PERSONAL), modelo para preguntas sencillas y para informes, tope diario con contador de uso, y atajos de preguntas frecuentes.
  - El contexto personal se lee de «🧠 Memoria e Información Importante» de Craft, ya indexada; no se duplica.
  - Las instrucciones no pueden cambiar los permisos (herramientas de solo lectura fijadas por el worker), ni el origen de las cifras (SQL), ni las reglas del proyecto.
- [x] F5-2 Asistente sin IA (21-11-2026): pantalla Asistente con campo de pregunta y diez preguntas sugeridas, reconocidas por palabras clave (`lib/quick-answers.ts`) y respondidas con consultas: km del mes (frente al mismo día del mes anterior) y de la semana, evolución del ritmo por meses, forma y preparación, último entrenamiento, marcas, tareas pendientes, asuntos en seguimiento, eventos de 7 días y «busca …» en Craft. Cada respuesta indica su fuente. Lo que no reconoce ofrece buscarlo en Craft.
- [x] F5-3 Instalar la CLI de Claude Code en el Mac mini y proveedor `claude_cli` (21-11-2026: CLI ya instalada con la sesión del plan Pro y sin `ANTHROPIC_API_KEY`; `src/ai/claude.ts` la lanza sin herramientas, sin MCP y sin ajustes del usuario; probado desde terminal y desde launchd)
- [x] F5-4 Cola `ai_jobs` con aviso inmediato, tope diario y medición de consumo (21-11-2026: la web solo inserta preguntas y lee; `pg_notify` + `LISTEN` en el worker en lugar de Realtime, con revisión cada minuto; tope diario de la configuración; tokens, modelo y duración en `usage`. Botón «Preguntar a Claude» en el Asistente, con respuesta y fuentes citadas; primera prueba desde la app: 5,7 s con Haiku)
- [x] F5-5 Herramientas de solo lectura del asistente sobre Supabase (21-11-2026, resuelto sin dar herramientas a Claude: el worker reúne con SQL tareas, seguimiento, eventos, running, forma, informes, lecturas web, documentos de Craft que coinciden con la pregunta y la Memoria, según las fuentes activadas, en bloques numerados que la respuesta cita)
- [x] F5-6 Consulta de Craft en vivo desde el asistente (nivel C), con citas (21-11-2026: el worker busca en el índice y lee enteros, en el momento, los dos documentos propios más relevantes con la conexión de solo lectura (`GET /blocks`, markdown); las tablas de Craft llegan como «- fila · campo: valor». Más de 12.000 caracteres: principio + fragmentos que coinciden; si Craft falla, texto del índice. Noticias y resúmenes, solo fragmentos. Claude sigue sin herramientas. Probado con el historial del Koleos: 13 operaciones y sumas correctas, en 9,8 s)
- [x] F5-7 Redacción con IA de los informes semanal y mensual (21-11-2026: comentario de Claude con el modelo «para informes» de la configuración, en `reports.ai_summary`, sobre las cifras de la plantilla, que se siguen guardando igual; cuenta para el tope diario y queda en `ai_jobs` con `kind = 'report'`. Sin IA, con el tope alcanzado o si Claude falla, el informe sale sin comentario. En Informes, el último semanal y el último mensual van arriba con su comentario y las cifras debajo. Probado con la semana del 9-11 (Sonnet, 8,5 s) y octubre (9,8 s))
- [ ] F5-8 Resúmenes de fuentes web
- [ ] F5-9 Decisión D4: unificar o no con el «Resumen diario» actual
- [ ] F5-10 Opcional: MCP de Supabase para que Cowork consulte los datos del Hub

**Hecho cuando:** las seis preguntas de ejemplo del briefing reciben respuesta correcta con fuentes, el consumo queda dentro del tope acordado, y con `AI_PROVIDER=none` todo lo demás sigue funcionando.

**Prueba del 21-11-2026 (criterio cumplido; quedan F5-6 a F5-10):**
- Con consultas (sin IA): «¿Cuántos kilómetros he corrido este mes?», «¿Cómo ha evolucionado mi ritmo?» y «¿Qué tareas tengo pendientes?», cada una con su fuente.
- Con Claude (Haiku): «Prepara mi resumen semanal» (26 s, ~5.500 tokens de salida; tareas, running por semanas, finanzas, asuntos y la semana próxima), «Busca en mi documentación de Craft la información relacionada con el Koleos» (9 s, cita la ficha del coche y la Memoria) y «Relaciona mis tareas actuales con documentación que ya tengo almacenada» (9 s; bloque de coincidencias por título con al menos dos palabras en común, y Claude descarta los falsos positivos). Todas con fuentes.
- Reparto: lo que pide redactar, relacionar o razonar («prepara», «resume», «relaciona», «me conviene»…) ya no lo atrapa una consulta, va a Claude.
- Consumo del día: 5 preguntas a Claude de un tope de 20; 11,8 s de media.
- Con `AI_PROVIDER=none`: la pregunta se cierra con «La IA está desactivada en el Mac mini…» y las preguntas rápidas siguen funcionando.

## Fase 6 · Ampliaciones

Sin orden fijado; cada una se planifica aparte.

- **Podcast diario en la app** (empezado el 18-11-2026)
  - [x] Tabla `podcast_episodes`, bucket privado `podcast` y reproductor en Inicio: reproducir/pausa, −15 s, +30 s, barra, velocidad, posición recordada y controles en la pantalla de bloqueo.
  - [x] Puente desde iCloud resuelto el 18-11-2026: el atajo del Mac «HUB - Podcast» lee `podcast_hoy.txt`, crea el audio con la voz de Siri y lo devuelve. Probado con `shortcuts run "HUB - Podcast" --output-path …` desde un trabajo de launchd: 46 s, 6 min 41 s de audio, y no toca los archivos de iCloud. El worker no entra en iCloud: se lo pide a Atajos.
  - [x] **Resuelto el 21-11-2026:** el atajo se colgaba porque Node lo lanzaba con la entrada estándar abierta y `shortcuts run` se quedaba esperándola (desde `/bin/sh` terminaba en 43 s). `podcast.ts` lo lanza ahora con la entrada cerrada; probado desde launchd de principio a fin: episodio del 21-11 subido (6 min 19 s, 3 MB) y reproducido en la app. Se programará cada 10 minutos entre las 05:00 y las 13:00, para que esté listo antes del viaje al trabajo de las 05:30 (el guion llega hacia las 05:00).
  - [x] (Historial) **Aparcado el 21-11-2026:** `apps/worker/src/podcast.ts` está escrito (atajo → `afconvert` → bucket → `podcast_episodes`, 7 episodios, reintento si el audio es igual al del día anterior, ventana 06:30–13:00, adelantada después a 05:00), pero no está programado. El atajo funciona a mano y desde el terminal (43 s), y se cuelga 5 minutos cada vez que lo lanza launchd (tres intentos), aunque el 18 sí funcionó así. Pendiente averiguar qué le falta en segundo plano. Botón «Escuchar con ElevenReader» en Inicio, solo en iPhone: abre el atajo del iPhone «Elevenreader».
  - [x] Tarea del worker programada el 21-11-2026: cada 10 minutos entre las 05:00 y las 13:00 hasta que haya guion nuevo. Plan original: lanzar el atajo, convertir a AAC con `afconvert` (77 MB → ~3,4 MB), subir al bucket y conservar 7 episodios. Si el audio es idéntico al del día anterior (Cowork aún no ha dejado guion nuevo), reintentar más tarde. Clave `SUPABASE_SECRET_KEY` ya configurada y comprobada (18-11-2026).
  - [ ] Prueba de voces: ElevenLabs (cuenta propia, 10.000 créditos al mes), una voz premium de macOS y Piper; decisión del usuario.
- **Eventos y seguimiento desde Craft** (acordado el 19-11-2026, para el sábado 21-11 tras cerrar la prueba de 72 h)
  - [x] Próximos eventos: el indexador de Craft lee la sección «📅 Próximos eventos — 30 días vista» del último «📰 Informe Diario» y guarda cada evento con su fecha (lectura tolerante: si el formato cambia, se muestran las líneas tal cual). Tarjeta en Inicio (7 días) y lista completa en Productividad (30 días).
  - [x] Hecho el 21-11-2026 en web y base de datos (`craft_events`, `craft_tracking`), con el lector `apps/worker/src/craft/extras.ts` probado a mano (17 eventos, 35 asuntos activos de 44). Programado el 21-11-2026: `craft_extras` cada hora.
  - [x] Edición del seguimiento desde la app (autorizada el 21-11-2026, única escritura en Craft): lápiz y «hecho» en cada asunto; la web deja el cambio en `craft_tracking_changes` y el worker lo aplica con la conexión de escritura (`CRAFT_WRITE_API_*`, limitada a «Seguimiento activo») tras comprobar que no cambió en Craft. Probado sin efecto y con conflicto simulado; Craft quedó idéntico. La API no permite vaciar campos. Programado el 21-11-2026: `craft_changes` en cada vuelta del planificador (cada minuto) cuando hay cambios en cola.
  - [x] Seguimiento: la colección «Seguimiento» de «🗂️ Seguimiento activo» (estados 🔴 Abierto, 🟡 En curso y 🔵 Seguimiento; fuera Hecho y Caducado) aparece en la lista de tareas de Productividad como bloque «En seguimiento (Craft)», con estado, fecha si la hay y notas desplegables. Solo lectura, con enlace a Craft.
- [x] Forma, fatiga y frescura (19-11-2026): CTL 42 días, ATL 7 días y TSB con el esfuerzo relativo de Strava de todas las actividades (`lib/fitness.ts`), en tres paneles enlazados en Running. Valores actuales en el resumen y barra de «Preparación de hoy» (lineal desde la frescura: −30 → 0 %, +15 → 100 %; verde ≥ 60 %, amarilla 35–60 %, roja < 35 %) también en Inicio.
- [x] Datos de demostración borrados el 19-11-2026 con copia previa; «Personal Hub» se conserva como proyecto real.
- Widgets del iPhone y Apple Watch: ver la nota de la conversación del 18-11-2026 (Scriptable o Atajos sin coste; app nativa con WidgetKit/watchOS más adelante).

- Apple Health (no tiene API web: exige una app nativa mínima o un Atajo que exporte datos)
- Finanzas personales
- Calendario
- Más fuentes web
- Notificaciones push en la PWA
- Escritura acotada en Craft (carpeta «Personal Hub»)
- Búsqueda semántica con embeddings locales

---

## Dependencias entre fases

```
F0 ─► F1 ─► F2 ─┬─► F3 ─► F4 ─► F5
                └─────────────────► F6 (a demanda)
```

- La Fase 3 puede empezar sin el worker: la sincronización se ejecuta a mano.
- El índice de Craft (F4-6) no depende de Strava; puede adelantarse si te interesa más.
- La Fase 5 es la única que depende de una condición externa incierta (R1).

## Puntos de control

Al cerrar cada fase: demostración, lista de lo que se ha hecho y lo que no, actualización de documentos, y tu visto bueno antes de continuar. Ninguna fase crea cuentas, contrata servicios ni hace cambios destructivos sin que lo autorices en ese momento.
