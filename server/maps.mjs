import { Router } from "express";
import { fetch, EnvHttpProxyAgent } from "undici";
// Only these two official upstreams can be reached; this is not an open proxy.
const agent = new EnvHttpProxyAgent();
const ofm = "https://tiles.openfreemap.org";
const cache = new Map();
const MAX_CACHE = 300;
const pending = new Map();
function rewrite(value, origin) {
  if (typeof value === "string")
    return value.replaceAll(ofm, origin + "/api/maps/ofm");
  if (Array.isArray(value)) return value.map((v) => rewrite(v, origin));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewrite(v, origin)]),
    );
  return value;
}
async function load(url) {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached;
  if (pending.has(url)) return pending.get(url);
  const promise = (async () => {
    const response = await fetch(url, {
      dispatcher: agent,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok)
      throw new Error("El servicio cartográfico respondió " + response.status);
    const type =
      response.headers.get("content-type") || "application/octet-stream";
    if (Number(response.headers.get("content-length") || 0) > 10 * 1024 * 1024)
      throw new Error("Tesela demasiado grande.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10 * 1024 * 1024)
      throw new Error("Tesela demasiado grande.");
    const data = { bytes, type, expires: Date.now() + 3600000 };
    cache.set(url, data);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return data;
  })();
  pending.set(url, promise);
  try {
    return await promise;
  } finally {
    pending.delete(url);
  }
}
export const mapsRouter = Router();
mapsRouter.get("/style", async (req, res) => {
  try {
    const data = await load(ofm + "/styles/liberty");
    const style = JSON.parse(data.bytes);
    const origin = `${req.protocol}://${req.get("host")}`;
    // Muted colours leave imported layers and annotations easy to read.
    for (const layer of style.layers) {
      if (layer.id === "water" && layer.paint)
        layer.paint["fill-color"] = "#c6e0e9";
    }
    res.json(rewrite(style, origin));
  } catch {
    res
      .status(502)
      .json({ error: "No se puede acceder a OpenFreeMap. Usa la base local." });
  }
});
mapsRouter.get("/ofm/{*path}", async (req, res) => {
  const path = req.path.slice(4);
  if (
    !/^\/(?:planet(?:\/[^?#]+)?|fonts\/[^?#]+|sprites\/[^?#]+|natural_earth\/[^?#]+)$/.test(
      path,
    ) ||
    path.includes("..") ||
    path.includes("\\")
  )
    return res.status(400).end();
  try {
    const data = await load(ofm + path);
    if (data.type.includes("json") || path === "/planet")
      return res.json(
        rewrite(JSON.parse(data.bytes), `${req.protocol}://${req.get("host")}`),
      );
    res
      .set({
        "Content-Type": data.type,
        "Cache-Control": "private,max-age=3600",
      })
      .send(data.bytes);
  } catch {
    res
      .status(502)
      .json({ error: "No se ha podido obtener la tesela cartográfica." });
  }
});
mapsRouter.get("/ortho", async (req, res) => {
  const bbox = String(req.query.bbox || "")
    .split(",")
    .map(Number);
  if (
    bbox.length !== 4 ||
    bbox.some((n) => !Number.isFinite(n) || Math.abs(n) > 20037509) ||
    bbox[0] >= bbox[2] ||
    bbox[1] >= bbox[3]
  )
    return res.status(400).end();
  const query = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: "OI.OrthoimageCoverage",
    STYLES: "",
    CRS: "EPSG:3857",
    BBOX: bbox.join(","),
    WIDTH: "256",
    HEIGHT: "256",
    FORMAT: "image/jpeg",
  });
  try {
    const data = await load("https://www.ign.es/wms-inspire/pnoa-ma?" + query);
    if (!data.type.startsWith("image/"))
      throw new Error("Respuesta WMS inválida");
    res
      .set({
        "Content-Type": data.type,
        "Cache-Control": "private,max-age=3600",
      })
      .send(data.bytes);
  } catch {
    res.status(502).json({
      error:
        "La ortofoto PNOA no está accesible. Usa cartografía o base local.",
    });
  }
});
