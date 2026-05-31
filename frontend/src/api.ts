const BASE = "/api";

export interface StorageWrite {
  tier: "instance" | "persistent" | "temporary";
  contractId: string;
  key: string;
  changeType: "created" | "updated";
}

export interface StorageTiers {
  instance: StorageWrite[];
  persistent: StorageWrite[];
  temporary: StorageWrite[];
}

export interface FeeBumpInfo {
  /** Outer fee-paying account (the sponsor). */
  sponsor: string;
  /** Inner transaction source account (the original caller). */
  inner_source: string;
}

export interface DecodedEvent {
  seq: number;
  contract_id: string;
  function: string;
  ledger: number;
  description: string;
  raw_topics: string[];
  tx_hash?: string;
  // Issue #40: Soroban resource gas costs
  cpu_instructions?: number;
  mem_bytes?: number;
  fee_charged?: number;
  // Issue #50: state-bloat risk
  is_high_bloat_risk?: boolean;
  // Issue #51: upgrade lineage
  upgrade_info?: { type: "upgrade"; oldHash: string; newHash: string };
  // Issue #52: storage tier breakdown
  storage_tiers?: StorageTiers;
  // Issue #74: clawback compliance flag
  is_clawback?: boolean;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface MigrationStatus {
  pending: boolean;
  upgradedAtLedger: number | null;
  migratedAtLedger: number | null;
}

export interface ContractMeta {
  id: string;
  name: string;
  description: string;
  functions: { name: string; description: string }[];
  source?: string;
  source_file?: string;
  source_files?: SourceFile[];
}

export interface BurnAlert {
  contractId: string;
  ledger: number;
  burnedPct: number;
  burnedAmount: string;
  flaggedAt: number;
}

// Issue #38: paginated contract transaction response
export interface ContractTransactionsResponse {
  data: DecodedEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export interface SimResult {
  success: boolean;
  returnValue?: string;
  cost?: { cpuInsns: string; memBytes: string };
  error?: string;
}

export interface PrivilegedRole {
  role: string;
  address: string;
  ledger: number | null;
  updated_at: string;
}

// Issue #117: sub-invocation record
export interface SubInvocation {
  id: number;
  parent_tx_hash: string;
  depth: number;
  contract_id: string;
  function: string;
  args: unknown[] | null;
  ledger: number;
}

// Issue #118: transaction status
export interface TxStatusResponse {
  tx_hash: string;
  status: "pending" | "success" | "failed";
  ledger: number | null;
  error?: string | null;
}

export const api = {
  events: (params: { contract?: string; fn?: string; page?: number; type?: string }) => {
    const q = new URLSearchParams();
    if (params.contract) q.set("contract", params.contract);
    if (params.fn)       q.set("fn", params.fn);
    if (params.page)     q.set("page", String(params.page));
    if (params.type)     q.set("type", params.type);
    return get<DecodedEvent[]>(`/events?${q}`);
  },
  event:    (seq: number)     => get<DecodedEvent>(`/events/${seq}`),
  contract:        (id: string) => get<ContractMeta>(`/contracts/${id}`),
  migrationStatus: (id: string) => get<MigrationStatus>(`/contracts/${id}/migration-status`),
  wallet:   (address: string) => get<DecodedEvent[]>(`/wallet/${address}`),
  roles:    (id: string)      => get<PrivilegedRole[]>(`/contracts/${id}/roles`),
  networkComparison: (id: string) => get<NetworkComparisonResult>(`/contracts/${id}/network-comparison`),
  addressGraph:      (id: string) => get<AddressGraphData>(`/contracts/${id}/address-graph`),

  // Issue #117: sub-invocations for a transaction
  subInvocations: (txHash: string) => get<SubInvocation[]>(`/transactions/${txHash}/sub-invocations`),
  // Events where contract appears directly OR as sub-invocation
  eventsDeep: (contractId: string, page = 1) =>
    get<DecodedEvent[]>(`/v1/contracts/${contractId}/events-deep?page=${page}`),

  // Issue #118: transaction status (polling fallback; SSE via useTxStatus hook)
  txStatus: (txHash: string) => get<TxStatusResponse>(`/transactions/${txHash}/status`),

  downloadAbi: async (id: string) => {
    const res = await fetch(`${BASE}/contracts/${id}/abi`);
    if (!res.ok) throw new Error(`API ${res.status}: /contracts/${id}/abi`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}.abi.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
