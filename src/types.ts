import type { Feature, FeatureCollection, Geometry } from "geojson";
export type Tool =
  | "navigate"
  | "query"
  | "profile"
  | "watershed"
  | "select"
  | "point"
  | "line"
  | "polygon"
  | "text"
  | "area"
  | "edit";
export type Props = Record<string, string | number | boolean | null>;
export type MapFeature = Feature<Geometry, Props> & { id: string };
export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  color: string;
  source: "drawing" | "import" | "photo";
};
export type Project = {
  version: 1;
  name: string;
  features: FeatureCollection;
  layers: Layer[];
  rainfall: number;
  floodDepthM?: 0.05 | 0.1 | 0.25 | 0.5;
  terrainVisible?: boolean;
  hillshadeVisible?: boolean;
  contoursVisible?: boolean;
  contourInterval?: 0.25 | 5 | 10 | 20;
  flowVisible?: boolean;
  depressionsVisible?: boolean;
  flowThresholdHa?: 0.25 | 1 | 5;
  basemap: "local" | "streets" | "ortho";
  view: { center: number[]; zoom: number; bearing: number; pitch: number };
};
export type SavedProject = { id: string; name: string; updatedAt: string };
export type QueryResult = { lng: number; lat: number; feature?: MapFeature };
export type WatershedResult = {
  basin: FeatureCollection;
  downstream: Feature;
  outlet: number[];
  endpoint: number[];
  area_m2: number;
  downstream_length_m: number;
  cells: number;
  status: string;
};
export type StaticFloodResult = {
  rainfall_mm: number;
  minimum_depth_m: number;
  stored_volume_m3: number;
  boundary_outflow_m3: number;
  flooded_area_m2: number;
  maximum_depth_m: number;
  reservoirs: number;
  image: string;
  coordinates: number[][];
  status: string;
  limitations: string;
};
export type ToolSpec = { name: string; hint: string };
export const TOOL_INFO: Record<Tool, ToolSpec> = {
  navigate: {
    name: "Zoom",
    hint: "Arrastra para mover el mapa · Rueda para acercar",
  },
  query: {
    name: "Point Query",
    hint: "Haz clic para consultar una posición o una geometría",
  },
  profile: {
    name: "Profile",
    hint: "Dibuja una línea de referencia · Enter termina el trazado · Consulta el MDT disponible desde el elemento.",
  },
  watershed: {
    name: "Cuenca",
    hint: "Haz clic dentro del MDT para delimitar la cuenca y seguir el agua hasta el borde.",
  },
  select: {
    name: "Seleccionar",
    hint: "Haz clic sobre un elemento para seleccionarlo",
  },
  point: { name: "Punto", hint: "Haz clic en el mapa para crear un punto" },
  line: {
    name: "Línea",
    hint: "Haz clic para añadir vértices · Doble clic o Enter para terminar · Esc para cancelar",
  },
  polygon: {
    name: "Polígono",
    hint: "Dibuja al menos tres vértices · Doble clic o Enter para terminar",
  },
  text: { name: "Texto", hint: "Haz clic para colocar una anotación" },
  area: {
    name: "Área",
    hint: "Dibuja un polígono para medir su superficie · Doble clic para terminar",
  },
  edit: {
    name: "Editar vértices",
    hint: "Arrastra los vértices naranjas de la geometría seleccionada",
  },
};
export const INITIAL: Project = {
  version: 1,
  name: "Conservación de torrentes",
  features: { type: "FeatureCollection", features: [] },
  layers: [
    {
      id: "canvas",
      name: "Dibujos y anotaciones",
      visible: true,
      opacity: 1,
      color: "#ee9b46",
      source: "drawing",
    },
    {
      id: "hydrological-corrections",
      name: "Correcciones hidrológicas",
      visible: true,
      opacity: 1,
      color: "#247da0",
      source: "drawing",
    },
  ],
  rainfall: 50,
  floodDepthM: 0.1,
  terrainVisible: true,
  hillshadeVisible: true,
  contoursVisible: false,
  contourInterval: 10,
  flowVisible: false,
  depressionsVisible: false,
  flowThresholdHa: 1,
  basemap: "streets",
  view: { center: [2.94, 39.65], zoom: 8.6, bearing: 0, pitch: 0 },
};
