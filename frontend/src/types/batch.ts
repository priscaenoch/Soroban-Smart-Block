/**
 * Batch Multi-Call Types and Interfaces
 * Issue #211: Add batch multi-call constructor interface improvements
 */

export type ExecutionMode = "sequential" | "parallel" | "hybrid" | "batch";

export interface BatchCall {
  id: string;
  contractId: string;
  functionName: string;
  args: BatchArgValue[];
  type?: "call" | "condition" | "loop" | "merge";
  condition?: {
    sourceCallId: string;
    expression: string;
  };
  loop?: {
    iterations: number;
    condition?: string;
  };
  signer?: string;
  signerThreshold?: number;
  signerWeight?: number;
}

export interface BatchArgValue {
  name: string;
  value: string;
  type: string;
}

export interface BatchTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  calls: BatchCall[];
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  name: string;
  type: "address" | "contract" | "amount" | "string" | "symbol";
  placeholder: string;
  required: boolean;
}

export interface StorageKeyRef {
  contractId: string;
  key: string;
}

export interface ConflictDetection {
  callId: string;
  storageKeys: StorageKeyRef[];
  conflictingCalls: {
    callId: string;
    type: "read-write" | "write-write" | "read-read";
  }[];
}

export interface GasEstimate {
  callId: string;
  cpuInsns: number;
  memBytes: number;
  fee: number;
}

export interface BatchSimulationResult {
  success: boolean;
  results: CallResult[];
  totalGas: GasEstimate;
  stateDiffs: StateDiffPreview[];
  conflicts: ConflictDetection[];
  optimizedOrder?: string[];
}

export interface CallResult {
  callId: string;
  success: boolean;
  returnValue?: string;
  error?: string;
  cost: {
    cpuInsns: number;
    memBytes: number;
  };
}

export interface StateDiffPreview {
  callId: string;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  changes: {
    key: string;
    oldValue: string | null;
    newValue: string | null;
    changeType: "created" | "updated" | "removed";
  }[];
}

export interface SignerConfig {
  address: string;
  weight: number;
}

export interface MultiSigConfig {
  signers: SignerConfig[];
  threshold: number;
}

export interface BatchEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface BatchNode {
  id: string;
  type: "call" | "condition" | "loop" | "merge";
  data: {
    label: string;
    contractId?: string;
    functionName?: string;
    args?: BatchArgValue[];
    signer?: string;
    signerThreshold?: number;
  };
  position: { x: number; y: number };
}