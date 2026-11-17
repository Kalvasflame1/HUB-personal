import pg from "pg";

export function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Falta la variable ${name} en apps/worker/.env`);
    process.exit(1);
  }
  return value;
}

export const USER_ID = () => env("HUB_USER_ID");

/**
 * Conexión directa a Postgres por el pooler de Supabase. Salta la RLS y puede
 * leer el esquema private, así que solo se usa desde este Mac.
 * El pooler cifra la conexión con un certificado de la CA de Supabase, que no
 * está en el almacén de Node: se cifra sin verificar la cadena.
 */
export async function connect(): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: env("SUPABASE_DB_URL"),
    ssl: { rejectUnauthorized: false },
    application_name: "hub-worker",
  });
  await client.connect();
  return client;
}

/** Registra una ejecución en job_runs y devuelve una función para cerrarla. */
export async function startJob(db: pg.Client, jobName: string) {
  const { rows } = await db.query<{ id: number }>(
    "insert into public.job_runs (user_id, job_name) values ($1, $2) returning id",
    [USER_ID(), jobName],
  );
  const id = rows[0].id;
  return async (status: "ok" | "error" | "skipped", items: number | null, details: object, error?: string) => {
    await db.query(
      "update public.job_runs set finished_at = now(), status = $2, items = $3, details = $4, error = $5 where id = $1",
      [id, status, items, JSON.stringify(details), error ?? null],
    );
  };
}
