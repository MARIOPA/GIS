import express from "express";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { createApp } from "./app.mjs";
import { surfaceDirectory } from "./paths.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const local = process.argv.includes("--local");
const host = process.env.HOST || "127.0.0.1";
if (local && host !== "127.0.0.1" && host !== "localhost")
  throw new Error("El modo local solo admite localhost.");
const dataDir = process.env.DATA_DIR || resolve(root, ".data");
const db = openStore(dataDir);
if (!dev && !local && !db.prepare("SELECT id FROM users LIMIT 1").get()) {
  console.error(
    "Configura un usuario con npm run user:add antes de arrancar en producción.",
  );
  process.exit(1);
}
const app = createApp({
  db,
  dev: dev || local,
  secure: !dev && !local,
  terrainDir: surfaceDirectory(dataDir),
});
if (dev) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      hmr: { port: Number(process.env.PORT || 5173) + 1000 },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(resolve(root, "dist"), { index: false }));
  app.get("/{*path}", (_, res) =>
    res.sendFile(resolve(root, "dist/index.html")),
  );
}
const port = Number(process.env.PORT || 5173);
if (
  dev &&
  host !== "127.0.0.1" &&
  host !== "localhost" &&
  !db.prepare("SELECT id FROM users LIMIT 1").get()
)
  throw new Error(
    "Crea un usuario antes de exponer el servidor fuera de localhost.",
  );
const server = app.listen(port, host, () =>
  console.log(
    `Torrents ${dev ? "desarrollo" : local ? "local" : "privado"} · puerto ${port}`,
  ),
);
function stop() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
