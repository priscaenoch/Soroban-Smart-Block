import { useState, useEffect } from "react";

interface DoctorReport {
  runtimes: Record<string, { status: string; version?: string; message: string }>;
  database: { connected: boolean; message: string };
  env: Record<string, { status: string; value: string; message: string }>;
  ports: Record<string, { status: string; inUse: boolean; message: string }>;
  system: {
    disk: { status: string; freeGB?: string; message: string };
    memory: {
      status: string;
      totalGB?: string;
      freeGB?: string;
      message: string;
    };
  };
  gitHooks: { status: string; message: string };
  docker: { status: string; message: string };
}

export default function SetupPage() {
  // Form state
  const [rpcUrl, setRpcUrl] = useState("https://soroban-testnet.stellar.org");
  const [dbUrl, setDbUrl] = useState("postgres://soroban:soroban_secret@localhost:5432/soroban_explorer");
  const [pollMs, setPollMs] = useState("5000");

  // Health report state
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [doctorError, setDoctorError] = useState("");

  // Action states
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const [savingConfig, setSavingConfig] = useState(false);
  const [saveResult, setSaveResult] = useState<boolean | null>(null);

  const [initializingDb, setInitializingDb] = useState(false);
  const [dbInitResult, setDbInitResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Fetch diagnostics
  const fetchDiagnostics = async () => {
    setLoadingDoctor(true);
    setDoctorError("");
    try {
      const res = await fetch("/api/setup/doctor");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);

      // Pre-fill form from report values if configured
      if (data.env.SOROBAN_RPC_URL?.value !== "Not set") {
        setRpcUrl(data.env.SOROBAN_RPC_URL.value);
      }
      if (data.env.DATABASE_URL?.value !== "Not set") {
        setDbUrl(data.env.DATABASE_URL.value);
      }
    } catch (err: any) {
      setDoctorError(`Failed to load health diagnostics: ${err.message}`);
    } finally {
      setLoadingDoctor(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  // Handlers
  const handleTestConnection = async () => {
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch("/api/setup/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: dbUrl }),
      });
      const data = await res.json();
      setDbTestResult(data);
    } catch (err: any) {
      setDbTestResult({ success: false, error: err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/setup/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sorobanRpcUrl: rpcUrl,
          databaseUrl: dbUrl,
          pollMs,
        }),
      });
      const data = await res.json();
      setSaveResult(data.success);
      if (data.success) {
        fetchDiagnostics(); // refresh
      }
    } catch {
      setSaveResult(false);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleInitDatabase = async () => {
    setInitializingDb(true);
    setDbInitResult(null);
    try {
      const res = await fetch("/api/setup/db-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbInitResult({ success: true });
        fetchDiagnostics();
      } else {
        setDbInitResult({
          success: false,
          error: data.error || "Initialization failed",
        });
      }
    } catch (err: any) {
      setDbInitResult({ success: false, error: err.message });
    } finally {
      setInitializingDb(false);
    }
  };

  // Diagnostic helper functions
  const getBadgeClass = (status: string) => {
    if (status === "pass") return "badge green";
    if (status === "warn") return "badge yellow";
    return "badge clawback"; // red
  };

  const getStatusText = (status: string) => {
    if (status === "pass") return "✓ Passed";
    if (status === "warn") return "⚠ Warning";
    return "✗ Failed";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1
          style={{
            fontSize: 24,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🛠️</span> Onboarding Setup & Diagnostics
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Validate requirements, update environment configurations, connect databases, and seed mock explorer data.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left Column: Config Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Step 1: Environment Variables */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3
              style={{
                fontSize: 16,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
              }}
            >
              [1/3] Environment Configuration
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>SOROBAN_RPC_URL</label>
              <input
                id="setup-rpc-url"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="https://soroban-testnet.stellar.org"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>DATABASE_URL</label>
              <input
                id="setup-db-url"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="postgres://user:password@localhost:5432/db"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>POLL_MS</label>
              <input
                id="setup-poll-ms"
                type="number"
                value={pollMs}
                onChange={(e) => setPollMs(e.target.value)}
                placeholder="5000"
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                id="btn-test-db"
                onClick={handleTestConnection}
                disabled={testingDb}
                style={{ background: "var(--border)", color: "var(--text)" }}
              >
                {testingDb ? "Testing..." : "Test Connection"}
              </button>

              <button
                id="btn-save-config"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                style={{ background: "var(--accent)" }}
              >
                {savingConfig ? "Saving..." : "Save Configuration"}
              </button>
            </div>

            {dbTestResult && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 13,
                  background: dbTestResult.success ? "#1a3a22" : "#3a0d0d",
                  color: dbTestResult.success ? "var(--green)" : "#f85149",
                  border: `1px solid ${dbTestResult.success ? "var(--green)" : "#f85149"}`,
                }}
              >
                {dbTestResult.success
                  ? "✓ Database connection test succeeded!"
                  : `✗ Connection failed: ${dbTestResult.error}`}
              </div>
            )}

            {saveResult !== null && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 13,
                  background: saveResult ? "#1a3a22" : "#3a0d0d",
                  color: saveResult ? "var(--green)" : "#f85149",
                  border: `1px solid ${saveResult ? "var(--green)" : "#f85149"}`,
                }}
              >
                {saveResult
                  ? "✓ Configuration saved into .env successfully!"
                  : "✗ Failed to save configuration to .env"}
              </div>
            )}
          </div>

          {/* Step 2: Database setup & seed */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3
              style={{
                fontSize: 16,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
              }}
            >
              [2/3] Database Seeding & Schema Setup
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Initialize database schema, apply table migrations, and populate mock transaction history (500+ events, 20
              contracts).
            </p>

            <div>
              <button
                id="btn-init-db"
                onClick={handleInitDatabase}
                disabled={initializingDb}
                style={{
                  background: "var(--yellow)",
                  color: "#0d1117",
                  fontWeight: 700,
                }}
              >
                {initializingDb ? "Initializing & Seeding..." : "⚡ Initialize & Seed Database"}
              </button>
            </div>

            {dbInitResult && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 13,
                  background: dbInitResult.success ? "#1a3a22" : "#3a0d0d",
                  color: dbInitResult.success ? "var(--green)" : "#f85149",
                  border: `1px solid ${dbInitResult.success ? "var(--green)" : "#f85149"}`,
                }}
              >
                {dbInitResult.success
                  ? "✓ Database initialized, migrations run, and 500+ events seeded successfully!"
                  : `✗ Database setup failed: ${dbInitResult.error}`}
              </div>
            )}
          </div>

          {/* Step 3: Local Dev info */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3
              style={{
                fontSize: 16,
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
              }}
            >
              [3/3] Start Local Server
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              After completing the steps above, start both the API indexer daemon and frontend Vite server:
            </p>
            <div
              style={{
                background: "var(--bg)",
                padding: "8px 12px",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 13,
                border: "1px solid var(--border)",
              }}
            >
              npm run dev
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              Open{" "}
              <a href="http://localhost:5173" target="_blank" rel="noreferrer">
                http://localhost:5173
              </a>{" "}
              to view the explorer interface.
            </p>
          </div>
        </div>

        {/* Right Column: Health Diagnostics Dashboard */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid var(--border)",
              paddingBottom: 8,
            }}
          >
            <h3 style={{ fontSize: 16 }}>System Health & Prerequisites</h3>
            <button
              onClick={fetchDiagnostics}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "var(--border)",
                color: "var(--text)",
              }}
            >
              Refresh
            </button>
          </div>

          {loadingDoctor ? (
            <p
              style={{
                color: "var(--muted)",
                textAlign: "center",
                padding: 24,
              }}
            >
              Loading system diagnostic report…
            </p>
          ) : doctorError ? (
            <p style={{ color: "#f85149", textAlign: "center", padding: 24 }}>{doctorError}</p>
          ) : report ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Runtimes */}
              <div>
                <h4
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Runtimes
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(report.runtimes).map(([key, check]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{key}</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {check.version && <span style={{ color: "var(--muted)", fontSize: 12 }}>{check.version}</span>}
                        <span className={getBadgeClass(check.status)}>{getStatusText(check.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Database Status */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <h4
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Database Connection
                </h4>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span>PostgreSQL Connectivity</span>
                  <span className={getBadgeClass(report.database.connected ? "pass" : "fail")}>
                    {report.database.connected ? "✓ Connected" : "✗ Disconnected"}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{report.database.message}</p>
              </div>

              {/* Ports */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <h4
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  Ports Status
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(report.ports).map(([port, check]) => (
                    <div
                      key={port}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 13,
                      }}
                    >
                      <span>Port {port}</span>
                      <span className={getBadgeClass(check.status)}>{check.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Stats */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <h4
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  System Resources
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <span>Disk Space</span>
                    <span className={getBadgeClass(report.system.disk.status)}>
                      {report.system.disk.status === "pass" ? "✓ OK" : "⚠ Low Space"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: -4,
                    }}
                  >
                    {report.system.disk.message}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <span>System Memory</span>
                    <span className={getBadgeClass(report.system.memory.status)}>
                      {report.system.memory.status === "pass" ? "✓ OK" : "⚠ Low Memory"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: -4,
                    }}
                  >
                    {report.system.memory.message}
                  </p>
                </div>
              </div>

              {/* Git Hooks & Docker */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <h4
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Git Hooks
                  </h4>
                  <span className={getBadgeClass(report.gitHooks.status)}>
                    {report.gitHooks.status === "pass" ? "✓ Installed" : "⚠ Missing Hooks"}
                  </span>
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Docker Environment
                  </h4>
                  <span className={getBadgeClass(report.docker.status)}>
                    {report.docker.status === "pass" ? "✓ Available" : "⚠ Not Available"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
