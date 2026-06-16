const BASE = "/api";

export interface SpecType {
  kind: "struct" | "enum" | "union" | "error_enum";
  name: string;
  fields?: { name: string; type: string }[];
  cases?: { name: string; value?: number; types?: string[] }[];
}

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
  /** Outer fee-bump feeSource — pays the network fee. */
  sponsor: string;
  /** Inner transaction source account (channel account — provides sequence number for parallel execution). */
  inner_source: string;
  /** Actual signing identity from Soroban auth credentials (who authorised the contract logic). */
  actual_caller: string | null;
}

// Issue #177: Factory deployment tracking
export interface FactoryDeploymentContract {
  contractId: string;
  wasmHash: string | null;
  deploymentMethod: string;
  index: number;
}

export interface FactoryDeploymentTree {
  factoryContractId: string | null;
  contracts: FactoryDeploymentContract[];
}

// Issue #164: CAP-0080 ZK host function types
export interface ZkHostCall {
  fn_name: string;
  curve: "BN254" | "BLS12-381";
  kind: "msm" | "pairing" | "scalar_field" | "map_to_curve" | "hash_to_curve" | "other";
  cpu_native: number;
  cpu_legacy: number;
}

export interface ZkCostDelta {
  total_native: number;
  total_legacy: number;
  saved_cpu: number;
  saved_pct: number;
}

export interface HeuristicParam {
  index: number;
  raw: string;
  type: "Address" | "ContractId" | "Amount" | "Hash" | "Symbol" | "Boolean" | "Unknown";
  value: string;
  confidence: "likely" | "possible";
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
  // Issue #75: AMM swap path hops ["10 USDC", "9.1 EURC", "5.2 XLM"]
  swap_path?: string[];
  // Protocol 26: TTL extension host function data
  ttl_extension?: {
    fn_name: string | null;
    extend_to: number | null;
    min_extension: number | null;
    max_extension: number | null;
  };
  // Issue #169: fee-bump chain of custody
  fee_bump?: FeeBumpInfo | null;
  // Issue #167: state archival / restoration info (RestoreFootprintOp)
  archival_info?: {
    isRestoreOp: boolean;
    revivedKeys: {
      type: string;
      label: string;
      contractId?: string;
      wasmHash?: string;
      dataKey?: string;
      durability?: string;
    }[];
    keyCount: number;
    feePaid: number | null;
  } | null;
  // Issue #191: CAP-0080 ZK host function telemetry (Protocol 26)
  zk_host_calls?: { calls: ZkHostCall[]; delta: ZkCostDelta | null };
  // Heuristic fallback params: present when no ABI is registered
  heuristic_params?: HeuristicParam[];
  // SAC implicit side-effect (auto-created account or trustline)
  sac_side_effect?: "account_created" | "trustline_opened";
  // Issue #177: Factory deployment trace
  factory_deployment?: FactoryDeploymentTree;
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

export interface DependencyAdvisoryPackage {
  name: string;
  currentVersion: string;
  latestVersion: string;
  upgradeUrl: string;
}

export interface DependencyAdvisory {
  outdated: boolean;
  summary: string;
  packages: DependencyAdvisoryPackage[];
}

export interface ContractMeta {
  id: string;
  name: string;
  description: string;
  functions: { name: string; description: string }[];
  source?: string;
  source_file?: string;
  source_files?: SourceFile[];
  dependency_advisory?: DependencyAdvisory | null;
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

// Issue #142: contract dependency graph
export interface GraphNode3D {
  id: string;
  callCount: number;
}

export interface GraphLink3D {
  source: string;
  target: string;
  value: number;
}

export interface ContractGraphData {
  nodes: GraphNode3D[];
  links: GraphLink3D[];
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

// Issue #135: source verification signature
export interface SourceVerification {
  signer: string;
  signature: string;
  compiler_hash: string;
  wasm_hash: string;
  submitted_at: string;
}

// Issue #140: storage state diff entry
export interface StateDiff {
  ledger: number;
  tx_hash: string | null;
  key: string;
  tier?: string;
  old_value: string | null;
  new_value: string | null;
  change_type: "created" | "updated" | "removed";
  created_at: string;
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

// Issue #165: Live TTL status for contract instance and code entries
export interface ContractTTL {
  contract_id: string;
  current_ledger: number;
  instance: { live_until_ledger: number | null };
  code:     { live_until_ledger: number | null };
}

export interface CircuitBreakerStatus {
  has_circuit_breaker: boolean;
  is_paused: boolean;
  pause_status_ledger: number | null;
}

export interface RwaMetadata {
  is_rwa: boolean;
  rwa_type: string | null;
}

export interface NetworkStatus {
  network: string;
  deployed: boolean;
  wasmHash?: string;
  balance?: string;
  error?: string;
}

export interface NetworkComparisonResult {
  contractId: string;
  statuses: NetworkStatus[];
  hasVersionMismatch: boolean;
}

export interface GraphNode { id: string; label: string; type: string; }

export interface GraphEdge { source: string; target: string; label?: string; amount?: string; }

export interface AddressGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
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
  zkCosts:  (seq: number)     => get<{ calls: ZkHostCall[]; delta: ZkCostDelta | null }>(`/events/${seq}/zk-costs`),
  contract:        (id: string) => get<ContractMeta>(`/contracts/${id}`),
  burnAlerts:      (contract: string) => get<BurnAlert[]>(`/burn-alerts?contract=${contract}`),
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

  // Issue #86: Circuit breaker status
  circuitBreakerStatus: (id: string) => get<CircuitBreakerStatus>(`/contracts/${id}/circuit-breaker`),

  // Issue #81: RWA token metadata
  rwaMetadata: (id: string) => get<RwaMetadata>(`/contracts/${id}/rwa-metadata`),

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

  // Issue #135: multi-sig source verification
  sourceVerifications: (id: string, wasmHash?: string) => {
    const q = wasmHash ? `?wasm_hash=${encodeURIComponent(wasmHash)}` : "";
    return get<SourceVerification[]>(`/contracts/${id}/source-verifications${q}`);
  },
  submitSourceVerification: (id: string, body: { wasm_hash: string; signer: string; signature: string; compiler_hash: string }) =>
    fetch(`${BASE}/contracts/${id}/source-verifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); }),

  // Issue #165: live TTL status (instance + code expiration ledgers)
  contractTTL: (id: string) => get<ContractTTL>(`/contracts/${id}/ttl`),

  // Issue #140: state-diff timeline
  stateDiffs: (id: string, key?: string) => {
    const q = key ? `?key=${encodeURIComponent(key)}` : "";
    return get<StateDiff[]>(`/contracts/${id}/state-diffs${q}`);
  },

  // Issue #142: global contract dependency graph
  contractGraph: (limit = 500) => get<ContractGraphData>(`/contract-graph?limit=${limit}`),

  // Issue #172: CAP-0077 quorum freeze status
  quorumFreeze: (id: string) => get<{ is_frozen: boolean; ledger: number; tx_hash: string; frozen_ids: string[] }>(`/contracts/${id}/quorum-freeze`),

  // Full contract spec (functions + custom types)
  specFull: (id: string) => get<{ functions: { name: string; outputs?: string[] }[]; types: SpecType[] }>(`/contracts/${id}/spec-full`),
};
