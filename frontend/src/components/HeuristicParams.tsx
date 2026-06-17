import type { HeuristicParam } from "../api";

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  Address: { bg: "rgba(88,166,255,0.12)", fg: "#58a6ff" },
  ContractId: { bg: "rgba(63,185,80,0.12)", fg: "#3fb950" },
  Amount: { bg: "rgba(210,153,34,0.12)", fg: "#d29922" },
  Hash: { bg: "rgba(139,148,158,0.12)", fg: "#8b949e" },
  Symbol: { bg: "rgba(184,128,255,0.12)", fg: "#b880ff" },
  Boolean: { bg: "rgba(248,81,73,0.12)", fg: "#f85149" },
  Unknown: { bg: "rgba(139,148,158,0.08)", fg: "#8b949e" },
};

interface Props {
  params: HeuristicParam[];
}

export default function HeuristicParams({ params }: Props) {
  if (!params || params.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h4 style={{ fontSize: 13 }}>Heuristic Parameters</h4>
        <span
          className="badge yellow"
          title="No ABI registered — types are guessed from value shape"
          style={{ fontSize: 11 }}
        >
          ⚠ Unverified
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {params.map((p) => (
          <ParamRow key={p.index} param={p} />
        ))}
      </div>
    </div>
  );
}

function ParamRow({ param }: { param: HeuristicParam }) {
  const colors = TYPE_COLORS[param.type] ?? TYPE_COLORS.Unknown;
  const label = param.confidence === "likely" ? `Likely ${param.type}` : `Possibly ${param.type}`;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ color: "var(--muted)", minWidth: 70, fontSize: 12 }}>Param {param.index}</span>
      <span
        style={{
          display: "inline-block",
          padding: "1px 7px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          background: colors.bg,
          color: colors.fg,
          whiteSpace: "nowrap",
          minWidth: 100,
        }}
        title={`Confidence: ${param.confidence}`}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          wordBreak: "break-all",
          color: "var(--text)",
        }}
      >
        {param.value}
      </span>
    </div>
  );
}
