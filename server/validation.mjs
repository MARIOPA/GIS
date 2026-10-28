import { z } from "zod";
const position = z
  .array(z.number().finite())
  .min(2)
  .max(3)
  .refine(
    (p) => Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90,
    "Coordenadas fuera de WGS84. Reproyecta los datos a EPSG:4326.",
  );
const line = z.array(position).min(2).max(100000);
const ring = z
  .array(position)
  .min(4)
  .max(100000)
  .refine(
    (r) => r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1],
    "El anillo del polígono debe estar cerrado.",
  );
const geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({
    type: z.literal("MultiPoint"),
    coordinates: z.array(position).max(100000),
  }),
  z.object({ type: z.literal("LineString"), coordinates: line }),
  z.object({
    type: z.literal("MultiLineString"),
    coordinates: z.array(line).max(10000),
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(ring).min(1).max(10000),
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(ring).min(1)).max(10000),
  }),
]);
const property = z.union([
  z.string().max(3000000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const featureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string().max(100), z.number().finite()]).optional(),
  geometry,
  properties: z.record(z.string().max(100), property).nullable(),
});
export const collectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema).max(10000),
  crs: z.never().optional(),
});
export const layerSchema = z.object({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(120),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  source: z.enum(["drawing", "import", "photo"]),
  count: z.number().int().min(0).optional(),
});
export const projectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(120),
    features: collectionSchema,
    layers: z.array(layerSchema).max(100),
    rainfall: z.number().min(0).max(500),
    floodDepthM: z.union([z.literal(0.05), z.literal(0.1), z.literal(0.25), z.literal(0.5)]).optional(),
    terrainVisible: z.boolean().optional(),
    hillshadeVisible: z.boolean().optional(),
    contoursVisible: z.boolean().optional(),
    contourInterval: z.union([z.literal(0.25), z.literal(5), z.literal(10), z.literal(20)]).optional(),
    flowVisible: z.boolean().optional(),
    depressionsVisible: z.boolean().optional(),
    flowThresholdHa: z.union([z.literal(0.25), z.literal(1), z.literal(5)]).optional(),
    basemap: z.enum(["local", "streets", "ortho"]),
    view: z.object({
      center: position,
      zoom: z.number().min(0).max(22),
      bearing: z.number().finite(),
      pitch: z.number().min(0).max(85),
    }),
  })
  .superRefine((p, ctx) => {
    const ids = new Set();
    for (const f of p.features.features) {
      if (f.id != null && ids.has(String(f.id)))
        ctx.addIssue({
          code: "custom",
          message: "Identificadores de geometría duplicados.",
        });
      ids.add(String(f.id));
    }
    const layerIds = p.layers.map((l) => l.id);
    if (new Set(layerIds).size !== layerIds.length)
      ctx.addIssue({
        code: "custom",
        message: "Identificadores de capa duplicados.",
      });
    for (const f of p.features.features)
      if (!layerIds.includes(f.properties?.layerId))
        ctx.addIssue({
          code: "custom",
          message: "Una geometría hace referencia a una capa inexistente.",
        });
  });
