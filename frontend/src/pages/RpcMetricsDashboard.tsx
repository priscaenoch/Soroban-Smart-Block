/**
 * Issue #115 — RPC Node Performance Dashboard
 * Polls /api/rpc-metrics every 15 s and renders latency sparklines + uptime.
 */
import { useEffect, useState } from "react";

interface NodeMetrics {
  url: string;
  latencyAvgMs: number | null;
  latencyP95Ms: number | null;
  errorRate: number;
  uptime: number;
  lastLedger: number;
  sampleCount: number;
  history: number[];
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span style={{ color: "#888" }}>no data</span>;
  const max = Math.max(...values, 1);
  const w = 120, h = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth={1.5} />
    </svg>
  );
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      background: healthy ? "#d1fae5" : "#fee2e2",
      color: healthy ? "#065f46" : "#991b1b",
    }}>
      {healthy ? "UP" : "DOWN"}
    </span>
  );
}

export default function RpcMetricsDashboard() {
  const [metrics, setMetrics] = useState<NodeMetrics[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/rpc-metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMetrics(await res.json());
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>RPC Node Performance</h2>
        {lastUpdated && (
          <span style={{ fontSize: 12, color: "#888" }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: 12, background: "#fee2e2", borderRadius: 6, marginBottom: 16, color: "#991b1b" }}>
          Failed to load metrics: {error}
        </div>
      )}

      {metrics.length === 0 && !error && (
        <p style={{ color: "#888" }}>Loading…</p>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {metrics.map(node => (
          <div key={node.url} style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
            background: "#fff",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <code style={{ fontSize: 13, wordBreak: "break-all" }}>{node.url}</code>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  Ledger #{node.lastLedger} · {node.sampleCount} samples
                </div>
              </div>
              <StatusBadge healthy={node.uptime > 50} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              <Stat label="Avg Latency" value={node.latencyAvgMs != null ? `${node.latencyAvgMs} ms` : "—"} />
              <Stat label="P95 Latency" value={node.latencyP95Ms != null ? `${node.latencyP95Ms} ms` : "—"} />
              <Stat label="Uptime" value={`${node.uptime}%`} highlight={node.uptime < 90} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Latency history (last 60 probes)</div>
              <Sparkline values={node.history} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: highlight ? "#dc2626" : "#111827" }}>{value}</div>
    </div>
  );
}
