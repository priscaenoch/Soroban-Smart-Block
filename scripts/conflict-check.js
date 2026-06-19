#!/usr/bin/env node
/**
 * conflict-check.js
 * Scans staged (or all tracked) files for merge conflict markers.
 * Used by: pre-merge-commit git hook & CI pipeline.
 *
 * Exit 0 → clean
 * Exit 1 → conflict markers found
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────
const CONFLICT_PATTERNS = [
  /^<{7}( .+)?$/m,   // <<<<<<< HEAD  or  <<<<<<< branch-name
  /^={7}$/m,          // =======
  /^>{7}( .+)?$/m,   // >>>>>>> branch-name
];

const MERGE_ARTIFACT_PATTERNS = [
  /^<{7} (HEAD|main|master|develop)/m,
  /^>{7} (main|master|develop)/m,
];

const ARTIFACT_FILE_PATTERNS = [
  /\.orig$/,
  /\.(BACKUP|BASE|LOCAL|REMOTE)\.\d+\./,
];

const SCAN_EXTENSIONS = new Set([
  ".js", ".ts", ".tsx", ".jsx",
  ".json", ".yaml", ".yml",
  ".rs", ".toml",
  ".md", ".html", ".css",
  ".sql",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the list of files to scan. */
function getFilesToScan(mode) {
  if (mode === "staged") {
    try {
      const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
        encoding: "utf8",
      }).trim();
      return out ? out.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  // "all" — every tracked file
  try {
    const out = execSync("git ls-files", { encoding: "utf8" }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Check a single file for conflict markers. Returns array of findings. */
function checkFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCAN_EXTENSIONS.has(ext)) return [];

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return []; // skip unreadable files
  }

  const findings = [];
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (/^<{7}/.test(line)) {
      findings.push({ file: filePath, line: lineNo, marker: "<<<<<<<", content: line.trim() });
    } else if (/^={7}$/.test(line.trim())) {
      findings.push({ file: filePath, line: lineNo, marker: "=======", content: line.trim() });
    } else if (/^>{7}/.test(line)) {
      findings.push({ file: filePath, line: lineNo, marker: ">>>>>>>", content: line.trim() });
    }
  });

  return findings;
}

/** Check for leftover merge artifact files (.orig, .BACKUP.*, etc.) */
function checkArtifactFiles(files) {
  return files.filter((f) =>
    ARTIFACT_FILE_PATTERNS.some((pat) => pat.test(f))
  );
}

// ── Conflict Complexity Scorer ────────────────────────────────────────────────

/**
 * Score a conflict's complexity on a 0–10 scale.
 * Factor weights (sum = 1.0):
 *   linesChanged   0.30
 *   markersFound   0.30
 *   fileCount      0.20
 *   fileHistory    0.10   (approximated from git log --follow)
 *   authorCount    0.10
 */
function scoreComplexity(findings) {
  const fileSet = new Set(findings.map((f) => f.file));
  const linesScore = Math.min(findings.length * 0.5, 10) * 0.3;
  const markerScore = Math.min(findings.filter((f) => f.marker === "<<<<<<<").length * 1.5, 10) * 0.3;
  const fileScore = Math.min(fileSet.size * 2, 10) * 0.2;

  // git history approximation
  let historyScore = 0;
  for (const file of fileSet) {
    try {
      const count = execSync(`git log --oneline -- "${file}" 2>nul | find /c /v ""`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      if (Number(count) > 20) historyScore += 2;
    } catch { /* skip */ }
  }
  const histNorm = Math.min(historyScore, 10) * 0.1;

  // author diversity approximation
  let authorScore = 0;
  for (const file of fileSet) {
    try {
      const authors = execSync(`git log --format="%ae" -- "${file}" 2>nul`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim().split("\n").filter(Boolean);
      const unique = new Set(authors);
      if (unique.size > 2) authorScore += 2;
    } catch { /* skip */ }
  }
  const authorNorm = Math.min(authorScore, 10) * 0.1;

  const total = linesScore + markerScore + fileScore + histNorm + authorNorm;
  return Math.round(Math.min(total, 10) * 10) / 10;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const mode = process.argv[2] ?? "staged"; // "staged" | "all"
const files = getFilesToScan(mode);

if (files.length === 0) {
  console.log("✅ No files to scan.");
  process.exit(0);
}

let allFindings = [];
for (const file of files) {
  allFindings = allFindings.concat(checkFile(file));
}

const artifactFiles = checkArtifactFiles(files);

let hasError = false;

// ── Report ────────────────────────────────────────────────────────────────────

if (artifactFiles.length > 0) {
  hasError = true;
  console.error("\n❌  Merge artifact files detected:");
  artifactFiles.forEach((f) => console.error(`   ${f}`));
}

if (allFindings.length > 0) {
  hasError = true;
  console.error("\n❌  Conflict markers found:\n");

  // Group by file
  const byFile = {};
  for (const f of allFindings) {
    (byFile[f.file] = byFile[f.file] || []).push(f);
  }

  for (const [file, items] of Object.entries(byFile)) {
    console.error(`  📄 ${file}`);
    for (const item of items) {
      console.error(`     line ${item.line}: ${item.content}`);
    }
  }

  const score = scoreComplexity(allFindings);
  console.error(`\n  🔢 Conflict complexity score: ${score}/10`);
  if (score >= 7) {
    console.error("  ⚠️  Score ≥ 7 — senior review required before merging.");
  }

  console.error(`
  ──────────────────────────────────────────────────────
  To fix: resolve all conflict markers in the files above,
  then stage the resolved files with: git add <file>
  ──────────────────────────────────────────────────────
`);
  process.exit(1);
}

if (!hasError) {
  console.log(`✅ No conflict markers found in ${files.length} file(s).`);
  process.exit(0);
} else {
  process.exit(1);
}
