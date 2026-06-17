/**
 * Issue #134 — Resource Limit Exceeded Banner
 *
 * Displays an explicit error layout when a transaction was dropped because
 * the block's total compute capacity was maxed out.
 */

import React from "react";
import type { TxStatusPayload } from "../hooks/useTxStatus";

interface ResourceLimitBannerProps {
  payload: TxStatusPayload;
}

export default function ResourceLimitBanner({ payload }: ResourceLimitBannerProps) {
  if (!payload.is_resource_limit_exceeded) return null;

  return (
    <div
      role="alert"
      style={{
        padding: "16px 20px",
        borderRadius: "8px",
        backgroundColor: "#450a0a",
        border: "2px solid #ef4444",
        color: "#fca5a5",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      <span style={{ fontSize: "1.4em", lineHeight: 1 }}>⛽</span>
      <div>
        <div style={{ fontWeight: 600, color: "#f87171", marginBottom: "4px" }}>
          Transaction Dropped: Block Compute Capacity Maxed Out
        </div>
        <div style={{ fontSize: "0.875em", opacity: 0.85 }}>
          This transaction was rejected because the block&apos;s total resource budget was exhausted (
          <code>tx_resource_limit_exceeded</code>). Try resubmitting in the next ledger when capacity resets.
        </div>
        {payload.tx_hash && (
          <div
            style={{
              fontSize: "0.8em",
              marginTop: "6px",
              opacity: 0.6,
              fontFamily: "monospace",
            }}
          >
            tx: {payload.tx_hash}
          </div>
        )}
      </div>
    </div>
  );
}
