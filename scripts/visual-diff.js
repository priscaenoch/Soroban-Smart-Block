#!/usr/bin/env node
/**
 * visual-diff.js
 *
 * Generates a side-by-side and unified visual diff for PR review.
 * Outputs a self-contained HTML file and optionally a GitHub PR comment
 * body (Markdown) for posting via the GitHub API.
 *
 * Usage:
 *   node scripts/visual-diff.js --base <ref> --head <ref> [--file <path>]
 *                               [--output <html-path>] [--comment <md-path>]
 *
 * In CI, the Markdown output is posted as a PR comment using gh CLI.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args    = process.argv.slice(2);
const getArg  = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };

const BASE    = getArg("--base")    ?? "HEAD~1";
const HEAD    = getArg("--head")    ?? "HEAD";
const TARGET  = getArg("--file")    ?? null; // specific file or null = all
const OUT_HTML = getArg("--output") ?? path.join(ROOT, "docs", "site", "visual-diff.html");
const OUT_MD   = getArg("--comment") ?? null;

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: "utf8", cwd: ROOT, stdio: ["pipe","pipe","ignore"],
    }).trim();
  } catch { return ""; }
}

function getDiff(base, head, file) {
  const target = file ? `-- "${file}"` : "";
  return git(`diff --unified=5 ${base} ${head} ${target}`);
}

function getChangedFiles(base, head) {
  return git(`diff --name-only ${base} ${head}`).split("\n").filter(Boolean);
}

// ── Diff parser ───────────────────────────────────────────────────────────────

/**
 * Parse unified diff output into structured hunks.
 * Returns: [{ file, hunks: [{ header, lines: [{type, content}] }] }]
 */
function parseDiff(raw) {
  const files = [];
  let current = null;
  let hunk    = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (current) files.push(current);
      const m = line.match(/diff --git a\/(.+) b\/(.+)/);
      current = { file: m ? m[2] : "unknown", hunks: [] };
      hunk = null;
    } else if (line.startsWith("@@") && current) {
      hunk = { header: line, lines: [] };
      current.hunks.push(hunk);
    } else if (hunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        hunk.lines.push({ type: "add", content: line.slice(1) });
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        hunk.lines.push({ type: "remove", content: line.slice(1) });
      } else if (!line.startsWith("\\") && !line.startsWith("---") && !line.startsWith("+++")) {
        hunk.lines.push({ type: "context", content: line.slice(1) });
      }
    }
  }
  if (current) files.push(current);
  return files;
}

// ── Conflict marker detector ──────────────────────────────────────────────────

function findConflictRegions(lines) {
  const regions = [];
  let inConflict = false;
  let start = 0;

  lines.forEach((line, i) => {
    if (line.content?.startsWith("<<<<<<<")) { inConflict = true; start = i; }
    if (line.content?.startsWith(">>>>>>>") && inConflict) {
      regions.push({ start, end: i });
      inConflict = false;
    }
  });
  return regions;
}

// ── HTML generator ────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lineClass(type) {
  return type === "add" ? "add" : type === "remove" ? "remove" : "ctx";
}

