import { useState } from "react";
import RustCodeViewer from "./RustCodeViewer";

export interface SourceFile {
  path: string;
  content: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  content?: string;
}

function buildTree(files: SourceFile[]): TreeNode {
  const root: TreeNode = { name: "", fullPath: "", isDir: true, children: [] };

  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        node.children.push({
          name,
          fullPath: file.path,
          isDir: false,
          children: [],
          content: file.content,
        });
      } else {
        let dir = node.children.find((c) => c.name === name && c.isDir);
        if (!dir) {
          dir = {
            name,
            fullPath: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          node.children.push(dir);
        }
        node = dir;
      }
    }
  }

  return root;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface NodeRowProps {
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (file: SourceFile) => void;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function NodeRow({ node, depth, selected, onSelect, expanded, onToggle }: NodeRowProps) {
  const isExpanded = expanded.has(node.fullPath);
  const isSelected = selected === node.fullPath;

  const handleClick = () => {
    if (node.isDir) {
      onToggle(node.fullPath);
    } else {
      onSelect({ path: node.fullPath, content: node.content ?? "" });
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          paddingLeft: 8 + depth * 16,
          cursor: "pointer",
          background: isSelected ? "rgba(88,166,255,0.12)" : "transparent",
          borderRadius: 4,
          color: isSelected ? "var(--accent)" : "var(--text)",
          fontSize: 13,
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: "var(--muted)",
            fontSize: 11,
            width: 12,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {node.isDir ? (isExpanded ? "▾" : "▸") : ""}
        </span>
        <span
          style={{
            color: node.isDir ? "var(--yellow)" : "var(--muted)",
            fontSize: 13,
          }}
        >
          {node.isDir ? "📁" : fileIcon(node.name)}
        </span>
        <span>{node.name}</span>
      </div>
      {node.isDir &&
        isExpanded &&
        sortNodes(node.children).map((child) => (
          <NodeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function fileIcon(name: string): string {
  if (name === "Cargo.toml" || name === "Cargo.lock") return "📦";
  if (name.endsWith(".rs")) return "🦀";
  if (name.endsWith(".toml")) return "⚙";
  if (name.endsWith(".md")) return "📝";
  return "📄";
}

interface Props {
  files: SourceFile[];
}

export default function SourceFileTree({ files }: Props) {
  const tree = buildTree(files);

  const initialDirs = new Set<string>();
  (function collectDirs(node: TreeNode) {
    if (node.isDir && node.fullPath) initialDirs.add(node.fullPath);
    node.children.forEach(collectDirs);
  })(tree);

  const [expanded, setExpanded] = useState<Set<string>>(initialDirs);
  const [selected, setSelected] = useState<SourceFile | null>(
    files.find((f) => f.path.endsWith("lib.rs")) ?? files[0] ?? null,
  );

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Navigator panel */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--bg)",
          borderRight: "1px solid var(--border)",
          overflowY: "auto",
          padding: "8px 4px",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "var(--muted)",
            padding: "0 8px 6px",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Source Files
        </div>
        {sortNodes(tree.children).map((node) => (
          <NodeRow
            key={node.fullPath}
            node={node}
            depth={0}
            selected={selected?.path ?? ""}
            onSelect={setSelected}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Viewer panel */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {selected ? (
          <RustCodeViewer source={selected.content} filename={selected.path} />
        ) : (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>Select a file to view its source.</div>
        )}
      </div>
    </div>
  );
}
