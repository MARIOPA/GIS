import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
test("Terrain API returns actual raster samples, NoData and a real longitudinal profile", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "torrents-terrain-"));
  const prepare = spawnSync(
    resolve(".venv-lidar/bin/python"),
    [
      "-c",
      `
import json,sys
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer
root=Path(sys.argv[1]);root.mkdir(exist_ok=True)
a=np.arange(400,dtype='float32').reshape(20,20)+100
a[0,0]=-9999
with rasterio.open(root/'dtm.tif','w',driver='GTiff',width=20,height=20,count=1,dtype='float32',crs='EPSG:25831',transform=from_origin(462000,4382000,1,1),nodata=-9999) as dst:dst.write(a,1)
(root/'preview.json').write_text(json.dumps({'status':'candidate_not_validated','center':[2.5,39.5],'coordinates':[],'resolution_m':1}))
transform=Transformer.from_crs(25831,4326,always_xy=True)
print(json.dumps({'point':transform.transform(462010.5,4381989.5),'line':[transform.transform(462005.5,4381989.5),transform.transform(462015.5,4381989.5)]}))
`,
      directory,
    ],
    { encoding: "utf8" },
  );
  assert.equal(prepare.status, 0, prepare.stderr);
  const positions = JSON.parse(prepare.stdout);
  const tileDir = join(directory, "tiles/2/1");
  mkdirSync(tileDir, { recursive: true });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(join(tileDir, "1.png"), png);
  const hillshadeDir = join(directory, "hillshade/2/1");
  mkdirSync(hillshadeDir, { recursive: true });
  writeFileSync(join(hillshadeDir, "1.png"), png);
  for (const folder of ["fine-contours", "depressions", "accumulation"]) {
    const path = join(directory, folder, "2/1");
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "1.png"), png);
  }
  writeFileSync(
    join(directory, "tiles.json"),
    JSON.stringify({
      minzoom: 2,
      maxzoom: 2,
      bounds: [-90, 0, 0, 66],
      tile_size: 256,
      count: 1,
    }),
  );
  writeFileSync(
    join(directory, "hillshade.json"),
    JSON.stringify({
      minzoom: 2,
      maxzoom: 2,
      bounds: [-90, 0, 0, 66],
      tile_size: 256,
      count: 1,
    }),
  );
  writeFileSync(
    join(directory, "fine-contours.json"),
    JSON.stringify({
      minzoom: 2,
      maxzoom: 2,
      bounds: [-90, 0, 0, 66],
      tile_size: 256,
      count: 1,
      interval_m: 0.25,
    }),
  );
  writeFileSync(
    join(directory, "contours.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { elevation: 100 },
          geometry: { type: "LineString", coordinates: [[2.5, 39.5], [2.6, 39.6]] },
        },
      ],
    }),
  );
  writeFileSync(
    join(directory, "flow-network.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { area_m2: 10000 },
          geometry: { type: "LineString", coordinates: [[2.5, 39.5], [2.6, 39.6]] },
        },
      ],
    }),
  );
  writeFileSync(
    join(directory, "hydrology.json"),
    JSON.stringify({
      algorithm: "TEST D8",
      filled_cells: 2,
      maximum_fill_depth_m: 1,
      fill_volume_m3: 4,
      maximum_contributing_area_m2: 10000,
      network_segments: 1,
      limitations: "TEST ONLY",
    }),
  );
  const db = openStore(join(directory, "db"));
  const app = createApp({ db, dev: true, terrainDir: directory });
  const server = await new Promise((r) => {
    const s = app.listen(0, "127.0.0.1", () => r(s));
  });
  const base = "http://127.0.0.1:" + server.address().port;
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const query = (path, data) =>
    fetch(base + "/api/terrain/" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  const capabilities = await (await fetch(base + "/api/capabilities")).json();
  assert.deepEqual(capabilities.terrain.raster.tiles, [
    "/api/terrain/tiles/{z}/{x}/{y}.png",
  ]);
  assert.deepEqual(capabilities.terrain.hillshade.tiles, [
    "/api/terrain/hillshade/{z}/{x}/{y}.png",
  ]);
  assert.deepEqual(capabilities.terrain.contours.intervals, [0.25, 5, 10, 20]);
  assert.equal(capabilities.terrain.hydrology.algorithm, "TEST D8");
  const tile = await fetch(base + "/api/terrain/tiles/2/1/1.png");
  assert.equal(tile.status, 200);
  assert.equal(tile.headers.get("content-type"), "image/png");
  assert.match(tile.headers.get("cache-control"), /^private/);
  assert.deepEqual(Buffer.from(await tile.arrayBuffer()), png);
  assert.equal((await fetch(base + "/api/terrain/hillshade/2/1/1.png")).status, 200);
  const contours = await (await fetch(base + "/api/terrain/contours.geojson")).json();
  assert.equal(contours.features[0].properties.elevation, 100);
  assert.equal((await fetch(base + "/api/terrain/fine-contours/2/1/1.png")).status, 200);
  assert.equal((await fetch(base + "/api/terrain/depressions/2/1/1.png")).status, 200);
  assert.equal((await fetch(base + "/api/terrain/accumulation/2/1/1.png")).status, 200);
  const network = await (await fetch(base + "/api/terrain/flow-network.geojson")).json();
  assert.equal(network.features[0].properties.area_m2, 10000);
  assert.equal(
    (await fetch(base + "/api/terrain/tiles/2/2/1.png")).status,
    204,
  );
  assert.equal(
    (await fetch(base + "/api/terrain/tiles/2/4/1.png")).status,
    400,
  );
  assert.equal(
    (await fetch(base + "/api/terrain/tiles/21/1/1.png")).status,
    400,
  );
  assert.equal(
    (await (await fetch(base + "/api/capabilities")).json()).terrain.status,
    "candidate_not_validated",
  );
  const result = await (
    await query("elevation", {
      lng: positions.point[0],
      lat: positions.point[1],
    })
  ).json();
  assert.equal(result.elevation, 310);
  assert.equal(result.vertical_validated, false);
  const outside = await (
    await query("elevation", { lng: 2.9, lat: 39.6 })
  ).json();
  assert.equal(outside.elevation, null);
  assert.equal(outside.status, "outside_or_nodata");
  const profile = await (
    await query("profile", {
      geometry: { type: "LineString", coordinates: positions.line },
    })
  ).json();
  assert.ok(Math.abs(profile.length_m - 10) < 0.001);
  assert.ok(profile.samples.length >= 10);
  assert.equal(profile.samples[0].elevation, 305);
  assert.equal(profile.samples.at(-1).elevation, 315);
  assert.equal(profile.vertical_validated, false);
  assert.equal(
    (await query("profile", { geometry: { type: "Polygon", coordinates: [] } }))
      .status,
    400,
  );
  assert.equal(
    (await query("elevation", { lng: 462000, lat: 4382000 })).status,
    400,
  );
});
