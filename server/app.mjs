import express from "express";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { projectSchema } from "./validation.mjs";
import { mapsRouter } from "./maps.mjs";
import { terrainCapability, terrainRouter } from "./terrain.mjs";
export function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function verify(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const digest = (t) => createHash("sha256").update(t).digest("hex");
export function createApp({
  db,
  dev = false,
  secure = !dev,
  terrainDir = null,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-store",
    });
    if (
      req.path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    ) {
      const origin = req.headers.origin;
      if (origin && origin !== `${req.protocol}://${req.get("host")}`)
        return res.status(403).json({ error: "Origen no permitido." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Usa application/json." });
    }
    next();
  });
  app.use(express.json({ limit: "25mb" }));
  app.get("/api/health", (_, res) =>
    res.json({ status: "ok", app: "torrents", version: "0.5.0" }),
  );
  const configured = () =>
    Number(db.prepare("SELECT count(*) AS n FROM users").get().n) > 0;
  app.use("/api", (req, res, next) => {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("torrents_session="))
      ?.slice(17);
    const session = raw
      ? db
          .prepare("SELECT userId FROM sessions WHERE token=? AND expires>?")
          .get(digest(raw), Date.now())
      : null;
    req.user = session?.userId || (dev && !configured() ? "local" : null);
    next();
  });
  app.get("/api/session", (req, res) =>
    res.json({
      authenticated: !!req.user,
      name: req.user,
      mode: configured() ? "private" : "local",
      configured: configured(),
    }),
  );
  const attempts = new Map();
  app.post("/api/login", (req, res) => {
    const key = req.ip;
    const now = Date.now();
    const prior = attempts.get(key);
    const attempt =
      prior && now - prior.at < 900000 ? prior : { at: now, count: 0 };
    attempts.set(key, attempt);
    if (attempts.size > 1000)
      for (const [ip, a] of attempts)
        if (now - a.at > 900000) attempts.delete(ip);
    if (attempt.count >= 10)
      return res
        .status(429)
        .json({ error: "Demasiados intentos. Espera 15 minutos." });
    attempt.count++;
    const { name, password } = req.body || {};
    if (
      typeof name !== "string" ||
      typeof password !== "string" ||
      password.length > 1024
    )
      return res.status(400).json({ error: "Credenciales inválidas." });
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(name);
    const valid = verify(
      password,
      user?.hash || passwordHash("unavailable", "0".repeat(32)),
    );
    if (!user || !valid)
      return res
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos." });
    attempts.delete(key);
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      digest(token),
      user.id,
      now + 86400000,
    );
    res.cookie("torrents_session", token, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 86400000,
      path: "/",
    });
    res.json({
      authenticated: true,
      name: user.id,
      mode: "private",
      configured: true,
    });
  });
  app.post("/api/logout", (req, res) => {
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("torrents_session="))
      ?.slice(17);
    if (raw) db.prepare("DELETE FROM sessions WHERE token=?").run(digest(raw));
    res.clearCookie("torrents_session", {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) =>
    req.user
      ? next()
      : res.status(401).json({ error: "Inicia sesión para continuar." }),
  );
  app.use("/api/maps", mapsRouter);
  app.use("/api/terrain", terrainRouter(terrainDir));
  app.get("/api/capabilities", (_, res) =>
    res.json({
      terrain: terrainCapability(terrainDir),
      flashFlood: {
        status: "pending",
        message:
          "Motor de llenado y desbordamiento pendiente de implementación y validación.",
      },
      dynamicFlood: { status: "excluded" },
    }),
  );
  for (const path of [
    "elevation",
    "profile",
    "watershed",
    "downstream",
    "flash-flood",
  ])
    app.post("/api/analysis/" + path, (_, res) =>
      res.status(409).json({
        error:
          "Análisis no disponible: requiere datos de terreno validados y un motor de cálculo integrado. No se han generado resultados.",
        status: "not_available",
      }),
    );
  app.get("/api/projects", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,name,updatedAt FROM projects WHERE owner=? ORDER BY updatedAt DESC",
        )
        .all(req.user),
    ),
  );
  app.get("/api/projects/:id", (req, res) => {
    const p = db
      .prepare("SELECT data FROM projects WHERE id=? AND owner=?")
      .get(req.params.id, req.user);
    return p
      ? res.json(JSON.parse(p.data))
      : res.status(404).json({ error: "Proyecto no encontrado." });
  });
  function save(req, res) {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });
    const id = req.params.id || randomUUID();
    const now = new Date().toISOString();
    if (
      req.params.id &&
      !db
        .prepare("SELECT id FROM projects WHERE id=? AND owner=?")
        .get(id, req.user)
    )
      return res.status(404).json({ error: "Proyecto no encontrado." });
    db.prepare(
      "INSERT INTO projects VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,updatedAt=excluded.updatedAt",
    ).run(id, req.user, parsed.data.name, JSON.stringify(parsed.data), now);
    res
      .status(req.params.id ? 200 : 201)
      .json({ id, name: parsed.data.name, updatedAt: now });
  }
  app.post("/api/projects", save);
  app.put("/api/projects/:id", save);
  app.delete("/api/projects/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM projects WHERE id=? AND owner=?")
      .run(req.params.id, req.user);
    res
      .status(result.changes ? 200 : 404)
      .json(
        result.changes ? { ok: true } : { error: "Proyecto no encontrado." },
      );
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "Ruta no encontrada." }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
      error:
        error.type === "entity.too.large"
          ? "El archivo supera los 25 MB."
          : error.status === 400
            ? "JSON inválido."
            : "No se ha podido completar la operación.",
    });
  });
  return app;
}
