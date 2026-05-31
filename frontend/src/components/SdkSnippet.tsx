/**
 * Issue #120 — SDK Snippet Copy Button.
 *
 * Generates ready-to-use code snippets for a contract function in
 * JavaScript, Python, and Rust, pre-populated with the contract ID
 * and function signature.
 */

import { useState } from "react";

type Lang = "javascript" | "python" | "rust";

interface Props {
  contractId: string;
  fnName: string;
  args?: { name: string; type?: string }[];
}

function buildArgList(args: { name: string; type?: string }[] = []): string {
  return args.map(a => a.name).join(", ");
}

function jsSnippet(contractId: string, fnName: string, args: Props["args"] = []): string {
  const argList = buildArgList(args);
  return `import { Contract, SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from "@stellar/stellar-sdk";

const rpc = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
const contract = new Contract("${contractId}");

const account = await rpc.getAccount(sourcePublicKey);
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(contract.call("${fnName}"${argList ? `, ${argList}` : ""}))
  .setTimeout(30)
  .build();

const prepared = await rpc.prepareTransaction(tx);
prepared.sign(sourceKeypair);
const result = await rpc.sendTransaction(prepared);
console.log(result);`;
}

function pythonSnippet(contractId: string, fnName: string, args: Props["args"] = []): string {
  const argList = buildArgList(args);
  return `from stellar_sdk import SorobanServer, Keypair, TransactionBuilder, Network
from stellar_sdk.soroban_rpc import SendTransactionStatus

server = SorobanServer("https://soroban-testnet.stellar.org")
contract_id = "${contractId}"

source = server.load_account(source_public_key)
tx = (
    TransactionBuilder(source, network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE, base_fee=100)
    .append_invoke_contract_function_op(
        contract_id=contract_id,
        function_name="${fnName}",
        parameters=[${argList}],
    )
    .set_timeout(30)
    .build()
)

tx = server.prepare_transaction(tx)
tx.sign(source_keypair)
response = server.send_transaction(tx)
print(response.status)`;
}

function rustSnippet(contractId: string, fnName: string, args: Props["args"] = []): string {
  const argList = args.length
    ? args.map(a => `    // ${a.name}: ${a.type ?? "ScVal"}`).join("\n") + "\n"
    : "";
  return `use soroban_sdk::{contract, contractimpl, Address, Env};
// Client generated from contract spec:
// stellar contract bindings rust --contract-id ${contractId} --output-dir ./bindings

use bindings::Client;

fn invoke(env: &Env, contract_id: &Address) {
${argList}    let client = Client::new(env, contract_id);
    let result = client.${fnName}(/* args */);
    // handle result
}`;
}

const LANGS: { key: Lang; label: string }[] = [
  { key: "javascript", label: "JavaScript" },
  { key: "python",     label: "Python" },
  { key: "rust",       label: "Rust" },
];

export default function SdkSnippet({ contractId, fnName, args = [] }: Props) {
  const [lang, setLang] = useState<Lang>("javascript");
  const [copied, setCopied] = useState(false);

  const snippets: Record<Lang, string> = {
    javascript: jsSnippet(contractId, fnName, args),
    python:     pythonSnippet(contractId, fnName, args),
    rust:       rustSnippet(contractId, fnName, args),
  };

  const snippet = snippets[lang];

  function copy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Language tabs + copy button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {LANGS.map(l => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              style={{
                padding: "3px 10px",
                fontSize: 12,
                background: lang === l.key ? "var(--accent, #7c3aed)" : "var(--bg2, #1e1e2e)",
                color: lang === l.key ? "#fff" : "var(--muted)",
                border: "1px solid var(--border, #333)",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          style={{
            padding: "3px 12px",
            fontSize: 12,
            background: copied ? "#16a34a" : "var(--bg2, #1e1e2e)",
            color: copied ? "#fff" : "var(--muted)",
            border: "1px solid var(--border, #333)",
            borderRadius: 4,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      {/* Code block */}
      <pre style={{
        background: "var(--bg2, #1e1e2e)",
        border: "1px solid var(--border, #333)",
        borderRadius: 6,
        padding: "12px 14px",
        fontSize: 12,
        overflowX: "auto",
        margin: 0,
        color: "var(--fg, #e2e8f0)",
        lineHeight: 1.6,
      }}>
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
