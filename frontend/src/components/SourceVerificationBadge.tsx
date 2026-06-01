/**
 * Issue #135 — Multi-Signature Source Code Verification Badge
 *
 * Displays a security badge on the Source Code tab showing how many
 * independent developers have verified the compiled Rust source matches
 * the on-chain WASM hash.  Also lets a developer submit their own signature.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { SourceVerification } from "../api";

const MIN_VERIFIED = 3;

interface Props {
  contractId: string;
  wasmHash?: string;
}

export default function SourceVerificationBadge({ contractId, wasmHash }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ signer: "", signature: "", compiler_hash: "" });
  const [showForm, setShowForm] = useState(false);

  const { data: verifications = [] } = useQuery({
    queryKey: ["source-verifications", contractId, wasmHash],
    queryFn: () => api.sourceVerifications(contractId, wasmHash),
    enabled: !!contractId,
  });

  const mutation = useMutation({
    mutationFn: (body: { wasm_hash: string; signer: string; signature: string; compiler_hash: string }) =>
      api.submitSourceVerification(contractId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["source-verifications", contractId] });
      setForm({ signer: "", signature: "", compiler_hash: "" });
      setShowForm(false);
    },
  });

  const count = verifications.length;
  const isVerified = count >= MIN_VERIFIED;

  const badgeColor = isVerified ? "var(--green, #22c55e)" : count > 0 ? "var(--yellow, #eab308)" : "var(--muted)";
  const badgeIcon  = isVerified ? "✔" : count > 0 ? "⚠" : "✗";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasmHash) return;
    mutation.mutate({ wasm_hash: wasmHash, ...form });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 20,
          border: `1px solid ${badgeColor}`,
          background: `${badgeColor}18`,
          width: "fit-content",
        }}
      >
        <span style={{ color: badgeColor, fontWeight: 700, fontSize: 14 }}>{badgeIcon}</span>
        <span style={{ color: badgeColor, fontSize: 13, fontWeight: 600 }}>
          {isVerified
            ? `Source Verified by ${count} Independent Developer Signature${count !== 1 ? "s" : ""}`
            : count > 0
              ? `${count} of ${MIN_VERIFIED} required signatures`
              : "Source Not Yet Verified"}
        </span>
      </div>

      {/* Signer list */}
      {verifications.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {verifications.map((v: SourceVerification) => (
            <div
              key={v.signer}
              className="card"
              style={{ padding: "8px 12px", display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <span style={{ color: "var(--green, #22c55e)", fontSize: 13 }}>✔</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {v.signer}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  compiler hash: <code style={{ fontSize: 11 }}>{v.compiler_hash.slice(0, 16)}…</code>
                  {" · "}
                  {new Date(v.submitted_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit form toggle */}
      <button
        onClick={() => setShowForm(s => !s)}
        style={{
          alignSelf: "flex-start",
          padding: "5px 12px",
          fontSize: 12,
          background: "var(--surface)",
          color: "var(--accent)",
          border: "1px solid var(--accent)",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        {showForm ? "Cancel" : "+ Submit My Verification"}
      </button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <h4 style={{ fontSize: 13, margin: 0 }}>Submit Source Verification</h4>
          {!wasmHash && (
            <p style={{ color: "var(--yellow)", fontSize: 12 }}>
              No WASM hash available for this contract yet.
            </p>
          )}
          {[
            { field: "signer",        label: "Your Address / Public Key", placeholder: "G…" },
            { field: "signature",     label: "Cryptographic Signature",   placeholder: "base64 signature…" },
            { field: "compiler_hash", label: "Compiler Hash",             placeholder: "sha256 of compiled output…" },
          ].map(({ field, label, placeholder }) => (
            <label key={field} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>{label}</span>
              <input
                required
                value={(form as Record<string, string>)[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                placeholder={placeholder}
                style={{
                  padding: "6px 10px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  color: "var(--fg)",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={mutation.isPending || !wasmHash}
            style={{
              padding: "7px 16px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 13,
              alignSelf: "flex-start",
            }}
          >
            {mutation.isPending ? "Submitting…" : "Submit"}
          </button>
          {mutation.isError && (
            <p style={{ color: "var(--red, #ef4444)", fontSize: 12 }}>
              {(mutation.error as Error).message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
