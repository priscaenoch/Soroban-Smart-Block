import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Nav() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  function search(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    // Stellar addresses start with G (56 chars); contract IDs are hex 64 chars
    if (v.startsWith("G") && v.length === 56) nav(`/wallet/${v}`);
    else nav(`/contract/${v}`);
    setQ("");
  }

  return (
    <header style={{
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}>
      <Link to="/" style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap" }}>
        ⬡ Soroban Explorer
      </Link>
      <Link to="/xdr" style={{ fontSize: 13, whiteSpace: "nowrap", color: "var(--muted)" }}>
        XDR Inspector
      </Link>
      <Link to="/batch" style={{ fontSize: 13, whiteSpace: "nowrap", color: "var(--muted)" }}>
        Batch Builder
      </Link>
      <form onSubmit={search} style={{ display: "flex", gap: 8, flex: 1, maxWidth: 600 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search contract ID or wallet address…"
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
      </form>
    </header>
  );
}
