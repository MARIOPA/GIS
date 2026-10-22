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
  terrainVisible?: boolean;
  basemap: "local" | "streets" | "ortho";
  view: { center: number[]; zoom: number; bearing: number; pitch: number };
};
export type SavedProject = { id: string; name: string; updatedAt: string };
export type QueryResult = { lng: number; lat: number; feature?: MapFeature };
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
    name: "Watershed",
    hint: "Selecciona un punto de salida. El cálculo requiere un MDT validado.",
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
  ],
  rainfall: 50,
  basemap: "streets",
  view: { center: [2.94, 39.65], zoom: 8.6, bearing: 0, pitch: 0 },
};
