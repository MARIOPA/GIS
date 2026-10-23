import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import {
  type GeoJSONSource,
  type Map as GLMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Position } from "geojson";
import bbox from "@turf/bbox";
import type { Layer, MapFeature, Project, QueryResult, Tool } from "../types";
export type MapHandle = {
  setView: (view: Project["view"]) => void;
  flyTo: (center: number[], zoom?: number) => void;
  fitFeatures: (features: FeatureCollection) => void;
  getView: () => Project["view"];
  finish: () => void;
};
type Props = {
  terrain: {
    coordinates: number[][];
    preview: string;
    raster?: {
      tiles: string[];
      minzoom: number;
      maxzoom: number;
      bounds: [number, number, number, number];
      tile_size: number;
    };
    hillshade?: {
      tiles: string[];
      minzoom: number;
      maxzoom: number;
      bounds: [number, number, number, number];
      tile_size: number;
    };
    contours?: {
      url: string;
      intervals: Array<0.25 | 5 | 10 | 20>;
      fine?: {
        tiles: string[];
        minzoom: number;
        maxzoom: number;
        bounds: [number, number, number, number];
        tile_size: number;
      };
    };
    hydrology?: {
      depressions: {
        tiles: string[];
        minzoom: number;
        maxzoom: number;
        bounds: [number, number, number, number];
        tile_size: number;
      };
      accumulation: {
        tiles: string[];
        minzoom: number;
        maxzoom: number;
        bounds: [number, number, number, number];
        tile_size: number;
      };
      network: { url: string };
    };
  } | null;
  project: Project;
  tool: Tool;
  selected: string | null;
  onCreate: (f: MapFeature) => void;
  onUpdate: (f: MapFeature) => void;
  onSelect: (f: MapFeature | null) => void;
  onQuery: (q: QueryResult) => void;
  onCoordinates: (p: number[]) => void;
  onNotice: (s: string) => void;
  onView: (view: Project["view"]) => void;
  onReady: () => void;
};
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
const localStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#e5eef0" },
    },
  ],
};
function addLayers(map: GLMap) {
  if (map.getSource("sketches")) return;
  map.addSource("coast", { type: "geojson", data: "/data/balears.geojson" });
  map.addLayer({
    id: "coast-fill",
    type: "fill",
    source: "coast",
    paint: { "fill-color": "#d0e0d0", "fill-opacity": 1 },
  });
  map.addLayer({
    id: "coast-line",
    type: "line",
    source: "coast",
    paint: { "line-color": "#a4bdaf", "line-width": 1 },
  });
  map.addSource("sketches", { type: "geojson", data: empty });
  map.addSource("draft", { type: "geojson", data: empty });
  map.addLayer({
    id: "sketch-fill",
    type: "fill",
    source: "sketches",
    filter: ["==", "$type", "Polygon"],
    paint: {
      "fill-color": ["get", "_color"],
      "fill-opacity": ["*", ["get", "_opacity"], 0.22],
    },
  });
  map.addLayer({
    id: "sketch-line",
    type: "line",
    source: "sketches",
    filter: ["!=", "$type", "Point"],
    paint: {
      "line-color": [
        "case",
        ["get", "_selected"],
        "#e77d28",
        ["get", "_color"],
      ],
      "line-width": ["case", ["get", "_selected"], 4, 2.5],
      "line-opacity": ["get", "_opacity"],
    },
  });
  map.addLayer({
    id: "sketch-point",
    type: "circle",
    source: "sketches",
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": ["case", ["get", "_selected"], 8, 6],
      "circle-color": ["get", "_color"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
      "circle-opacity": ["get", "_opacity"],
    },
  });
  map.addLayer({
    id: "draft-fill",
    type: "fill",
    source: "draft",
    filter: ["==", "$type", "Polygon"],
    paint: { "fill-color": "#ed9d43", "fill-opacity": 0.16 },
  });
  map.addLayer({
    id: "draft-line",
    type: "line",
    source: "draft",
    filter: ["!=", "$type", "Point"],
    paint: {
      "line-color": "#e38f30",
      "line-width": 2,
      "line-dasharray": [3, 2],
    },
  });
  map.addLayer({
    id: "draft-vertices",
    type: "circle",
    source: "draft",
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": 4,
      "circle-color": "#fff",
      "circle-stroke-color": "#e38f30",
      "circle-stroke-width": 2,
    },
  });
}
function rendered(
  project: Project,
  selected: string | null,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: project.features.features
      .filter(
        (f) =>
          project.layers.find((l) => l.id === f.properties?.layerId)?.visible,
      )
      .map((f) => {
        const l = project.layers.find((l) => l.id === f.properties?.layerId)!;
        return {
          ...f,
          properties: {
            ...f.properties,
            _featureId: String(f.id),
            _color: l.color,
            _opacity: l.opacity,
            _selected: f.id === selected,
          },
        };
      }),
  };
}
export default forwardRef<MapHandle, Props>(function MapCanvas(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GLMap | null>(null);
  const live = useRef(props);
  live.current = props;
  const vertices = useRef<Position[]>([]);
  const markers = useRef<maplibregl.Marker[]>([]);
  const labels = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(0);
  const [online, setOnline] = useState(false);
  const [failed, setFailed] = useState(false);
  const baseRef = useRef("");
  function updateDraft() {
    const map = mapRef.current;
    if (!map?.getSource("draft")) return;
    const pts = vertices.current;
    const features: Feature[] = pts.map((coordinates) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates },
      properties: {},
    }));
    if (pts.length > 1)
      features.push({
        type: "Feature",
        geometry:
          ["polygon", "area"].includes(live.current.tool) && pts.length > 2
            ? { type: "Polygon", coordinates: [[...pts, pts[0]]] }
            : { type: "LineString", coordinates: pts },
        properties: {},
      });
    (map.getSource("draft") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }
  function finish() {
    const pts = vertices.current;
    const tool = live.current.tool;
    const polygon = tool === "polygon" || tool === "area";
    if (pts.length < (polygon ? 3 : 2)) {
      live.current.onNotice(
        polygon
          ? "Añade al menos tres vértices."
          : "Añade al menos dos vértices.",
      );
      return;
    }
    live.current.onCreate({
      type: "Feature",
      id: crypto.randomUUID(),
      geometry: polygon
        ? { type: "Polygon", coordinates: [[...pts, pts[0]]] }
        : { type: "LineString", coordinates: pts },
      properties: {
        name: polygon ? "Área de trabajo" : "Tramo de torrente",
        layerId: "canvas",
        kind: tool,
      },
    });
    vertices.current = [];
    updateDraft();
  }
  useImperativeHandle(ref, () => ({
    setView: (view) =>
      mapRef.current?.jumpTo({
        ...view,
        center: view.center as [number, number],
      }),
    flyTo: (center, zoom = 12) =>
      mapRef.current?.flyTo({
        center: center as [number, number],
        zoom,
        duration: 900,
      }),
    fitFeatures: (collection) => {
      if (!collection.features.length) return;
      const b = bbox(collection);
      mapRef.current?.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 60, maxZoom: 15 },
      );
    },
    getView: () => {
      const m = mapRef.current;
      return m
        ? {
            center: m.getCenter().toArray(),
            zoom: m.getZoom(),
            bearing: m.getBearing(),
            pitch: m.getPitch(),
          }
        : live.current.project.view;
    },
    finish,
  }));
  useEffect(() => {
    if (!container.current) return;
    const v = live.current.project.view;
    const map = new maplibregl.Map({
      container: container.current,
      style: localStyle,
      center: v.center as [number, number],
      zoom: v.zoom,
      bearing: v.bearing,
      pitch: v.pitch,
      attributionControl: false,
      maxPitch: 60,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.on("load", () => {
      addLayers(map);
      setReady((n) => n + 1);
      live.current.onReady();
    });
    map.on("style.load", () => {
      addLayers(map);
      setReady((n) => n + 1);
    });
    map.on("error", (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (
        sourceId &&
        [
          "pilot-terrain",
          "pilot-hillshade",
          "pilot-contours",
          "pilot-fine-contours",
          "pilot-depressions",
          "pilot-accumulation",
          "pilot-flow-network",
          "sketches",
          "draft",
          "coast",
        ].includes(sourceId)
      )
        return;
      if (
        event.error.message.includes("preview.png") ||
        event.error.message.includes("sketch")
      )
        return;
      if (baseRef.current !== "local") setFailed(true);
    });
    map.on("mousemove", (e) =>
      live.current.onCoordinates([e.lngLat.lng, e.lngLat.lat]),
    );
    map.on("moveend", () =>
      live.current.onView({
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      }),
    );
    map.on("click", (e) => {
      const p = live.current;
      const coordinates = [e.lngLat.lng, e.lngLat.lat];
      if (["point", "text"].includes(p.tool)) {
        p.onCreate({
          type: "Feature",
          id: crypto.randomUUID(),
          geometry: { type: "Point", coordinates },
          properties: {
            name: p.tool === "text" ? "Nueva anotación" : "Punto de interés",
            layerId: "canvas",
            kind: p.tool,
          },
        });
        return;
      }
      if (["line", "polygon", "area", "profile"].includes(p.tool)) {
        const last = vertices.current.at(-1);
        if (!last || last[0] !== coordinates[0] || last[1] !== coordinates[1])
          vertices.current.push(coordinates);
        updateDraft();
        return;
      }
      const found = map
        .queryRenderedFeatures(e.point, {
          layers: ["sketch-fill", "sketch-line", "sketch-point"],
        })
        .find((f) => f.properties?._featureId != null);
      const feature = found
        ? (p.project.features.features.find(
            (f) => String(f.id) === String(found.properties._featureId),
          ) as MapFeature)
        : undefined;
      if (p.tool === "query" || p.tool === "watershed") {
        p.onQuery({ lng: coordinates[0], lat: coordinates[1], feature });
      }
      p.onSelect(feature || null);
    });
    map.on("dblclick", (e) => {
      if (["line", "polygon", "area", "profile"].includes(live.current.tool)) {
        e.preventDefault();
        finish();
      }
    });
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.key === "Escape") {
        vertices.current = [];
        updateDraft();
      }
      if (e.key === "Enter" && vertices.current.length) finish();
    };
    window.addEventListener("keydown", key);
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      window.removeEventListener("keydown", key);
      markers.current.forEach((m) => m.remove());
      labels.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const drawing = ["line", "polygon", "area", "profile"].includes(props.tool);
    if (drawing) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    m.getCanvas().style.cursor =
      props.tool === "navigate"
        ? "grab"
        : props.tool === "select"
          ? "default"
          : "crosshair";
    vertices.current = [];
    updateDraft();
  }, [props.tool, ready]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const base = props.project.basemap;
    if (baseRef.current === base) return;
    baseRef.current = base;
    setFailed(false);
    if (base === "streets") {
      setOnline(true);
      m.setStyle("/api/maps/style");
    } else if (base === "ortho") {
      setOnline(true);
      m.setStyle({
        version: 8,
        sources: {
          ortho: {
            type: "raster",
            tiles: ["/api/maps/ortho?bbox={bbox-epsg-3857}"],
            tileSize: 256,
            attribution: "© IGN · PNOA",
          },
        },
        layers: [{ id: "ortho", type: "raster", source: "ortho" }],
      });
    } else {
      setOnline(false);
      m.setStyle(localStyle);
    }
  }, [props.project.basemap, ready]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !failed || !ready) return;
    setOnline(false);
    m.setStyle(localStyle);
    live.current.onNotice(
      "No se ha podido cargar toda la cartografía en línea. Se muestra la base local de Baleares.",
    );
  }, [failed]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getSource("sketches")) return;
    (m.getSource("sketches") as GeoJSONSource).setData(
      rendered(props.project, props.selected),
    );
    // The local coastline is only displayed on the offline basemap.
    m.setLayoutProperty(
      "coast-fill",
      "visibility",
      online ? "none" : "visible",
    );
    m.setLayoutProperty(
      "coast-line",
      "visibility",
      online ? "none" : "visible",
    );
    labels.current.forEach((label) => label.remove());
    labels.current = [];
    for (const f of props.project.features.features) {
      if (
        f.geometry.type !== "Point" ||
        !props.project.layers.find((l) => l.id === f.properties?.layerId)
          ?.visible
      )
        continue;
      if (f.properties?.kind === "text") {
        const el = document.createElement("div");
        el.className = "annotation";
        el.textContent = String(f.properties.name || "Anotación");
        labels.current.push(
          new maplibregl.Marker({
            element: el,
            anchor: "bottom-left",
            offset: [9, -7],
          })
            .setLngLat(f.geometry.coordinates as [number, number])
            .addTo(m),
        );
      }
    }
  }, [
    props.project.features,
    props.project.layers,
    props.selected,
    ready,
    online,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getSource("sketches") || !props.terrain) return;
    if (!m.getSource("pilot-terrain")) {
      m.addSource("pilot-terrain", {
        ...(props.terrain.raster
          ? {
              type: "raster" as const,
              tiles: props.terrain.raster.tiles.map((url) =>
                new URL(url, window.location.origin).href
                  .replaceAll("%7B", "{")
                  .replaceAll("%7D", "}"),
              ),
              tileSize: props.terrain.raster.tile_size,
              minzoom: props.terrain.raster.minzoom,
              maxzoom: props.terrain.raster.maxzoom,
              bounds: props.terrain.raster.bounds,
            }
          : {
              type: "image",
              url: props.terrain.preview,
              coordinates: props.terrain.coordinates as [
                [number, number],
                [number, number],
                [number, number],
                [number, number],
              ],
            }),
      });
      m.addLayer(
        {
          id: "pilot-terrain",
          type: "raster",
          source: "pilot-terrain",
          paint: { "raster-opacity": 0.9, "raster-fade-duration": 0 },
        },
        "sketch-fill",
      );
    }
    m.setLayoutProperty(
      "pilot-terrain",
      "visibility",
      props.project.terrainVisible ? "visible" : "none",
    );
  }, [props.terrain, props.project.terrainVisible, ready]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getSource("sketches") || !props.terrain?.hillshade) return;
    if (!m.getSource("pilot-hillshade")) {
      m.addSource("pilot-hillshade", {
        type: "raster",
        tiles: props.terrain.hillshade.tiles.map((url) =>
          new URL(url, window.location.origin).href
            .replaceAll("%7B", "{")
            .replaceAll("%7D", "}"),
        ),
        tileSize: props.terrain.hillshade.tile_size,
        minzoom: props.terrain.hillshade.minzoom,
        maxzoom: props.terrain.hillshade.maxzoom,
        bounds: props.terrain.hillshade.bounds,
      });
      m.addLayer(
        {
          id: "pilot-hillshade",
          type: "raster",
          source: "pilot-hillshade",
          paint: { "raster-opacity": 0.48, "raster-fade-duration": 0 },
        },
        "sketch-fill",
      );
    }
    m.setLayoutProperty(
      "pilot-hillshade",
      "visibility",
      props.project.hillshadeVisible ? "visible" : "none",
    );
  }, [props.terrain, props.project.hillshadeVisible, ready]);
  useEffect(() => {
    const m = mapRef.current;
    if (!m?.getSource("sketches") || !props.terrain?.contours) return;
    if (!m.getSource("pilot-contours")) {
      m.addSource("pilot-contours", {
        type: "geojson",
        data: props.terrain.contours.url,
      });
      m.addLayer(
        {
          id: "pilot-contours",
          type: "line",
          source: "pilot-contours",
          minzoom: 12,
          paint: {
            "line-color": "#38575d",
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.35, 16, 0.72],
            "line-width": [
              "case",
              ["==", ["%", ["get", "elevation"], 20], 0],
              1.35,
              0.75,
            ],
          },
        },
        "sketch-fill",
      );
    }
    if (props.terrain.contours.fine && !m.getSource("pilot-fine-contours")) {
      const fine = props.terrain.contours.fine;
      m.addSource("pilot-fine-contours", {
        type: "raster",
        tiles: fine.tiles.map((url) =>
          new URL(url, window.location.origin).href
            .replaceAll("%7B", "{")
            .replaceAll("%7D", "}"),
        ),
        tileSize: fine.tile_size,
        minzoom: fine.minzoom,
        maxzoom: fine.maxzoom,
        bounds: fine.bounds,
      });
      m.addLayer(
        {
          id: "pilot-fine-contours",
          type: "raster",
          source: "pilot-fine-contours",
          minzoom: 14,
          paint: { "raster-opacity": 0.7, "raster-fade-duration": 0 },
        },
        "sketch-fill",
      );
    }
    const interval = props.project.contourInterval || 10;
    m.setFilter("pilot-contours", [
      "==",
      ["%", ["get", "elevation"], interval],
      0,
    ]);
    m.setLayoutProperty(
      "pilot-contours",
      "visibility",
      props.project.contoursVisible && interval !== 0.25 ? "visible" : "none",
    );
    if (m.getLayer("pilot-fine-contours"))
      m.setLayoutProperty(
        "pilot-fine-contours",
        "visibility",
        props.project.contoursVisible && interval === 0.25
          ? "visible"
          : "none",
      );
  }, [
    props.terrain,
    props.project.contoursVisible,
    props.project.contourInterval,
    ready,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    const hydrology = props.terrain?.hydrology;
    if (!m?.getSource("sketches") || !hydrology) return;
    const rasterLayers = [
      ["pilot-depressions", hydrology.depressions],
      ["pilot-accumulation", hydrology.accumulation],
    ] as const;
    for (const [id, raster] of rasterLayers) {
      if (!m.getSource(id)) {
        m.addSource(id, {
          type: "raster",
          tiles: raster.tiles.map((url) =>
            new URL(url, window.location.origin).href
              .replaceAll("%7B", "{")
              .replaceAll("%7D", "}"),
          ),
          tileSize: raster.tile_size,
          minzoom: raster.minzoom,
          maxzoom: raster.maxzoom,
          bounds: raster.bounds,
        });
        m.addLayer(
          {
            id,
            type: "raster",
            source: id,
            paint: { "raster-opacity": 0.82, "raster-fade-duration": 0 },
          },
          "sketch-fill",
        );
      }
    }
    if (!m.getSource("pilot-flow-network")) {
      m.addSource("pilot-flow-network", {
        type: "geojson",
        data: hydrology.network.url,
      });
      m.addLayer(
        {
          id: "pilot-flow-network",
          type: "line",
          source: "pilot-flow-network",
          minzoom: 12,
          paint: {
            "line-color": "#087fa5",
            "line-opacity": 0.9,
            "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.8, 17, 2.2],
          },
        },
        "sketch-fill",
      );
    }
    m.setLayoutProperty(
      "pilot-depressions",
      "visibility",
      props.project.depressionsVisible ? "visible" : "none",
    );
    m.setLayoutProperty(
      "pilot-accumulation",
      "visibility",
      props.project.flowVisible ? "visible" : "none",
    );
    m.setLayoutProperty(
      "pilot-flow-network",
      "visibility",
      props.project.flowVisible ? "visible" : "none",
    );
    m.setFilter("pilot-flow-network", [
      ">=",
      ["get", "area_m2"],
      (props.project.flowThresholdHa || 1) * 10000,
    ]);
  }, [
    props.terrain,
    props.project.flowVisible,
    props.project.depressionsVisible,
    props.project.flowThresholdHa,
    ready,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    const selected = props.project.features.features.find(
      (f) => f.id === props.selected,
    ) as MapFeature | undefined;
    if (!m || props.tool !== "edit" || !selected) return;
    const g = selected.geometry;
    const coords =
      g.type === "Point"
        ? [g.coordinates]
        : g.type === "LineString"
          ? g.coordinates
          : g.type === "Polygon"
            ? g.coordinates[0].slice(0, -1)
            : [];
    coords.forEach((position, i) => {
      const el = document.createElement("div");
      el.className = "vertex-handle";
      el.setAttribute("aria-label", `Vértice ${i + 1}`);
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(position as [number, number])
        .addTo(m);
      marker.on("dragend", () => {
        const clone = structuredClone(selected);
        const point = marker.getLngLat().toArray();
        if (clone.geometry.type === "Point") clone.geometry.coordinates = point;
        if (clone.geometry.type === "LineString")
          clone.geometry.coordinates[i] = point;
        if (clone.geometry.type === "Polygon") {
          clone.geometry.coordinates[0][i] = point;
          if (i === 0)
            clone.geometry.coordinates[0][
              clone.geometry.coordinates[0].length - 1
            ] = point;
        }
        live.current.onUpdate(clone);
      });
      markers.current.push(marker);
    });
  }, [props.selected, props.tool, props.project.features, ready]);
  return (
    <>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Mapa de las Illes Balears"
        role="region"
      />
      <div className="map-source">
        <span className={online ? "live-dot" : "offline-dot"} />
        {online
          ? props.project.basemap === "ortho"
            ? "Ortofoto PNOA · IGN"
            : "OpenFreeMap · OpenStreetMap"
          : "Natural Earth · Base local"}
        {failed ? " · Sin conexión" : ""}
      </div>
    </>
  );
});
