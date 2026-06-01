import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

interface CircuitBreakerStatusProps {
  contractId: string;
}

export default function CircuitBreakerStatus({ contractId }: CircuitBreakerStatusProps) {
  const { data: status, isLoading } = useQuery({
    queryKey: ["circuit-breaker", contractId],
    queryFn: () => api.circuitBreakerStatus(contractId),
    enabled: !!contractId,
  });

  if (isLoading) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 13 }}>
        Loading status…
      </div>
    );
  }

  if (!status?.has_circuit_breaker) {
    return null;
  }

  const isPaused = status.is_paused;
  const bgColor = isPaused ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)";
  const borderColor = isPaused ? "#ef4444" : "#22c55e";
  const textColor = isPaused ? "#dc2626" : "#16a34a";
  const icon = isPaused ? "⛔" : "✓";
  const statusText = isPaused ? "Status: Paused by Emergency Administration" : "Status: Operational";

  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ color: textColor, fontWeight: 700, fontSize: 14 }}>
          {statusText}
        </div>
        {status.pause_status_ledger && (
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            Last status change at ledger {status.pause_status_ledger}
          </div>
        )}
      </div>
    </div>
  );
}
