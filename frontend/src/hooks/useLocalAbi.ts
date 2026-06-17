/**
 * useLocalAbi.ts
 *
 * Manages a per-contract ABI stored exclusively in sessionStorage so it
 * never touches the production database.  The ABI is keyed by contract ID
 * and is cleared automatically when the browser tab is closed.
 *
 * Accepted file shapes:
 *   1. Registry format  – { contractId, name, functions: [{ name, template, params }] }
 *   2. Full-spec format – { functions: [{ name, inputs, outputs }], types: [...] }
 *   3. Flat array       – [{ name, inputs?, params?, template? }]
 *
 * The hook normalises all three into LocalAbiFn[] so the rest of the UI
 * only needs to deal with one shape.
 */

import { useState, useCallback, useEffect } from "react";

// ── Public types ──────────────────────────────────────────────────────────────

export interface LocalAbiParam {
  name: string;
  type: string;
}

export interface LocalAbiType {
  kind: "struct" | "enum" | "union" | "error_enum";
  name: string;
  doc?: string;
  fields?: LocalAbiParam[];
  cases?: { name: string; value?: number; types?: string[] }[];
}

export interface LocalAbiFn {
  name: string;
  /** Human-readable template, e.g. "{from} transferred {amount} to {to}" */
  template?: string;
  params?: LocalAbiParam[];
  /** Output type strings from full-spec format */
  outputs?: string[];
  mutates?: boolean;
}

export interface LocalAbi {
  /** Source contract ID embedded in the file, if present */
  contractId?: string;
  name?: string;
  description?: string;
  functions: LocalAbiFn[];
  types?: LocalAbiType[];
  /** ISO timestamp of when the file was loaded */
  loadedAt: string;
  /** Original filename */
  fileName: string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const storageKey = (contractId: string) => `local_abi:${contractId}`;

function persist(contractId: string, abi: LocalAbi) {
  try {
    sessionStorage.setItem(storageKey(contractId), JSON.stringify(abi));
  } catch {
    // sessionStorage quota exceeded — silently ignore
  }
}

function load(contractId: string): LocalAbi | null {
  try {
    const raw = sessionStorage.getItem(storageKey(contractId));
    return raw ? (JSON.parse(raw) as LocalAbi) : null;
  } catch {
    return null;
  }
}

function remove(contractId: string) {
  sessionStorage.removeItem(storageKey(contractId));
}

// ── Normaliser ────────────────────────────────────────────────────────────────

/**
 * Parse and normalise any of the three accepted ABI file shapes into LocalAbi.
 * Throws a descriptive Error if the file is not recognisable.
 */
export function parseAbiFile(raw: unknown, fileName: string): LocalAbi {
  if (raw === null || typeof raw !== "object") {
    throw new Error("ABI file must be a JSON object or array.");
  }

  const base: Omit<LocalAbi, "functions"> = {
    loadedAt: new Date().toISOString(),
    fileName,
  };

  // ── Shape 1: flat array of functions ────────────────────────────────────
  if (Array.isArray(raw)) {
    const functions = raw.map(normaliseFn);
    return { ...base, functions };
  }

  const obj = raw as Record<string, unknown>;

  // ── Shape 2: full-spec format { functions, types } ───────────────────────
  if (Array.isArray(obj.functions) && !("contractId" in obj) && !("name" in obj)) {
    const functions = (obj.functions as unknown[]).map(normaliseFn);
    const types = Array.isArray(obj.types) ? (obj.types as LocalAbiType[]) : undefined;
    return { ...base, functions, types };
  }

  // ── Shape 3: registry format { contractId, name, functions } ────────────
  if (Array.isArray(obj.functions)) {
    const functions = (obj.functions as unknown[]).map(normaliseFn);
    const types = Array.isArray(obj.types) ? (obj.types as LocalAbiType[]) : undefined;
    return {
      ...base,
      contractId: typeof obj.contractId === "string" ? obj.contractId : undefined,
      name: typeof obj.name === "string" ? obj.name : undefined,
      description: typeof obj.description === "string" ? obj.description : undefined,
      functions,
      types,
    };
  }

  throw new Error("Unrecognised ABI format. Expected { functions: [...] } or an array of function definitions.");
}

function normaliseFn(raw: unknown): LocalAbiFn {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Each function entry must be an object.");
  }
  const fn = raw as Record<string, unknown>;
  if (typeof fn.name !== "string" || !fn.name) {
    throw new Error('Each function entry must have a "name" string field.');
  }

  // Normalise params: accept both "params" (registry) and "inputs" (full-spec)
  const rawParams = Array.isArray(fn.params) ? fn.params : Array.isArray(fn.inputs) ? fn.inputs : [];

  const params: LocalAbiParam[] = rawParams.map((p: unknown) => {
    const param = p as Record<string, unknown>;
    return {
      name: String(param.name ?? ""),
      type: String(param.type ?? "unknown"),
    };
  });

  return {
    name: fn.name,
    template: typeof fn.template === "string" ? fn.template : undefined,
    params: params.length > 0 ? params : undefined,
    outputs: Array.isArray(fn.outputs) ? (fn.outputs as string[]) : undefined,
    mutates: typeof fn.mutates === "boolean" ? fn.mutates : undefined,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseLocalAbiReturn {
  /** The currently loaded local ABI, or null if none */
  localAbi: LocalAbi | null;
  /** Load an ABI from a parsed JSON value and a filename */
  loadAbi: (raw: unknown, fileName: string) => void;
  /** Clear the stored ABI for this contract */
  clearAbi: () => void;
  /** Last parse error message, if any */
  parseError: string | null;
}

export function useLocalAbi(contractId: string): UseLocalAbiReturn {
  const [localAbi, setLocalAbi] = useState<LocalAbi | null>(() => (contractId ? load(contractId) : null));
  const [parseError, setParseError] = useState<string | null>(null);

  // Re-hydrate from sessionStorage if contractId changes (e.g. navigation)
  useEffect(() => {
    if (contractId) {
      setLocalAbi(load(contractId));
      setParseError(null);
    }
  }, [contractId]);

  const loadAbi = useCallback(
    (raw: unknown, fileName: string) => {
      try {
        const abi = parseAbiFile(raw, fileName);
        persist(contractId, abi);
        setLocalAbi(abi);
        setParseError(null);
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : String(err));
      }
    },
    [contractId],
  );

  const clearAbi = useCallback(() => {
    remove(contractId);
    setLocalAbi(null);
    setParseError(null);
  }, [contractId]);

  return { localAbi, loadAbi, clearAbi, parseError };
}
