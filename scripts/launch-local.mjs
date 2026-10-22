import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { appRoot } from "../server/paths.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Puerto inválido.");
const url = `http://${host}:${port}`;
// An existing process is left alone, including another installed copy of Torrents.
try {
  const existing = await fetch(url + "/api/health", {
    signal: AbortSignal.timeout(500),
  });
  if (existing.ok) {
    console.error(
      `El puerto ${port} está ocupado. Cierra la otra copia o elige otro PORT.`,
    );
    process.exit(1);
  }
} catch {}
const child = spawn(
  process.execPath,
  [resolve(appRoot, "server/index.mjs"), "--local"],
  {
    cwd: appRoot,
    stdio: "inherit",
    env: { ...process.env, HOST: host, PORT: String(port) },
  },
);
let exited = false;
child.on("exit", (code) => {
  exited = true;
  process.exitCode = code ?? 1;
});
child.on("error", (error) => {
  exited = true;
  console.error(error.message);
  process.exitCode = 1;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
for (let i = 0; i < 80 && !exited; i++) {
  try {
    const r = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(500),
    });
    if (r.ok) {
      console.log(
        `Abre ${url} en el navegador. Mantén esta ventana abierta; Ctrl+C para detener.`,
      );
      if (process.env.TORRENTS_NO_BROWSER !== "1") {
        const command =
          process.platform === "win32" ? "explorer.exe" : "xdg-open";
        const opener = spawn(command, [url], {
          stdio: "ignore",
          detached: true,
        });
        opener.on("error", () =>
          console.log("Abre la dirección manualmente en el navegador."),
        );
        opener.unref();
      }
      break;
    }
  } catch {}
  if (i === 79) {
    console.error("El servidor no ha arrancado a tiempo.");
    child.kill();
  }
  await new Promise((r) => setTimeout(r, 150));
}
