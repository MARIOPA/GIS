import { test, expect } from "@playwright/test";
const point = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [2.85, 39.65] },
      properties: { name: "Paso de agua", source: "Prueba funcional" },
    },
  ],
};
test("Terrain requests numeric XYZ tiles and changes detail when zooming", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#4b9d7a";
    context.fillRect(0, 0, 256, 256);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({
      json: {
        terrain: {
          status: "candidate_not_validated",
          preview: "/api/terrain/preview.png",
          coordinates: [
            [2.557, 39.587],
            [2.57, 39.587],
            [2.57, 39.577],
            [2.557, 39.577],
          ],
          center: [2.563335168, 39.582393159],
          resolution_m: 1.5,
          z_min: 230,
          z_max: 440,
          valid_fraction: 0.98,
          vertical_reference: "TEST FIXTURE ONLY",
          raster: {
            tiles: ["/api/terrain/tiles/{z}/{x}/{y}.png"],
            minzoom: 8,
            maxzoom: 17,
            bounds: [2.557, 39.577, 2.57, 39.587],
            tile_size: 256,
          },
          hillshade: {
            tiles: ["/api/terrain/hillshade/{z}/{x}/{y}.png"],
            minzoom: 8,
            maxzoom: 17,
            bounds: [2.557, 39.577, 2.57, 39.587],
            tile_size: 256,
          },
          contours: {
            url: "/api/terrain/contours.geojson",
            intervals: [0.25, 5, 10, 20],
            fine: {
              tiles: ["/api/terrain/fine-contours/{z}/{x}/{y}.png"],
              minzoom: 8,
              maxzoom: 17,
              bounds: [2.557, 39.577, 2.57, 39.587],
              tile_size: 256,
            },
          },
          hydrology: {
            algorithm: "TEST D8",
            filled_cells: 12,
            maximum_fill_depth_m: 1.25,
            fill_volume_m3: 42,
            maximum_contributing_area_m2: 60000,
            network_segments: 8,
            limitations: "TEST ONLY",
            depressions: {
              tiles: ["/api/terrain/depressions/{z}/{x}/{y}.png"],
              minzoom: 8,
              maxzoom: 17,
              bounds: [2.557, 39.577, 2.57, 39.587],
              tile_size: 256,
            },
            accumulation: {
              tiles: ["/api/terrain/accumulation/{z}/{x}/{y}.png"],
              minzoom: 8,
              maxzoom: 17,
              bounds: [2.557, 39.577, 2.57, 39.587],
              tile_size: 256,
            },
            network: { url: "/api/terrain/flow-network.geojson" },
          },
        },
      },
    }),
  );
  const zooms = new Set<number>();
  const invalid: string[] = [];
  await page.route("**/api/terrain/tiles/**", (route) => {
    const match = route
      .request()
      .url()
      .match(/\/tiles\/(\d+)\/\d+\/\d+\.png$/);
    if (match) zooms.add(Number(match[1]));
    else invalid.push(route.request().url());
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(png, "base64"),
    });
  });
  await page.route("**/api/terrain/hillshade/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(png, "base64"),
    }),
  );
  for (const layer of ["fine-contours", "depressions", "accumulation"])
    await page.route(`**/api/terrain/${layer}/**`, (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(png, "base64"),
      }),
    );
  await page.route("**/api/terrain/contours.geojson", (route) =>
    route.fulfill({
      json: { type: "FeatureCollection", features: [] },
    }),
  );
  await page.route("**/api/terrain/flow-network.geojson", (route) =>
    route.fulfill({ json: { type: "FeatureCollection", features: [] } }),
  );
  await ready(page);
  const focus = page.getByRole("button", {
    name: "Ver piloto LiDAR",
    exact: true,
  });
  if (!(await focus.isVisible()))
    await page.getByRole("button", { name: "Elevation", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Relieve sombreado/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Curvas de nivel/ }).click();
  await page.getByLabel("Intervalo de curvas de nivel").press("Home");
  await expect(page.getByLabel("Intervalo de curvas de nivel")).toHaveAttribute(
    "aria-valuetext",
    "0,25 m",
  );
  await page.getByRole("button", { name: /Red de flujo Disponible/ }).click();
  await expect(page.getByText("Flujo topográfico D8")).toBeVisible();
  await page.getByLabel("Área mínima de la red de flujo").press("Home");
  await expect(page.getByLabel("Área mínima de la red de flujo")).toHaveAttribute(
    "aria-valuetext",
    "Detallada",
  );
  await page.getByRole("button", { name: /Depresiones Disponible/ }).click();
  await expect(page.getByText("Relleno de depresiones")).toBeVisible();
  await focus.click();
  await expect.poll(() => zooms.has(15)).toBe(true);
  await page.locator(".maplibregl-canvas").hover();
  await page.mouse.wheel(0, -650);
  await expect.poll(() => [...zooms].some((z) => z > 15)).toBe(true);
  expect(invalid).toEqual([]);
  expect(errors).toEqual([]);
});
async function ready(page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Punto", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(
    () => !!document.querySelector(".maplibregl-canvas"),
  );
  await page.getByRole("button", { name: /Base local Natural Earth/ }).click();
  await expect(page.locator(".map-loading")).toBeHidden({ timeout: 15000 });
  await page.waitForTimeout(700);
}
test("Draw, edit, undo, save, reload and reopen a project", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("button", { name: "Punto", exact: true }).click();
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.click({ position: { x: 430, y: 390 } });
  await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill("Paso de agua");
  await page
    .getByLabel("Notas", { exact: true })
    .fill("Inspección de gabinete");
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await canvas.click({ position: { x: 100, y: 150 } });
  await expect(
    page.getByText("Ningún elemento seleccionado", { exact: true }),
  ).toBeVisible();
  await canvas.click({ position: { x: 430, y: 390 } });
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Paso de agua",
  );
  await page
    .getByRole("button", { name: "Eliminar elemento seleccionado" })
    .click();
  await expect(
    page.getByText("Ningún elemento seleccionado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await page.getByRole("button", { name: "Canvas 1", exact: true }).click();
  await page.getByRole("button", { name: /Paso de agua Point/ }).click();
  await expect(page.getByLabel("Notas", { exact: true })).toHaveValue(
    "Inspección de gabinete",
  );
  await page.getByLabel("Nombre del proyecto").fill("Proyecto e2e");
  await page
    .getByRole("button", { name: "Guardar proyecto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardado", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nombre del proyecto")).toHaveValue(
    "Proyecto e2e",
  );
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Proyecto e2e");
  await page
    .getByRole("button", { name: "Abrir", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Canvas 1", exact: true }).click();
  await page.getByRole("button", { name: /Paso de agua Point/ }).click();
  await expect(page.getByLabel("Notas", { exact: true })).toHaveValue(
    "Inspección de gabinete",
  );
  expect(errors).toEqual([]);
});
test("Import real GeoJSON structure, export and control layers; reject projected coordinates", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator('input[type=file][accept=".geojson,.json"]')
    .setInputFiles({
      name: "tramos.geojson",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(point)),
    });
  await expect(
    page.getByRole("button", { name: "tramos 1 elementos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ocultar tramos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mostrar tramos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: /Geometrías · GeoJSON/ }).click();
  const file = await d;
  expect(file.suggestedFilename()).toBe("torrents.geojson");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  const bad = structuredClone(point);
  bad.features[0].geometry.coordinates = [462000, 4382000];
  await page
    .locator('input[type=file][accept=".geojson,.json"]')
    .setInputFiles({
      name: "bad.geojson",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(bad)),
    });
  await expect(page.getByRole("status")).toContainText("WGS84");
});
test("Polygon drawing and vertex edit; panels preserve centre", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Polígono", exact: true }).click();
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.click({ position: { x: 300, y: 300 } });
  await canvas.click({ position: { x: 450, y: 300 } });
  await canvas.click({ position: { x: 400, y: 400 } });
  await page.keyboard.press("Enter");
  await expect(page.getByText("CANVAS · Polygon")).toBeVisible();
  await expect(page.locator(".metric-tag")).toContainText("ha");
  await page
    .getByRole("button", { name: "Editar vértices", exact: true })
    .click();
  await expect(page.locator(".vertex-handle")).toHaveCount(3);
  const centre = await page.locator(".status-coords").innerText();
  await page.getByRole("button", { name: "Plegar panel de capas" }).click();
  await expect(
    page.getByRole("button", { name: "Abrir panel de capas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir panel de capas" }).click();
  await expect(page.locator(".status-coords")).toHaveText(centre);
});
test("Missing terrain is explicit and rainfall is a saved parameter", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByText("Sin modelo de terreno", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Precipitación en mm").fill("85");
  await page
    .getByRole("button", { name: "Guardar proyecto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardado", exact: true }),
  ).toBeVisible();
  const p = await page.request.get("/api/projects");
  const rows = await p.json();
  const result = await (
    await page.request.get("/api/projects/" + rows[0].id)
  ).json();
  expect(result.rainfall).toBe(85);
  const analysis = await page.request.post("/api/analysis/flash-flood", {
    data: { rainfall: 85 },
  });
  expect(analysis.status()).toBe(409);
  await page.getByRole("button", { name: "Watershed", exact: true }).click();
  await expect(page.getByText("Posición de consulta")).toBeVisible();
  await page
    .locator(".maplibregl-canvas")
    .click({ position: { x: 400, y: 400 } });
  await expect(page.getByText("Longitud", { exact: true })).toBeVisible();
});
test("Mobile layout exposes tools without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir panel de capas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir panel de capas" }).click();
  await expect(
    page.getByRole("button", { name: "Spaces & Layers" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plegar panel de capas" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png" });
});

test("A photograph without EXIF requires an explicit location and persists in its layer", async ({
  page,
}) => {
  await ready(page);
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 2;
    c.height = 2;
    c.getContext("2d")!.fillRect(0, 0, 2, 2);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator('input[type=file][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles({
      name: "foto.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  await expect(page.getByRole("dialog")).toContainText(
    "La foto no incluye GPS",
  );
  await page
    .getByRole("spinbutton", { name: "Longitud", exact: true })
    .fill("2.8");
  await page
    .getByRole("spinbutton", { name: "Latitud", exact: true })
    .fill("39.7");
  await page
    .getByRole("button", { name: "Añadir al mapa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fotografías 1 elementos", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".selected-photo")).toBeVisible();
  await page
    .getByRole("button", { name: "Guardar proyecto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardado", exact: true }),
  ).toBeVisible();
  const list = await (await page.request.get("/api/projects")).json();
  const project = await (
    await page.request.get("/api/projects/" + list[0].id)
  ).json();
  expect(project.features.features[0].properties.locationSource).toBe("manual");
  expect(project.features.features[0].properties.image).toMatch(
    /^data:image\/jpeg;base64,/,
  );
});
