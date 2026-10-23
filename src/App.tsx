import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  CloudRain,
  Compass,
  Copy,
  Download,
  Droplets,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  FolderOpen,
  Hand,
  ImagePlus,
  Info,
  Layers,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  MapPin,
  Maximize,
  Minus,
  MoreHorizontal,
  Mountain,
  MousePointer2,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Plus,
  Redo2,
  Route,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Spline,
  Square,
  SquareDashed,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Upload,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import exifr from "exifr";
import TerrainProfile, {
  type ProfileResult,
} from "./components/TerrainProfile";
import MapCanvas, { type MapHandle } from "./components/MapCanvas";
import {
  api,
  download,
  metric,
  parseCollection,
  parseProject,
} from "./lib/project";
import {
  INITIAL,
  TOOL_INFO,
  type Layer,
  type MapFeature,
  type Project,
  type QueryResult,
  type SavedProject,
  type Tool,
} from "./types";
type Session = {
  authenticated: boolean;
  name: string | null;
  mode: "local" | "private";
  configured: boolean;
};
type Modal =
  | "projects"
  | "library"
  | "help"
  | "address"
  | "export"
  | "account"
  | "new"
  | "photo"
  | null;
type Terrain = {
  status: string;
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
    algorithm: string;
    filled_cells: number;
    maximum_fill_depth_m: number;
    fill_volume_m3: number;
    maximum_contributing_area_m2: number;
    network_segments: number;
    limitations: string;
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
  coordinates: number[][];
  center: number[];
  resolution_m: number;
  z_min: number;
  z_max: number;
  valid_fraction: number;
  vertical_reference: string;
};
const colours = [
  "#e99540",
  "#268eae",
  "#4b9d7a",
  "#a577b7",
  "#dd6b6b",
  "#405f83",
];
const places = [
  { name: "Mallorca", sub: "Illes Balears", center: [2.94, 39.65], zoom: 8.6 },
  {
    name: "Palma",
    sub: "Mallorca · municipio",
    center: [2.65, 39.57],
    zoom: 12,
  },
  {
    name: "Sóller",
    sub: "Serra de Tramuntana · Mallorca",
    center: [2.715, 39.766],
    zoom: 13,
  },
  {
    name: "Manacor",
    sub: "Llevant · Mallorca",
    center: [3.21, 39.57],
    zoom: 12,
  },
  { name: "Alcúdia", sub: "Nord · Mallorca", center: [3.12, 39.85], zoom: 12 },
  { name: "Menorca", sub: "Illes Balears", center: [4.08, 39.97], zoom: 10 },
  { name: "Eivissa", sub: "Illes Balears", center: [1.43, 38.98], zoom: 10 },
  { name: "Formentera", sub: "Illes Balears", center: [1.43, 38.71], zoom: 11 },
];
const topTools: { id: Tool; icon: LucideIcon; label: string }[] = [
  { id: "navigate", icon: Search, label: "Zoom" },
  { id: "query", icon: LocateFixed, label: "Point Query" },
  { id: "profile", icon: Activity, label: "Profile" },
  { id: "watershed", icon: Waves, label: "Watershed" },
];
const bottomTools: { id: Tool; icon: LucideIcon; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Seleccionar" },
  { id: "text", icon: Type, label: "Texto" },
  { id: "point", icon: MapPin, label: "Punto" },
  { id: "line", icon: Spline, label: "Línea" },
  { id: "polygon", icon: Triangle, label: "Polígono" },
  { id: "area", icon: SquareDashed, label: "Medir área" },
];
function IconButton({
  icon: Icon,
  label,
  active = false,
  onClick,
  disabled = false,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`icon-button ${active ? "active" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={17} />
    </button>
  );
}
function ModalBox({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        <IconButton icon={X} label="Cerrar" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-screen">
      <div className="login-brand">
        <Droplets size={36} />
        <span>
          torrents<span className="brand-dot">.</span>
        </span>
      </div>
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            onLogin(
              await api("/api/login", {
                method: "POST",
                body: JSON.stringify({ name, password }),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="eyebrow">SIG · ILLES BALEARS</div>
        <h1>
          Tu territorio.
          <br />
          Una visión más clara.
        </h1>
        <p>Accede al espacio privado de conservación de torrentes.</p>
        <label>
          Usuario
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar al espacio de trabajo"}
          <ArrowRight size={17} />
        </button>
        <small>
          <LockKeyhole size={13} /> Acceso privado · Datos protegidos por sesión
        </small>
      </form>
      <div className="login-foot">
        Torrents · Conservación y análisis del territorio
      </div>
    </div>
  );
}
export default function App() {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [elevation, setElevation] = useState<{
    elevation: number | null;
    status: string;
  } | null>(null);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(
    null,
  );
  const [profileBusy, setProfileBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [project, setProject] = useState<Project>(structuredClone(INITIAL));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("navigate");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState<QueryResult | null>(null);
  const [left, setLeft] = useState(() => window.innerWidth > 650);
  const [right, setRight] = useState(() => window.innerWidth > 960);
  const [tab, setTab] = useState<"layers" | "canvas">("layers");
  const [groups, setGroups] = useState<Record<string, boolean>>({
    Analysis: true,
    "Base Map": true,
  });
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [coordinates, setCoordinates] = useState<number[]>([2.94, 39.65]);
  const [saved, setSaved] = useState<"local" | "saving" | "saved" | "error">(
    "local",
  );
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [projectError, setProjectError] = useState("");
  const [search, setSearch] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const history = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const map = useRef<MapHandle>(null);
  const input = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{
    image: string;
    name: string;
    lat: string;
    lng: string;
    gps: boolean;
  } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [analysis, setAnalysis] = useState<"flood" | "flow" | "depressions">(
    "flood",
  );
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [canvasFilter, setCanvasFilter] = useState("");
  const [expandedLayer, setExpandedLayer] = useState<string | null>("canvas");
  const [importError, setImportError] = useState("");
  const revision = useRef(0);
  const querySequence = useRef(0);
  const current = useRef(project);
  current.current = project;
  const notify = useCallback((text: string) => setNotice(text), []);
  useEffect(() => {
    api<Session>("/api/session")
      .then(setSession)
      .catch((e) => setConnectionError(e.message));
  }, []);
  useEffect(() => {
    if (!session?.authenticated) return;
    api<{ terrain: Terrain }>("/api/capabilities")
      .then((c) => {
        if (c.terrain.status !== "missing") setTerrain(c.terrain);
      })
      .catch(() => {});
  }, [session?.authenticated]);
  useEffect(() => {
    setProfileResult(null);
  }, [selected]);
  useEffect(() => {
    if (!session?.authenticated) return;
    try {
      const raw = localStorage.getItem("torrents:" + session.name);
      if (raw) {
        const parsed = JSON.parse(raw);
        setProject(parseProject(parsed.project));
        setProjectId(parsed.id || null);
      }
    } catch {
      notify(
        "No se pudo recuperar el borrador local. Puedes abrir un proyecto guardado.",
      );
    }
    setLoaded(true);
  }, [session?.name, session?.authenticated]);
  useEffect(() => {
    if (!loaded || !session?.authenticated) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          "torrents:" + session.name,
          JSON.stringify({ project, id: projectId }),
        );
      } catch {
        notify(
          "No hay espacio para el borrador local. Guarda el proyecto o expórtalo a un archivo.",
        );
      }
    }, 500);
    return () => clearTimeout(t);
  }, [project, projectId, loaded, session]);
  useEffect(() => {
    if (!loaded || !session?.authenticated) return;
    const flush = () => {
      try {
        localStorage.setItem(
          "torrents:" + session.name,
          JSON.stringify({ project: current.current, id: projectId }),
        );
      } catch {
        /* The next explicit server save remains available. */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [loaded, session, projectId]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  const update = useCallback((fn: (p: Project) => Project, record = true) => {
    revision.current++;
    const prev = current.current;
    const next = fn(prev);
    if (record) {
      history.current.push(prev);
      if (history.current.length > 50) history.current.shift();
      future.current = [];
      setHistoryTick((n) => n + 1);
    }
    current.current = next;
    setProject(next);
    setSaved("local");
  }, []);
  const undo = useCallback(() => {
    revision.current++;
    const p = history.current.pop();
    if (!p) return;
    future.current.push(current.current);
    setProject(p);
    setSelected(null);
    setHistoryTick((n) => n + 1);
    setSaved("local");
  }, []);
  const redo = useCallback(() => {
    revision.current++;
    const p = future.current.pop();
    if (!p) return;
    history.current.push(current.current);
    setProject(p);
    setSelected(null);
    setHistoryTick((n) => n + 1);
    setSaved("local");
  }, []);
  function loadProject(p: Project, id: string | null) {
    setProject(p);
    setProjectId(id);
    setSelected(null);
    setQuery(null);
    history.current = [];
    future.current = [];
    setHistoryTick((n) => n + 1);
    setSaved(id ? "saved" : "local");
    setTool("navigate");
    map.current?.setView(p.view);
  }
  async function listProjects() {
    setProjectError("");
    try {
      setProjects(await api("/api/projects"));
    } catch (e) {
      setProjectError((e as Error).message);
    }
  }
  async function saveProject(asNew = false) {
    setSaved("saving");
    setBusy(true);
    try {
      const savedRevision = revision.current;
      const id = asNew ? null : projectId;
      const data = {
        ...current.current,
        view: map.current?.getView() || current.current.view,
      };
      const result = await api<SavedProject>(
        id ? "/api/projects/" + id : "/api/projects",
        { method: id ? "PUT" : "POST", body: JSON.stringify(data) },
      );
      setProjectId(result.id);
      try {
        localStorage.setItem(
          "torrents:" + session?.name,
          JSON.stringify({ project: current.current, id: result.id }),
        );
      } catch {
        notify(
          "Proyecto guardado en el servidor; el navegador no dispone de espacio para otra copia.",
        );
      }
      const hasLaterEdits = revision.current !== savedRevision;
      setSaved(hasLaterEdits ? "local" : "saved");
      notify(
        hasLaterEdits
          ? "Copia guardada; hay cambios posteriores pendientes."
          : "Proyecto guardado en el servidor.",
      );
      if (modal === "projects") await listProjects();
    } catch (e) {
      setSaved("error");
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function createFeature(f: MapFeature) {
    update((p) => ({
      ...p,
      features: { ...p.features, features: [...p.features.features, f] },
    }));
    setSelected(f.id);
    setRight(true);
    if (tool === "profile")
      notify(
        terrain
          ? "Línea creada. Usa Consultar perfil real para muestrear el MDT provisional."
          : "Línea de referencia creada. El perfil de elevación requiere un MDT.",
      );
    if (!["line", "polygon", "area"].includes(tool)) setTool("select");
  }
  function editFeature(f: MapFeature) {
    setProfileResult(null);
    update((p) => ({
      ...p,
      features: {
        ...p.features,
        features: p.features.features.map((old) => (old.id === f.id ? f : old)),
      },
    }));
  }
  function deleteSelected() {
    if (!selected) return;
    update((p) => ({
      ...p,
      features: {
        ...p.features,
        features: p.features.features.filter((f) => f.id !== selected),
      },
    }));
    setSelected(null);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const writing = (e.target as HTMLElement)?.closest(
        "input,textarea,select,[contenteditable]",
      );
      if (writing || modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") {
        setTool("navigate");
        setSelected(null);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  async function importFile(file: File) {
    setImportError("");
    if (file.size > 24 * 1024 * 1024) {
      setImportError(
        "El archivo supera los 24 MB. Simplifica o divide la capa.",
      );
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      if (raw.version === 1 && raw.features && raw.layers) {
        loadProject(parseProject(raw), null);
        setModal(null);
        notify(
          "Proyecto importado. Guárdalo para conservar una copia en el servidor.",
        );
        return;
      }
      const collection = parseCollection(raw);
      if (!collection.features.length)
        throw new Error("La capa no contiene geometrías.");
      const layer: Layer = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(geo)?json$/i, ""),
        visible: true,
        opacity: 1,
        color: colours[current.current.layers.length % colours.length],
        source: "import",
      };
      const features: MapFeature[] = collection.features.map((f, i) => ({
        ...f,
        id: crypto.randomUUID(),
        properties: {
          ...f.properties,
          name: String(
            f.properties?.name || f.properties?.nombre || "Elemento " + (i + 1),
          ),
          layerId: layer.id,
        },
      }));
      update((p) => ({
        ...p,
        layers: [...p.layers, layer],
        features: {
          type: "FeatureCollection",
          features: [...p.features.features, ...features],
        },
      }));
      map.current?.fitFeatures({ type: "FeatureCollection", features });
      setModal(null);
      notify(`${features.length} geometrías importadas · WGS84`);
    } catch (e) {
      setImportError((e as Error).message);
      notify((e as Error).message);
    }
  }
  async function readPhoto(file: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      notify("Usa una fotografía JPEG, PNG o WebP.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      notify("La fotografía supera los 25 MB.");
      return;
    }
    setPhotoBusy(true);
    try {
      const gps = await exifr.gps(file).catch(() => undefined);
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setPhoto({
        image: canvas.toDataURL("image/jpeg", 0.82),
        name: file.name,
        lat: gps?.latitude?.toFixed(7) || "",
        lng: gps?.longitude?.toFixed(7) || "",
        gps: !!gps,
      });
      setModal("photo");
    } catch {
      notify("No se ha podido leer la fotografía.");
    } finally {
      setPhotoBusy(false);
    }
  }
  const feature = project.features.features.find((f) => f.id === selected) as
    MapFeature | undefined;
  const visibleCount = project.features.features.filter((f) =>
    project.layers.some((l) => l.id === f.properties?.layerId && l.visible),
  ).length;
  function category(
    name: string,
    icon: LucideIcon,
    children: ReactNode,
    extra?: ReactNode,
  ) {
    const Icon = icon;
    return (
      <section className="layer-category">
        <button
          className="category-heading"
          onClick={() => setGroups((g) => ({ ...g, [name]: !g[name] }))}
          aria-expanded={!!groups[name]}
        >
          <Icon size={16} />
          <span>{name}</span>
          {extra}
          {groups[name] ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>
        {groups[name] && <div className="category-body">{children}</div>}
      </section>
    );
  }
  if (connectionError)
    return (
      <div className="connection-error">
        <Droplets size={36} />
        <h1>No se ha podido conectar con Torrents</h1>
        <p>{connectionError}</p>
        <button className="primary" onClick={() => location.reload()}>
          Volver a intentar
        </button>
      </div>
    );
  if (!session)
    return (
      <div className="loading-screen">
        <Droplets size={32} />
        <span>Preparando tu espacio de trabajo…</span>
      </div>
    );
  if (!session.authenticated) return <Login onLogin={setSession} />;
  if (!loaded)
    return (
      <div className="loading-screen">
        <Droplets size={32} />
        <span>Recuperando tu proyecto…</span>
      </div>
    );
  return (
    <div className="app-shell" data-history={historyTick}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            map.current?.flyTo([2.94, 39.65], 8.6);
          }}
          aria-label="Torrents, volver a Mallorca"
        >
          <Droplets size={26} />
          <span>
            torrents<span className="brand-dot">.</span>
          </span>
          <span className="brand-divider" />
        </a>
        <nav className="main-tools" aria-label="Herramientas de análisis">
          {topTools.map((t) => (
            <button
              key={t.id}
              className={`top-tool ${tool === t.id ? "active" : ""}`}
              onClick={() => {
                setTool(t.id);
                if (["profile", "watershed", "query"].includes(t.id))
                  setRight(true);
              }}
              title={TOOL_INFO[t.id].hint}
            >
              <t.icon size={19} />
              <span>{t.label}</span>
            </button>
          ))}
          <span className="tool-divider" />
          <button
            className="top-tool"
            onClick={() => {
              setModal("projects");
              void listProjects();
            }}
          >
            <Layers size={19} />
            <span>Workspace</span>
          </button>
          <button className="top-tool" onClick={() => setModal("export")}>
            <Download size={19} />
            <span>Export</span>
          </button>
        </nav>
        <nav className="utility-tools">
          <button
            className="top-tool"
            onClick={() => {
              setSearch("");
              setModal("address");
            }}
          >
            <Search size={18} />
            <span>Address</span>
          </button>
          <button className="top-tool" onClick={() => setModal("help")}>
            <CircleHelp size={18} />
            <span>Help</span>
          </button>
          <button
            className="user-button"
            aria-label="User, cuenta"
            title="User · Cuenta"
            onClick={() => setModal("account")}
          >
            <UserRound size={18} />
          </button>
        </nav>
      </header>
      <main
        className={`workspace ${left ? "" : "left-closed"} ${right ? "" : "right-closed"}`}
      >
        {left && (
          <aside className="left-panel" aria-label="Capas del proyecto">
            <div className="panel-tabs">
              <button
                className={tab === "layers" ? "selected" : ""}
                onClick={() => setTab("layers")}
              >
                Spaces & Layers
              </button>
              <button
                className={tab === "canvas" ? "selected" : ""}
                onClick={() => setTab("canvas")}
              >
                Canvas <span>{project.features.features.length}</span>
              </button>
              <IconButton
                icon={PanelLeftClose}
                label="Plegar panel de capas"
                onClick={() => setLeft(false)}
              />
            </div>
            <div className="project-info">
              <div className="eyebrow">
                <span className="tiny-dot" /> ESPACIO DE TRABAJO
              </div>
              <input
                className="project-name"
                aria-label="Nombre del proyecto"
                value={project.name}
                maxLength={120}
                onChange={(e) =>
                  update((p) => ({ ...p, name: e.target.value }), false)
                }
                onBlur={() => {
                  if (!project.name.trim())
                    update((p) => ({ ...p, name: INITIAL.name }), false);
                }}
              />
              <div className="project-location">
                <MapPin size={12} /> Illes Balears, España{" "}
                <span className="small-tag">SIG</span>
              </div>
            </div>
            <div className="panel-scroll">
              {tab === "layers" ? (
                <>
                  <div className="section-label">
                    <span>CAPAS DEL MAPA</span>
                    <IconButton
                      icon={Plus}
                      label="Añadir una capa"
                      onClick={() => setModal("library")}
                    />
                  </div>
                  {category(
                    "Analysis",
                    Waves,
                    <>
                      {[
                        {
                          id: "flood" as const,
                          name: "Flash Flood Map",
                          icon: CloudRain,
                        },
                        {
                          id: "flow" as const,
                          name: "Red de flujo",
                          icon: Spline,
                        },
                        {
                          id: "depressions" as const,
                          name: "Depresiones",
                          icon: Waves,
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          className={`analysis-row ${analysis === item.id ? "chosen" : ""}`}
                          onClick={() => {
                            setAnalysis(item.id);
                            setTool("navigate");
                            setRight(true);
                            if (terrain?.hydrology && item.id !== "flood")
                              update((p) => ({
                                ...p,
                                flowVisible:
                                  item.id === "flow"
                                    ? !p.flowVisible
                                    : false,
                                depressionsVisible:
                                  item.id === "depressions"
                                    ? !p.depressionsVisible
                                    : false,
                              }));
                          }}
                        >
                          <item.icon size={15} />
                          <span>{item.name}</span>
                          <span className="status-chip">
                            {terrain?.hydrology && item.id !== "flood"
                              ? "Disponible"
                              : "Sin datos"}
                          </span>
                        </button>
                      ))}
                      <p className="category-note">
                        {terrain?.hydrology
                          ? "D8 topográfico provisional. La lluvia y la inundación siguen pendientes."
                          : "Análisis pendientes de MDT validado."}
                      </p>
                    </>,
                  )}
                  {category(
                    "Elevation",
                    Mountain,
                    <>
                      {terrain ? (
                        <>
                          <button
                            className="terrain-layer-row"
                            onClick={() =>
                              update((p) => ({
                                ...p,
                                terrainVisible: !p.terrainVisible,
                              }))
                            }
                          >
                            {project.terrainVisible ? (
                              <Eye size={14} />
                            ) : (
                              <EyeOff size={14} />
                            )}
                            <span>MDT piloto · {terrain.resolution_m} m</span>
                            <span className="status-chip">Provisional</span>
                          </button>
                          <button
                            className="text-button terrain-focus"
                            onClick={() => {
                              update((p) => ({ ...p, terrainVisible: true }));
                              map.current?.flyTo(terrain.center, 15);
                              setTool("query");
                              setRight(true);
                            }}
                          >
                            <LocateFixed size={13} />
                            Ver piloto LiDAR
                          </button>
                          <p className="category-note">
                            Z nativa. Datum vertical y precisión pendientes de
                            validar.
                          </p>
                        </>
                      ) : (
                        <div className="unavailable-row">
                          <Square size={13} />
                          <span>Modelo digital del terreno</span>
                          <LockKeyhole size={12} />
                        </div>
                      )}
                      {terrain?.hillshade ? (
                        <button
                          className="terrain-layer-row"
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              hillshadeVisible: !p.hillshadeVisible,
                            }))
                          }
                        >
                          {project.hillshadeVisible ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                          <span>Relieve sombreado</span>
                          <span className="status-chip">Disponible</span>
                        </button>
                      ) : (
                        <div className="unavailable-row">
                          <Square size={13} />
                          <span>Relieve sombreado</span>
                          <LockKeyhole size={12} />
                        </div>
                      )}
                      {terrain?.contours ? (
                        <div className="contour-control">
                          <button
                            className="terrain-layer-row"
                            onClick={() =>
                              update((p) => ({
                                ...p,
                                contoursVisible: !p.contoursVisible,
                              }))
                            }
                          >
                            {project.contoursVisible ? (
                              <Eye size={14} />
                            ) : (
                              <EyeOff size={14} />
                            )}
                            <span>Curvas de nivel</span>
                            <span className="status-chip">Disponible</span>
                          </button>
                          <label>
                            Intervalo
                            <select
                              aria-label="Intervalo de curvas de nivel"
                              value={project.contourInterval || 10}
                              onChange={(event) =>
                                update((p) => ({
                                  ...p,
                                  contourInterval: Number(event.target.value) as
                                    | 5
                                    | 10
                                    | 20
                                    | 0.25,
                                }))
                              }
                            >
                              {terrain.contours.intervals.map((interval) => (
                                <option key={interval} value={interval}>
                                  {interval} m
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <div className="unavailable-row">
                          <Square size={13} />
                          <span>Curvas de nivel</span>
                          <LockKeyhole size={12} />
                        </div>
                      )}
                      <p className="category-note">
                        {terrain
                          ? "Elevación, sombreado y curvas derivados del MDT real. No es un MDS."
                          : "Piloto PNOA 2024 · pendiente de procesar."}
                      </p>
                    </>,
                  )}
                  {category(
                    "Hydrological Corrections",
                    SlidersHorizontal,
                    <p className="category-note">
                      Sin correcciones importadas. Importa geometrías para
                      documentar pasos, barreras o actuaciones. No modifican aún
                      un modelo hidrológico.
                    </p>,
                  )}
                  {category(
                    "Land Cover",
                    Layers,
                    <p className="category-note">
                      Cobertura, infiltración y permeabilidad pendientes de
                      incorporar. No se aplican coeficientes supuestos.
                    </p>,
                  )}
                  {category(
                    "Base Map",
                    MapIcon,
                    <div className="basemap-options">
                      {[
                        {
                          id: "streets",
                          name: "Cartografía",
                          desc: "OpenFreeMap · OSM",
                          style: "streets",
                        },
                        {
                          id: "ortho",
                          name: "Ortofoto",
                          desc: "PNOA · IGN",
                          style: "ortho",
                        },
                        {
                          id: "local",
                          name: "Base local",
                          desc: "Natural Earth · sin red",
                          style: "local",
                        },
                      ].map((b) => (
                        <button
                          key={b.id}
                          className={`basemap-option ${project.basemap === b.id ? "selected" : ""}`}
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              basemap: b.id as Project["basemap"],
                            }))
                          }
                        >
                          <div className={`basemap-thumb ${b.style}`}>
                            <MapIcon size={18} />
                            {project.basemap === b.id && (
                              <span>
                                <Check size={10} />
                              </span>
                            )}
                          </div>
                          <div>
                            <strong>{b.name}</strong>
                            <small>{b.desc}</small>
                          </div>
                          <span className="radio-dot" />
                        </button>
                      ))}
                    </div>,
                  )}
                  <div className="section-label own-layers">
                    <span>
                      MIS CAPAS <b>{project.layers.length}</b>
                    </span>
                    <IconButton
                      icon={Upload}
                      label="Importar GeoJSON"
                      onClick={() => input.current?.click()}
                    />
                  </div>
                  {project.layers.map((layer) => (
                    <div className="user-layer" key={layer.id}>
                      <div className="layer-row">
                        <IconButton
                          icon={layer.visible ? Eye : EyeOff}
                          label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.name}`}
                          active={layer.visible}
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              layers: p.layers.map((l) =>
                                l.id === layer.id
                                  ? { ...l, visible: !l.visible }
                                  : l,
                              ),
                            }))
                          }
                        />
                        <span
                          className="layer-swatch"
                          style={{ background: layer.color }}
                        />
                        <button
                          className="layer-title"
                          onClick={() =>
                            setExpandedLayer(
                              expandedLayer === layer.id ? null : layer.id,
                            )
                          }
                        >
                          {layer.name}
                          <small>
                            {
                              project.features.features.filter(
                                (f) => f.properties?.layerId === layer.id,
                              ).length
                            }{" "}
                            elementos
                          </small>
                        </button>
                        <IconButton
                          icon={Settings2}
                          label={`Opciones de ${layer.name}`}
                          onClick={() =>
                            setExpandedLayer(
                              expandedLayer === layer.id ? null : layer.id,
                            )
                          }
                        />
                      </div>
                      {expandedLayer === layer.id && (
                        <div className="layer-options">
                          <div>
                            <label htmlFor={"opacity-" + layer.id}>
                              Opacidad
                            </label>
                            <span>{Math.round(layer.opacity * 100)}%</span>
                          </div>
                          <input
                            id={"opacity-" + layer.id}
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layer.opacity}
                            onChange={(e) =>
                              update(
                                (p) => ({
                                  ...p,
                                  layers: p.layers.map((l) =>
                                    l.id === layer.id
                                      ? {
                                          ...l,
                                          opacity: Number(e.target.value),
                                        }
                                      : l,
                                  ),
                                }),
                                false,
                              )
                            }
                          />
                          <div className="color-options">
                            {colours.map((c) => (
                              <button
                                key={c}
                                aria-label={`Color ${c} de ${layer.name}`}
                                aria-pressed={c === layer.color}
                                style={{ background: c }}
                                onClick={() =>
                                  update((p) => ({
                                    ...p,
                                    layers: p.layers.map((l) =>
                                      l.id === layer.id
                                        ? { ...l, color: c }
                                        : l,
                                    ),
                                  }))
                                }
                              />
                            ))}
                            <button
                              className="layer-fit"
                              title="Encuadrar capa"
                              aria-label={`Encuadrar ${layer.name}`}
                              onClick={() =>
                                map.current?.fitFeatures({
                                  type: "FeatureCollection",
                                  features: project.features.features.filter(
                                    (f) => f.properties?.layerId === layer.id,
                                  ),
                                })
                              }
                            >
                              <Maximize size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="canvas-heading">
                    <h3>Elementos del canvas</h3>
                    <p>Dibujos, anotaciones y datos importados.</p>
                  </div>
                  <div className="search-input">
                    <Search size={15} />
                    <input
                      aria-label="Filtrar elementos"
                      placeholder="Buscar un elemento…"
                      value={canvasFilter}
                      onChange={(e) => setCanvasFilter(e.target.value)}
                    />
                  </div>
                  {!project.features.features.length ? (
                    <div className="canvas-empty">
                      <Pencil size={25} />
                      <strong>Empieza sobre el mapa</strong>
                      <p>
                        Crea un punto, dibuja un tramo o importa tu primera
                        capa.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => input.current?.click()}
                      >
                        <Upload size={14} />
                        Importar GeoJSON
                      </button>
                    </div>
                  ) : (
                    project.features.features
                      .filter((f) =>
                        String(f.properties?.name)
                          .toLowerCase()
                          .includes(canvasFilter.toLowerCase()),
                      )
                      .map((f) => (
                        <button
                          key={f.id}
                          className={`canvas-item ${selected === f.id ? "selected" : ""}`}
                          onClick={() => {
                            setSelected(String(f.id));
                            setTool("select");
                            setRight(true);
                            map.current?.fitFeatures({
                              type: "FeatureCollection",
                              features: [f],
                            });
                          }}
                        >
                          {f.geometry.type === "Point" ? (
                            <MapPin size={16} />
                          ) : f.geometry.type.includes("Polygon") ? (
                            <Triangle size={16} />
                          ) : (
                            <Spline size={16} />
                          )}
                          <span>
                            {String(f.properties?.name || "Sin nombre")}
                            <small>{f.geometry.type}</small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))
                  )}
                </>
              )}
            </div>
            <div className="library-footer">
              <button onClick={() => setModal("library")}>
                <BookOpen size={18} />
                <span>Library</span>
                <Plus size={16} />
              </button>
              <div>
                <span className="tiny-dot" /> {visibleCount} elementos visibles{" "}
                <span>WGS84</span>
              </div>
            </div>
          </aside>
        )}
        <section className="map-region" aria-label="Visor cartográfico">
          <MapCanvas
            ref={map}
            project={project}
            tool={tool}
            selected={selected}
            onCreate={createFeature}
            onUpdate={editFeature}
            onSelect={(f) => {
              setSelected(f?.id || null);
              if (f) setRight(true);
            }}
            terrain={terrain}
            onQuery={(q) => {
              const sequence = ++querySequence.current;
              setQuery(q);
              setElevation(null);
              setRight(true);
              if (terrain)
                api<{ elevation: number | null; status: string }>(
                  "/api/terrain/elevation",
                  {
                    method: "POST",
                    body: JSON.stringify({ lng: q.lng, lat: q.lat }),
                  },
                )
                  .then((result) => {
                    if (sequence === querySequence.current)
                      setElevation(result);
                  })
                  .catch((e) => notify(e.message));
            }}
            onCoordinates={setCoordinates}
            onNotice={notify}
            onView={(view) => setProject((p) => ({ ...p, view }))}
            onReady={() => setMapReady(true)}
          />
          <div className="map-breadcrumb">
            {!left && (
              <IconButton
                icon={Layers}
                label="Abrir panel de capas"
                onClick={() => setLeft(true)}
              />
            )}
            <span className="breadcrumb-icon">
              <MapPin size={13} />
            </span>
            <strong>Illes Balears</strong>
            <ChevronRight size={12} />
            <span>Conservación de torrentes</span>
          </div>
          {!right && (
            <button
              className="open-right"
              title="Abrir panel de análisis"
              aria-label="Abrir panel de análisis"
              onClick={() => setRight(true)}
            >
              <SlidersHorizontal size={17} />
            </button>
          )}
          <div className="map-bottom-actions">
            <IconButton
              icon={Compass}
              label="Ver todas las Illes Balears"
              onClick={() => map.current?.flyTo([2.85, 39.5], 7.4)}
            />
            <IconButton
              icon={MapPin}
              label="Volver a Mallorca"
              onClick={() => map.current?.flyTo([2.94, 39.65], 8.6)}
            />
          </div>
          <div className="drawing-bar" aria-label="Herramientas de dibujo">
            {bottomTools.map((t, i) => (
              <span key={t.id} className={i === 1 ? "with-divider" : ""}>
                <button
                  className={tool === t.id ? "active" : ""}
                  aria-label={t.label}
                  title={t.label}
                  aria-pressed={tool === t.id}
                  onClick={() => setTool(t.id)}
                >
                  <t.icon size={19} />
                </button>
              </span>
            ))}
            <span className="drawing-divider" />
            <button
              aria-label="Deshacer"
              title="Deshacer · Ctrl+Z"
              onClick={undo}
              disabled={!history.current.length}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Rehacer"
              title="Rehacer · Ctrl+Shift+Z"
              onClick={redo}
              disabled={!future.current.length}
            >
              <Redo2 size={17} />
            </button>
          </div>
          {tool !== "navigate" && (
            <div className="tool-hint">
              <span className="tiny-dot" />
              {TOOL_INFO[tool].hint}
              {["line", "polygon", "area", "profile"].includes(tool) && (
                <button onClick={() => map.current?.finish()}>
                  Terminar <Check size={12} />
                </button>
              )}
            </div>
          )}
          {!mapReady && (
            <div className="map-loading">Preparando cartografía…</div>
          )}
        </section>
        {right && (
          <aside className="right-panel" aria-label="Parámetros e información">
            <div className="right-heading">
              <SlidersHorizontal size={16} />
              <span>
                {feature
                  ? "Elemento seleccionado"
                  : tool === "profile"
                    ? "Profile"
                    : tool === "watershed"
                      ? "Watershed"
                      : tool === "query"
                        ? "Point Query"
                        : "Análisis del terreno"}
              </span>
              <IconButton
                icon={PanelRightClose}
                label="Plegar panel de análisis"
                onClick={() => setRight(false)}
              />
            </div>
            <div className="panel-scroll">
              {feature ? (
                <>
                  <div className="context-title">
                    <div className="eyebrow">
                      CANVAS · {feature.geometry.type}
                    </div>
                    <h2>{String(feature.properties?.name || "Elemento")}</h2>
                    <span className="metric-tag">{metric(feature)}</span>
                  </div>
                  <div className="parameter-section">
                    <label className="field-label" htmlFor="feature-name">
                      Nombre
                    </label>
                    <input
                      id="feature-name"
                      value={String(feature.properties?.name || "")}
                      maxLength={200}
                      onChange={(e) =>
                        editFeature({
                          ...feature,
                          properties: {
                            ...feature.properties,
                            name: e.target.value,
                          },
                        })
                      }
                    />
                    <label className="field-label" htmlFor="feature-note">
                      Notas
                    </label>
                    <textarea
                      id="feature-note"
                      value={String(feature.properties?.note || "")}
                      onChange={(e) =>
                        editFeature({
                          ...feature,
                          properties: {
                            ...feature.properties,
                            note: e.target.value.slice(0, 4000),
                          },
                        })
                      }
                      placeholder="Añade una observación sobre el terreno…"
                      rows={4}
                    />
                    {typeof feature.properties?.image === "string" &&
                      /^data:image\/(jpeg|png|webp);base64,/.test(
                        feature.properties.image,
                      ) && (
                        <img
                          className="selected-photo"
                          src={feature.properties.image}
                          alt={String(feature.properties.name)}
                        />
                      )}
                    <div className="feature-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setTool("edit");
                          notify(
                            "Arrastra los vértices naranjas. La geometría se actualizará al soltar.",
                          );
                        }}
                        disabled={feature.geometry.type.startsWith("Multi")}
                      >
                        <Pencil size={13} />
                        Editar vértices
                      </button>
                      <IconButton
                        icon={Trash2}
                        label="Eliminar elemento seleccionado"
                        onClick={deleteSelected}
                      />
                    </div>
                  </div>
                  {terrain && feature.geometry.type === "LineString" && (
                    <div className="parameter-section">
                      <h3>Perfil del terreno</h3>
                      <p className="subtle-note">
                        Muestreo del MDT piloto; solo dentro de su cobertura.
                      </p>
                      <button
                        className="secondary"
                        disabled={profileBusy}
                        onClick={async () => {
                          setProfileBusy(true);
                          try {
                            setProfileResult(
                              await api("/api/terrain/profile", {
                                method: "POST",
                                body: JSON.stringify({
                                  geometry: feature.geometry,
                                }),
                              }),
                            );
                          } catch (e) {
                            notify((e as Error).message);
                          } finally {
                            setProfileBusy(false);
                          }
                        }}
                      >
                        <Activity size={13} />
                        {profileBusy ? "Muestreando…" : "Consultar perfil real"}
                      </button>
                      {profileResult && (
                        <>
                          <TerrainProfile result={profileResult} />
                          <button
                            className="text-button"
                            onClick={() =>
                              download(
                                "perfil-mdt-provisional.json",
                                profileResult,
                              )
                            }
                          >
                            <Download size={12} />
                            Exportar muestras
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="parameter-section">
                    <h3>Propiedades</h3>
                    <dl className="properties">
                      <dt>Geometría</dt>
                      <dd>{feature.geometry.type}</dd>
                      <dt>Referencia</dt>
                      <dd>EPSG:4326</dd>
                      {Object.entries(feature.properties || {})
                        .filter(
                          ([k]) =>
                            !["name", "note", "layerId", "image"].includes(k),
                        )
                        .slice(0, 20)
                        .map(([k, v]) => (
                          <div className="property-row" key={k}>
                            <dt>{k}</dt>
                            <dd>{String(v).slice(0, 200)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                  <button
                    className="text-button export-one"
                    onClick={() =>
                      download("elemento.geojson", {
                        type: "FeatureCollection",
                        features: [feature],
                      })
                    }
                  >
                    <Download size={14} />
                    Exportar este elemento
                  </button>
                </>
              ) : (
                <>
                  <div className="context-title">
                    <div className="eyebrow">
                      {tool === "query"
                        ? "CONSULTA DEL MAPA"
                        : tool === "profile"
                          ? "PERFIL LONGITUDINAL"
                          : tool === "watershed"
                            ? "DELIMITACIÓN DE CUENCA"
                            : "ANÁLISIS HIDROLÓGICO"}
                    </div>
                    <h2>
                      {tool === "query"
                        ? "Point Query"
                        : tool === "profile"
                          ? "Profile"
                          : tool === "watershed"
                            ? "Watershed"
                            : analysis === "flood"
                              ? "Flash Flood Map"
                              : analysis === "flow"
                                ? "Red de flujo"
                                : "Depresiones"}
                    </h2>
                    <p>
                      {tool === "query"
                        ? "Consulta las coordenadas y los elementos del mapa."
                        : tool === "profile"
                          ? "Define el trazado de un perfil sobre el terreno."
                          : tool === "watershed"
                            ? "Identifica el área que aporta agua a un punto."
                            : analysis === "flow"
                              ? "Visualiza la dirección D8, la acumulación y la red de drenaje derivadas del MDT acondicionado."
                              : analysis === "depressions"
                                ? "Visualiza las celdas elevadas durante el relleno topográfico de depresiones."
                                : "Explora la respuesta del territorio a un episodio de lluvia."}
                    </p>
                    <span className="data-status">
                      <span />{" "}
                      {tool === "query"
                        ? terrain
                          ? "Coordenadas · Z nativa provisional"
                          : "Coordenadas disponibles"
                        : terrain?.hydrology && analysis !== "flood"
                          ? "D8 provisional · resultado disponible"
                          : terrain
                            ? "MDT provisional · análisis pendiente"
                            : "Sin modelo de terreno"}
                    </span>
                  </div>
                  {tool === "query" || tool === "watershed" ? (
                    <div className="parameter-section">
                      <h3>Posición de consulta</h3>
                      {query ? (
                        <>
                          <dl className="coordinates-detail">
                            <dt>Longitud</dt>
                            <dd>{query.lng.toFixed(6)}°</dd>
                            <dt>Latitud</dt>
                            <dd>{query.lat.toFixed(6)}°</dd>
                            <dt>Z nativa</dt>
                            <dd className="muted">
                              {!terrain
                                ? "Sin MDT"
                                : !elevation
                                  ? "Consultando…"
                                  : elevation.elevation === null
                                    ? "Fuera del piloto / sin datos"
                                    : elevation.elevation.toFixed(3)}
                            </dd>
                          </dl>
                          <button
                            className="text-button"
                            onClick={() => {
                              navigator.clipboard
                                ?.writeText(
                                  `${query.lng.toFixed(6)}, ${query.lat.toFixed(6)}`,
                                )
                                .then(() => notify("Coordenadas copiadas."))
                                .catch(() =>
                                  notify("No se pudo acceder al portapapeles."),
                                );
                            }}
                          >
                            <Copy size={12} />
                            Copiar coordenadas
                          </button>
                        </>
                      ) : (
                        <div className="query-empty">
                          <LocateFixed size={25} />
                          <p>
                            Haz clic sobre el mapa
                            <br />
                            para elegir una posición.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : tool === "profile" ? (
                    <div className="parameter-section">
                      <div className="empty-profile">
                        <Activity size={32} />
                        <p>Sin muestras de elevación</p>
                        <span>
                          El perfil se generará a partir de un MDT validado,
                          nunca de valores simulados.
                        </span>
                      </div>
                      <p className="subtle-note">
                        Puedes dibujar y guardar la línea de referencia con la
                        herramienta Profile.
                      </p>
                    </div>
                  ) : analysis !== "flood" && terrain?.hydrology ? (
                    <>
                      <div className="parameter-section">
                        <div className="section-title">
                          {analysis === "flow" ? (
                            <Spline size={16} />
                          ) : (
                            <Waves size={16} />
                          )}
                          <h3>
                            {analysis === "flow"
                              ? "Flujo topográfico D8"
                              : "Relleno de depresiones"}
                          </h3>
                          <Info size={13} />
                        </div>
                        <button
                          className="secondary hydrology-toggle"
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              flowVisible:
                                analysis === "flow"
                                  ? !p.flowVisible
                                  : p.flowVisible,
                              depressionsVisible:
                                analysis === "depressions"
                                  ? !p.depressionsVisible
                                  : p.depressionsVisible,
                            }))
                          }
                        >
                          {analysis === "flow" ? (
                            project.flowVisible ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )
                          ) : project.depressionsVisible ? (
                            <EyeOff size={13} />
                          ) : (
                            <Eye size={13} />
                          )}
                          {analysis === "flow"
                            ? project.flowVisible
                              ? "Ocultar acumulación y red"
                              : "Mostrar acumulación y red"
                            : project.depressionsVisible
                              ? "Ocultar depresiones"
                              : "Mostrar depresiones"}
                        </button>
                        {analysis === "flow" && (
                          <label className="hydrology-select">
                            Área mínima de la red
                            <select
                              aria-label="Área mínima de la red de flujo"
                              value={project.flowThresholdHa || 1}
                              onChange={(event) =>
                                update((p) => ({
                                  ...p,
                                  flowThresholdHa: Number(event.target.value) as
                                    | 0.25
                                    | 1
                                    | 5,
                                }))
                              }
                            >
                              <option value="0.25">0,25 ha</option>
                              <option value="1">1 ha</option>
                              <option value="5">5 ha</option>
                            </select>
                          </label>
                        )}
                      </div>
                      <div className="parameter-section">
                        <h3>Resumen del cálculo</h3>
                        <dl className="properties hydrology-stats">
                          {analysis === "flow" ? (
                            <>
                              <dt>Dirección</dt>
                              <dd>D8, una salida por celda</dd>
                              <dt>Área máxima aportante</dt>
                              <dd>
                                {(
                                  terrain.hydrology
                                    .maximum_contributing_area_m2 / 10000
                                ).toFixed(2)}{" "}
                                ha
                              </dd>
                              <dt>Segmentos base</dt>
                              <dd>{terrain.hydrology.network_segments}</dd>
                            </>
                          ) : (
                            <>
                              <dt>Celdas rellenadas</dt>
                              <dd>{terrain.hydrology.filled_cells}</dd>
                              <dt>Profundidad máxima</dt>
                              <dd>
                                {terrain.hydrology.maximum_fill_depth_m.toFixed(
                                  3,
                                )}{" "}
                                m
                              </dd>
                              <dt>Volumen de relleno</dt>
                              <dd>
                                {terrain.hydrology.fill_volume_m3.toFixed(1)} m³
                              </dd>
                            </>
                          )}
                        </dl>
                        <div className="parameter-callout">
                          <Info size={14} />
                          <p>{terrain.hydrology.limitations}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="parameter-section">
                        <div className="section-title">
                          <CloudRain size={16} />
                          <h3>Precipitación</h3>
                          <Info size={13} />
                        </div>
                        <div className="rain-value">
                          <input
                            aria-label="Precipitación en mm"
                            type="number"
                            min="0"
                            max="500"
                            step="1"
                            value={project.rainfall}
                            onChange={(e) =>
                              update(
                                (p) => ({
                                  ...p,
                                  rainfall: Math.min(
                                    500,
                                    Math.max(0, Number(e.target.value)),
                                  ),
                                }),
                                false,
                              )
                            }
                          />
                          <span>mm</span>
                          <span className="rain-icon">
                            <CloudRain size={25} />
                          </span>
                        </div>
                        <input
                          className="rain-range"
                          aria-label="Ajustar precipitación"
                          type="range"
                          min="0"
                          max="500"
                          step="5"
                          value={project.rainfall}
                          onChange={(e) =>
                            update(
                              (p) => ({
                                ...p,
                                rainfall: Number(e.target.value),
                              }),
                              false,
                            )
                          }
                        />
                        <div className="range-labels">
                          <span>0 mm</span>
                          <span>250</span>
                          <span>500 mm</span>
                        </div>
                        <div className="parameter-callout">
                          <Info size={14} />
                          <p>
                            Parámetro guardado. No genera resultados hasta
                            integrar y validar el modelo.
                          </p>
                        </div>
                      </div>
                      <div className="parameter-section">
                        <h3>Capas del análisis</h3>
                        <div className="analysis-legend">
                          <span className="legend-swatch" />
                          <span>Acumulación de agua</span>
                          <small>Pendiente</small>
                        </div>
                        <div className="analysis-legend">
                          <span className="legend-line" />
                          <span>Recorrido del flujo</span>
                          <small>Pendiente</small>
                        </div>
                        <div className="depth-legend">
                          <div />
                          <span>Profundidad · sin resultados</span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="terrain-needed">
                    <div className="terrain-needed-icon">
                      <Mountain size={24} />
                      <span>
                        <LockKeyhole size={10} />
                      </span>
                    </div>
                    <h3>
                      {terrain
                        ? "Terreno provisional preparado"
                        : "Conecta el terreno"}
                    </h3>
                    <p>
                      {terrain
                        ? "MDT piloto preparado a " +
                          terrain.resolution_m +
                          " m. Z nativa y precisión pendientes de validar. Las cuencas y las inundaciones siguen pendientes de cálculo."
                        : "Falta procesar y validar el LiDAR piloto PNOA. No hay inundaciones, cuencas ni elevaciones calculadas."}
                    </p>
                    {terrain && (
                      <button
                        className="text-button"
                        onClick={() => {
                          update((p) => ({ ...p, terrainVisible: true }));
                          map.current?.flyTo(terrain.center, 15);
                          setTool("query");
                        }}
                      >
                        Consultar piloto real <LocateFixed size={12} />
                      </button>
                    )}
                    <button
                      className="secondary"
                      onClick={() => {
                        setModal("library");
                      }}
                    >
                      Ver fuentes y datos <ArrowRight size={13} />
                    </button>
                  </div>
                  <div className="right-bottom-note">
                    <LockKeyhole size={12} />
                    DynamicFlood fuera del alcance.
                  </div>
                </>
              )}
            </div>
            <div className="selection-footer">
              <MousePointer2 size={13} />
              <span>
                {selected
                  ? "1 elemento seleccionado"
                  : "Ningún elemento seleccionado"}
              </span>
              {selected && (
                <IconButton
                  icon={X}
                  label="Quitar selección"
                  onClick={() => setSelected(null)}
                />
              )}
            </div>
          </aside>
        )}
      </main>
      <footer className="statusbar">
        <div className="status-left">
          <span className="live-dot" />
          <span>
            {session.mode === "local" ? "Desarrollo local" : "Espacio privado"}
          </span>
          <span className="status-divider" />
          <span className="status-project">{project.name}</span>
        </div>
        <div className="status-right">
          <span className="status-coords">
            {coordinates[0].toFixed(5)}° E &nbsp; {coordinates[1].toFixed(5)}° N
          </span>
          <span className="status-divider" />
          <span>EPSG:4326</span>
          <button
            onClick={() => void saveProject()}
            disabled={busy}
            title="Guardar proyecto · Ctrl+S"
          >
            <Save size={12} />
            {saved === "saving"
              ? "Guardando…"
              : saved === "saved"
                ? "Guardado"
                : saved === "error"
                  ? "Reintentar guardado"
                  : "Guardar proyecto"}
          </button>
        </div>
      </footer>
      <input
        ref={input}
        type="file"
        accept=".geojson,.json"
        hidden
        aria-label="Archivo GeoJSON o proyecto"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label="Fotografía georreferenciada"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readPhoto(f);
          e.target.value = "";
        }}
      />
      {notice && (
        <div role="status" className="toast">
          <Info size={17} />
          <span>{notice}</span>
          <IconButton
            icon={X}
            label="Cerrar aviso"
            onClick={() => setNotice("")}
          />
        </div>
      )}
      {modal === "library" && (
        <ModalBox
          title="Library"
          eyebrow="DATOS Y CARTOGRAFÍA"
          wide
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            Incorpora datos a tu espacio de trabajo y consulta las fuentes del
            territorio.
          </p>
          <div className="import-options">
            <button onClick={() => input.current?.click()}>
              <div className="import-icon">
                <Upload size={23} />
              </div>
              <strong>Importar capa</strong>
              <span>GeoJSON · WGS84 / EPSG:4326</span>
              <small>Puntos, líneas y polígonos · hasta 24 MB</small>
            </button>
            <button
              onClick={() => photoInput.current?.click()}
              disabled={photoBusy}
            >
              <div className="import-icon">
                <ImagePlus size={23} />
              </div>
              <strong>
                {photoBusy ? "Leyendo imagen…" : "Añadir fotografía"}
              </strong>
              <span>JPEG, PNG o WebP</span>
              <small>GPS EXIF o coordenadas manuales</small>
            </button>
          </div>
          {importError && (
            <p role="alert" className="error">
              {importError}
            </p>
          )}
          <h3 className="modal-section-title">Fuentes cartográficas</h3>
          <div className="source-row">
            <span className="source-icon">
              <MapIcon size={19} />
            </span>
            <div>
              <strong>OpenFreeMap · OpenStreetMap</strong>
              <p>Mapa vectorial con vías, edificios y topónimos.</p>
            </div>
            <button
              className="text-button"
              onClick={() => {
                update((p) => ({ ...p, basemap: "streets" }));
                setModal(null);
              }}
            >
              Usar
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="source-row">
            <span className="source-icon">
              <ImagePlus size={19} />
            </span>
            <div>
              <strong>PNOA · Instituto Geográfico Nacional</strong>
              <p>Ortofotografía oficial mediante WMS.</p>
            </div>
            <button
              className="text-button"
              onClick={() => {
                update((p) => ({ ...p, basemap: "ortho" }));
                setModal(null);
              }}
            >
              Usar
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="source-row">
            <span className="source-icon">
              <Layers size={19} />
            </span>
            <div>
              <strong>IDEIB · Govern de les Illes Balears</strong>
              <p>
                Catálogo oficial. Capas de hidrología pendientes de integrar.
              </p>
            </div>
            <a
              href="https://ideib.caib.es/"
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir IDEIB"
            >
              <ExternalLink size={16} />
            </a>
          </div>
          <div className="pilot-source">
            <div>
              <Mountain size={18} />
              <strong>Piloto LiDAR · PNOA 2024</strong>
              <span className="status-chip">
                {terrain ? "MDT provisional" : "Pendiente"}
              </span>
            </div>
            <code>PNOA_2024_BAL_462-4382_H31_NPC03.laz</code>
            <p>
              {terrain
                ? "LAZ descargado e inspeccionado. MDT real a 1,5 m preparado; datum vertical y precisión sin validar. "
                : ""}
              MDT de terreno desnudo y modelo independiente con huellas de
              edificios verificadas a cota máxima del terreno + 10 m. Los
              árboles no se usarán como barreras.
            </p>
            <a
              href="https://centrodedescargas.cnig.es/CentroDescargas/detalleArchivo?sec=13023168"
              target="_blank"
              rel="noreferrer"
            >
              Ficha del CNIG <ExternalLink size={12} />
            </a>
          </div>
        </ModalBox>
      )}
      {modal === "projects" && (
        <ModalBox
          title="Tu espacio de trabajo"
          eyebrow="WORKSPACE"
          wide
          onClose={() => setModal(null)}
        >
          <div className="project-current">
            <FolderOpen size={25} />
            <div>
              <strong>{project.name}</strong>
              <p>
                {project.features.features.length} geometrías ·{" "}
                {project.layers.length} capas
              </p>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void saveProject()}
            >
              <Save size={14} />
              Guardar
            </button>
          </div>
          <div className="workspace-actions">
            <button className="secondary" onClick={() => setModal("new")}>
              <FilePlus2 size={14} />
              Nuevo proyecto
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void saveProject(true)}
            >
              <Copy size={14} />
              Guardar copia
            </button>
            <button
              className="secondary"
              onClick={() => input.current?.click()}
            >
              <Upload size={14} />
              Abrir archivo
            </button>
          </div>
          <h3 className="modal-section-title">Proyectos guardados</h3>
          {projectError && (
            <p className="error" role="alert">
              {projectError}
            </p>
          )}
          {projects.length ? (
            projects.map((p) => (
              <div className="saved-project" key={p.id}>
                <FolderOpen size={18} />
                <div>
                  <strong>{p.name}</strong>
                  <small>{new Date(p.updatedAt).toLocaleString("es-ES")}</small>
                </div>
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      loadProject(
                        parseProject(await api("/api/projects/" + p.id)),
                        p.id,
                      );
                      setModal(null);
                      notify("Proyecto recuperado.");
                    } catch (e) {
                      setProjectError((e as Error).message);
                    }
                  }}
                >
                  Abrir
                  <ArrowRight size={13} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-projects">
              <FolderOpen size={25} />
              <p>Aún no hay proyectos guardados en el servidor.</p>
              <small>
                Los cambios se conservan como borrador en este navegador.
              </small>
            </div>
          )}
        </ModalBox>
      )}
      {modal === "new" && (
        <ModalBox title="Crear un proyecto" onClose={() => setModal(null)}>
          <p className="modal-description">
            El borrador actual se sustituirá. Guarda antes el proyecto si
            quieres recuperarlo más tarde.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal("projects")}>
              Volver
            </button>
            <button
              className="primary"
              onClick={() => {
                loadProject(structuredClone(INITIAL), null);
                setModal(null);
                notify("Nuevo proyecto creado.");
              }}
            >
              Crear proyecto
            </button>
          </div>
        </ModalBox>
      )}
      {modal === "address" && (
        <ModalBox
          title="Ir a una ubicación"
          eyebrow="ADDRESS"
          onClose={() => setModal(null)}
        >
          <div className="search-input address-search">
            <Search size={17} />
            <input
              autoFocus
              aria-label="Buscar municipio o coordenadas"
              placeholder="Municipio o longitud, latitud…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="search-hint">
            Lugares de referencia o coordenadas WGS84. No es un geocodificador
            de direcciones.
          </p>
          {places
            .filter((p) =>
              p.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .includes(
                  search
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase(),
                ),
            )
            .map((p) => (
              <button
                key={p.name}
                className="place-row"
                onClick={() => {
                  map.current?.flyTo(p.center, p.zoom);
                  setModal(null);
                }}
              >
                <MapPin size={16} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.sub}</small>
                </span>
                <ArrowRight size={15} />
              </button>
            ))}
          {(() => {
            const m = search.match(
              /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
            );
            if (!m || Math.abs(+m[1]) > 180 || Math.abs(+m[2]) > 90)
              return null;
            return (
              <button
                className="place-row"
                onClick={() => {
                  map.current?.flyTo([+m[1], +m[2]], 14);
                  setModal(null);
                }}
              >
                <LocateFixed size={17} />
                <span>
                  <strong>Ir a las coordenadas</strong>
                  <small>
                    {m[1]}°, {m[2]}°
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            );
          })()}
        </ModalBox>
      )}
      {modal === "export" && (
        <ModalBox
          title="Exportar tu trabajo"
          eyebrow="EXPORT"
          onClose={() => setModal(null)}
        >
          <p className="modal-description">
            Descarga las geometrías o una copia completa del proyecto. Las
            cartografías externas no se incluyen.
          </p>
          <button
            className="export-option"
            onClick={() => {
              download("torrents.geojson", project.features);
              notify("GeoJSON exportado.");
            }}
            disabled={!project.features.features.length}
          >
            <div>
              <Spline size={23} />
            </div>
            <span>
              <strong>Geometrías · GeoJSON</strong>
              <small>
                {project.features.features.length} elementos · EPSG:4326
              </small>
            </span>
            <ArrowDownToLine size={18} />
          </button>
          <button
            className="export-option"
            onClick={() => {
              download("proyecto.torrents.json", {
                ...project,
                view: map.current?.getView() || project.view,
              });
              notify("Copia del proyecto exportada.");
            }}
          >
            <div>
              <Layers size={23} />
            </div>
            <span>
              <strong>Proyecto completo · JSON</strong>
              <small>Capas, geometrías, notas, fotos y parámetros</small>
            </span>
            <ArrowDownToLine size={18} />
          </button>
          <div className="parameter-callout">
            <Info size={14} />
            <p>No hay resultados hidrológicos disponibles para exportar.</p>
          </div>
        </ModalBox>
      )}
      {modal === "photo" && photo && (
        <ModalBox
          title="Ubicar fotografía"
          eyebrow="DATOS GEORREFERENCIADOS"
          onClose={() => {
            setModal(null);
            setPhoto(null);
          }}
        >
          <img
            className="photo-preview"
            src={photo.image}
            alt="Vista previa de la fotografía"
          />
          <p className="modal-description">
            {photo.gps
              ? "Coordenadas GPS leídas de los metadatos EXIF. Comprueba la ubicación antes de añadirla."
              : "La foto no incluye GPS. Introduce su ubicación en WGS84."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const lat = Number(photo.lat),
                lng = Number(photo.lng);
              if (
                !photo.lat.trim() ||
                !photo.lng.trim() ||
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                Math.abs(lat) > 90 ||
                Math.abs(lng) > 180
              ) {
                notify("Introduce una longitud y latitud válidas.");
                return;
              }
              const layerId = "photos";
              const f: MapFeature = {
                type: "Feature",
                id: crypto.randomUUID(),
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: {
                  name: photo.name,
                  kind: "photo",
                  image: photo.image,
                  locationSource: photo.gps ? "EXIF" : "manual",
                  layerId,
                },
              };
              update((p) => ({
                ...p,
                layers: p.layers.some((l) => l.id === layerId)
                  ? p.layers
                  : [
                      ...p.layers,
                      {
                        id: layerId,
                        name: "Fotografías",
                        visible: true,
                        opacity: 1,
                        color: "#a577b7",
                        source: "photo",
                      },
                    ],
                features: {
                  type: "FeatureCollection",
                  features: [...p.features.features, f],
                },
              }));
              setSelected(f.id);
              map.current?.flyTo([lng, lat], 14);
              setRight(true);
              setPhoto(null);
              setModal(null);
              notify("Fotografía incorporada al proyecto.");
            }}
          >
            <label className="field-label">
              Nombre
              <input
                required
                value={photo.name}
                onChange={(e) => setPhoto({ ...photo, name: e.target.value })}
                maxLength={200}
              />
            </label>
            <div className="coordinate-inputs">
              <label>
                Longitud
                <input
                  required
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={photo.lng}
                  onChange={(e) =>
                    setPhoto({ ...photo, lng: e.target.value, gps: false })
                  }
                />
              </label>
              <label>
                Latitud
                <input
                  required
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={photo.lat}
                  onChange={(e) =>
                    setPhoto({ ...photo, lat: e.target.value, gps: false })
                  }
                />
              </label>
            </div>
            <button className="primary" type="submit">
              <MapPin size={15} />
              Añadir al mapa
            </button>
          </form>
        </ModalBox>
      )}
      {modal === "account" && (
        <ModalBox title="Tu cuenta" onClose={() => setModal(null)}>
          <div className="account-info">
            <UserRound size={28} />
            <h3>
              {session.mode === "local" ? "Desarrollo local" : session.name}
            </h3>
            <p>
              {session.mode === "local"
                ? "Modo de desarrollo limitado a localhost. Para uso privado, crea un usuario con npm run user:add y ejecuta el servidor en producción con HTTPS."
                : "Sesión privada. Tus proyectos solo están disponibles para este usuario."}
            </p>
          </div>
          {session.mode === "private" && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api("/api/logout", { method: "POST", body: "{}" });
                  setModal(null);
                  setLoaded(false);
                  setProject(structuredClone(INITIAL));
                  setProjectId(null);
                  setSession({ ...session, authenticated: false, name: null });
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          )}
        </ModalBox>
      )}
      {modal === "help" && (
        <ModalBox
          title="Un espacio para entender el territorio"
          eyebrow="TORRENTS · GUÍA RÁPIDA"
          wide
          onClose={() => setModal(null)}
        >
          <div className="help-intro">
            <Droplets size={34} />
            <p>
              Visor SIG de conservación de torrentes en Baleares. Navega,
              documenta actuaciones y organiza tus datos geográficos en un
              espacio de trabajo.
            </p>
          </div>
          <div className="help-grid">
            <section>
              <h3>
                <MousePointer2 size={17} />
                Navega y consulta
              </h3>
              <p>
                Arrastra para desplazarte y usa la rueda para hacer zoom. Point
                Query muestra coordenadas y propiedades. Address localiza
                municipios o coordenadas.
              </p>
            </section>
            <section>
              <h3>
                <Pencil size={17} />
                Dibuja y edita
              </h3>
              <p>
                Usa la barra inferior. En líneas y polígonos, doble clic o Enter
                termina el trazado. Selecciona un elemento para editar su
                nombre, notas o vértices.
              </p>
            </section>
            <section>
              <h3>
                <Layers size={17} />
                Organiza tus datos
              </h3>
              <p>
                Library importa GeoJSON y fotografías. Regula visibilidad, color
                y opacidad de cada capa. Guarda en Workspace o exporta una copia
                completa.
              </p>
            </section>
            <section>
              <h3>
                <Mountain size={17} />
                Análisis con rigor
              </h3>
              <p>
                Si el piloto está preparado, Point Query y los perfiles
                muestrean el MDT real y muestran su carácter provisional.
                Cuencas y Flash Flood Map siguen pendientes de validación e
                implementación. La lluvia es un parámetro guardado.
              </p>
            </section>
          </div>
          <div className="shortcuts">
            <span>
              <kbd>Enter</kbd>Terminar dibujo
            </span>
            <span>
              <kbd>Esc</kbd>Cancelar
            </span>
            <span>
              <kbd>Ctrl Z</kbd>Deshacer
            </span>
            <span>
              <kbd>Ctrl S</kbd>Guardar
            </span>
            <span>
              <kbd>Supr</kbd>Eliminar selección
            </span>
          </div>
          <div className="help-source">
            Diseño inspirado en la organización de SCALGO Live, con identidad y
            alcance propios.{" "}
            <a
              href="https://scalgo.com/en-US/scalgo-live-documentation/analysis/flash-flood-map"
              target="_blank"
              rel="noreferrer"
            >
              Documentación de referencia <ExternalLink size={12} />
            </a>
          </div>
        </ModalBox>
      )}
    </div>
  );
}
