import { useState } from "react";

export interface StorageEntry {
  key: string;
  type: string;
  tier: "instance" | "persistent" | "temporary";
  description?: string;
}

const TIER_META: Record<StorageEntry["tier"], { label: string; color: string; bg: string; ttl: string }> = {
  instance: {
    label: "Instance",
    color: "#58a6ff",
    bg: "#0d2a3a",
    ttl: "Lives with contract",
  },
  persistent: {
    label: "Persistent",
    color: "#3fb950",
    bg: "#1a3a22",
    ttl: "Long-lived, rent-extended",
  },
  temporary: {
    label: "Temporary",
    color: "#d29922",
    bg: "#3a2e0a",
    ttl: "Short TTL, auto-evicted",
  },
};

const DEMO_ENTRIES: StorageEntry[] = [
  {
    key: "Admin",
    type: "Address",
    tier: "instance",
    description: "Contract administrator",
  },
  {
    key: "TotalSupply",
    type: "i128",
    tier: "instance",
    description: "Total token supply",
  },
  {
    key: "Initialized",
    type: "bool",
    tier: "instance",
    description: "Init guard flag",
  },
  {
    key: "Balance(Address)",
    type: "i128",
    tier: "persistent",
    description: "Per-account token balance",
  },
  {
    key: "Allowance(Address,Address)",
    type: "i128",
    tier: "persistent",
    description: "Spender allowance",
  },
  {
    key: "Nonce(Address)",
    type: "u64",
    tier: "temporary",
    description: "Replay-protection nonce",
  },
  {
    key: "PriceCache",
    type: "Map<Symbol,i128>",
    tier: "temporary",
    description: "Cached oracle prices",
  },
];

function TierBadge({ tier }: { tier: StorageEntry["tier"] }) {
  const m = TIER_META[tier];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        background: m.bg,
        color: m.color,
      }}
    >
      {m.label}
    </span>
  );
}

function TierBar({ entries }: { entries: StorageEntry[] }) {
  const counts = { instance: 0, persistent: 0, temporary: 0 };
  entries.forEach((e) => counts[e.tier]++);
  const total = entries.length || 1;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {(Object.keys(TIER_META) as StorageEntry["tier"][]).map((tier) => (
          <div
            key={tier}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: TIER_META[tier].color,
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--muted)" }}>{TIER_META[tier].label}</span>
            <span style={{ fontWeight: 700, color: TIER_META[tier].color }}>{counts[tier]}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: "var(--border)",
        }}
      >
        {(Object.keys(TIER_META) as StorageEntry["tier"][]).map(
          (tier) =>
            counts[tier] > 0 && (
              <div
                key={tier}
                title={`${TIER_META[tier].label}: ${counts[tier]}`}
                style={{
                  width: `${(counts[tier] / total) * 100}%`,
                  background: TIER_META[tier].color,
                }}
              />
            ),
        )}
      </div>
    </div>
  );
}

export default function StorageLayoutMapper({ entries = DEMO_ENTRIES }: { entries?: StorageEntry[] }) {
  const [filter, setFilter] = useState<StorageEntry["tier"] | "all">("all");
  const [search, setSearch] = useState("");

  const visible = entries.filter(
    (e) =>
      (filter === "all" || e.tier === filter) &&
      (e.key.toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 14 }}>Storage Distribution</h3>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
          Visual breakdown of contract state keys across storage tiers.
        </p>
        <TierBar entries={entries} />

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search key or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 160, fontSize: 12 }}
          />
          {(["all", "instance", "persistent", "temporary"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                background: filter === t ? "var(--accent)" : "var(--border)",
                color: filter === t ? "#0d1117" : "var(--text)",
                fontSize: 12,
                padding: "4px 12px",
              }}
            >
              {t === "all" ? "All" : TIER_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Schema table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr
              style={{
                background: "var(--bg)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <th style={th}>Storage Key</th>
              <th style={th}>Value Type</th>
              <th style={th}>Tier</th>
              <th style={th}>TTL Policy</th>
              <th style={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--muted)",
                  }}
                >
                  No entries match the current filter.
                </td>
              </tr>
            ) : (
              visible.map((e, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <code style={{ color: "var(--accent)", fontSize: 12 }}>{e.key}</code>
                  </td>
                  <td style={td}>
                    <code style={{ color: "var(--green)", fontSize: 12 }}>{e.type}</code>
                  </td>
                  <td style={td}>
                    <TierBadge tier={e.tier} />
                  </td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{TIER_META[e.tier].ttl}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{e.description ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--muted)",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "middle",
};
