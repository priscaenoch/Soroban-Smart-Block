/**
 * SDK Snippet Generator Component
 * Issue #51: Client SDK Snippet Generator Utility
 */

import React, { useState } from "react";
import {
  generateJavaScriptSnippet,
  generateRustSnippet,
  generateTypeScriptSnippet,
} from "../utils/snippetGenerator";

interface SDKSnippetGeneratorProps {
  contractId: string;
  functionName: string;
  functionParams?: Array<{ name: string; type: string }>;
}

type Language = "javascript" | "typescript" | "rust";

export default function SDKSnippetGenerator({
  contractId,
  functionName,
  functionParams,
}: SDKSnippetGeneratorProps) {
  const [language, setLanguage] = useState<Language>("javascript");
  const [copied, setCopied] = useState(false);

  const generateSnippet = () => {
    const config = { contractId, functionName, functionParams };
    switch (language) {
      case "javascript":
        return generateJavaScriptSnippet(config);
      case "typescript":
        return generateTypeScriptSnippet(config);
      case "rust":
        return generateRustSnippet(config);
      default:
        return "";
    }
  };

  const snippet = generateSnippet();

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ borderRadius: "8px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          backgroundColor: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          {(["javascript", "typescript", "rust"] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              style={{
                padding: "6px 12px",
                border: language === lang ? "2px solid #3b82f6" : "1px solid #d1d5db",
                backgroundColor: language === lang ? "#dbeafe" : "#fff",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: language === lang ? "600" : "400",
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: "6px 12px",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: "16px",
          backgroundColor: "#1f2937",
          color: "#e5e7eb",
          fontSize: "12px",
          fontFamily: "monospace",
          overflow: "auto",
          maxHeight: "400px",
        }}
      >
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
