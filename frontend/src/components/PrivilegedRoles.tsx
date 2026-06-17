import { useQuery } from "@tanstack/react-query";
import { api, type PrivilegedRole } from "../api";

const ROLE_COLORS: Record<string, string> = {
  admin: "#f85149",
  manager: "#d29922",
  minter: "#3fb950",
  pauser: "#58a6ff",
};

function roleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? "#8b949e";
}

function fmtAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export default function PrivilegedRoles({ contractId }: { contractId: string }) {
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles", contractId],
    queryFn: () => api.roles(contractId),
    enabled: !!contractId,
  });

  if (isLoading) return <p style={{ color: "var(--muted)", fontSize: 13 }}>Loading roles…</p>;

  if (roles.length === 0) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          No privileged role assignments detected for this contract.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 14 }}>Privileged Roles</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--muted)" }}>
            <th style={th}>Role</th>
            <th style={th}>Address</th>
            <th style={th}>Since Ledger</th>
            <th style={th}>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r: PrivilegedRole, i: number) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={td}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    background: roleColor(r.role) + "22",
                    color: roleColor(r.role),
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {r.role}
                </span>
              </td>
              <td style={{ ...td, fontFamily: "monospace" }}>
                <span title={r.address}>{fmtAddr(r.address)}</span>
              </td>
              <td style={{ ...td, color: "var(--muted)" }}>{r.ledger ?? "—"}</td>
              <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{new Date(r.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontWeight: 500,
  fontSize: 11,
};
const td: React.CSSProperties = {
  padding: "7px 8px",
  verticalAlign: "middle",
};
