import React, { useState } from "react";
import { SandboxFile } from "../services/webcontainer";
import { exportAsZip, downloadZip, copySandboxUrl } from "../services/export";
import "../styles/ActionBar.css";

interface ActionBarProps {
  files: Map<string, SandboxFile>;
  sandboxId: string | null;
}

const ActionBar: React.FC<ActionBarProps> = ({ files, sandboxId }) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async () => {
    const blob = await exportAsZip(files, "soroban-sandbox");
    downloadZip(blob, "soroban-sandbox.zip");
  };

  const handleShare = () => {
    if (sandboxId) {
      copySandboxUrl(sandboxId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="action-bar">
      <div className="action-group">
        <button className="action-btn" onClick={handleExport} title="Export as ZIP">
          📦 Export
        </button>
        {sandboxId && (
          <button className="action-btn" onClick={handleShare} title="Copy shareable URL">
            {copied ? "✓ Copied" : "🔗 Share"}
          </button>
        )}
      </div>

      <div className="menu">
        <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
          ⋮
        </button>
        {showMenu && (
          <div className="menu-dropdown">
            <button className="menu-item">Save</button>
            <button className="menu-item">Fork</button>
            <button className="menu-item">Settings</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionBar;
