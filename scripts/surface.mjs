import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { appRoot, pythonExecutable } from "../server/paths.mjs";
const source = process.argv[2];
if (!source) {
  console.error(
    'Uso: node scripts/surface.mjs "ruta/al/mdt-piloto.zip o carpeta sincronizada"',
  );
  process.exit(1);
}
const result = spawnSync(
  pythonExecutable(),
  [
    resolve(appRoot, "scripts/import_surface.py"),
    resolve(source),
    process.env.DATA_DIR || resolve(appRoot, ".data"),
  ],
  { stdio: "inherit" },
);
if (result.error)
  console.error("No se ha podido ejecutar Python:", result.error.message);
process.exit(result.status ?? 1);
