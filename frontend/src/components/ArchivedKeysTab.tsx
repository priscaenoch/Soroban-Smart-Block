/**
 * Issue #176 — Archived / Evicted Keys Tab
 *
 * Displays the "Archived / Evicted Keys" tab in the contract storage state
 * dashboard, listing persistent data entries that have expired off-chain
 * with the estimated RestoreFootprintOp cost to revive them.
 */

import React, { useState } from "react";

export interface StorageEntry {
  contractId: string;
  key: string;
  durability: "persistent" | "temporary" | string;
  liveUntilLedger: number;
  state: "live" | "expiring_soon" | "evicted";
  ledgersUntilEviction: number;
  secondsUntilEviction: number;
  estimatedRestoreFeeStroops: number | null;
  valueSizeBytes?: number;
  lastModifiedLedger?: number | null;
}

export interface EvictionStats {
  total: number;
  live: number;
  expiringSoon: number;
  evicted: number;
  totalEstimatedRestoreFeeStroops: number;
}

interface Props {
  entries: StorageEntry[];
  stats: EvictionStats;
  currentLedger: number;
}

const STATE_COLORS: Record<string, string> = {
  live: "#3fb950",
  expiring_soon: "#d29922",
  evicted: "#f85149",
};

const STATE_LABELS: Record<string, string> = {
  live: "Live",
  expiring_soon: "Expiring Soon",
  evicted: "Evicted",
};

function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7).replace(/\.?0+$/, "") + " XLM";
}

function formatLedgers(ledgers: number): string {
  if (ledgers <= 0) return "Expired";
  const seconds = ledgers * 5;
  if (seconds < 3600) return `~${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `~${Math.round(seconds / 3600)}h`;
  return `~${Math.round(seconds / 86400)}d`;
}

export default function ArchivedKeysTab({ entries, stats, currentLedger }: Props) {
  const [filter, setFilter] = useState<"all" | "evicted" | "expiring_soon">("evicted");

  const visible = entries.filter((e) => (filter === "all" ? true : e.state === filter));

  return (
    <div>
      {/* Stats summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[
          { label: "Total Keys", value: stats.total, color: "inherit" },
          { label: "Live", value: stats.live, color: STATE_COLORS.live },
          {
            label: "Expiring Soon",
            value: stats.expiringSoon,
            color: STATE_COLORS.expiring_soon,
          },
          {
            label: "Evicted",
            value: stats.evicted,
            color: STATE_COLORS.evicted,
          },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Restore cost estimate */}
      {stats.evicted > 0 && stats.totalEstimatedRestoreFeeStroops > 0 && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(248,81,73,0.06)",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#f85149", fontWeight: 700 }}>⚠</span>
          <span style={{ color: "var(--muted)" }}>
            Estimated total <code>RestoreFootprintOp</code> cost to revive all {stats.evicted} evicted{" "}
            {stats.evicted === 1 ? "key" : "keys"}:
          </span>
          <span style={{ fontWeight: 700, color: "#f85149" }}>
            {stroopsToXlm(stats.totalEstimatedRestoreFeeStroops)}
          </span>
          <span style={{ color: "var(--muted)", fontSize: 11 }}>
            ({stats.totalEstimatedRestoreFeeStroops.toLocaleString()} stroops, estimated)
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {(["evicted", "expiring_soon", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "var(--accent, #58a6ff)" : "transparent",
              color: filter === f ? "#fff" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "3px 10px",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: filter === f ? 700 : 400,
            }}
          >
            {f === "all"
              ? "All"
              : f === "evicted"
                ? `Evicted (${stats.evicted})`
                : `Expiring Soon (${stats.expiringSoon})`}
          </button>
        ))}
      </div>

      {/* Keys table */}
      {visible.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          {filter === "evicted" ? "No evicted keys found for this contract." : "No entries match the selected filter."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <th style={th}>Key</th>
                <th style={th}>Durability</th>
                <th style={th}>Live Until Ledger</th>
                <th style={th}>Status</th>
                <th style={th}>Time Remaining</th>
                <th style={th}>Est. Restore Fee</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: entry.state === "evicted" ? "rgba(248,81,73,0.04)" : "transparent",
                  }}
                >
                  <td style={{ ...td, fontFamily: "monospace" }}>
                    <code title={entry.key}>{entry.key.length > 32 ? `${entry.key.slice(0, 32)}…` : entry.key}</code>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{entry.durability}</span>
                  </td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{entry.liveUntilLedger.toLocaleString()}</td>
                  <td style={td}>
                    <span
                      style={{
                        background: `${STATE_COLORS[entry.state]}22`,
                        color: STATE_COLORS[entry.state] ?? "inherit",
                        borderRadius: 3,
                        padding: "2px 7px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {STATE_LABELS[entry.state] ?? entry.state}
                    </span>
                  </td>
                  <td
                    style={{
                      ...td,
                      color: STATE_COLORS[entry.state] ?? "inherit",
                    }}
                  >
                    {entry.state === "evicted" ? (
                      <span style={{ color: "#f85149", fontWeight: 600 }}>Archived off-chain</span>
                    ) : (
                      formatLedgers(entry.ledgersUntilEviction)
                    )}
                  </td>
                  <td style={td}>
                    {entry.estimatedRestoreFeeStroops != null ? (
                      <span
                        title={`${entry.estimatedRestoreFeeStroops.toLocaleString()} stroops`}
                        style={{
                          color: "#f85149",
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      >
                        {stroopsToXlm(entry.estimatedRestoreFeeStroops)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          padding: "8px 16px",
          fontSize: 11,
          color: "var(--muted)",
          borderTop: "1px solid var(--border)",
        }}
      >
        Current ledger: {currentLedger.toLocaleString()} · Restore fee estimates assume 120,960-ledger extension (~1
        week)
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: 11,
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "6px 12px",
  verticalAlign: "middle",
};
