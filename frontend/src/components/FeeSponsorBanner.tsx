import type { FeeBumpInfo } from "../api";

interface Props {
  feeBump: FeeBumpInfo;
}

/** Shorten a Stellar address for display. */
function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function FeeSponsorBanner({ feeBump }: Props) {
  const tiers: { role: string; label: string; address: string; color: string }[] = [
    {
      role: "Sponsor",
      label: "Paid the fee",
      address: feeBump.sponsor,
      color: "#f0a500",
    },
    {
      role: "Channel Account",
      label: "Provided sequence number",
      address: feeBump.inner_source,
      color: "#58a6ff",
    },
    ...(feeBump.actual_caller
      ? [
          {
            role: "Actual Caller",
            label: "Signed the contract logic",
            address: feeBump.actual_caller,
            color: "#3fb950",
          },
        ]
      : []),
  ];

  return (
    <div
      className="card"
      style={{ marginTop: 12, borderLeft: "3px solid var(--accent)" }}
      aria-label="Fee-bump chain of custody"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          Fee-Bump · Chain of Custody
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {tiers.map((tier, i) => (
          <div key={tier.role}>
            <TierRow {...tier} />
            {i < tiers.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  paddingLeft: 20,
                  lineHeight: 1,
                  color: "var(--muted)",
                  fontSize: 14,
                  userSelect: "none",
                }}
              >
                ↓
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TierRow({
  role,
  label,
  address,
  color,
}: {
  role: string;
  label: string;
  address: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 6,
        background: "var(--bg)",
      }}
    >
      {/* Coloured role pill */}
      <span
        style={{
          minWidth: 130,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color,
        }}
      >
        {role}
      </span>

      {/* Address */}
      <code
        style={{ fontSize: 13, fontFamily: "monospace", color, wordBreak: "break-all" }}
        title={address}
      >
        {short(address)}
      </code>

      {/* Full address (truncated) */}
      <span
        style={{
          fontSize: 11,
          color: "var(--muted)",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={address}
      >
        {address}
      </span>

      {/* Role description */}
      <span
        style={{
          fontSize: 11,
          color: "var(--muted)",
          whiteSpace: "nowrap",
          fontStyle: "italic",
        }}
      >
        {label}
      </span>
    </div>
  );
}
