import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import FileExplorer from "../components/FileExplorer";
import Terminal from "../components/Terminal";
import { loadSandbox } from "../services/sandbox-api";
import { SandboxFile } from "../services/webcontainer";
import "../styles/Sandbox.css";

const SharedSandbox: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [files, setFiles] = useState<Map<string, SandboxFile>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedSandbox = async () => {
      if (!id) {
        setError("Sandbox ID not found");
        setLoading(false);
        return;
      }

      try {
        const sandbox = await loadSandbox(id);
        const fileMap = new Map(Object.entries(sandbox.files));
        setFiles(fileMap);
        setSelectedFile(Object.keys(sandbox.files)[0]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sandbox");
      } finally {
        setLoading(false);
      }
    };

    loadSharedSandbox();
  }, [id]);

  if (loading) {
    return (
      <div className="sandbox-container">
        <div className="sandbox-header">
          <h1>Soroban Sandbox</h1>
        </div>
        <div className="placeholder">Loading sandbox...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sandbox-container">
        <div className="sandbox-header">
          <h1>Soroban Sandbox</h1>
        </div>
        <div className="placeholder" style={{ color: "#f48771" }}>
          ✗ {error}
        </div>
      </div>
    );
  }

  const currentFile = selectedFile ? files.get(selectedFile) : null;

  return (
    <div className="sandbox-container">
      <div className="sandbox-header">
        <h1>Soroban Sandbox - Read Only</h1>
      </div>

      <div className="sandbox-layout">
        <FileExplorer files={Array.from(files.values())} selectedFile={selectedFile} onSelectFile={setSelectedFile} />

        <div className="editor-section">
          {currentFile ? (
            <div
              style={{
                height: "100%",
                overflow: "hidden",
                background: "#1e1e1e",
              }}
            >
              <div
                style={{
                  height: "100%",
                  color: "#d4d4d4",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  padding: "12px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {currentFile.content}
              </div>
            </div>
          ) : (
            <div className="placeholder">Select a file to view</div>
          )}
        </div>

        <div className="right-panel">
          <div className="preview">
            <div className="preview-header">Info</div>
            <div className="preview-content">
              <p style={{ fontSize: "12px", color: "#bebebe" }}>
                This is a read-only view of a shared Soroban Sandbox.
              </p>
            </div>
          </div>
          <Terminal output={["> Shared sandbox loaded"]} />
        </div>
      </div>
    </div>
  );
};

export default SharedSandbox;
