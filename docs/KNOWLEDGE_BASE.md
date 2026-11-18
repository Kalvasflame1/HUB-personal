# Personal Hub · Base de conocimiento (Craft, Cowork y Claude Code)

Versión 0.1 (propuesta para revisión) · 16 de noviembre de 2026
Estado: **estrategia. La integración no está implementada y no se ha modificado nada en Craft.**

---

## 1. Resumen

- Craft sigue siendo la fuente de conocimiento. Personal Hub guarda **un índice de búsqueda con enlace al original**, no una copia.
- El puente entre Cowork y Claude Code no es la memoria (no se comparte), sino **los datos a los que ambos llegan por conector**: Craft hoy, y Supabase cuando exista.
- Los artefactos actuales (Resumen diario, Coach Personal…) se **enlazan** desde el Hub. No sirven como fuente de datos.
- La integración se hace en tres niveles, cada uno útil por sí solo, y ninguno escribe en Craft sin tu permiso.

## 2. Qué hay hoy en Craft

Inventario leído el 16 de noviembre de 2026 con el conector de Craft de tu cuenta, en solo lectura. Solo he listado carpetas, títulos y colecciones; no he abierto el contenido de los documentos.

Espacio: **HOME MARCOS** · zona horaria Europe/Madrid.

| Carpeta | Documentos | Naturaleza |
|---|---|---|
| NOTICIAS / 📰 Informe Diario | 145 | Informes generados automáticamente |
| Histórico Resúmenes / Semanal | 27 | Resúmenes generados |
| Histórico Resúmenes / Mensual | 6 | Resúmenes generados |
| Histórico Resúmenes (raíz) | 1 | «🗂️ Seguimiento activo» |
| PERSONAL | 4 | Notas de trabajo (compra, apuntes, buzón de notas de voz) |
| VIAJES (2 subcarpetas) | 4 | Planificación |
| VEHÍCULOS (3 subcarpetas) | 5 | Fichas |
| NOTION, How to use Craft | 4 | Importados / plantillas |
| Sin clasificar | 11 | Mezcla: plantillas de ejemplo, «Coach Running · Cola de órdenes», «Black Friday 2026»… |

Colecciones (tablas): **Seguimiento** (36 elementos), **Seguimiento — Archivo** (52), **Operaciones** (15), más tres pequeñas de ejemplo o listas.

Tres conclusiones que condicionan el diseño:

1. **Es pequeño**: unos 210 documentos. Indexarlo entero cuesta pocas decenas de peticiones y cabe sobradamente en el plan gratuito.
2. **El 85 % son informes generados** por tus automatizaciones actuales. Craft funciona en buena parte como archivo de salida, no solo como base de conocimiento escrita a mano. Eso encaja con el módulo de Informes del Hub y obliga a decidir quién genera qué (decisión D4 en ARCHITECTURE.md).
3. **Ya hay datos estructurados** (colecciones «Seguimiento» y «Operaciones») que se solapan con el módulo de tareas. De ahí la decisión D3.

## 3. Qué comparten y qué no Cowork y Claude Code

| Elemento | ¿Compartido? | Detalle |
|---|---|---|
| Conectores de la cuenta (Craft, Strava, Gmail…) | **Sí, en la app de escritorio** | Comprobado: esta sesión de Claude Code ha leído Craft con el mismo conector |
| Conectores en `claude -p` desde el Mac mini (sin app) | **No garantizado** | La vía fiable es declarar el MCP o la API de Craft de forma explícita en la configuración del worker |
| Memoria de Cowork | **No** | Cada producto guarda la suya. Claude Code usa una carpeta de memoria por proyecto, hoy vacía |
| Historial de conversaciones y sesiones | **No** | Sin acceso cruzado |
| Artefactos publicados | **Sí, legibles** | Los 8 artefactos de tu cuenta se listan y se pueden leer desde aquí. Son páginas, no APIs |
| Tareas programadas de Cowork | **No visibles desde aquí** | En la pestaña Code no hay ninguna. Requieren la app abierta |
| Archivos locales del Mac | **Sí** si ambos apuntan a la misma carpeta | Útil para compartir un `CLAUDE.md` o exportaciones |

Lo que esto significa en la práctica:

