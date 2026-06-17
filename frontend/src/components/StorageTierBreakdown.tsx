import type { StorageTiers, StorageWrite } from "../api";

const TIERS: { key: keyof StorageTiers; label: string; color: string }[] = [
  { key: "instance", label: "Instance Configuration", color: "#58a6ff" },
  { key: "persistent", label: "Persistent Data", color: "#3fb950" },
  { key: "temporary", label: "Temporary Scratchpad", color: "#d29922" },
];

export default function StorageTierBreakdown({ tiers }: { tiers: StorageTiers }) {
  const hasAny = TIERS.some((t) => tiers[t.key].length > 0);
  if (!hasAny) return null;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4 style={{ marginBottom: 12, fontSize: 13 }}>State Writes by Storage Tier</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {TIERS.map(({ key, label, color }) => {
          const writes = tiers[key];
          if (writes.length === 0) return null;
          return (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 12, color }}>{label}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>({writes.length})</span>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ color: "var(--muted)" }}>
                    <th style={th}>Key</th>
                    <th style={th}>Change</th>
                    <th style={th}>Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {writes.map((w: StorageWrite, i: number) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={td}>
                        <code>{w.key}</code>
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            color: w.changeType === "created" ? "#3fb950" : "#d29922",
                            fontWeight: 600,
                          }}
                        >
                          {w.changeType}
                        </span>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: "monospace",
                          color: "var(--muted)",
                        }}
                      >
                        {w.contractId.slice(0, 8)}…{w.contractId.slice(-4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  fontWeight: 500,
  fontSize: 11,
};
const td: React.CSSProperties = {
  padding: "5px 8px",
  verticalAlign: "middle",
};
