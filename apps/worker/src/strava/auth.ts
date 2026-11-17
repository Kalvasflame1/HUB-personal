/**
 * Autorización de Strava (una sola vez, o si se revoca el acceso).
 * Abre un servidor temporal en localhost, recibe el código de Strava,
 * lo cambia por tokens y los guarda en private.strava_tokens.
 *
 *   npm run strava:auth --workspace apps/worker
 */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { connect, env, USER_ID } from "../db.ts";
import { exchangeToken } from "./api.ts";

const PORT = 8723;
// Strava admite localhost y 127.0.0.1 sin configurar nada más.
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "read,activity:read_all";

const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
authorizeUrl.search = new URLSearchParams({
  client_id: env("STRAVA_CLIENT_ID"),
  redirect_uri: REDIRECT,
  response_type: "code",
  approval_prompt: "auto",
  scope: SCOPE,
}).toString();
env("STRAVA_CLIENT_SECRET");
USER_ID();

function page(title: string, body: string) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:16px -apple-system,system-ui;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1d1d1f">
<h1 style="font-size:22px">${title}</h1><p style="color:#6e6e73">${body}</p></body>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("scope") ?? "";
  const done = (status: number, title: string, body: string) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" }).end(page(title, body));
  };

  if (!code) {
    done(400, "Autorización cancelada", "Strava no ha devuelto ningún código. Puedes cerrar esta pestaña y repetir el proceso.");
    finish(1, "Autorización cancelada en Strava.");
    return;
  }
  if (!scope.includes("activity:read_all")) {
    done(400, "Falta un permiso", "Hay que marcar la casilla de ver los datos de actividades privadas. Repite el proceso.");
    finish(1, `Permisos concedidos insuficientes: ${scope}`);
    return;
  }

  try {
    const t = await exchangeToken({ grant_type: "authorization_code", code });
    const db = await connect();
    await db.query(
      `insert into private.strava_tokens (user_id, athlete_id, access_token, refresh_token, expires_at, scope)
       values ($1, $2, $3, $4, to_timestamp($5), $6)
       on conflict (user_id) do update set
         athlete_id = excluded.athlete_id, access_token = excluded.access_token,
         refresh_token = excluded.refresh_token, expires_at = excluded.expires_at,
         scope = excluded.scope, updated_at = now()`,
      [USER_ID(), t.athlete?.id, t.access_token, t.refresh_token, t.expires_at, scope],
    );
    await db.end();
    done(200, "Strava conectado", "Ya puedes cerrar esta pestaña y volver a la terminal.");
    finish(0, `Strava conectado (atleta ${t.athlete?.id}). Siguiente paso: npm run strava:sync --workspace apps/worker`);
  } catch (e) {
    done(500, "No se pudo completar", "Revisa el mensaje en la terminal.");
    finish(1, (e as Error).message);
  }
});

function finish(code: number, message: string) {
  (code ? console.error : console.log)(message);
  server.close();
  setTimeout(() => process.exit(code), 200);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("Abriendo Strava en el navegador para autorizar el acceso de solo lectura…");
  console.log(`Si no se abre, copia esta dirección:\n${authorizeUrl}\n`);
  execFile("open", [authorizeUrl.toString()], () => {});
});

setTimeout(() => finish(1, "Tiempo de espera agotado (5 min)."), 5 * 60_000).unref();
