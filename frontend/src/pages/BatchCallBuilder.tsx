/**
 * Issue #119 — Batch Multi-Call Constructor Interface Panel.
 *
 * Lets developers chain multiple contract calls into a single transaction
 * envelope. Each call can be added, reordered, and removed before generating
 * the final signed transaction XDR.
 */

import { useState } from "react";

interface CallEntry {
  id: number;
  contractId: string;
  fnName: string;
  args: string; // JSON string
}

let _nextId = 1;
const nextId = () => _nextId++;

export default function BatchCallBuilder() {
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [contractId, setContractId] = useState("");
  const [fnName, setFnName] = useState("");
  const [args, setArgs] = useState("[]");
  const [envelope, setEnvelope] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addCall() {
    if (!contractId.trim() || !fnName.trim()) {
      setError("Contract ID and function name are required.");
      return;
    }
    try { JSON.parse(args); } catch {
      setError("Args must be valid JSON (e.g. [\"arg1\", 42]).");
      return;
    }
    setError(null);
    setCalls(prev => [...prev, { id: nextId(), contractId: contractId.trim(), fnName: fnName.trim(), args }]);
    setContractId("");
    setFnName("");
    setArgs("[]");
  }

  function removeCall(id: number) {
    setCalls(prev => prev.filter(c => c.id !== id));
    setEnvelope(null);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setCalls(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setEnvelope(null);
  }

  function moveDown(index: number) {
    setCalls(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setEnvelope(null);
  }

  function generateEnvelope() {
    if (!calls.length) { setError("Add at least one call."); return; }
    setError(null);
    // Produce a human-readable JSON representation of the multi-call envelope.
    // In a real integration this would be assembled via stellar-sdk TransactionBuilder.
    const envelope = {
      type: "soroban_batch_transaction",
      network: "testnet",
      operations: calls.map((c, i) => ({
        index: i + 1,
        contractId: c.contractId,
        function: c.fnName,
        args: JSON.parse(c.args),
      })),
      note: "Pass this to TransactionBuilder.addOperation() for each entry in order.",
    };
    setEnvelope(JSON.stringify(envelope, null, 2));
  }

  function copyEnvelope() {
    if (envelope) navigator.clipboard.writeText(envelope);
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    background: "var(--bg2, #1e1e2e)",
    border: "1px solid var(--border, #333)",
    borderRadius: 4,
    color: "inherit",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  };

  const btnStyle: React.CSSProperties = {
    padding: "6px 14px",
    background: "var(--accent, #7c3aed)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Batch Multi-Call Constructor</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
          Chain multiple contract calls into a single transaction envelope.
        </p>

        {/* Add call form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Contract ID</label>
            <input
              style={inputStyle}
              placeholder="C..."
              value={contractId}
              onChange={e => setContractId(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Function</label>
            <input
              style={inputStyle}
              placeholder="transfer"
              value={fnName}
              onChange={e => setFnName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Args (JSON)</label>
            <input
              style={inputStyle}
              placeholder='["addr", 100]'
              value={args}
              onChange={e => setArgs(e.target.value)}
            />
          </div>
          <button style={btnStyle} onClick={addCall}>+ Add</button>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Call list */}
      {calls.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Execution Order ({calls.length} call{calls.length !== 1 ? "s" : ""})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {calls.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--bg2, #1e1e2e)",
                  borderRadius: 6,
                  border: "1px solid var(--border, #333)",
                }}
              >
                <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 14 }}>#{i + 1}</span>
                <div>
                  <code style={{ fontSize: 12, color: "var(--accent, #7c3aed)" }}>{c.contractId}</code>
                  <span style={{ color: "var(--muted)", margin: "0 6px" }}>→</span>
                  <strong style={{ fontSize: 13 }}>{c.fnName}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 8 }}>{c.args}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    style={{ ...btnStyle, background: "var(--bg3, #2a2a3e)", padding: "4px 8px", opacity: i === 0 ? 0.4 : 1 }}
                    title="Move up"
                  >↑</button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === calls.length - 1}
                    style={{ ...btnStyle, background: "var(--bg3, #2a2a3e)", padding: "4px 8px", opacity: i === calls.length - 1 ? 0.4 : 1 }}
                    title="Move down"
                  >↓</button>
                  <button
                    onClick={() => removeCall(c.id)}
                    style={{ ...btnStyle, background: "#7f1d1d", padding: "4px 8px" }}
                    title="Remove"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={btnStyle} onClick={generateEnvelope}>Generate Transaction Envelope</button>
            {envelope && (
              <button style={{ ...btnStyle, background: "var(--bg3, #2a2a3e)" }} onClick={copyEnvelope}>
                Copy Envelope
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generated envelope */}
      {envelope && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 14 }}>Transaction Envelope</h3>
            <button style={{ ...btnStyle, background: "var(--bg3, #2a2a3e)", fontSize: 12 }} onClick={copyEnvelope}>
              Copy
            </button>
          </div>
          <pre style={{
            background: "var(--bg2, #1e1e2e)",
            padding: 14,
            borderRadius: 6,
            fontSize: 12,
            overflowX: "auto",
            margin: 0,
            color: "var(--fg, #e2e8f0)",
          }}>
            {envelope}
          </pre>
        </div>
      )}
    </div>
  );
}