- **No se puede «heredar» la memoria de Cowork.** Lo que Cowork sabe y deba saber el Hub tiene que estar escrito en un sitio común. Recomendación: un documento de Craft «Contexto para asistentes» mantenido por ti (o por Cowork con tu permiso) y un `CLAUDE.md` en el repositorio para el contexto técnico.
- **El contexto «indexado» de Cowork es, en realidad, Craft consultado por conector.** No existe un índice exportable aparte. El Hub puede reproducir el mismo acceso con su propia conexión.
- **Supabase puede ser el segundo puente.** Si se conecta el MCP de Supabase a tu cuenta, Cowork podrá consultar tareas y entrenamientos del Hub igual que hoy consulta Craft. Opcional, Fase 5.

## 4. Vías de acceso a Craft

| Vía | Qué ofrece | Uso en el Hub |
|---|---|---|
| **API REST de Craft** (conexión creada en Craft → Connections / Imagine) | Bloques, búsqueda, tareas, colecciones, notas diarias. Permisos por conexión. Límites: 50 peticiones/10 s por IP, 100/min por espacio, 20.000 bloques/min. Sin webhooks | **Vía principal del worker** para construir el índice |
| **MCP de Craft** (misma sección de Craft) | Las mismas capacidades expuestas como herramientas para un modelo; acceso a todo el espacio con búsqueda por carpeta, etiqueta y fecha | **Vía del asistente** cuando necesite leer un documento entero en vivo |
| **Enlaces profundos** `craftdocs://open?spaceId=…&blockId=…` | Abren el documento original en la app de Craft en iPhone, iPad y Mac | **Siempre**: cada resultado del Hub enlaza al original |
| Exportación manual (Markdown) | Copia puntual | Solo como copia de seguridad; no para el flujo normal |
| Make | Módulos de Craft | No necesario |

Pendiente de verificar al crear la conexión: qué plan de Craft incluye la API, si la conexión admite modo de solo lectura a nivel de espacio completo, y el formato exacto de la credencial.

## 5. Estrategia en tres niveles

### Nivel A · Enlaces (primera entrega, Fase 2)
- Sección «Conocimiento» con accesos directos a las carpetas y documentos clave, y tarjeta en el dashboard.
- Datos: lista curada a mano en `kb_documents` (título, carpeta, `external_id`). Sin sincronización.
- Riesgo nulo; no requiere credenciales de Craft.

### Nivel B · Índice de búsqueda (Fase 4)
- El worker del Mac mini recorre Craft cada hora con una conexión de **solo lectura**.
- Por documento guarda: identificador, título, ruta de carpeta, tipo, fecha de modificación, extracto y texto plano para búsqueda. **El original no se toca y sigue siendo la referencia.**
- Sincronización incremental por fecha de modificación y `content_hash`; los documentos borrados en Craft se marcan con `deleted_at`.
- Búsqueda de texto completo en español en Postgres. La pantalla muestra título, extracto resaltado y el botón «Abrir en Craft».
- Relación con tareas y proyectos mediante `kb_links`, creada a mano desde la interfaz.
- Coste: primera indexación de ~210 documentos en pocos minutos; después, unas pocas peticiones por hora.

Qué se indexa por defecto:

| Contenido | ¿Se indexa? | Motivo |
|---|---|---|
| Notas escritas a mano (PERSONAL, VIAJES, VEHÍCULOS, sin clasificar) | Sí, texto completo | Es el conocimiento propiamente dicho |
| Resúmenes semanales y mensuales | Sí, texto completo | Alto valor, poco volumen |
| Informes diarios de noticias (145) | Solo título, fecha y extracto | Volumen alto y valor decreciente; se abre el original si hace falta |
| Colecciones «Seguimiento» y «Operaciones» | Solo referencia y recuento | Son datos vivos; se consultan en Craft |
| Plantillas de ejemplo de Craft | No | Ruido |

Tú decides la lista final de carpetas incluidas y excluidas antes de activar la sincronización.

### Nivel C · Consulta contextual con el asistente (Fase 5)
- El asistente busca primero en el índice (rápido, sin IA) y, si necesita detalle, lee el documento en vivo con el MCP de Craft.
- Las respuestas citan sus fuentes con enlace al original.
- El asistente puede **proponer** relaciones entre tareas y documentos (`kb_links.created_by = 'assistant'`); tú las confirmas.
- Depende del riesgo R1 (uso programado de la suscripción). Sin IA, los niveles A y B siguen funcionando.

