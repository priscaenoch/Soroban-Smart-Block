import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import ResourceCosts from "../components/ResourceCosts";
import StorageTierBreakdown from "../components/StorageTierBreakdown";
import FiatValue from "../components/FiatValue";
import GasLimitAlert from "../components/GasLimitAlert";
import FeeSponsorBanner from "../components/FeeSponsorBanner";
import RestoreFootprintPanel from "../components/RestoreFootprintPanel";
import HeuristicParams from "../components/HeuristicParams";
import ZkCostDelta from "../components/ZkCostDelta";
import FactoryDeploymentTree from "../components/FactoryDeploymentTree";

/** Parse amount and symbol from a transfer description. */
function parseTransfer(description: string): { amount: number; symbol: string } | null {
  const m = description.match(/transferred\s+([\d,.]+)\s+([A-Z]{2,10})/i);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(amount) ? null : { amount, symbol: m[2].toUpperCase() };
}

export default function EventPage() {
  const { seq = "0" } = useParams();

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event", seq],
    queryFn: () => api.event(Number(seq)),
  });

  if (isLoading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (!ev) return <p>Event not found.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2>Event #{ev.seq}</h2>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <Row label="Description" value={ev.description} highlight />
        <Row label="Function"    value={ev.function} badge />
        {ev.is_clawback && (
          <Row
            label="Compliance"
            value={
              <span className="badge clawback" title="Mandatory authority intervention">
                ⚠ COMPLIANCE: CLAWBACK — mandatory authority intervention
              </span>
            }
          />
        )}
        {ev.sac_side_effect && (
          <Row
            label="SAC Side-Effect"
            value={
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  background: ev.sac_side_effect === "account_created"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(59,130,246,0.12)",
                  border: `1px solid ${ev.sac_side_effect === "account_created" ? "#10b981" : "#3b82f6"}`,
                  borderRadius: 4,
                  fontSize: 12,
                  color: ev.sac_side_effect === "account_created" ? "#34d399" : "#60a5fa",
                }}
                title={
                  ev.sac_side_effect === "account_created"
                    ? "SAC implicitly created a new Stellar account entry for this recipient"
                    : "SAC implicitly opened a trustline for this asset on the recipient account"
                }
              >
                {ev.sac_side_effect === "account_created"
                  ? "⬡ SAC Auto-Created Account Entry"
                  : "⬡ SAC Native Trustline Open"}
              </span>
            }
          />
        )}
        <Row label="Ledger"      value={ev.ledger.toLocaleString()} />
        <Row label="Contract"    value={<Link to={`/contract/${ev.contract_id}`}>{ev.contract_id}</Link>} />
        {ev.tx_hash && <Row label="Tx Hash" value={ev.tx_hash} mono />}
        {ev.raw_topics.length > 0 && (
          <Row label="Topics" value={ev.raw_topics.join(", ")} mono />
        )}
      </div>

      {/* Heuristic parameter guesses when no ABI is registered */}
      {ev.heuristic_params && <HeuristicParams params={ev.heuristic_params} />}

      {/* Fee-Bump sponsorship banner */}
      {ev.fee_bump && <FeeSponsorBanner feeBump={ev.fee_bump} />}

      {/* Issue #177 — Factory Deployment Trace */}
      {ev.factory_deployment && (
        <FactoryDeploymentTree deployment={ev.factory_deployment} />
      )}

      {/* Issue #40 — Resource Consumption breakdown */}
      <ResourceCosts event={ev} />

      {/* Issue #164 — CAP-0080 ZK host function cost delta */}
      {ev.zk_host_calls && (
        <ZkCostDelta calls={ev.zk_host_calls.calls} delta={ev.zk_host_calls.delta} />
      )}

      {/* Issue #125 — Gas-Limit Alert Flag */}
      <GasLimitAlert event={ev} />

      {/* Issue #52 — Storage tier breakdown */}
      {ev.storage_tiers && <StorageTierBreakdown tiers={ev.storage_tiers} />}

      {/* Issue #167 — State restoration (RestoreFootprintOp) */}
      {ev.archival_info?.isRestoreOp && (
        <RestoreFootprintPanel restore={ev.archival_info} />
      )}
    </div>
  );
}

function Row({ label, value, highlight, badge, mono }: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  badge?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <span style={{ color: "var(--muted)", minWidth: 100 }}>{label}</span>
      {badge
        ? <FunctionBadge fn={String(value)} />
        : <span style={{
            fontWeight: highlight ? 600 : 400,
            fontFamily: mono ? "monospace" : undefined,
            fontSize: mono ? 12 : undefined,
            wordBreak: "break-all",
          }}>{value}</span>
      }
    </div>
  );
}

function FunctionBadge({ fn }: { fn: string }) {
  if (fn === "wrap_native") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="badge wrap">Wrap Native Asset</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Classic XLM → Soroban</span>
      </span>
    );
  }
  if (fn === "unwrap_native") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="badge unwrap">Unwrap Native Asset</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Soroban → Classic XLM</span>
      </span>
    );
  }
  return <span className="badge green">{fn}</span>;
}
