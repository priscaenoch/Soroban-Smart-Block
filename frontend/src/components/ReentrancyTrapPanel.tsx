/**
 * Issue #175 — Reentrancy Guard Trap & Deep Call-Stack Exception Panel
 *
 * Displays a prominent developer warning when a failed transaction contains
 * a reentrancy violation or maximum call depth violation, including the
 * exact event log index where the trap occurred.
 */

import React, { useState } from "react";

interface TrapFinding {
  index: number;
  error: string;
  contractId: string | null;
  kind: "reentrancy" | "depth" | "other";
}

interface ReentrancyTrapResult {
  hasReentrancyTrap: boolean;
  hasMaxDepthViolation: boolean;
  trapEventIndex: number | null;
  trapMessage: string | null;
  callDepth: number;
  warning: string | null;
  findings: TrapFinding[];
}

interface Props {
  result: ReentrancyTrapResult;
}

const REENTRANCY_ICON = "⚠";

export default function ReentrancyTrapPanel({ result }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!result || (!result.hasReentrancyTrap && !result.hasMaxDepthViolation)) {
    return null;
  }

  const isReentrancy = result.hasReentrancyTrap;
  const isDepth = result.hasMaxDepthViolation;
  const borderColor = "#f85149";
  const bgColor = "rgba(248,81,73,0.08)";

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 6,
        background: bgColor,
        padding: "12px 16px",
        marginBottom: 12,
      }}
      aria-label="Reentrancy or Call Depth Trap Warning"
    >
      {/* Warning banner */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 18, color: borderColor, flexShrink: 0 }}>{REENTRANCY_ICON}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: borderColor,
              fontFamily: "monospace",
              letterSpacing: 0.3,
            }}
          >
            {result.warning ?? "[Trap Detected]"}
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {isReentrancy && <span>A reentrancy guard prevented recursive re-entry into a locked contract state.</span>}
            {isReentrancy && isDepth && <br />}
            {isDepth && (
              <span>
                The transaction exceeded the maximum allowed cross-contract call depth
                {result.callDepth > 0 ? ` (reached depth ${result.callDepth})` : ""}.
              </span>
            )}
          </div>

          {result.trapEventIndex != null && (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <span style={{ color: "var(--muted)" }}>Trapped at diagnostic event </span>
              <code
                style={{
                  background: "rgba(248,81,73,0.15)",
                  color: borderColor,
                  borderRadius: 3,
                  padding: "1px 5px",
                  fontSize: 11,
                }}
              >
                #{result.trapEventIndex}
              </code>
              {result.trapMessage && (
                <span style={{ color: "var(--muted)" }}>
                  : <em>{result.trapMessage}</em>
                </span>
              )}
            </div>
          )}
        </div>

        {result.findings.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              background: "none",
              border: `1px solid ${borderColor}`,
              borderRadius: 4,
              color: borderColor,
              cursor: "pointer",
              fontSize: 11,
              padding: "3px 8px",
              flexShrink: 0,
            }}
          >
            {expanded ? "Hide" : `Details (${result.findings.length})`}
          </button>
        )}
      </div>

      {/* Expanded findings table */}
      {expanded && result.findings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr
                style={{
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <th style={th}>#</th>
                <th style={th}>Kind</th>
                <th style={th}>Error</th>
                <th style={th}>Contract</th>
              </tr>
            </thead>
            <tbody>
              {result.findings.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>
                    <code>{f.index >= 0 ? f.index : "—"}</code>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        background: f.kind === "reentrancy" ? "rgba(210,168,255,0.2)" : "rgba(88,166,255,0.2)",
                        color: f.kind === "reentrancy" ? "#d2a8ff" : "#58a6ff",
                        borderRadius: 3,
                        padding: "1px 5px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {f.kind.toUpperCase()}
                    </span>
                  </td>
                  <td
                    style={{
                      ...td,
                      fontFamily: "monospace",
                      color: borderColor,
                    }}
                  >
                    {f.error}
                  </td>
                  <td
                    style={{
                      ...td,
                      fontFamily: "monospace",
                      color: "var(--muted)",
                    }}
                  >
                    {f.contractId ? `${f.contractId.slice(0, 8)}…${f.contractId.slice(-4)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  fontWeight: 600,
  fontSize: 11,
};
const td: React.CSSProperties = {
  padding: "5px 8px",
  verticalAlign: "middle",
};
