/**
 * Issue #174 — WASM Execution Call Stack Visualizer
 *
 * Renders the expandable "Execution Trace" tab in the transaction detail view,
 * showing the exact call hierarchy with CPU instruction costs per step.
 */

import React, { useState } from "react";

interface TraceNode {
  seq: number;
  contractId: string | null;
  eventType: string;
  fnName: string | null;
  kind: "call" | "return" | "auth" | "trap" | "event";
  topics: string[];
  data: unknown;
  cpuInstructions: number | null;
  cpuCost?: number | null;
  returnData?: unknown;
  children: TraceNode[];
  depth?: number;
}

interface ExecutionTrace {
  callTree: TraceNode[];
  flatEvents: TraceNode[];
  totalCpuInstructions: number | null;
  hasTrap: boolean;
}

interface Props {
  trace: ExecutionTrace;
}

const KIND_COLORS: Record<string, string> = {
  call: "#58a6ff",
  return: "#3fb950",
  auth: "#d2a8ff",
  trap: "#f85149",
  event: "#8b949e",
};

const KIND_LABELS: Record<string, string> = {
  call: "CALL",
  return: "RETURN",
  auth: "AUTH",
  trap: "TRAP",
  event: "EVENT",
};

function Badge({ kind }: { kind: string }) {
  return (
    <span
      style={{
        background: KIND_COLORS[kind] ?? "#8b949e",
        color: "#fff",
        borderRadius: 3,
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        marginRight: 6,
        flexShrink: 0,
      }}
    >
      {KIND_LABELS[kind] ?? kind.toUpperCase()}
    </span>
  );
}

function TraceNodeRow({ node, depth = 0 }: { node: TraceNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 20;

  return (
    <div>
      <div
        onClick={() => hasChildren && setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "5px 8px",
          paddingLeft: 8 + indent,
          cursor: hasChildren ? "pointer" : "default",
          borderBottom: "1px solid var(--border)",
          background: node.kind === "trap" ? "rgba(248,81,73,0.08)" : "transparent",
          gap: 6,
        }}
      >
        {hasChildren && (
          <span
            style={{
              fontSize: 10,
              color: "var(--muted)",
              width: 12,
              flexShrink: 0,
            }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 12, flexShrink: 0 }} />}

        <Badge kind={node.kind} />

        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            fontWeight: 600,
            color: KIND_COLORS[node.kind] ?? "inherit",
          }}
        >
          {node.fnName ?? node.eventType}
        </span>

        {node.contractId && (
          <span
            style={{
              fontSize: 11,
              color: "var(--muted)",
              fontFamily: "monospace",
            }}
          >
            {node.contractId.slice(0, 8)}…{node.contractId.slice(-4)}
          </span>
        )}

        {(node.cpuCost ?? node.cpuInstructions) != null && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--muted)",
              flexShrink: 0,
            }}
          >
            {Number(node.cpuCost ?? node.cpuInstructions).toLocaleString()} CPU insns
          </span>
        )}
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((child, i) => <TraceNodeRow key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}

export default function ExecutionTraceTab({ trace }: Props) {
  if (!trace || (trace.callTree.length === 0 && trace.flatEvents.length === 0)) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--muted)",
          textAlign: "center",
          fontSize: 13,
        }}
      >
        No execution trace data available for this transaction.
      </div>
    );
  }

  const treeToRender = trace.callTree.length > 0 ? trace.callTree : trace.flatEvents;

  return (
    <div>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Execution Trace</span>

        {trace.hasTrap && (
          <span
            style={{
              background: "rgba(248,81,73,0.15)",
              color: "#f85149",
              border: "1px solid #f85149",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            WASM TRAP DETECTED
          </span>
        )}

        {trace.totalCpuInstructions != null && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
            Total CPU: <strong>{trace.totalCpuInstructions.toLocaleString()}</strong> instructions
          </span>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "8px 16px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {Object.entries(KIND_LABELS).map(([kind, label]) => (
          <span
            key={kind}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: KIND_COLORS[kind],
              }}
            />
            <span style={{ color: "var(--muted)" }}>{label}</span>
          </span>
        ))}
      </div>

      {/* Call tree */}
      <div style={{ fontFamily: "monospace", fontSize: 12 }}>
        {treeToRender.map((node, i) => (
          <TraceNodeRow key={i} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}
