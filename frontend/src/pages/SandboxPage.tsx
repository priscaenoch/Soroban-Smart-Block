import { useState } from "react";
import {
  xdr,
  StrKey,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Contract,
  Account,
} from "@stellar/stellar-sdk";

interface ParsedInvocation {
  contractId: string;
  fnName: string;
  args: string[]; // each arg as base64 XDR ScVal
  sourceAccount: string;
  fee: string;
  networkPassphrase: string;
}

/** Extract the first invokeHostFunction invocation from a TransactionEnvelope */
function parseEnvelope(b64: string): ParsedInvocation {
  const env = xdr.TransactionEnvelope.fromXDR(b64.trim(), "base64");

  let tx: xdr.Transaction;
  if (env.switch() === xdr.EnvelopeType.envelopeTypeTx()) {
    tx = env.v1().tx();
  } else if (env.switch() === xdr.EnvelopeType.envelopeTypeTxV0()) {
    tx = env.v0().tx() as unknown as xdr.Transaction;
  } else {
    tx = env.feeBump().tx().innerTx().v1().tx();
  }

  const sourceAccount =
    tx.sourceAccount().switch() === xdr.CryptoKeyType.keyTypeMuxedEd25519()
      ? StrKey.encodeEd25519PublicKey(tx.sourceAccount().med25519().ed25519())
      : StrKey.encodeEd25519PublicKey(tx.sourceAccount().ed25519());

  const fee = String(tx.fee());

  for (const op of tx.operations()) {
    const body = op.body();
    if (body.switch().name !== "invokeHostFunction") continue;
    const hf = (body as any).invokeHostFunction().hostFunction();
    if (hf.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) continue;
    const inv = hf.invokeContract();
    const contractId = StrKey.encodeContract(inv.contractAddress().contractId());
    const fnName = inv.functionName().toString();
    const args = inv.args().map((a: xdr.ScVal) => a.toXDR("base64"));
    return { contractId, fnName, args, sourceAccount, fee, networkPassphrase: Networks.TESTNET };
  }
  throw new Error("No invokeHostFunction operation found in this envelope.");
}

/** Re-encode a modified invocation back to a TransactionEnvelope base64 */
function reEncode(parsed: ParsedInvocation, editedArgs: string[]): string {
  const scArgs = editedArgs.map((a) => xdr.ScVal.fromXDR(a.trim(), "base64"));
  const contract = new Contract(parsed.contractId);
  const op = contract.call(parsed.fnName, ...scArgs);
  // Use a dummy sequence number — simulation doesn't validate it
  const account = new Account(parsed.sourceAccount, "0");
  const tx = new TransactionBuilder(account, {
    fee: parsed.fee,
    networkPassphrase: parsed.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();
  return tx.toEnvelope().toXDR("base64");
}

interface SimResult {
  success: boolean;
  returnValue?: string;
  cost?: { cpuInsns: string; memBytes: string };
  minResourceFee?: string | null;
  latestLedger?: number | null;
  error?: string;
}

export default function SandboxPage() {
  const [rawXdr, setRawXdr] = useState("");
  const [parsed, setParsed] = useState<ParsedInvocation | null>(null);
  const [editedArgs, setEditedArgs] = useState<string[]>([]);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handleDecode() {
    setParseError("");
    setResult(null);
    try {
      const p = parseEnvelope(rawXdr);
      setParsed(p);
      setEditedArgs([...p.args]);
    } catch (e: any) {
      setParseError(e.message);
      setParsed(null);
    }
  }

  function updateArg(i: number, val: string) {
    setEditedArgs((prev) => prev.map((a, idx) => (idx === i ? val : a)));
  }

  async function simulate() {
    if (!parsed) return;
    setLoading(true);
    setResult(null);
    try {
      const xdrEnvelope = reEncode(parsed, editedArgs);
      const res = await fetch("/api/sandbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xdrEnvelope }),
      });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Step 1 — paste XDR */}
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>XDR Sandbox</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          Paste a raw Base64 TransactionEnvelope, edit its arguments, then simulate the modified call.
        </p>
        <textarea
          value={rawXdr}
          onChange={(e) => setRawXdr(e.target.value)}
          placeholder="Paste Base64 XDR TransactionEnvelope…"
          rows={4}
          style={{
            width: "100%",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: "monospace",
            resize: "vertical",
          }}
        />
        <button
          onClick={handleDecode}
          disabled={!rawXdr.trim()}
          style={{ marginTop: 10, background: "var(--accent)", color: "#0d1117" }}
        >
          Decode XDR
        </button>
        {parseError && (
          <p style={{ color: "#f85149", fontSize: 13, marginTop: 8 }}>{parseError}</p>
        )}
      </div>

      {/* Step 2 — edit args */}
      {parsed && (
        <div className="card">
          <div style={{ marginBottom: 12 }}>
            <span className="badge">{parsed.contractId.slice(0, 8)}…</span>
            <span style={{ marginLeft: 8, fontWeight: 600, color: "var(--green)" }}>
              {parsed.fnName}
            </span>
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>
              {parsed.args.length} arg{parsed.args.length !== 1 ? "s" : ""}
            </span>
          </div>

          {editedArgs.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              This function takes no arguments.
            </p>
          )}

          {editedArgs.map((arg, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                arg[{i}] — Base64 ScVal XDR
              </label>
              <textarea
                value={arg}
                onChange={(e) => updateArg(i, e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
            </div>
          ))}

          <button
            onClick={simulate}
            disabled={loading}
            style={{ background: "var(--yellow)", color: "#0d1117", marginTop: 4 }}
          >
            {loading ? "Simulating…" : "⚡ Simulate"}
          </button>
        </div>
      )}

      {/* Step 3 — result */}
      {result && (
        <div
          className="card"
          style={{ borderColor: result.success ? "var(--green)" : "#f85149" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: result.success ? "var(--green)" : "#f85149" }}>
              {result.success ? "✓ Would succeed" : "✗ Would revert"}
            </span>
            {result.latestLedger != null && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                ledger #{result.latestLedger}
              </span>
            )}
          </div>

          {result.error && (
            <p style={{ color: "#f85149", fontSize: 13, marginBottom: 8 }}>{result.error}</p>
          )}

          {result.returnValue && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Return value (XDR): </span>
              <code style={{ fontSize: 12, color: "var(--text)", wordBreak: "break-all" }}>
                {result.returnValue}
              </code>
            </div>
          )}

          {result.cost && (
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <span>
                CPU:{" "}
                <strong style={{ color: "var(--text)" }}>{result.cost.cpuInsns}</strong> insns
              </span>
              <span>
                Mem:{" "}
                <strong style={{ color: "var(--text)" }}>{result.cost.memBytes}</strong> bytes
              </span>
              {result.minResourceFee != null && (
                <span>
                  Min fee:{" "}
                  <strong style={{ color: "var(--text)" }}>{result.minResourceFee}</strong> stroops
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
