/**
 * Issue #164 — ZkCostDelta
 * Shows CAP-0080 ZK host function calls and the CPU cost savings
 * (native Protocol 26 vs legacy Wasm-side micro-allocations).
 */
import type { ZkHostCall, ZkCostDelta as ZkCostDeltaType } from "../api";

interface Props {
  calls: ZkHostCall[];
  delta: ZkCostDeltaType | null;
}

export default function ZkCostDelta({ calls, delta }: Props) {
  if (!calls.length) return null;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h4 style={{ marginBottom: 10, fontSize: 13 }}>
        ⚡ ZK Host Functions (CAP-0080 / Protocol 26)
      </h4>

      {/* Aggregate savings banner */}
      {delta && (
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14,
          padding: "10px 14px",
          background: "var(--surface, #1a1a2e)",
          borderRadius: 8,
          borderLeft: "3px solid #22c55e",
        }}>
          <Stat label="Native CPU" value={delta.total_native.toLocaleString()} unit="ops" />
          <Stat label="Legacy Wasm CPU" value={delta.total_legacy.toLocaleString()} unit="ops" />
          <Stat
            label="Saved"
            value={`${delta.saved_cpu.toLocaleString()} (${delta.saved_pct}%)`}
            unit="ops"
            highlight
          />
        </div>
      )}

      {/* Per-call breakdown */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left" }}>
            <Th>Host Function</Th>
            <Th>Curve</Th>
            <Th>Kind</Th>
            <Th align="right">Native CPU</Th>
            <Th align="right">Legacy CPU</Th>
            <Th align="right">Saved</Th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => {
            const saved = c.cpu_legacy - c.cpu_native;
            const pct = c.cpu_legacy > 0 ? Math.round((saved / c.cpu_legacy) * 100) : 0;
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border, #2a2a3e)" }}>
                <Td mono>{c.fn_name}</Td>
                <Td>
                  <span className={`badge ${c.curve === "BN254" ? "green" : "wrap"}`} style={{ fontSize: 10 }}>
                    {c.curve}
                  </span>
                </Td>
                <Td>{c.kind.replace(/_/g, " ")}</Td>
                <Td align="right">{c.cpu_native.toLocaleString()}</Td>
                <Td align="right" muted>{c.cpu_legacy.toLocaleString()}</Td>
                <Td align="right" green>{saved.toLocaleString()} ({pct}%)</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 600, fontSize: 15, color: highlight ? "#22c55e" : undefined }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: "var(--muted)" }}>{unit}</span>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th style={{ padding: "4px 8px", fontWeight: 500, textAlign: align ?? "left" }}>{children}</th>
  );
}

function Td({ children, mono, muted, green, align }: {
  children: React.ReactNode; mono?: boolean; muted?: boolean; green?: boolean; align?: "right";
}) {
  return (
    <td style={{
      padding: "5px 8px",
      fontFamily: mono ? "monospace" : undefined,
      color: muted ? "var(--muted)" : green ? "#22c55e" : undefined,
      textAlign: align ?? "left",
    }}>
      {children}
    </td>
  );
}
