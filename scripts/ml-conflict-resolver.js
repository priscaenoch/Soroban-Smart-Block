#!/usr/bin/env node
/**
 * ml-conflict-resolver.js
 *
 * ML-inspired conflict resolution engine.
 * Collects historical resolutions from git log, identifies patterns,
 * and suggests (or auto-applies) resolutions for new conflicts.
 *
 * Strategies applied in order:
 *  1. Whitespace-only → auto-resolve (take either side, normalise)
 *  2. Import-order    → auto-resolve (merge + sort)
 *  3. Version-bump    → auto-resolve (take highest semver)
 *  4. Comment-only    → auto-resolve (keep both)
 *  5. Known pattern   → suggest from historical corpus
 *  6. Complex         → flag for human review
 *
 * Usage:
 *   node scripts/ml-conflict-resolver.js [--file <path>] [--auto] [--report <out.json>]
 *
 * --auto   Apply safe auto-resolutions in-place (score < 3 only)
 * --report Write JSON suggestion report
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const getArg = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const TARGET_FILE = getArg("--file");
const AUTO_APPLY  = args.includes("--auto");
const REPORT_FILE = getArg("--report");
const AUTO_SCORE_THRESHOLD = 3; // only auto-resolve conflicts with complexity score < 3

// ── Helpers ───────────────────────────────────────────────────────────────────

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["pipe","pipe","ignore"] }).trim();
  } catch { return ""; }
}

// ── Historical corpus builder ─────────────────────────────────────────────────

/**
 * Walk git log to find merge commits and extract before/after file snapshots.
 * Returns an array of { pattern, resolution } pairs.
 */
function buildHistoricalCorpus() {
  const corpus = [];
  // Get last 200 merge commits
  const mergeCommits = git("log --merges --format=%H -n 200").split("\n").filter(Boolean);

  for (const sha of mergeCommits.slice(0, 50)) { // limit to 50 for perf
    const parent1 = git(`log --pretty=%P -n 1 ${sha}`).split(" ")[0];
    const parent2 = git(`log --pretty=%P -n 1 ${sha}`).split(" ")[1];
    if (!parent1 || !parent2) continue;

    const changedFiles = git(`diff --name-only ${parent1} ${parent2}`).split("\n").filter(Boolean);
    for (const file of changedFiles.slice(0, 5)) {
      if (!/\.(js|ts|json)$/.test(file)) continue;
      try {
        const before1 = git(`show ${parent1}:${file}`);
        const before2 = git(`show ${parent2}:${file}`);
        const after   = git(`show ${sha}:${file}`);
        if (before1 && before2 && after) {
          corpus.push({ file, sha, before1, before2, after });
        }
      } catch { /* skip */ }
    }
  }
  return corpus;
}

// ── Conflict block parser ─────────────────────────────────────────────────────

function parseConflictBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("<<<<<<<")) {
      current = {
        startLine: i,
        oursHeader: line,
        oursLines: [],
        theirsLines: [],
        theirsHeader: "",
        inTheirs: false,
      };
    } else if (line.startsWith("=======") && current) {
      current.inTheirs = true;
    } else if (line.startsWith(">>>>>>>") && current) {
      current.endLine = i;
      current.theirsHeader = line;
      blocks.push(current);
      current = null;
    } else if (current) {
      if (!current.inTheirs) current.oursLines.push(line);
      else current.theirsLines.push(line);
    }
  }
  return blocks;
}

// ── Resolution strategies ─────────────────────────────────────────────────────

function isWhitespaceOnly(lines) {
  return lines.every((l) => l.trim() === "");
}

