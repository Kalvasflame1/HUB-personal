# Personal Hub · Hoja de ruta

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **plan aprobado el 16-11-2026 (D1–D6 con las recomendaciones). Fase 1 en curso.**

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
- [ ] F1-4 Repositorio privado remoto (si D6)
- [x] F1-5 Crear proyecto de Supabase (plan Free, región UE: eu-west-1)
- [x] F1-6 Migración inicial: tablas, índices, vistas y RLS (aplicada el 16-11-2026; 17 tablas con RLS, 17 políticas)
- [ ] F1-7 Datos de demostración (`seed.sql`, `is_demo = true`) (escritos; falta cargarlos: requiere que exista tu usuario)
- [x] F1-8 Tipos de TypeScript generados (`packages/shared/database.types.ts`)
- [x] F1-9 `.env.example` completo
- [x] F1-10 Mover los cinco documentos a `docs/`

**Hecho cuando:** el esquema está aplicado, una consulta sin sesión devuelve cero filas, y `git log` muestra el primer commit sin ningún secreto.

## Fase 2 · Aplicación inicial (primera entrega)

- [ ] F2-1 Proyecto Next.js con TypeScript, Tailwind y ESLint
- [ ] F2-2 Sistema de diseño: colores, tipografía, tarjetas, modo claro/oscuro
- [ ] F2-3 Autenticación con Supabase y protección de rutas
- [ ] F2-4 Estructura de navegación: pestañas inferiores (iPhone), barra lateral (iPad/Mac)
- [ ] F2-5 Dashboard: resumen del día, tareas pendientes, actividad reciente, resumen deportivo, informes y avisos, tarjeta de Craft
- [ ] F2-6 Productividad: tareas y proyectos con lectura y escritura reales
- [ ] F2-7 Running: pantalla con gráficas de Recharts sobre datos de demostración
- [ ] F2-8 Información web: favoritos y fuentes por categoría (alta, edición, borrado)
- [ ] F2-9 Informes, Asistente y Conocimiento: pantallas navegables con datos de demostración y estado «próximamente» donde corresponda
- [ ] F2-10 Conocimiento nivel A: enlaces a carpetas y documentos de Craft y a los artefactos actuales
- [ ] F2-11 PWA: manifiesto, iconos, pantalla de inicio, áreas seguras, service worker mínimo
- [ ] F2-12 Etiqueta «Demo» visible donde haya datos de ejemplo
- [ ] F2-13 Despliegue (D1) y prueba de instalación en iPhone, iPad y Mac
- [ ] F2-14 Revisión de accesibilidad y rendimiento básicos
- [ ] F2-15 Documentación actualizada con lo construido

**Hecho cuando:** se cumplen los diez criterios de aceptación de [ARCHITECTURE.md](ARCHITECTURE.md) §12.

## Fase 3 · Running

- [ ] F3-1 Registro de la app de Strava y revisión del acuerdo de la API
- [ ] F3-2 Script de autorización OAuth y guardado de tokens en `private`
- [ ] F3-3 Renovación automática del token
- [ ] F3-4 Importación histórica por lotes con control de límites
- [ ] F3-5 Sincronización incremental (ejecución manual por ahora)
- [ ] F3-6 Estadísticas: semanal, mensual, comparativas entre periodos
- [ ] F3-7 Marcas personales por distancia
- [ ] F3-8 Carga de entrenamiento y recuperación (aguda frente a crónica)
- [ ] F3-9 Gráficas: volumen, ritmo, frecuencia cardiaca, carga
- [ ] F3-10 Detalle de actividad con parciales
- [ ] F3-11 Sustituir los datos de demostración de Running por los reales

**Hecho cuando:** los kilómetros del mes en curso y de los dos anteriores coinciden con los que muestra Strava, y un entrenamiento nuevo aparece tras ejecutar la sincronización.

## Fase 4 · Automatizaciones

- [ ] F4-1 Worker en Node con planificador y registro en `job_runs`
- [ ] F4-2 Servicio de `launchd` con arranque y reinicio automáticos
- [ ] F4-3 Sincronización de Strava cada 30 min
- [ ] F4-4 Recogida de fuentes web (RSS/Atom) y limpieza periódica
- [ ] F4-5 Informes diario, semanal y mensual con plantilla (sin IA)
- [ ] F4-6 Conexión de solo lectura con Craft e índice de búsqueda (nivel B)
- [ ] F4-7 Pantalla de búsqueda en Conocimiento y enlaces documento–tarea–proyecto
- [ ] F4-8 Historial de automatizaciones y control de errores en Productividad
- [ ] F4-9 Avisos cuando una tarea falla o lleva demasiado sin ejecutarse
- [ ] F4-10 Copia nocturna y prueba de restauración
- [ ] F4-11 Restringir a solo lectura las tablas que únicamente escribe el worker

**Hecho cuando:** tras 72 horas sin intervención, todas las tareas programadas muestran ejecuciones correctas, la búsqueda encuentra un documento de Craft por una palabra de su contenido, y una copia se ha restaurado con éxito.

## Fase 5 · Inteligencia artificial

- [ ] F5-1 **Verificar las condiciones vigentes de uso programado de la suscripción (R1)** y decidir contigo si se sigue
- [ ] F5-2 Asistente sin IA: consultas predefinidas resueltas con SQL (km del mes, evolución del ritmo, tareas pendientes)
- [ ] F5-3 Instalar la CLI de Claude Code en el Mac mini y proveedor `claude_cli`
- [ ] F5-4 Cola `ai_jobs` con Realtime, tope diario y medición de consumo
- [ ] F5-5 Herramientas de solo lectura del asistente sobre Supabase
- [ ] F5-6 Consulta de Craft en vivo desde el asistente (nivel C), con citas
- [ ] F5-7 Redacción con IA de los informes semanal y mensual
- [ ] F5-8 Resúmenes de fuentes web
- [ ] F5-9 Decisión D4: unificar o no con el «Resumen diario» actual
- [ ] F5-10 Opcional: MCP de Supabase para que Cowork consulte los datos del Hub

**Hecho cuando:** las seis preguntas de ejemplo del briefing reciben respuesta correcta con fuentes, el consumo queda dentro del tope acordado, y con `AI_PROVIDER=none` todo lo demás sigue funcionando.

## Fase 6 · Ampliaciones

Sin orden fijado; cada una se planifica aparte.

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
