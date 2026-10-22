import type { FeatureCollection } from "geojson";
import type { Project, MapFeature } from "../types";
import area from "@turf/area";
import length from "@turf/length";
// Shared runtime validation is also used by the API.
// @ts-expect-error Plain ESM shared with the Node server.
import { collectionSchema, projectSchema } from "../../server/validation.mjs";
export function parseCollection(raw: unknown): FeatureCollection {
  const candidate = raw as { type?: string };
  const parsed = collectionSchema.safeParse(
    candidate?.type === "Feature"
      ? { type: "FeatureCollection", features: [raw] }
      : raw,
  );
  if (!parsed.success)
    throw new Error(
      "GeoJSON inválido. Usa Point, LineString o Polygon (también Multi) en WGS84 / EPSG:4326, sin campo CRS. " +
        parsed.error.issues[0].message,
    );
  return parsed.data;
}
export function parseProject(raw: unknown): Project {
  const p = projectSchema.safeParse(raw);
  if (!p.success)
    throw new Error("Proyecto incompatible: " + p.error.issues[0].message);
  return p.data;
}
export function metric(feature: MapFeature): string {
  try {
    if (feature.geometry.type.includes("Polygon"))
      return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(area(feature) / 10000)} ha`;
    if (feature.geometry.type.includes("LineString"))
      return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(length(feature as never))} km`;
    return "WGS84 · EPSG:4326";
  } catch {
    return "Geometría sin medida";
  }
}
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || "No se ha podido completar la operación");
  return body;
}
