import React from "react";
import { useTxStatus } from "../hooks/useTxStatus";

export default function SSEStatusIndicator({ txHash }: { txHash?: string | null }) {
  if (!txHash) return null;
  const payload = useTxStatus(txHash);
  const status = payload?.status ?? "pending";

  const colors: Record<string, string> = {
    pending: "#f59e0b",
    success: "#10b981",
    failed: "#ef4444",
    resource_limit_exceeded: "#7c3aed",
  };
  const bgs: Record<string, string> = {
    pending: "#fef3c7",
    success: "#d1fae5",
    failed: "#fee2e2",
    resource_limit_exceeded: "#f3e8ff",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: colors[status] }} />
      <span
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          background: bgs[status],
          border: `1px solid ${colors[status]}`,
          fontSize: 12,
          color: "var(--text)",
        }}
      >
        {status}
        {payload?.ledger != null ? ` • #${payload.ledger}` : ""}
      </span>
    </span>
  );
}
