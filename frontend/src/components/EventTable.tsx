import { Link } from "react-router-dom";
import type { DecodedEvent } from "../api";
import FiatValue from "./FiatValue";
import { getGasAlert } from "./GasLimitAlert";

/** Parse amount and symbol from a transfer description like "Address GA… transferred 50.00 PYUSD to …" */
function parseTransfer(description: string): { amount: number; symbol: string } | null {
  const m = description.match(/transferred\s+([\d,.]+)\s+([A-Z]{2,10})/i);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(amount) ? null : { amount, symbol: m[2].toUpperCase() };
}

interface Props {
  events: DecodedEvent[];
}

function FunctionBadge({ fn }: { fn: string }) {
  if (fn === "wrap_native") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span className="badge wrap">Wrap Native Asset</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Classic XLM → Soroban</span>
      </span>
    );
  }
  if (fn === "unwrap_native") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span className="badge unwrap">Unwrap Native Asset</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Soroban → Classic XLM</span>
      </span>
    );
  }
  return <span className="badge">{fn}</span>;
}

export default function EventTable({ events }: Props) {
  if (!events.length) return <p style={{ color: "var(--muted)" }}>No events found.</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
            <th style={th}>Seq</th>
            <th style={th}>Ledger</th>
            <th style={th}>Function</th>
            <th style={th}>Description</th>
          </tr>
        </thead>
        <tbody>
          {events.map(ev => (
            <tr key={ev.seq} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td}>
                <Link to={`/event/${ev.seq}`}>#{ev.seq}</Link>
              </td>
              <td style={td}>{ev.ledger.toLocaleString()}</td>
              <td style={td}>
                <FunctionBadge fn={ev.function} />
              </td>
              <td style={{ ...td, maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ev.is_clawback && (
                  <span className="badge clawback" style={{ marginRight: 6 }} title="Mandatory authority intervention">
                    ⚠ COMPLIANCE: CLAWBACK
                  </span>
                )}
                {getGasAlert(ev) && (
                  <span
                    style={{
                      display: "inline-block",
                      marginRight: 6,
                      padding: "1px 6px",
                      background: "rgba(245,158,11,0.15)",
                      border: "1px solid #f59e0b",
                      borderRadius: 4,
                      fontSize: 11,
                      color: "#f59e0b",
                      verticalAlign: "middle",
                    }}
                    title="High gas usage — >80% of network limit"
                  >
                    ⚠ High Gas
                  </span>
                )}
                {ev.description}
                {ev.function === "transfer" && (() => {
                  const t = parseTransfer(ev.description);
                  return t ? <FiatValue amount={t.amount} symbol={t.symbol} /> : null;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontWeight: 500 };
const td: React.CSSProperties = { padding: "10px 12px" };
