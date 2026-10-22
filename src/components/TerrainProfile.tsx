export type ProfileResult = {
  length_m: number;
  status: string;
  samples: {
    distance_m: number;
    elevation: number | null;
    lng: number;
    lat: number;
  }[];
};
export default function TerrainProfile({ result }: { result: ProfileResult }) {
  const valid = result.samples.filter((p) => p.elevation !== null);
  if (!valid.length)
    return (
      <p className="subtle-note">
        La línea está fuera de la cobertura del piloto o atraviesa únicamente
        zonas sin datos.
      </p>
    );
  const min = Math.min(...valid.map((p) => p.elevation!)),
    max = Math.max(...valid.map((p) => p.elevation!));
  let open = false;
  const path = result.samples
    .map((p) => {
      if (p.elevation === null) {
        open = false;
        return "";
      }
      const x = 8 + (p.distance_m / result.length_m) * 220;
      const y = 90 - ((p.elevation - min) / Math.max(0.001, max - min)) * 74;
      const cmd = open ? "L" : "M";
      open = true;
      return `${cmd}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <div className="profile-result">
      <div className="profile-stats">
        <span>{result.length_m.toFixed(0)} m de trazado</span>
        <span>
          {valid.length}/{result.samples.length} muestras
        </span>
      </div>
      <svg
        viewBox="0 0 236 112"
        role="img"
        aria-label={`Perfil real del MDT provisional. Z nativa entre ${min.toFixed(2)} y ${max.toFixed(2)}. Los huecos indican ausencia de datos.`}
      >
        <path
          d="M8,16H228 M8,53H228 M8,90H228"
          stroke="#e3edef"
          strokeDasharray="3 3"
          fill="none"
        />
        <path d={path} stroke="#228e91" strokeWidth="2" fill="none" />
        <text x="8" y="108" fontSize="8" fill="#8aa1ac">
          0 m
        </text>
        <text x="228" y="108" textAnchor="end" fontSize="8" fill="#8aa1ac">
          {result.length_m.toFixed(0)} m
        </text>
      </svg>
      <div className="profile-stats">
        <span>Z mín. {min.toFixed(2)}</span>
        <span>Z máx. {max.toFixed(2)}</span>
      </div>
      <p className="subtle-note">
        Muestras reales de la malla, sin interpolar los huecos. Z nativa; datum
        vertical y precisión sin validar.
      </p>
    </div>
  );
}
