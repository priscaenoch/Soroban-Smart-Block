/**
 * Issue #125 — Gas-Limit Alert Flag
 * Flags transactions consuming >80% of the network's max allowed gas limits.
 * Soroban network limits: 100M CPU instructions, 40MB memory per transaction.
 */
import type { DecodedEvent } from "../api";

// Soroban network maximums (testnet/mainnet defaults)
const MAX_CPU_INSTRUCTIONS = 100_000_000;
const MAX_MEM_BYTES = 40 * 1024 * 1024; // 40 MB
const ALERT_THRESHOLD = 0.8; // 80%

export interface GasAlertInfo {
  cpuPct: number;
  memPct: number;
  isHighCpu: boolean;
  isHighMem: boolean;
}

export function getGasAlert(event: DecodedEvent): GasAlertInfo | null {
  const { cpu_instructions, mem_bytes } = event;
  if (cpu_instructions == null && mem_bytes == null) return null;

  const cpuPct = cpu_instructions != null ? cpu_instructions / MAX_CPU_INSTRUCTIONS : 0;
  const memPct = mem_bytes != null ? mem_bytes / MAX_MEM_BYTES : 0;
  const isHighCpu = cpuPct >= ALERT_THRESHOLD;
  const isHighMem = memPct >= ALERT_THRESHOLD;

  if (!isHighCpu && !isHighMem) return null;
  return { cpuPct, memPct, isHighCpu, isHighMem };
}

export default function GasLimitAlert({ event }: { event: DecodedEvent }) {
  const alert = getGasAlert(event);
  if (!alert) return null;

  const { cpuPct, memPct, isHighCpu, isHighMem } = alert;

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      background: "rgba(245,158,11,0.08)",
      border: "1px solid #f59e0b",
      borderRadius: 6,
      padding: "10px 14px",
      marginTop: 8,
    }}>
      <span style={{ fontSize: 18 }}>⚠</span>
      <div>
        <strong style={{ color: "#f59e0b", fontSize: 13 }}>High Gas Usage — Optimization Recommended</strong>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 0" }}>
          This transaction consumes a high percentage of network limits. Review function efficiency.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {isHighCpu && (
            <GasBar label="CPU" pct={cpuPct} />
          )}
          {isHighMem && (
            <GasBar label="Memory" pct={memPct} />
          )}
        </div>
      </div>
    </div>
  );
}

function GasBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 0.95 ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{(pct * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
