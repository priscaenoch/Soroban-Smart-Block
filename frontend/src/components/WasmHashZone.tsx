import { useCallback, useState, type DragEvent } from "react";

export default function WasmHashZone() {
  const [hash, setHash] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function computeHash(file: File) {
    setError(null);
    setHash(null);
    if (!file.name.endsWith(".wasm")) {
      setError("Only .wasm files are accepted.");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setHash(hex);
    } catch {
      setError("Failed to compute hash.");
    }
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) computeHash(file);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 8,
          padding: "20px 24px",
          textAlign: "center",
          background: dragging ? "rgba(88,166,255,0.06)" : "transparent",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔐</div>
        <p style={{ color: "var(--text)", fontSize: 13, marginBottom: 4 }}>
          Drop a <code style={{ color: "var(--accent)" }}>.wasm</code> contract binary to compute its SHA-256 deploy
          hash
        </p>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>Computed locally in your browser — no file upload</p>
      </div>
      {error && <p style={{ color: "#f85149", fontSize: 12 }}>{error}</p>}
      {hash && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--green)",
            borderRadius: 6,
            padding: "10px 14px",
          }}
        >
          <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>SHA-256 Deploy Hash (32 bytes)</p>
          <code
            style={{
              fontSize: 12,
              color: "var(--green)",
              wordBreak: "break-all",
            }}
          >
            {hash}
          </code>
        </div>
      )}
    </div>
  );
}
