/**
 * Contract TTL (Time-To-Live) Calculator
 * Issue #50: Contract TTL Status Tracker
 */

export interface TTLMetrics {
  liveUntilLedger: number;
  currentLedger: number;
  remainingLedgers: number;
  isExpired: boolean;
  percentageRemaining: number;
  warningThreshold: number; // blocks until warning
}

export function calculateTTLMetrics(
  liveUntilLedger: number,
  currentLedger: number,
  warningThreshold: number = 10000 // ~1.5 days at 6 seconds/block
): TTLMetrics {
  const remainingLedgers = Math.max(0, liveUntilLedger - currentLedger);
  const estimatedTotalLedgers = liveUntilLedger - Math.max(0, currentLedger - 10000);

  return {
    liveUntilLedger,
    currentLedger,
    remainingLedgers,
    isExpired: remainingLedgers === 0,
    percentageRemaining: (remainingLedgers / estimatedTotalLedgers) * 100,
    warningThreshold,
  };
}

export function getTTLStatus(metrics: TTLMetrics): "healthy" | "warning" | "critical" | "expired" {
  if (metrics.isExpired) return "expired";
  if (metrics.remainingLedgers < 5000) return "critical";
  if (metrics.remainingLedgers < metrics.warningThreshold) return "warning";
  return "healthy";
}

export function formatTTLTime(ledgers: number, blockTimeSeconds: number = 6): string {
  const seconds = ledgers * blockTimeSeconds;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}
