import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

interface Props {
  contractId: string;
}

export default function QuorumFreezeBadge({ contractId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["quorum-freeze", contractId],
    queryFn: () => api.quorumFreeze(contractId),
    enabled: !!contractId,
  });

  if (isLoading || !data?.is_frozen) return null;

  return (
    <div
      style={{
        background: "rgba(239, 68, 68, 0.08)",
        border: "2px solid #ef4444",
        borderRadius: 8,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            background: "#ef4444",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          FROZEN BY CONSENSUS network-wide
        </span>
        <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
          CAP-0077 / Protocol 26 Quorum Freeze Active
        </span>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        This contract has been collectively frozen by network validators during a security incident. All invocations
        targeting this contract will be rejected with a quarantine error.
      </p>

      {data.ledger && (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Freeze enacted at ledger <strong style={{ color: "var(--text)" }}>{data.ledger}</strong>
          {data.tx_hash && (
            <span>
              {" "}
              · tx <code style={{ fontSize: 11 }}>{data.tx_hash.slice(0, 12)}…</code>
            </span>
          )}
        </div>
      )}

      {data.frozen_ids.length > 1 && (
        <details style={{ fontSize: 11, color: "var(--muted)" }}>
          <summary style={{ cursor: "pointer" }}>{data.frozen_ids.length} frozen keys in this event</summary>
          <ul
            style={{
              margin: "6px 0 0",
              paddingLeft: 16,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {data.frozen_ids.map((id) => (
              <li key={id}>
                <code style={{ fontSize: 11, color: "#ef4444" }}>{id}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