### Incorporar información nueva
- El Hub **no escribe en Craft** en las primeras fases.
- Cuando lo autorices: una conexión de escritura limitada a **una carpeta concreta** (por ejemplo «Personal Hub») donde el Hub publica informes o notas. Nunca edita ni mueve documentos existentes.
- Los informes generados por el Hub viven en Supabase (`reports`); publicarlos además en Craft es opcional y se registra en `reports.craft_url`.

## 6. Artefactos actuales

| Artefacto | Tratamiento propuesto |
|---|---|
| Resumen diario / Panel del Resumen Diario | Enlace desde el dashboard. Posible unificación en la Fase 5 (D4) |
| Coach Personal · Marcos / Coach Chat Marcos | Enlace desde el módulo Running. El Hub aporta el histórico y las estadísticas; el coach conserva la conversación |
| Taller del Resumen Diario, documentos de análisis | Enlace en «Conocimiento» |
| Simulador de ahorro familiar | Enlace; candidato para el futuro módulo de finanzas |

Un artefacto es una página publicada: no ofrece una API estable de datos. Por eso el Hub lee de las mismas fuentes que ellos (Craft, Strava) en lugar de leer de los artefactos.

## 7. Principio de no duplicación

| Dato | Fuente única | El otro sistema… |
|---|---|---|
| Notas, documentos, fichas | Craft | …guarda índice y enlace |
| Entrenamientos | Strava | …guarda copia para estadísticas, regenerable |
| Tareas del Hub | Supabase (si se aprueba D3) | …Craft no las recibe |
| Seguimiento / Operaciones | Craft | …el Hub las muestra o enlaza, no las edita |
| Informes del Hub | Supabase | …Craft recibe copia solo si lo autorizas |

## 8. Seguridad y permisos de Craft

- Conexión de solo lectura para el índice; una conexión distinta y acotada para escribir, si llega el caso.
- La credencial vive solo en el Mac mini (Llavero o `.env` con permisos `600`). Nunca en el frontend ni en el repositorio.
- El texto indexado queda protegido por RLS igual que el resto de datos.
- Revocar el acceso es borrar la conexión en Craft; el Hub sigue funcionando con el índice existente.
- Ninguna migración masiva, reorganización de carpetas ni borrado sin tu autorización expresa.

## 9. Decisiones sobre el índice (respondidas el 18-11-2026)

1. **Carpetas excluidas:** las plantillas de ejemplo de Craft (las de «Sin clasificar» como *Q3 Planning Meeting*, *Lumina…*, *Weekly Review Guide*, y la carpeta «How to use Craft») y la carpeta NOTION. **PERSONAL se indexa entera**, porque en ella viven la memoria del resumen diario y sus apuntes (punto 4).
2. **Informes diarios de noticias:** solo título, fecha y extracto. Para leer uno entero, se abre en Craft.
3. **Colecciones «Seguimiento» y «Operaciones»:** siguen en Craft. El Hub las enlaza y muestra su recuento; no las absorbe.
4. **Contexto para asistentes:** no hace falta crear un documento nuevo. Ya existe la memoria que mantiene el resumen diario de Cowork:
   - «🧠 Memoria e Información Importante» (`f1422cc7-82fa-9911-d31b-637c6f868433`), con los hechos duraderos;
   - «✍️ Apuntes pendientes», la Bandeja (`096acea6-3228-b48c-ce24-1bdaed2a9f35`), con la captura rápida.

   Las dos están en PERSONAL. Cowork las actualiza cada mañana a partir del «📝 Cierre del día» del Informe Diario anterior y de la Bandeja; esos informes, a su vez, se nutren del calendario, el correo y las fichas de «Seguimiento». El Hub las indexa en **solo lectura**: **nunca las edita**, porque las escribe Cowork.
   - Detalle para el indexador: el bloque raíz de la Memoria no contiene el título, sino el texto «Última actualización: …». El título visible se toma del primer encabezado, con un nombre fijo como respaldo.
5. **Carpeta «Personal Hub» con escritura:** no se ha preguntado aún. No hace falta hasta que el Hub quiera publicar en Craft.

## Fuentes

- [API de Craft](https://support.craft.do/en/integrate/api) · [MCP de Craft](https://support.craft.do/en/integrate/mcp) · [Referencia y límites](https://connect.craft.do/api-docs/daily-notes)
