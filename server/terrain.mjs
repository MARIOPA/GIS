import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectionSchema } from "./validation.mjs";
import { pythonExecutable } from "./paths.mjs";
const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
export function terrainCapability(directory) {
  if (
    !directory ||
    !existsSync(resolve(directory, "dtm.tif")) ||
    !existsSync(resolve(directory, "preview.json"))
  )
    return { status: "missing", message: "No hay un MDT preparado." };
  try {
    const surfaceFile = resolve(directory, "surface.json");
    const version = existsSync(surfaceFile)
      ? "?surface=" +
        encodeURIComponent(JSON.parse(readFileSync(surfaceFile, "utf8")).id)
      : "";
    return {
      ...JSON.parse(readFileSync(resolve(directory, "preview.json"), "utf8")),
      preview: "/api/terrain/preview.png",
      ...(existsSync(resolve(directory, "tiles.json"))
        ? {
            raster: {
              ...JSON.parse(
                readFileSync(resolve(directory, "tiles.json"), "utf8"),
              ),
              tiles: ["/api/terrain/tiles/{z}/{x}/{y}.png" + version],
            },
          }
        : {}),
      ...(existsSync(resolve(directory, "hillshade.json"))
        ? {
            hillshade: {
              ...JSON.parse(
                readFileSync(resolve(directory, "hillshade.json"), "utf8"),
              ),
              tiles: [
                "/api/terrain/hillshade/{z}/{x}/{y}.png" + version,
              ],
            },
          }
        : {}),
      ...(existsSync(resolve(directory, "contours.geojson"))
        ? {
            contours: {
              url: "/api/terrain/contours.geojson" + version,
              intervals: [5, 10, 20],
            },
          }
        : {}),
      message:
        "MDT provisional. Datum vertical y precisión pendientes de validar.",
    };
  } catch {
    return {
      status: "missing",
      message: "No se ha podido leer la preparación del terreno.",
    };
  }
}
export function terrainRouter(directory) {
  const router = Router();
  let running = 0;
  router.get("/tiles/:z/:x/:y.png", (req, res) => {
    const parts = [req.params.z, req.params.x, req.params.y];
    if (!parts.every((p) => /^(0|[1-9]\d{0,6})$/.test(p)))
      return res.status(400).end();
    const [z, x, y] = parts.map(Number);
    if (z > 20 || x >= 2 ** z || y >= 2 ** z) return res.status(400).end();
    const file =
      directory &&
      resolve(directory, "tiles", String(z), String(x), `${y}.png`);
    if (!file || !existsSync(file)) return res.status(204).end();
    // Cache in the browser privately; surface changes require restarting the local server.
    res.set("Cache-Control", "private, max-age=3600");
    res.sendFile(file, { dotfiles: "allow" });
  });
  router.get("/hillshade/:z/:x/:y.png", (req, res) => {
    const parts = [req.params.z, req.params.x, req.params.y];
    if (!parts.every((p) => /^(0|[1-9]\d{0,6})$/.test(p)))
      return res.status(400).end();
    const [z, x, y] = parts.map(Number);
    if (z > 20 || x >= 2 ** z || y >= 2 ** z) return res.status(400).end();
    const file =
      directory &&
      resolve(directory, "hillshade", String(z), String(x), `${y}.png`);
    if (!file || !existsSync(file)) return res.status(204).end();
    res.set("Cache-Control", "private, max-age=3600");
    res.sendFile(file, { dotfiles: "allow" });
  });
  router.get("/contours.geojson", (_, res) => {
    const file = directory && resolve(directory, "contours.geojson");
    if (!file || !existsSync(file)) return res.status(404).end();
    res.set("Cache-Control", "private, max-age=3600");
    res.type("application/geo+json").sendFile(file, { dotfiles: "allow" });
  });
  router.get("/preview.png", (_, res) => {
    if (terrainCapability(directory).status === "missing")
      return res.status(404).end();
    res.sendFile(resolve(directory, "preview.png"), { dotfiles: "allow" });
  });
  async function query(req, res, kind) {
    if (terrainCapability(directory).status === "missing")
      return res.status(409).json({ error: "No hay un MDT preparado." });
    const input = { kind };
    if (kind === "point") {
      if (
        !Number.isFinite(req.body?.lng) ||
        !Number.isFinite(req.body?.lat) ||
        Math.abs(req.body.lng) > 180 ||
        Math.abs(req.body.lat) > 90
      )
        return res.status(400).json({ error: "Coordenadas WGS84 inválidas." });
      input.lng = req.body.lng;
      input.lat = req.body.lat;
    } else {
      const parsed = collectionSchema.safeParse({
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: req.body?.geometry, properties: {} },
        ],
      });
      if (
        !parsed.success ||
        parsed.data.features[0].geometry.type !== "LineString" ||
        parsed.data.features[0].geometry.coordinates.length > 1000
      )
        return res
          .status(400)
          .json({ error: "Usa una línea WGS84 de hasta 1.000 vértices." });
      input.coordinates = parsed.data.features[0].geometry.coordinates;
    }
    if (running >= 2)
      return res.status(429).json({
        error: "Hay otras consultas de terreno en curso. Vuelve a intentarlo.",
      });
    running++;
    const child = spawn(
      pythonExecutable(),
      [resolve(appRoot, "scripts/query_terrain.py"), resolve(directory)],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const timer = setTimeout(() => child.kill("SIGTERM"), 15000);
    let output = "";
    let failed = false;
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(input));
    child.stdout.on("data", (b) => {
      output += b.toString();
      if (output.length > 200000) {
        failed = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", () => {});
    let completed = false;
    const finish = (code) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      running--;
      if (res.destroyed) return;
      if (code !== 0 || failed)
        return res.status(422).json({
          error:
            "No se ha podido muestrear el terreno. Revisa la cobertura, la longitud de la línea y el entorno Python.",
        });
      try {
        res.json(JSON.parse(output));
      } catch {
        res.status(500).json({ error: "Respuesta del terreno inválida." });
      }
    };
    child.on("error", () => finish(1));
    child.on("close", finish);
  }
  router.post("/elevation", (req, res) => query(req, res, "point"));
  router.post("/profile", (req, res) => query(req, res, "profile"));
  return router;
}
