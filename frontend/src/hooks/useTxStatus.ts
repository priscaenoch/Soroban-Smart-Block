/**
 * Issue #118 — SSE transaction status hook.
 *
 * Opens a Server-Sent Events connection to /api/transactions/:hash/status/stream
 * and returns the live status. Falls back to polling if SSE is unavailable.
 */

import { useEffect, useState } from "react";

export type TxStatus = "pending" | "success" | "failed";

export interface TxStatusPayload {
  tx_hash: string;
  status: TxStatus;
  ledger: number | null;
  error: string | null;
}

export function useTxStatus(txHash: string | null | undefined) {
  const [payload, setPayload] = useState<TxStatusPayload | null>(null);

  useEffect(() => {
    if (!txHash) return;

    const es = new EventSource(`/api/transactions/${txHash}/status/stream`);

    es.onmessage = (e) => {
      try {
        const data: TxStatusPayload = JSON.parse(e.data);
        setPayload(data);
        if (data.status === "success" || data.status === "failed") {
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      // Fallback: single poll
      fetch(`/api/transactions/${txHash}/status`)
        .then(r => r.json())
        .then(setPayload)
        .catch(() => {});
    };

    return () => es.close();
  }, [txHash]);

  return payload;
}
