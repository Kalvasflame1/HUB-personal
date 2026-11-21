/**
 * Proveedor `claude_cli`: ejecuta `claude -p` con la sesión del plan iniciada en este Mac
 * (opción A, decidida el 18-11-2026). Sin coste añadido; comparte límites con Claude Code.
 *
 * Aislamiento: sin ninguna herramienta (`--tools ""`), sin servidores MCP, sin ajustes ni
 * CLAUDE.md del usuario, sin guardar la sesión y en una carpeta vacía. Claude solo ve el texto
 * que le pasa el worker y solo puede devolver texto: no puede leer ni cambiar nada.
 *
 * No se usa `--bare`: se salta el Llavero, que es donde está la sesión del plan.
 * Si existiera ANTHROPIC_API_KEY, `claude` facturaría a la API: se quita del entorno.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BIN = join(homedir(), ".local/bin/claude");
const WORKDIR = join(homedir(), "Library/Application Support/PersonalHub/ai");

export type ClaudeResult = {
  text: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number; cache_read_tokens: number; duration_ms: number };
};

export function runClaude(opts: { system: string; prompt: string; model: string; timeoutMs?: number }): Promise<ClaudeResult> {
  mkdirSync(WORKDIR, { recursive: true });
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  const args = [
    "-p",
    "--model", opts.model,
    "--output-format", "json",
    "--no-session-persistence",
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--system-prompt", opts.system,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(BIN, args, { cwd: WORKDIR, env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude no respondió a tiempo"));
    }, opts.timeoutMs ?? 120_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let data: Record<string, any>;
      try {
        data = JSON.parse(out);
      } catch {
        return reject(new Error(`claude terminó con código ${code}: ${(err || out).trim().slice(0, 300)}`));
      }
      if (data.is_error || data.subtype !== "success") {
        return reject(new Error(String(data.result ?? data.subtype ?? "error de Claude").slice(0, 300)));
      }
      const u = data.usage ?? {};
      resolve({
        text: String(data.result ?? "").trim(),
        model: Object.keys(data.modelUsage ?? {})[0] ?? opts.model,
        usage: {
          input_tokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          output_tokens: u.output_tokens ?? 0,
          cache_read_tokens: u.cache_read_input_tokens ?? 0,
          duration_ms: data.duration_ms ?? 0,
        },
      });
    });
    child.stdin.end(opts.prompt);
  });
}
