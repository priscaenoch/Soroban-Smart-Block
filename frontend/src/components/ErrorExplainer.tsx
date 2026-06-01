/**
 * Error State Explainer Component
 * Issue #49: Human-Friendly Error State Explainer UI
 */

import React from "react";
import { translateError, getErrorSeverity } from "../utils/errorTranslator";

interface ErrorExplainerProps {
  error: string;
  onClose?: () => void;
}

const severityColors = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const severityBgColors = {
  critical: "#fee2e2",
  warning: "#fef3c7",
  info: "#dbeafe",
};

export default function ErrorExplainer({ error, onClose }: ErrorExplainerProps) {
  const parsed = translateError(error);
  const severity = getErrorSeverity(parsed.code);

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "8px",
        backgroundColor: severityBgColors[severity],
        border: `2px solid ${severityColors[severity]}`,
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 8px 0",
              color: severityColors[severity],
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            {parsed.message}
          </h3>
          <p
            style={{
              margin: "4px 0 0 0",
              color: "#666",
              fontSize: "12px",
            }}
          >
            Error Code: {parsed.code} | Category: {parsed.category}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: severityColors[severity],
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
