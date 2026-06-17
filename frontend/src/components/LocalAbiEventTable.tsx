/**
 * LocalAbiEventTable.tsx
 *
 * Wraps EventTable and re-renders event descriptions using a locally-loaded
 * ABI when one is available.  Falls back to the original description for any
 * event whose function name is not found in the local ABI.
 *
 * Template interpolation:
 *   A template string like "{from} transferred {amount} to {to}" is filled
 *   by matching placeholder names against the event's raw_topics array
 *   (positionally, after the leading function-name topic) and the decoded
 *   data field stored in the description.
 *
 *   If a template is not provided for a function, the component falls back
 *   to listing the function name and its raw topics in a readable format.
 */

import { Link } from "react-router-dom";
import type { DecodedEvent } from "../api";
import type { LocalAbi, LocalAbiFn } from "../hooks/useLocalAbi";
import FiatValue from "./FiatValue";

// ── Template engine ───────────────────────────────────────────────────────────

/**
 * Fill a template string with values from a positional args array.
 * Placeholders are {paramName} and matched by position against the params
 * definition, or by index ({0}, {1}) as a fallback.
 *
 * Example:
 *   template = "{from} sent {amount} to {to}"
 *   params   = [{name:"from"}, {name:"amount"}, {name:"to"}]
 *   args     = ["GABC…", "100", "GXYZ…"]
 *   → "GABC… sent 100 to GXYZ…"
 */
function fillTemplate(template: string, fn: LocalAbiFn, args: string[]): string {
  const params = fn.params ?? [];
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    // Try named param first
    const idx = params.findIndex((p) => p.name === key);
    if (idx !== -1 && args[idx] !== undefined) return String(args[idx]);
    // Try numeric index
    const numIdx = parseInt(key, 10);
    if (!isNaN(numIdx) && args[numIdx] !== undefined) return String(args[numIdx]);
    return `{${key}}`;
  });
}

/**
 * Build a human-readable description for an event using the local ABI.
 * raw_topics[0] is the function name symbol; raw_topics[1..] are the args.
 */
function buildLocalDescription(ev: DecodedEvent, fn: LocalAbiFn): string {
  const args = ev.raw_topics.slice(1); // drop the leading function-name topic

  if (fn.template) {
    return fillTemplate(fn.template, fn, args);
  }

  // No template: produce a readable fallback
  const params = fn.params ?? [];
  if (params.length > 0 && args.length > 0) {
    const pairs = params
      .map((p, i) => (args[i] !== undefined ? `${p.name}=${args[i]}` : null))
      .filter(Boolean)
      .join(", ");
    return `${fn.name}(${pairs})`;
  }

  if (args.length > 0) {
    return `${fn.name}(${args.join(", ")})`;
  }

  return `${fn.name}()`;
}

// ── Transfer fiat helper (mirrors EventTable) ─────────────────────────────────

function parseTransfer(description: string): { amount: number; symbol: string } | null {
  const m = description.match(/transferred\s+([\d,.]+)\s+([A-Z]{2,10})/i);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(amount) ? null : { amount, symbol: m[2].toUpperCase() };
}

// ── Badge (mirrors EventTable) ────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  events: DecodedEvent[];
  localAbi: LocalAbi;
}

/**
 * Renders the event table using local ABI descriptions where available.
 * Rows whose function is not in the local ABI fall back to the original
 * server-side description.
 */
export default function LocalAbiEventTable({ events, localAbi }: Props) {
  if (!events.length) {
    return <p style={{ color: "var(--muted)" }}>No events found.</p>;
  }

  // Build a quick lookup map
  const fnMap = new Map<string, LocalAbiFn>(localAbi.functions.map((f) => [f.name, f]));

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Local ABI active indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          fontSize: 11,
          color: "var(--green)",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--green)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        Descriptions rendered using local ABI —{" "}
        <span style={{ color: "var(--muted)" }}>
          {localAbi.functions.filter((f) => events.some((e) => e.function === f.name)).length} of{" "}
          {localAbi.functions.length} functions matched
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--border)",
              color: "var(--muted)",
            }}
          >
            <th style={th}>Seq</th>
            <th style={th}>Ledger</th>
            <th style={th}>Function</th>
            <th style={th}>Description</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const localFn = fnMap.get(ev.function);
            const description = localFn ? buildLocalDescription(ev, localFn) : ev.description;
            const usedLocal = !!localFn;

            return (
              <tr key={ev.seq} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}>
                  <Link to={`/event/${ev.seq}`}>#{ev.seq}</Link>
                </td>
                <td style={td}>{ev.ledger.toLocaleString()}</td>
                <td style={td}>
                  <FunctionBadge fn={ev.function} />
                </td>
                <td
                  style={{
                    ...td,
                    maxWidth: 480,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ev.is_clawback && (
                    <span
                      className="badge clawback"
                      style={{ marginRight: 6 }}
                      title="Mandatory authority intervention"
                    >
                      ⚠ COMPLIANCE: CLAWBACK
                    </span>
                  )}

                  {/* Subtle indicator when local ABI description is used */}
                  {usedLocal && (
                    <span
                      title="Description from local ABI"
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--green)",
                        marginRight: 6,
                        verticalAlign: "middle",
                        flexShrink: 0,
                      }}
                    />
                  )}

                  {description}

                  {ev.function === "transfer" &&
                    (() => {
                      const t = parseTransfer(description);
                      return t ? <FiatValue amount={t.amount} symbol={t.symbol} /> : null;
                    })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 500,
};
const td: React.CSSProperties = { padding: "10px 12px" };