function generateDiffHTML(parsedFiles, base, head) {
  const totalAdded   = parsedFiles.flatMap((f) => f.hunks.flatMap((h) => h.lines)).filter((l) => l.type === "add").length;
  const totalRemoved = parsedFiles.flatMap((f) => f.hunks.flatMap((h) => h.lines)).filter((l) => l.type === "remove").length;

  const fileCards = parsedFiles.map((f) => {
    const conflictRegions = findConflictRegions(f.hunks.flatMap((h) => h.lines));
    const hasConflicts = conflictRegions.length > 0;

    const hunkBlocks = f.hunks.map((h) => {
      // Build side-by-side view
      const leftLines  = [];
      const rightLines = [];
      let li = 1, ri = 1;

      for (const line of h.lines) {
        if (line.type === "remove") {
          leftLines.push(`<div class="line remove"><span class="lno">${li++}</span><code>${escapeHtml(line.content)}</code></div>`);
        } else if (line.type === "add") {
          rightLines.push(`<div class="line add"><span class="lno">${ri++}</span><code>${escapeHtml(line.content)}</code></div>`);
        } else {
          // Pad whichever side is shorter
          while (leftLines.length < rightLines.length) leftLines.push(`<div class="line ctx pad"></div>`);
          while (rightLines.length < leftLines.length) rightLines.push(`<div class="line ctx pad"></div>`);
          leftLines.push(`<div class="line ctx"><span class="lno">${li++}</span><code>${escapeHtml(line.content)}</code></div>`);
          rightLines.push(`<div class="line ctx"><span class="lno">${ri++}</span><code>${escapeHtml(line.content)}</code></div>`);
        }
      }

      // Unified view
      const unifiedLines = h.lines.map((line) =>
        `<div class="line ${lineClass(line.type)}"><code>${escapeHtml(line.content)}</code></div>`
      ).join("");

      return `
        <div class="hunk">
          <div class="hunk-header">${escapeHtml(h.header)}</div>
          <div class="view-split view-container">
            <div class="split-side">${leftLines.join("")}</div>
            <div class="split-side">${rightLines.join("")}</div>
          </div>
          <div class="view-unified view-container" style="display:none">
            ${unifiedLines}
          </div>
        </div>`;
    }).join("");

    return `
      <div class="file-card ${hasConflicts ? "has-conflicts" : ""}">
        <div class="file-header" onclick="toggleFile(this)">
          <span class="file-toggle">▼</span>
          <span class="file-name">${escapeHtml(f.file)}</span>
          ${hasConflicts ? `<span class="conflict-badge">⚠️ ${conflictRegions.length} conflict${conflictRegions.length > 1 ? "s" : ""}</span>` : ""}
          <span class="file-stats">
            <span class="stat-add">+${f.hunks.flatMap(h => h.lines).filter(l => l.type === "add").length}</span>
            <span class="stat-remove">-${f.hunks.flatMap(h => h.lines).filter(l => l.type === "remove").length}</span>
          </span>
        </div>
        <div class="file-body">
          ${hunkBlocks}
        </div>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visual Diff — ${escapeHtml(base)} → ${escapeHtml(head)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "SF Mono", "Fira Code", monospace; background: #0d1117; color: #e6edf3; padding: 1.5rem; font-size: 13px; }
    h1 { font-family: -apple-system, sans-serif; font-size: 1.4rem; color: #f0f6fc; margin-bottom: 0.5rem; }
    .meta { color: #6e7681; font-size: 0.8rem; margin-bottom: 1.5rem; font-family: sans-serif; }
    .toolbar {
      display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center;
      font-family: -apple-system, sans-serif; font-size: 0.85rem;
    }
    .btn {
      padding: 0.4rem 0.9rem; border-radius: 6px; border: 1px solid #30363d;
      background: #21262d; color: #c9d1d9; cursor: pointer;
    }
    .btn.active { background: #1f6feb; border-color: #1f6feb; color: #fff; }
    .summary { display: flex; gap: 1rem; margin-left: auto; }
    .stat-add    { color: #3fb950; }
    .stat-remove { color: #f85149; }
    .file-card { border: 1px solid #30363d; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }
    .file-card.has-conflicts { border-color: #d29922; }
    .file-header {
      display: flex; align-items: center; gap: 0.75rem;
      background: #161b22; padding: 0.6rem 1rem; cursor: pointer;
      font-family: -apple-system, sans-serif; font-size: 0.85rem;
    }
    .file-header:hover { background: #1c2128; }
    .file-toggle { color: #6e7681; transition: transform 0.15s; }
    .file-toggle.closed { transform: rotate(-90deg); }
    .file-name { color: #79c0ff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .conflict-badge { background: #3d2b00; color: #d29922; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
    .file-stats { display: flex; gap: 0.5rem; }
    .file-body { display: block; }
    .file-body.hidden { display: none; }
    .hunk { border-top: 1px solid #21262d; }
    .hunk-header { background: #1d2d3e; color: #79c0ff; padding: 0.3rem 1rem; font-size: 0.8rem; }
    .view-container { overflow-x: auto; }
    .view-split { display: flex; }
    .split-side { flex: 1; min-width: 0; border-right: 1px solid #21262d; }
    .split-side:last-child { border-right: none; }
    .line { display: flex; min-height: 1.6em; }
    .line.add    { background: #0d4429; }
    .line.remove { background: #3c0614; }
    .line.ctx    { background: transparent; }
    .line.pad    { background: #0d1117; min-height: 1.6em; }
    .lno { min-width: 3rem; text-align: right; padding: 0 0.5rem; color: #4d5566; user-select: none; flex-shrink: 0; }
    code { white-space: pre; flex: 1; padding: 0 0.5rem; overflow: hidden; }
    .line.add code    { color: #3fb950; }
    .line.remove code { color: #f85149; }
  </style>
</head>
<body>
  <h1>🔀 Visual Diff</h1>
  <p class="meta">
    <strong>${escapeHtml(base)}</strong> → <strong>${escapeHtml(head)}</strong> ·
    ${parsedFiles.length} file(s) changed ·
    Generated ${new Date().toLocaleString()}
  </p>

  <div class="toolbar">
    <button class="btn active" id="btnSplit"  onclick="setView('split')">⬛ Split</button>
    <button class="btn"        id="btnUnified" onclick="setView('unified')">≡ Unified</button>
    <button class="btn"        onclick="expandAll()">Expand All</button>
    <button class="btn"        onclick="collapseAll()">Collapse All</button>
    <div class="summary">
      <span class="stat-add">+${totalAdded} additions</span>
      <span class="stat-remove">-${totalRemoved} deletions</span>
    </div>
  </div>

  <div id="diffContainer">
    ${fileCards || "<p style='color:#6e7681;padding:1rem'>No changes detected.</p>"}
  </div>

  <script>
    let viewMode = "split";

    function setView(mode) {
      viewMode = mode;
      document.getElementById("btnSplit").classList.toggle("active", mode === "split");
      document.getElementById("btnUnified").classList.toggle("active", mode === "unified");
      document.querySelectorAll(".view-split").forEach(el => el.style.display = mode === "split" ? "flex" : "none");
      document.querySelectorAll(".view-unified").forEach(el => el.style.display = mode === "unified" ? "block" : "none");
    }

    function toggleFile(header) {
      const body   = header.nextElementSibling;
      const toggle = header.querySelector(".file-toggle");
      const hidden = body.classList.toggle("hidden");
      toggle.classList.toggle("closed", hidden);
    }

    function expandAll()   { document.querySelectorAll(".file-body").forEach(b => { b.classList.remove("hidden"); b.previousElementSibling.querySelector(".file-toggle").classList.remove("closed"); }); }
    function collapseAll() { document.querySelectorAll(".file-body").forEach(b => { b.classList.add("hidden");    b.previousElementSibling.querySelector(".file-toggle").classList.add("closed"); }); }
  </script>
</body>
</html>`;
}

// ── Markdown PR comment generator ────────────────────────────────────────────

function generateMarkdownComment(parsedFiles, base, head) {
  const totalAdded   = parsedFiles.flatMap((f) => f.hunks.flatMap((h) => h.lines)).filter((l) => l.type === "add").length;
  const totalRemoved = parsedFiles.flatMap((f) => f.hunks.flatMap((h) => h.lines)).filter((l) => l.type === "remove").length;
  const conflicts    = parsedFiles.filter((f) => findConflictRegions(f.hunks.flatMap((h) => h.lines)).length > 0);

  const lines = [
    `## 🔀 Visual Diff Summary`,
    ``,
    `**Base:** \`${base}\` → **Head:** \`${head}\``,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Files changed | ${parsedFiles.length} |`,
    `| Lines added | +${totalAdded} |`,
    `| Lines removed | -${totalRemoved} |`,
    `| Conflict regions | ${conflicts.length > 0 ? `⚠️ ${conflicts.reduce((s, f) => s + findConflictRegions(f.hunks.flatMap((h) => h.lines)).length, 0)}` : "✅ 0"} |`,
    ``,
  ];

  if (conflicts.length > 0) {
    lines.push(`### ⚠️ Files with Conflict Markers`);
    lines.push(``);
    for (const f of conflicts) {
      const regions = findConflictRegions(f.hunks.flatMap((h) => h.lines));
      lines.push(`- \`${f.file}\` — ${regions.length} conflict region(s)`);
    }
    lines.push(``);
    lines.push(`> **Action required:** Resolve all conflict markers before this PR can be merged.`);
    lines.push(``);
  }

  lines.push(`### 📄 Changed Files`);
  lines.push(``);
  lines.push(`| File | +Added | -Removed |`);
  lines.push(`|------|--------|----------|`);
  for (const f of parsedFiles.slice(0, 20)) {
    const added   = f.hunks.flatMap((h) => h.lines).filter((l) => l.type === "add").length;
    const removed = f.hunks.flatMap((h) => h.lines).filter((l) => l.type === "remove").length;
    const flag    = findConflictRegions(f.hunks.flatMap((h) => h.lines)).length > 0 ? " ⚠️" : "";
    lines.push(`| \`${f.file}\`${flag} | +${added} | -${removed} |`);
  }
  if (parsedFiles.length > 20) lines.push(`| *(${parsedFiles.length - 20} more files…)* | | |`);

  lines.push(``);
  lines.push(`<details><summary>🔍 View full visual diff</summary>`);
  lines.push(``);
  lines.push(`Run locally: \`node scripts/visual-diff.js --base ${base} --head ${head}\``);
  lines.push(`</details>`);

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n🎨 Visual Diff Generator`);
console.log(`   ${BASE} → ${HEAD}${TARGET ? ` (file: ${TARGET})` : ""}\n`);

const rawDiff = getDiff(BASE, HEAD, TARGET);
if (!rawDiff) {
  console.log("✅ No differences found.");
  process.exit(0);
}

const parsed = parseDiff(rawDiff);
console.log(`   Parsed ${parsed.length} file(s) with ${parsed.reduce((s, f) => s + f.hunks.length, 0)} hunks`);

// HTML output
const html = generateDiffHTML(parsed, BASE, HEAD);
fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
fs.writeFileSync(OUT_HTML, html, "utf8");
console.log(`   ✅ HTML diff written to: ${OUT_HTML}`);

// Markdown comment output
if (OUT_MD) {
  const md = generateMarkdownComment(parsed, BASE, HEAD);
  fs.writeFileSync(OUT_MD, md, "utf8");
  console.log(`   ✅ Markdown comment written to: ${OUT_MD}`);
}

// Detect conflicts in diff
const conflictFiles = parsed.filter((f) =>
  findConflictRegions(f.hunks.flatMap((h) => h.lines)).length > 0
);

if (conflictFiles.length > 0) {
  console.error(`\n❌ Conflict markers detected in ${conflictFiles.length} file(s):`);
  conflictFiles.forEach((f) => console.error(`   ${f.file}`));
  process.exit(1);
}

console.log(`\n✅ No conflict markers detected in diff.`);
process.exit(0);