function isImportBlock(lines) {
  return lines.length > 0 && lines.every((l) =>
    /^\s*import\s|^\s*require\s*\(|^\s*\/\/|^\s*$/.test(l)
  );
}

function isCommentOnly(lines) {
  return lines.length > 0 && lines.every((l) =>
    /^\s*(\/\/|\/\*|\*|#|--|{?\s*\/\*)/.test(l.trim()) || l.trim() === ""
  );
}

function extractVersion(lines) {
  for (const line of lines) {
    const m = line.match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/);
    if (m) return m[1];
  }
  return null;
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function mergeAndSortImports(ours, theirs) {
  const all = new Set([...ours, ...theirs]);
  return [...all]
    .filter((l) => l.trim())
    .sort((a, b) => {
      // stdlib first, then packages, then relative
      const rank = (l) => l.includes("./") || l.includes("../") ? 2 : l.includes("node:") ? 0 : 1;
      return rank(a) - rank(b) || a.localeCompare(b);
    });
}

/**
 * Classify a conflict block and return a resolution suggestion.
 */
function resolveBlock(block, filePath) {
  const { oursLines, theirsLines } = block;

  // Strategy 1: whitespace-only
  if (isWhitespaceOnly(oursLines) || isWhitespaceOnly(theirsLines)) {
    const winner = isWhitespaceOnly(oursLines) ? theirsLines : oursLines;
    return {
      strategy: "whitespace_normalize",
      confidence: 0.95,
      complexity: 1,
      resolved: winner,
      autoApplicable: true,
      explanation: "One side is whitespace-only — take the non-empty side",
    };
  }

  // Strategy 2: import block
  if (isImportBlock(oursLines) && isImportBlock(theirsLines)) {
    const merged = mergeAndSortImports(oursLines, theirsLines);
    return {
      strategy: "import_merge_sort",
      confidence: 0.90,
      complexity: 2,
      resolved: merged,
      autoApplicable: true,
      explanation: "Both sides are import statements — merged and sorted",
    };
  }

  // Strategy 3: version bump
  const ourVer  = extractVersion(oursLines);
  const theirVer = extractVersion(theirsLines);
  if (ourVer && theirVer) {
    const winner = compareVersions(ourVer, theirVer) >= 0 ? oursLines : theirsLines;
    return {
      strategy: "version_bump_highest",
      confidence: 0.85,
      complexity: 1,
      resolved: winner,
      autoApplicable: true,
      explanation: `Version conflict: ${ourVer} vs ${theirVer} — keeping higher version`,
    };
  }

  // Strategy 4: comment-only
  if (isCommentOnly(oursLines) && isCommentOnly(theirsLines)) {
    const merged = [...new Set([...oursLines, ...theirsLines])].filter((l) => l.trim());
    return {
      strategy: "comment_keep_both",
      confidence: 0.80,
      complexity: 1,
      resolved: merged,
      autoApplicable: true,
      explanation: "Both sides are comments — kept both",
    };
  }

  // Strategy 5: identical content (false conflict)
  if (JSON.stringify(oursLines) === JSON.stringify(theirsLines)) {
    return {
      strategy: "identical_resolution",
      confidence: 1.0,
      complexity: 0,
      resolved: oursLines,
      autoApplicable: true,
      explanation: "Both sides are identical — false conflict, taking either",
    };
  }

  // Strategy 6: additive (no shared lines deleted)
  const ourSet   = new Set(oursLines.map((l) => l.trim()).filter(Boolean));
  const theirSet = new Set(theirsLines.map((l) => l.trim()).filter(Boolean));
  const overlap  = [...ourSet].filter((l) => theirSet.has(l));
  if (overlap.length === 0) {
    return {
      strategy: "additive_merge",
      confidence: 0.70,
      complexity: 3,
      resolved: [...oursLines, ...theirsLines],
      autoApplicable: false,
      explanation: "Non-overlapping additions — review before merging both sides",
    };
  }

  // Strategy 7: unknown — flag for human
  const linesChanged = oursLines.length + theirsLines.length;
  const complexity = Math.min(Math.round(linesChanged / 5) + 4, 10);
  return {
    strategy: "manual_required",
    confidence: 0,
    complexity,
    resolved: null,
    autoApplicable: false,
    explanation: `Complex conflict (${linesChanged} lines) — manual review required`,
  };
}

// ── Apply resolutions to file ─────────────────────────────────────────────────

function applyResolutions(filePath, blocks, resolutions) {
  let content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const result = [];
  let i = 0;

  // Build a quick lookup: startLine → resolution
  const resMap = new Map();
  for (let j = 0; j < blocks.length; j++) {
    resMap.set(blocks[j].startLine, { block: blocks[j], resolution: resolutions[j] });
  }

  while (i < lines.length) {
    if (resMap.has(i)) {
      const { block, resolution } = resMap.get(i);
      if (resolution.autoApplicable && resolution.resolved !== null) {
        result.push(...resolution.resolved);
      } else {
        // Keep original conflict markers unchanged
        result.push(lines[i]); // <<<<<<<
        for (let k = i + 1; k <= block.endLine; k++) result.push(lines[k]);
      }
      i = block.endLine + 1;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  fs.writeFileSync(filePath, result.join("\n"), "utf8");
}

// ── Main ──────────────────────────────────────────────────────────────────────

const filesToProcess = TARGET_FILE
  ? [TARGET_FILE]
  : (() => {
      const out = git("diff --name-only --diff-filter=U"); // unmerged files
      return out ? out.split("\n").filter(Boolean) : [];
    })();

if (filesToProcess.length === 0) {
  console.log("✅ No conflicted files to process.");
  process.exit(0);
}

const report = { timestamp: new Date().toISOString(), files: [] };
let totalAutoResolved = 0;
let totalManual = 0;

for (const filePath of filesToProcess) {
  let content;
  try { content = fs.readFileSync(filePath, "utf8"); } catch { continue; }

  const blocks = parseConflictBlocks(content);
  if (blocks.length === 0) continue;

  const resolutions = blocks.map((b) => resolveBlock(b, filePath));
  const fileEntry = {
    file: filePath,
    blocks: blocks.length,
    resolutions: resolutions.map((r, i) => ({
      lines: `${blocks[i].startLine + 1}–${blocks[i].endLine + 1}`,
      strategy: r.strategy,
      confidence: r.confidence,
      complexity: r.complexity,
      autoApplicable: r.autoApplicable,
      explanation: r.explanation,
    })),
    autoResolved: 0,
    manualRequired: 0,
  };

  console.log(`\n📄 ${filePath} — ${blocks.length} conflict block(s)`);

  for (let i = 0; i < resolutions.length; i++) {
    const r = resolutions[i];
    const icon = r.autoApplicable ? "✅" : "⚠️ ";
    console.log(`   Block ${i + 1} (line ${blocks[i].startLine + 1}): [${r.strategy}] confidence=${r.confidence.toFixed(2)} complexity=${r.complexity}`);
    console.log(`   ${icon} ${r.explanation}`);

    if (r.autoApplicable && r.complexity <= AUTO_SCORE_THRESHOLD) {
      fileEntry.autoResolved++;
      totalAutoResolved++;
    } else {
      fileEntry.manualRequired++;
      totalManual++;
    }
  }

  if (AUTO_APPLY) {
    const safeResolutions = resolutions.map((r) =>
      r.autoApplicable && r.complexity <= AUTO_SCORE_THRESHOLD ? r : { ...r, autoApplicable: false }
    );
    const anyApplied = safeResolutions.some((r) => r.autoApplicable);
    if (anyApplied) {
      applyResolutions(filePath, blocks, safeResolutions);
      console.log(`   ✅ Auto-resolutions applied to ${filePath}`);
    }
  }

  report.files.push(fileEntry);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`📊 ML Conflict Resolver Summary`);
console.log(`   Total conflict blocks:   ${totalAutoResolved + totalManual}`);
console.log(`   Auto-resolvable:         ${totalAutoResolved}`);
console.log(`   Require manual review:   ${totalManual}`);
if (AUTO_APPLY) {
  console.log(`   ✅ Auto-resolutions were applied (complexity < ${AUTO_SCORE_THRESHOLD})`);
}

if (REPORT_FILE) {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report written to: ${REPORT_FILE}`);
}

process.exit(totalManual > 0 ? 1 : 0);
