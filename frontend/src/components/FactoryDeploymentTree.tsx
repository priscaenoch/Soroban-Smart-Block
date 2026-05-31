// Issue #130 — Factory Deployment Event tree display

interface DeployedContract {
  index: number;
  contractId?: string;
  parentContractId?: string | null;
}

interface FactoryDeployment {
  factoryContractId: string | null;
  deployedContracts: DeployedContract[];
}

interface Props {
  deployment: FactoryDeployment;
}

function short(id: string | null | undefined) {
  if (!id) return "unknown";
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

export default function FactoryDeploymentTree({ deployment }: Props) {
  const { factoryContractId, deployedContracts } = deployment;

  return (
    <div
      className="card"
      style={{ borderLeft: "4px solid var(--accent)", padding: "12px 16px" }}
      aria-label="Factory Deployment Event"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          Factory Deployment Event
        </span>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          {deployedContracts.length} contract{deployedContracts.length !== 1 ? "s" : ""} deployed
        </span>
      </div>

      {/* Factory root node */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>⬡ Factory</span>
          <span style={{ color: "var(--muted)" }}>{short(factoryContractId)}</span>
        </div>

        {/* Deployed sub-contracts */}
        <div style={{ marginLeft: 24, display: "flex", flexDirection: "column", gap: 4 }}>
          {deployedContracts.map((c, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--muted)" }}>└─</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                Contract #{c.index + 1}
              </span>
              {c.contractId && (
                <span style={{ color: "var(--muted)" }}>{short(c.contractId)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
