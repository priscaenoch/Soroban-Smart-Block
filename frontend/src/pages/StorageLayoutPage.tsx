import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StorageLayoutMapper, { type StorageEntry } from "../components/StorageLayoutMapper";
import { api } from "../api";

/** Map storage tier writes from the API into StorageEntry shape */
function toEntries(contractId: string, meta: Awaited<ReturnType<typeof api.contract>>): StorageEntry[] {
  // If the contract meta has explicit storage_schema, use it; otherwise derive from functions
  const schema = (meta as any).storage_schema as StorageEntry[] | undefined;
  if (schema?.length) return schema;

  // Fallback: synthesise entries from function names (best-effort)
  return meta.functions.map(f => ({
    key: f.name,
    type: "unknown",
    tier: "persistent" as const,
    description: f.description,
  }));
}

export default function StorageLayoutPage() {
  const [contractId, setContractId] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: meta, isLoading, isError } = useQuery({
    queryKey: ["contract", submitted],
    queryFn: () => api.contract(submitted),
    enabled: !!submitted,
  });

  const entries: StorageEntry[] | undefined = meta ? toEntries(submitted, meta) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Storage Layout Schema Mapper</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
          Visualise how a contract distributes its state across Instance, Persistent, and Temporary storage tiers.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={contractId}
            onChange={e => setContractId(e.target.value)}
            placeholder="Contract ID (leave blank for demo)"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button onClick={() => setSubmitted(contractId.trim())}>
            Inspect
          </button>
        </div>
      </div>

      {isLoading && <p style={{ color: "var(--muted)" }}>Loading contract…</p>}
      {isError   && <p style={{ color: "#f85149" }}>Contract not found or API unavailable.</p>}

      {/* Show mapper: with real entries if loaded, demo otherwise */}
      {!submitted && <StorageLayoutMapper />}
      {submitted && entries && <StorageLayoutMapper entries={entries} />}
    </div>
  );
}
