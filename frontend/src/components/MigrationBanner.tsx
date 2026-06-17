interface Props {
  upgradedAtLedger: number;
}

export default function MigrationBanner({ upgradedAtLedger }: Props) {
  return (
    <div
      style={{
        border: "1px solid var(--yellow)",
        borderRadius: 8,
        background: "#3a2e0a",
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>⚠</span>
      <div>
        <div
          style={{
            color: "var(--yellow)",
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 6,
          }}
        >
          Migration Pending — External State Interactions Suspended
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
          This contract was upgraded at ledger&nbsp;
          <strong style={{ color: "var(--text)" }}>{upgradedAtLedger}</strong> but has not yet executed its
          post-upgrade&nbsp;<code>migrate()</code>
          &nbsp;step. Per SEP-49, external state interactions remain suspended until the mandatory migration call
          completes.
        </div>
      </div>
    </div>
  );
}
