import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = fileURLToPath(new URL("../", import.meta.url));
export function pythonExecutable() {
  if (process.env.TORRENTS_PYTHON) return process.env.TORRENTS_PYTHON;
  const bundled = resolve(
    appRoot,
    "runtime/python",
    process.platform === "win32" ? "python.exe" : "bin/python3",
  );
  return existsSync(bundled)
    ? bundled
    : resolve(
        appRoot,
        ".venv-lidar",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
}
export function surfaceDirectory(dataDir) {
  if (process.env.TERRAIN_DIR) return resolve(process.env.TERRAIN_DIR);
  const pointer = resolve(dataDir, "surface-selection.json");
  if (existsSync(pointer)) {
    const { id } = JSON.parse(readFileSync(pointer, "utf8"));
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))
      throw new Error("Identificador de superficie inválido.");
    return resolve(dataDir, "surfaces", id);
  }
  for (const id of [
    "pnoa-bal-462-4382-v3",
    "pnoa-bal-462-4382-v2",
    "pnoa-bal-462-4382-v1",
  ]) {
    const optimized = resolve(dataDir, "surfaces", id);
    if (existsSync(resolve(optimized, "surface.json"))) return optimized;
  }
  return resolve(dataDir, "terrain");
}
