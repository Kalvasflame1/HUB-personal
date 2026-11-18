/**
 * Copia de seguridad de los datos del hub.
 *
 * Vuelca todas las tablas de `public` a un único archivo JSON comprimido (hub-AAAA-MM-DD.json.gz)
 * en una carpeta local: BACKUP_LOCAL_DIR, por defecto ~/Library/Application Support/PersonalHub/backups.
 * No se usa iCloud Drive: macOS no deja entrar en él a un proceso de launchd sin «Acceso total al disco».
 * El esquema `private` (tokens de terceros) no se copia: los secretos no salen de Supabase
 * y tras una restauración basta con volver a autorizar Strava.
 *
 * Después de escribir, la copia se comprueba: se vuelve a leer del disco y cada tabla se carga
 * en una tabla temporal con la estructura actual dentro de una transacción que se deshace.
 * Así se sabe que el archivo es legible y que se podría restaurar, sin tocar los datos reales.
 *
 *   npm run backup --workspace apps/worker             copia y comprobación
 *   npm run backup --workspace apps/worker -- --verify=RUTA   solo comprueba un archivo
 *
 * Se conservan las KEEP copias más recientes; las más antiguas de esta carpeta se borran.
 */
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type pg from "pg";
import { USER_ID } from "./db.ts";
import { runJob, type JobResult } from "./jobs.ts";

const KEEP = 30;
const NAME = /^hub-\d{4}-\d{2}-\d{2}\.json\.gz$/;

type Dump = {
  format: 1;
  created_at: string;
  migration: string | null;
  tables: Record<string, unknown[]>;
};

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function publicTables(db: pg.Client) {
  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((r) => r.table_name);
}

async function dump(db: pg.Client): Promise<Dump> {
  const uid = USER_ID();
  const tables: Record<string, unknown[]> = {};
  for (const t of await publicTables(db)) {
    const { rows } = await db.query<{ data: unknown[] }>(
      `select coalesce(json_agg(x), '[]'::json) as data from public.${ident(t)} x where x.user_id = $1`,
      [uid],
    );
    tables[t] = rows[0].data;
  }
  const mig = await db
    .query<{ v: string }>("select max(version) v from supabase_migrations.schema_migrations")
    .then((r) => r.rows[0]?.v ?? null)
    .catch(() => null);
  return { format: 1, created_at: new Date().toISOString(), migration: mig, tables };
}

/**
 * Carga cada tabla del archivo en una copia temporal de la tabla real y cuenta las filas.
 * Todo ocurre dentro de una transacción que termina en ROLLBACK.
 */
export async function verify(db: pg.Client, file: string) {
  const data = JSON.parse(gunzipSync(await readFile(file)).toString("utf8")) as Dump;
  if (data.format !== 1 || typeof data.tables !== "object") throw new Error("Formato de copia desconocido");
  const current = new Set(await publicTables(db));
  const result: Record<string, number> = {};
  await db.query("begin");
  try {
    for (const [t, rows] of Object.entries(data.tables)) {
      if (!current.has(t)) throw new Error(`La tabla ${t} de la copia ya no existe`);
      const tmp = ident(`restore_${t}`);
      await db.query(`create temp table ${tmp} (like public.${ident(t)}) on commit drop`);
      const r = await db.query(
        `insert into ${tmp} select * from json_populate_recordset(null::${tmp}, $1::json)`,
        [JSON.stringify(rows)],
      );
      if ((r.rowCount ?? 0) !== rows.length) throw new Error(`${t}: ${r.rowCount} de ${rows.length} filas`);
      result[t] = rows.length;
    }
  } finally {
    await db.query("rollback");
  }
  return result;
}

async function prune(dir: string) {
  const files = (await readdir(dir)).filter((f) => NAME.test(f)).sort();
  const old = files.slice(0, Math.max(0, files.length - KEEP));
  for (const f of old) await unlink(join(dir, f));
  return old.length;
}

export async function backup(db: pg.Client): Promise<JobResult> {
  const local = process.env.BACKUP_LOCAL_DIR?.trim() || join(homedir(), "Library/Application Support/PersonalHub/backups");
  await mkdir(local, { recursive: true });
  const data = await dump(db);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const name = `hub-${day}.json.gz`;
  const file = join(local, name);
  // Se escribe a un temporal y se renombra: nunca queda una copia a medias con el nombre bueno
  await writeFile(`${file}.part`, gzipSync(JSON.stringify(data)));
  await rename(`${file}.part`, file);
  const counts = await verify(db, file);
  const rows = Object.values(counts).reduce((a, b) => a + b, 0);
  const size = (await stat(file)).size;
  const removed = await prune(local);
  const mb = (size / 1_048_576).toLocaleString("es-ES", { maximumFractionDigits: 1 });
  const summary = `${Object.keys(counts).length} tablas, ${rows} filas, ${mb} MB, comprobada`;

  return {
    items: rows,
    details: { file, bytes: size, tables: counts, migration: data.migration, removed, verified: true },
    message: `${summary}${removed ? `; ${removed} copias antiguas borradas` : ""}`,
  };
}

if (import.meta.main) {
  const only = process.argv.find((a) => a.startsWith("--verify="))?.slice("--verify=".length);
  if (only) {
    const { connect } = await import("./db.ts");
    const db = await connect();
    try {
      const counts = await verify(db, only);
      console.log(`Copia correcta: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ")}`);
    } finally {
      await db.end();
    }
  } else {
    const r = await runJob("backup", backup);
    if (!r.ok) process.exitCode = 1;
  }
}
