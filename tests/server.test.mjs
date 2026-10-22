import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../server/store.mjs";
import { createApp, passwordHash } from "../server/app.mjs";
const project = {
  version: 1,
  name: "Torrente de prueba",
  features: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "p1",
        geometry: { type: "Point", coordinates: [2.7, 39.7] },
        properties: { name: "Punto", layerId: "canvas" },
      },
    ],
  },
  layers: [
    {
      id: "canvas",
      name: "Dibujos",
      visible: true,
      opacity: 1,
      color: "#e99540",
      source: "drawing",
    },
  ],
  rainfall: 50,
  basemap: "local",
  view: { center: [2.9, 39.6], zoom: 9, bearing: 0, pitch: 0 },
};
async function fixture(t, dev = true) {
  const dir = mkdtempSync(join(tmpdir(), "torrents-test-"));
  const db = openStore(dir);
  const app = createApp({ db, dev, secure: false });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const request = async (path, method = "GET", body, cookie) =>
    fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { db, base, request };
}
test("Projects persist, reload and isolate; invalid geographic data is rejected", async (t) => {
  const { db, request } = await fixture(t);
  const created = await request("/api/projects", "POST", project);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.deepEqual(
    await (await request("/api/projects/" + id)).json(),
    project,
  );
  assert.equal((await (await request("/api/projects")).json()).length, 1);
  const changed = structuredClone(project);
  changed.rainfall = 75;
  assert.equal(
    (await request("/api/projects/" + id, "PUT", changed)).status,
    200,
  );
  assert.equal(
    JSON.parse(db.prepare("SELECT data FROM projects WHERE id=?").get(id).data)
      .rainfall,
    75,
  );
  const bad = structuredClone(project);
  bad.features.features[0].geometry.coordinates = [462000, 4382000];
  assert.equal((await request("/api/projects", "POST", bad)).status, 400);
  const orphan = structuredClone(project);
  orphan.features.features[0].properties.layerId = "missing";
  assert.equal((await request("/api/projects", "POST", orphan)).status, 400);
  assert.equal(
    (await request("/api/projects/" + id, "DELETE", {})).status,
    200,
  );
  assert.equal((await request("/api/projects/" + id)).status, 404);
});
test("Private API requires login, rejects bad origins and isolates each user", async (t) => {
  const { db, request, base } = await fixture(t, false);
  db.prepare("INSERT INTO users VALUES (?,?,?)").run(
    "ana",
    "Ana",
    passwordHash("synthetic-test-only-123"),
  );
  db.prepare("INSERT INTO users VALUES (?,?,?)").run(
    "bea",
    "Bea",
    passwordHash("synthetic-test-only-456"),
  );
  assert.equal((await request("/api/projects")).status, 401);
  assert.equal(
    (await request("/api/login", "POST", { name: "ana", password: "wrong" }))
      .status,
    401,
  );
  const auth = await request("/api/login", "POST", {
    name: "ana",
    password: "synthetic-test-only-123",
  });
  assert.equal(auth.status, 200);
  const cookie = auth.headers.get("set-cookie").split(";")[0];
  assert.match(auth.headers.get("set-cookie"), /HttpOnly/);
  assert.match(auth.headers.get("set-cookie"), /SameSite=Strict/);
  const saved = await (
    await request("/api/projects", "POST", project, cookie)
  ).json();
  const bea = await request("/api/login", "POST", {
    name: "bea",
    password: "synthetic-test-only-456",
  });
  const other = bea.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await request("/api/projects/" + saved.id, "GET", null, other)).status,
    404,
  );
  assert.equal(
    (await request("/api/projects/" + saved.id, "PUT", project, other)).status,
    404,
  );
  assert.equal(
    (await request("/api/projects/" + saved.id, "DELETE", {}, other)).status,
    404,
  );
  const csrf = await fetch(base + "/api/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      cookie,
    },
    body: JSON.stringify(project),
  });
  assert.equal(csrf.status, 403);
  const analysis = await request(
    "/api/analysis/watershed",
    "POST",
    { lng: 2.7, lat: 39.7 },
    cookie,
  );
  assert.equal(analysis.status, 409);
  assert.equal((await analysis.json()).status, "not_available");
  assert.equal((await request("/api/logout", "POST", {}, cookie)).status, 200);
  assert.equal(
    (await request("/api/projects", "GET", null, cookie)).status,
    401,
  );
});
test("Expired sessions fail and login attempts are rate limited", async (t) => {
  const { db, request } = await fixture(t, false);
  db.prepare("INSERT INTO users VALUES (?,?,?)").run(
    "ana",
    "Ana",
    passwordHash("synthetic-test-only-123"),
  );
  const auth = await request("/api/login", "POST", {
    name: "ana",
    password: "synthetic-test-only-123",
  });
  const cookie = auth.headers.get("set-cookie").split(";")[0];
  db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal(
    (await request("/api/projects", "GET", null, cookie)).status,
    401,
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await request("/api/login", "POST", { name: "ana", password: "wrong" }))
        .status,
      401,
    );
  assert.equal(
    (await request("/api/login", "POST", { name: "ana", password: "wrong" }))
      .status,
    429,
  );
});
