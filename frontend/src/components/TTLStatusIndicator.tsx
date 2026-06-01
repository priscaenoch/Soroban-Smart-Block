/**
 * Contract TTL Status Indicator Component
 * Issue #50: Contract TTL Status Tracker
 */

import React from "react";
import { calculateTTLMetrics, getTTLStatus, formatTTLTime } from "../utils/ttlCalculator";

interface TTLStatusIndicatorProps {
  liveUntilLedger: number;
  currentLedger: number;
}

const statusColors = {
  healthy: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
  expired: "#6b7280",
};

const statusBgColors = {
  healthy: "#d1fae5",
  warning: "#fef3c7",
  critical: "#fee2e2",
  expired: "#f3f4f6",
};

export default function TTLStatusIndicator({ liveUntilLedger, currentLedger }: TTLStatusIndicatorProps) {
  const metrics = calculateTTLMetrics(liveUntilLedger, currentLedger);
  const status = getTTLStatus(metrics);
  const timeRemaining = formatTTLTime(metrics.remainingLedgers);

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: "8px",
        backgroundColor: statusBgColors[status],
        border: `1px solid ${statusColors[status]}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: statusColors[status],
          }}
        />
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: statusColors[status] }}>
          TTL Status: {status.charAt(0).toUpperCase() + status.slice(1)}
        </h4>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
        <div>
          <span style={{ color: "#666" }}>Remaining Time:</span>
          <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>{timeRemaining}</p>
        </div>
        <div>
          <span style={{ color: "#666" }}>Expires at Ledger:</span>
          <p style={{ margin: "4px 0 0 0", fontWeight: "600", fontSize: "14px" }}>
            {liveUntilLedger.toLocaleString()}
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "8px",
          height: "6px",
          backgroundColor: "#e5e7eb",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: statusColors[status],
            width: `${Math.max(5, metrics.percentageRemaining)}%`,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}
