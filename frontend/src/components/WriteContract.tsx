import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";
import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  Account,
  xdr,
} from "@stellar/stellar-sdk";
import { api } from "../api";
import StructuredInput from "./StructuredInput";
import { buildTypeIndex, type TypeIndex } from "./StructuredValue";

interface Param {
  name: string;
  type: string;
}

interface AbiFunction {
  name: string;
  description?: string;
  params?: Param[];
  mutates?: boolean;
}

interface Props {
  functions: AbiFunction[];
  contractId: string;
}

const NETWORK_PASSPHRASE = Networks.TESTNET;

// ── ScVal serialisation ───────────────────────────────────────────────────────

/**
 * Convert a value (string for primitives, object for structs, number for enums,
 * {variant, data} for unions) to an xdr.ScVal using the ABI type information.
 */
function toScVal(value: unknown, type: string, typeIndex: TypeIndex): xdr.ScVal {
  const typeDef = typeIndex.get(type);

  // ── Struct ────────────────────────────────────────────────────────────────
  if (typeDef?.kind === "struct") {
    const fields = typeDef.fields ?? [];
    const obj = (value ?? {}) as Record<string, unknown>;

    // Named struct → ScvMap
    const entries = fields.map((field) => {
      const fieldVal = toScVal(obj[field.name] ?? "", field.type, typeIndex);
      return new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol(field.name),
        val: fieldVal,
      });
    });
    return xdr.ScVal.scvMap(entries);
  }

  // ── Enum (integer discriminant) ───────────────────────────────────────────
  if (typeDef?.kind === "enum" || typeDef?.kind === "error_enum") {
    const discriminant = typeof value === "number" ? value : Number(value);
    return xdr.ScVal.scvU32(discriminant);
  }

  // ── Union (tagged variant) ────────────────────────────────────────────────
  if (typeDef?.kind === "union") {
    const unionVal = (value ?? {}) as { variant?: string; data?: unknown };
    const tag = unionVal.variant ?? typeDef.cases?.[0]?.name ?? "";
    const matchedCase = typeDef.cases?.find((c) => c.name === tag);
    const payloadTypes = matchedCase?.types ?? [];

    const tagScVal = xdr.ScVal.scvSymbol(tag);

    if (payloadTypes.length === 0) {
      // Void variant: just the symbol
      return xdr.ScVal.scvVec([tagScVal]);
    }

    if (payloadTypes.length === 1) {
      const payloadScVal = toScVal(unionVal.data ?? "", payloadTypes[0], typeIndex);
      return xdr.ScVal.scvVec([tagScVal, payloadScVal]);
    }

    // Multi-payload tuple variant
    const dataArr = Array.isArray(unionVal.data) ? (unionVal.data as unknown[]) : [];
    const payloadScVals = payloadTypes.map((pt, i) => toScVal(dataArr[i] ?? "", pt, typeIndex));
    return xdr.ScVal.scvVec([tagScVal, ...payloadScVals]);
  }

  // ── Primitives ────────────────────────────────────────────────────────────
  const str = String(value ?? "");
  const t = type.toLowerCase();

  if (t === "address") return new Address(str).toScVal();
  if (t === "u32") return nativeToScVal(Number(str), { type: "u32" });
  if (t === "i32") return nativeToScVal(Number(str), { type: "i32" });
  if (t === "u64") return nativeToScVal(BigInt(str), { type: "u64" });
  if (t === "i64") return nativeToScVal(BigInt(str), { type: "i64" });
  if (t === "u128") return nativeToScVal(BigInt(str), { type: "u128" });
  if (t === "i128") return nativeToScVal(BigInt(str), { type: "i128" });
  if (t === "bool") return nativeToScVal(value === true || str === "true", { type: "bool" });
  if (t === "string") return nativeToScVal(str, { type: "string" });
  if (t === "symbol") return xdr.ScVal.scvSymbol(str);
  if (t === "bytes") return nativeToScVal(Buffer.from(str, "hex"), { type: "bytes" });

  return nativeToScVal(str, { type: "string" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WriteContract({ functions, contractId }: Props) {
  const writeFns = functions.filter((f) => f.mutates);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(writeFns[0]?.name ?? "");
  // args holds either a string (primitive) or a structured value (complex type)
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch the full spec (functions + custom types) for this contract
  const { data: fullSpec } = useQuery({
    queryKey: ["spec-full", contractId],
    queryFn: () => api.specFull(contractId),
    enabled: !!contractId,
    retry: false,
  });

  const typeIndex: TypeIndex = fullSpec?.types ? buildTypeIndex(fullSpec.types) : new Map();

  const fn = writeFns.find((f) => f.name === selected);

  async function connectWallet() {
    try {
      const connected = await isConnected();
      if (!connected) {
        setStatus({
          type: "error",
          msg: "Freighter extension not found. Please install it.",
        });
        return;
      }
      const { address } = await getAddress();
      setWalletAddress(address);
      setStatus(null);
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    }
  }

  function handleSelect(name: string) {
    setSelected(name);
    setArgs({});
    setStatus(null);
  }

  async function handleWrite() {
    if (!fn || !walletAddress) return;
    setLoading(true);
    setStatus(null);
    try {
      const accRes = await fetch(`/api/account/${walletAddress}`);
      if (!accRes.ok) throw new Error("Failed to fetch account info");
      const accData = await accRes.json();
      const account = new Account(accData.id, accData.sequence);

      const contract = new Contract(contractId);
      const callArgs = (fn.params ?? []).map((p) => toScVal(args[p.name] ?? "", p.type, typeIndex));

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(fn.name, ...callArgs))
        .setTimeout(30)
        .build();

      const { signedTxXdr } = await signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const submitRes = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xdr: signedTxXdr }),
      });
      const data = await submitRes.json();
      if (!submitRes.ok) throw new Error(data.error ?? "Submission failed");

      setStatus({
        type: "success",
        msg: `Transaction submitted! Hash: ${data.hash}`,
      });
    } catch (e: any) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setLoading(false);
    }
  }

  if (writeFns.length === 0) return null;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ fontSize: 14 }}>Write Contract</h3>

      {!walletAddress ? (
        <button onClick={connectWallet} style={{ alignSelf: "flex-start" }}>
          Connect Freighter Wallet
        </button>
      ) : (
        <p style={{ fontSize: 12, color: "var(--green)" }}>
          Connected: <code style={{ wordBreak: "break-all" }}>{walletAddress}</code>
        </p>
      )}

      <select value={selected} onChange={(e) => handleSelect(e.target.value)} style={{ width: "100%" }}>
        {writeFns.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>

      {fn?.params && fn.params.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fn.params.map((p) => {
            const isComplex = typeIndex.has(p.type);
            return (
              <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {/* For primitive types render the original simple input */}
                {!isComplex && (
                  <>
                    <label style={{ fontSize: 12, color: "var(--muted)" }}>
                      {p.name} <span style={{ color: "var(--accent)" }}>({p.type})</span>
                    </label>
                    <input
                      type={
                        p.type.toLowerCase() === "address"
                          ? "text"
                          : p.type.toLowerCase().includes("int") ||
                              ["u32", "i32", "u64", "i64", "u128", "i128"].includes(p.type.toLowerCase())
                            ? "number"
                            : "text"
                      }
                      placeholder={
                        p.type.toLowerCase() === "address" ? `${p.name} (e.g. GABC…)` : `${p.name} (${p.type})`
                      }
                      value={args[p.name] != null ? String(args[p.name]) : ""}
                      onChange={(e) => setArgs((a) => ({ ...a, [p.name]: e.target.value }))}
                      style={{ width: "100%" }}
                    />
                  </>
                )}

                {/* For complex types (struct/enum/union) use StructuredInput */}
                {isComplex && (
                  <StructuredInput
                    type={p.type}
                    value={args[p.name] ?? null}
                    onChange={(v) => setArgs((a) => ({ ...a, [p.name]: v }))}
                    typeIndex={typeIndex}
                    label={p.name}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleWrite}
        disabled={loading || !walletAddress}
        style={{
          alignSelf: "flex-start",
          background: walletAddress ? "var(--accent)" : "var(--border)",
        }}
      >
        {loading ? "Signing…" : "Write"}
      </button>

      {status && (
        <p
          style={{
            fontSize: 13,
            color: status.type === "success" ? "var(--green)" : "#f85149",
            wordBreak: "break-all",
          }}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}
